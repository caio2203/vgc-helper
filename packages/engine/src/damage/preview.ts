/**
 * Team preview: given your team and the opponent's team list, which members to bring and which to
 * lead. Every matchup is a damage calc both ways plus a speed check, scored with the weights of
 * the analysis profile, so each pick can be explained with the numbers behind it.
 */
import type { AnalysisProfile, AnalysisRules, MetaSnapshot, StatsTable } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import { commonSet } from '../analysis/meta.js';
import { analysisProfileFor, type ResolvedSlot, resolveSlots } from '../analysis/resolve.js';
import { findRoles } from '../analysis/roles.js';
import { type DexIndex, megaFormeFor, type RulesContext } from '../context.js';
import {
  bestMove,
  type CalcSet,
  calcStatsFor,
  type DamageResult,
  type FieldOptions,
  slotSet,
} from './calc.js';

/** Fields of an opponent's set that were not in their list and came from the usage data. */
export type AssumedField = 'ability' | 'item' | 'moves' | 'spread';

export interface PreviewMember {
  /** Position in its team, 0-based. */
  slot: number;
  set: CalcSet;
  /** Speed stat with the held item's multiplier (Choice Scarf), from the analysis rules. */
  speed: number;
  /** Empty for your own team. */
  assumed: AssumedField[];
}

export interface PreviewCell {
  mine: number;
  theirs: number;
  /** Your member's best hit on theirs. */
  dealt: DamageResult | null;
  /** Their best hit on your member. */
  taken: DamageResult | null;
  /** 1 when yours moves first, -1 when theirs does, 0 on a tie (items count, field effects do not). */
  speed: 1 | 0 | -1;
  /** Knocks it out in one hit and moves first, or in two hits and survives its best hit. */
  answers: boolean;
  /** Weighted offense, defense and speed of the matchup. */
  score: number;
}

export interface PreviewPlan {
  /** Members to bring, in team order. */
  bring: number[];
  /** The members of `bring` to lead with. */
  lead: number[];
  /** Coverage plus roles. */
  score: number;
  /** Sum over their members of the best matchup among the brought ones. */
  coverage: number;
  /** Sum of every matchup of the brought members: the tie-break between equal picks. */
  depth: number;
  /** Checklist groups the brought members fill. */
  roles: string[];
  /** Lead role groups the lead fills. */
  leadRoles: string[];
  leadScore: number;
  /** Their members none of the brought ones answers. */
  unanswered: number[];
}

export interface TeamPreview {
  mine: PreviewMember[];
  theirs: PreviewMember[];
  /** cells[mine][theirs], in the order of `mine` and `theirs`. */
  cells: PreviewCell[][];
  plans: PreviewPlan[];
  bringCount: number;
  leadCount: number;
}

/** Speed after the held item, e.g. 1.5× with Choice Scarf. */
const withItem = (speed: number, item: string | null, rules: Pick<AnalysisRules, 'speed'>) =>
  Math.floor(speed * (item ? (rules.speed.itemMultipliers[item] ?? 1) : 1));

const ZERO: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const hasSpread = (s: StatsTable) => Object.values(s).some((v) => v > 0);

/** Every way to pick `k` of `items`, in order. */
export function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items as [T, ...T[]];
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

/**
 * The opponent's list as calc sets. What the list leaves out (team lists show no spreads) comes
 * from the most common set in the usage data; a member holding its Mega Stone battles as the Mega.
 */
export function opponentSets(
  slots: TeamSlot[],
  ctx: RulesContext,
  index: DexIndex,
  meta: MetaSnapshot | null,
  speedRules: Pick<AnalysisRules, 'speed'>,
): PreviewMember[] {
  const out: PreviewMember[] = [];
  slots.forEach((slot, i) => {
    const species = index.species.get(slot.species);
    if (!species) return;
    const assumed: AssumedField[] = [];
    const mega = megaFormeFor(index, species.id, slot.item);
    const battle = mega ?? species;
    // Usage data lists Megas apart (Charizard-Mega-Y), so look the battle forme up first.
    const entry =
      meta?.pokemon.find((p) => p.species === battle.id) ??
      meta?.pokemon.find((p) => p.species === species.id);
    const common = entry ? commonSet(entry, index) : null;

    let ability = mega ? (mega.abilities[0] ?? null) : slot.ability;
    if (!ability) {
      ability = common?.ability ?? species.abilities[0] ?? null;
      assumed.push('ability');
    }
    let item = slot.item;
    if (!item && common?.item) {
      item = common.item;
      assumed.push('item');
    }
    let moves = slot.moves.flatMap((m) => index.moves.get(m) ?? []);
    if (moves.length === 0 && common) {
      moves = common.moves;
      assumed.push('moves');
    }
    let spread = slot.spread;
    let nature = slot.nature;
    if (!hasSpread(spread)) {
      spread = common?.spread ?? ZERO;
      nature = common?.nature ?? nature;
      assumed.push('spread');
    }
    const set: CalcSet = { species: battle, ability, item, nature, spread, moves };
    const speed = withItem(calcStatsFor(set, ctx, index).spe, set.item, speedRules);
    out.push({ slot: i, set, speed, assumed });
  });
  return out;
}

function cell(
  mine: PreviewMember,
  theirs: PreviewMember,
  ctx: RulesContext,
  index: DexIndex,
  weights: AnalysisProfile['preview'],
  options: FieldOptions,
): PreviewCell {
  const dealt = bestMove(mine.set, theirs.set, ctx, index, options);
  const taken = bestMove(theirs.set, mine.set, ctx, index, options);
  const speed = mine.speed > theirs.speed ? 1 : mine.speed < theirs.speed ? -1 : 0;
  const share = (r: DamageResult | null) =>
    r ? Math.min(1, (r.minPercent + r.maxPercent) / 200) : 0;
  const answers =
    dealt !== null &&
    ((dealt.hitsWorst === 1 && speed === 1) ||
      (dealt.hitsWorst > 0 && dealt.hitsWorst <= 2 && (taken?.hitsBest ?? 2) > 1));
  const score =
    weights.offense * share(dealt) +
    weights.defense * (1 - share(taken)) +
    (speed === 1 ? weights.speed : 0);
  return {
    mine: mine.slot,
    theirs: theirs.slot,
    dealt,
    taken,
    speed,
    answers,
    score: Math.round(score * 100) / 100,
  };
}

/** Role groups (of `wanted`) that at least one of `slots` fills. */
function groupsFilled(
  roles: Map<string, { slot: number }[]>,
  rules: Pick<AnalysisRules, 'roles'>,
  wanted: string[],
  slots: ReadonlySet<number>,
): string[] {
  return wanted.filter((group) =>
    rules.roles.some(
      (role) => role.group === group && (roles.get(role.id) ?? []).some((m) => slots.has(m.slot)),
    ),
  );
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Scores every pick of `format.pickCount` members (4 of 6 in VGC) by how well it covers each
 * opponent and the checklist groups it keeps, then the best lead for it (2 in Doubles, 1 in
 * Singles) by its pressure on their whole team and the lead roles it fills.
 */
export function teamPreview(
  mySlots: TeamSlot[],
  theirSlots: TeamSlot[],
  ctx: RulesContext,
  index: DexIndex,
  rules: AnalysisRules,
  meta: MetaSnapshot | null,
): TeamPreview {
  const profile = analysisProfileFor(rules, ctx);
  const weights = profile.preview;
  const options: FieldOptions = { autoField: rules };
  const resolved: ResolvedSlot[] = resolveSlots(mySlots, ctx, index);
  const mine: PreviewMember[] = resolved.map((r) => ({
    slot: r.slot,
    set: slotSet(r, mySlots),
    speed: withItem(r.stats.spe, r.item, rules),
    assumed: [],
  }));
  const theirs = opponentSets(theirSlots, ctx, index, meta, rules);
  const cells = mine.map((m) => theirs.map((t) => cell(m, t, ctx, index, weights, options)));

  const bringCount = Math.min(ctx.format.pickCount, mine.length);
  const leadCount = Math.min(ctx.format.gameType === 'doubles' ? 2 : 1, bringCount);
  const roles = findRoles(resolved, rules);
  const rowOf = new Map(mine.map((m, i) => [m.slot, i]));
  const best = (slots: number[], col: number) =>
    Math.max(0, ...slots.map((s) => cells[rowOf.get(s) ?? -1]?.[col]?.score ?? 0));

  const plans = combinations(
    mine.map((m) => m.slot),
    bringCount,
  ).map((bring): PreviewPlan => {
    const coverage = theirs.reduce((sum, _, col) => sum + best(bring, col), 0);
    const filled = groupsFilled(roles, rules, profile.checklist, new Set(bring));
    const leads = combinations(bring, leadCount).map((lead) => {
      const leadRoles = groupsFilled(roles, rules, weights.leadRoles, new Set(lead));
      const pressure = theirs.reduce((sum, _, col) => sum + best(lead, col), 0);
      return { lead, leadRoles, leadScore: round(pressure + weights.leadRole * leadRoles.length) };
    });
    leads.sort((a, b) => b.leadScore - a.leadScore);
    const top = leads[0] ?? { lead: [], leadRoles: [], leadScore: 0 };
    const unanswered = theirs
      .filter((_, col) => !bring.some((s) => cells[rowOf.get(s) ?? -1]?.[col]?.answers))
      .map((t) => t.slot);
    const depth = bring.reduce(
      (sum, s) => sum + (cells[rowOf.get(s) ?? -1] ?? []).reduce((a, c) => a + c.score, 0),
      0,
    );
    return {
      bring,
      ...top,
      score: round(coverage + weights.bringRole * filled.length),
      coverage: round(coverage),
      depth: round(depth),
      roles: filled,
      unanswered,
    };
  });
  // Ties go to the pick that answers more of their team, then to the one whose members do better
  // in every matchup, not only in the best one (a second answer when the first one goes down).
  plans.sort(
    (a, b) => b.score - a.score || a.unanswered.length - b.unanswered.length || b.depth - a.depth,
  );

  return {
    mine,
    theirs,
    cells,
    plans: plans.slice(0, weights.alternatives),
    bringCount,
    leadCount,
  };
}
