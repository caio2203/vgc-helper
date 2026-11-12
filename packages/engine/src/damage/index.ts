/**
 * Damage calculations through @smogon/calc, fed only with numbers from the data snapshot: species
 * stats and types, move power, type and category are passed as overrides, so a correction in
 * packages/data reaches the calc. A separate entry point because the calc is large: the web app
 * loads it on demand.
 */
import {
  Move as CalcMove,
  Pokemon as CalcPokemon,
  calculate,
  Field,
  Generations,
} from '@smogon/calc';
import type { AnalysisRules, MetaSnapshot, Move, Species, StatsTable } from '@vgc-helper/data';
import { commonSet, rankedMeta } from '../analysis/meta.js';
import { isDamaging, type ResolvedSlot } from '../analysis/resolve.js';
import type { DexIndex, RulesContext } from '../context.js';

/** A Pokémon as the calc needs it. */
export interface CalcSet {
  species: Species;
  ability: string | null;
  item: string | null;
  nature: string | null;
  spread: StatsTable;
  moves: Move[];
}

export interface FieldOptions {
  weather?: 'Sun' | 'Rain' | 'Sand' | 'Snow' | null;
  terrain?: 'Electric' | 'Grassy' | 'Psychic' | 'Misty' | null;
  /** Attacker's stat stages (Attack and Special Attack), e.g. -1 after Intimidate. */
  attackerBoost?: number;
  defenderBoost?: number;
  reflect?: boolean;
  lightScreen?: boolean;
  helpingHand?: boolean;
  critical?: boolean;
  /**
   * Roles from the analysis rules: when given, weather and terrain that either side's ability
   * sets on entry are applied (Drought, Psychic Surge), unless weather or terrain is passed.
   */
  autoField?: Pick<AnalysisRules, 'roles'>;
}

/** Weather and terrain the abilities of the two sides set, attacker first. */
export function abilityField(
  rules: Pick<AnalysisRules, 'roles'>,
  abilities: (string | null)[],
): { weather: FieldOptions['weather']; terrain: FieldOptions['terrain'] } {
  let weather: FieldOptions['weather'] = null;
  let terrain: FieldOptions['terrain'] = null;
  for (const ability of abilities) {
    if (!ability) continue;
    for (const role of rules.roles) {
      if (!role.sets || role.rule.kind !== 'list' || !role.rule.abilities.includes(ability))
        continue;
      weather ??= role.sets.weather;
      terrain ??= role.sets.terrain;
    }
  }
  return { weather, terrain };
}

export interface DamageResult {
  move: string;
  /** Damage as a share of the defender's max HP, in percent. */
  minPercent: number;
  maxPercent: number;
  minDamage: number;
  maxDamage: number;
  defenderHp: number;
  /** Hits needed with the lowest and highest roll. 0 when the move does no damage. */
  hitsWorst: number;
  hitsBest: number;
  description: string;
}

/** Champions uses the Stat Points model; the calc calls it generation 0. */
function generationFor(ctx: RulesContext) {
  return Generations.get(ctx.profile.statSystem.kind === 'statPoints' ? 0 : 9);
}

function toCalcPokemon(
  gen: ReturnType<typeof Generations.get>,
  set: CalcSet,
  ctx: RulesContext,
  index: DexIndex,
  boosts: number,
): CalcPokemon {
  const s = set.species;
  return new CalcPokemon(gen, s.name, {
    level: ctx.format.level,
    ability: set.ability ? index.abilities.get(set.ability)?.name : undefined,
    item: set.item ? index.items.get(set.item)?.name : undefined,
    nature: set.nature ? index.natures.get(set.nature)?.name : undefined,
    evs: set.spread,
    boosts: { atk: boosts, spa: boosts, def: 0, spd: 0, spe: 0, hp: 0 },
    overrides: {
      name: s.name,
      types: s.types as never,
      baseStats: s.baseStats,
      weightkg: s.weightkg,
    } as never,
  });
}

function toCalcMove(
  gen: ReturnType<typeof Generations.get>,
  move: Move,
  critical: boolean,
): CalcMove {
  return new CalcMove(gen, move.name, {
    isCrit: critical,
    overrides: {
      basePower: move.basePower,
      type: move.type as never,
      category: move.category,
      target: move.target as never,
    } as never,
  });
}

const percent = (n: number, hp: number) => Math.round((n / hp) * 1000) / 10;

export function calcDamage(
  attacker: CalcSet,
  defender: CalcSet,
  move: Move,
  ctx: RulesContext,
  index: DexIndex,
  options: FieldOptions = {},
): DamageResult {
  const gen = generationFor(ctx);
  const auto = options.autoField
    ? abilityField(options.autoField, [attacker.ability, defender.ability])
    : { weather: null, terrain: null };
  const field = new Field({
    gameType: ctx.format.gameType === 'doubles' ? 'Doubles' : 'Singles',
    weather: (options.weather === undefined ? auto.weather : options.weather) ?? undefined,
    terrain: (options.terrain === undefined ? auto.terrain : options.terrain) ?? undefined,
    defenderSide: { isReflect: options.reflect, isLightScreen: options.lightScreen },
    attackerSide: { isHelpingHand: options.helpingHand },
  });
  const a = toCalcPokemon(gen, attacker, ctx, index, options.attackerBoost ?? 0);
  const d = toCalcPokemon(gen, defender, ctx, index, options.defenderBoost ?? 0);
  const result = calculate(gen, a, d, toCalcMove(gen, move, options.critical ?? false), field);
  const [min, max] = result.range();
  const hp = d.maxHP();
  let description = '';
  try {
    description = result.desc();
  } catch {
    description = `${a.name} ${move.name} vs. ${d.name}: 0 damage`;
  }
  return {
    move: move.id,
    minPercent: percent(min, hp),
    maxPercent: percent(max, hp),
    minDamage: min,
    maxDamage: max,
    defenderHp: hp,
    hitsWorst: min > 0 ? Math.ceil(hp / min) : 0,
    hitsBest: max > 0 ? Math.ceil(hp / max) : 0,
    description,
  };
}

/** The attacker's damaging move that does the most, by its lowest roll. */
export function bestMove(
  attacker: CalcSet,
  defender: CalcSet,
  ctx: RulesContext,
  index: DexIndex,
  options: FieldOptions = {},
): DamageResult | null {
  let best: DamageResult | null = null;
  for (const move of attacker.moves.filter(isDamaging)) {
    const r = calcDamage(attacker, defender, move, ctx, index, options);
    if (!best || r.minPercent > best.minPercent) best = r;
  }
  return best && best.maxDamage > 0 ? best : null;
}

export interface ThreatMatchup {
  slot: number;
  /** The threat's best hit on this member. */
  taken: DamageResult | null;
  /** This member's best hit on the threat. */
  dealt: DamageResult | null;
  /** The member outspeeds the threat (both at their own speed, no field effects). */
  faster: boolean;
  answers: boolean;
}

export interface Threat {
  species: string;
  usage: number;
  set: CalcSet;
  matchups: ThreatMatchup[];
  /** Members the threat can knock out in one hit with its highest roll. */
  ohko: number[];
  answeredBy: number[];
}

function slotSet(s: ResolvedSlot, slots: { spread: StatsTable; nature: string | null }[]): CalcSet {
  const source = slots[s.slot];
  return {
    species: s.battle,
    ability: s.ability,
    item: s.item,
    nature: source?.nature ?? null,
    spread: source?.spread ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: s.moves,
  };
}

/**
 * Checks the most used meta Pokémon, with their most common sets, against the team. A member
 * answers a threat when it knocks it out in one hit and moves first, or knocks it out in two hits
 * and survives its best hit.
 */
export function analyzeThreats(
  team: ResolvedSlot[],
  slots: { spread: StatsTable; nature: string | null }[],
  ctx: RulesContext,
  index: DexIndex,
  meta: MetaSnapshot,
  rules: Pick<AnalysisRules, 'thresholds' | 'roles'>,
): Threat[] {
  const options: FieldOptions = { autoField: rules };
  const threats: Threat[] = [];
  for (const entry of rankedMeta(meta, index).slice(0, rules.thresholds.threatCount)) {
    const set = commonSet(entry, index);
    if (!set) continue;
    const threatSpeed = calcStatsFor(set, ctx, index).spe;
    const matchups = team.map((member) => {
      const mine = slotSet(member, slots);
      const taken = bestMove(set, mine, ctx, index, options);
      const dealt = bestMove(mine, set, ctx, index, options);
      const faster = member.stats.spe > threatSpeed;
      const answers =
        dealt !== null &&
        ((dealt.hitsWorst === 1 && faster) ||
          (dealt.hitsWorst > 0 && dealt.hitsWorst <= 2 && (taken?.hitsBest ?? 2) > 1));
      return { slot: member.slot, taken, dealt, faster, answers };
    });
    threats.push({
      species: set.species.id,
      usage: entry.usage,
      set,
      matchups,
      ohko: matchups.filter((m) => m.taken?.hitsBest === 1).map((m) => m.slot),
      answeredBy: matchups.filter((m) => m.answers).map((m) => m.slot),
    });
  }
  // Unanswered first, then by how many members fall in one hit, then by usage.
  return threats.sort(
    (a, b) =>
      Number(a.answeredBy.length > 0) - Number(b.answeredBy.length > 0) ||
      b.ohko.length - a.ohko.length ||
      b.usage - a.usage,
  );
}

function calcStatsFor(set: CalcSet, ctx: RulesContext, index: DexIndex): StatsTable {
  const gen = generationFor(ctx);
  return toCalcPokemon(gen, set, ctx, index, 0).stats;
}
