import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DexIndex, RulesContext } from '../context.js';
import { analyzeThreats, calcDamage } from '../damage/index.js';
import { emptySlot } from '../paste.js';
import { loadAnalysis } from '../test-support/snapshot.js';
import { analyzeTeam } from './analyze.js';
import { topCutByBase } from './meta.js';
import { resolveSlots } from './resolve.js';

let ctx: RulesContext;
let index: DexIndex;
let rules: AnalysisRules;
let meta: MetaSnapshot;
beforeAll(async () => {
  ({ ctx, index, rules, meta } = await loadAnalysis());
});

const slot = (patch: Partial<TeamSlot> & { species: string }): TeamSlot => ({
  ...emptySlot(patch.species),
  ...patch,
});
const OPTIONS = { cutoff: 0.04, offMeta: false };
const analyze = (slots: TeamSlot[]) => analyzeTeam(slots, ctx, index, rules, meta, OPTIONS);

const incineroar = slot({
  species: 'incineroar',
  item: 'sitrusberry',
  ability: 'intimidate',
  moves: ['fakeout', 'partingshot', 'flareblitz', 'protect'],
  nature: 'careful',
  spread: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
});
const kingambit = slot({
  species: 'kingambit',
  item: 'blackglasses',
  ability: 'defiant',
  moves: ['kowtowcleave', 'suckerpunch', 'ironhead', 'protect'],
  nature: 'adamant',
  spread: { hp: 32, atk: 32, def: 0, spa: 0, spd: 2, spe: 0 },
});
const archaludon = slot({
  species: 'archaludon',
  item: 'leftovers',
  ability: 'stamina',
  moves: ['electroshot', 'dracometeor', 'flashcannon', 'protect'],
  nature: 'modest',
  spread: { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0 },
});

describe('type matrix', () => {
  it('flags three members weak to Ground and names the slot that stacked it', () => {
    const a = analyze([incineroar, kingambit, archaludon]);
    expect(a.types.stacked).toContain('Ground');
    const ground = a.stacked.find((s) => s.type === 'Ground');
    expect(ground?.slots).toEqual([0, 1, 2]);
    expect(ground?.addedBy).toBe(2);
    // Garchomp is in the top of the Reg M-C meta and its common set has Earthquake.
    expect(ground?.users.map((u) => u.species)).toContain('garchomp');
  });

  it('applies abilities: Levitate makes Rotom-Wash immune to Ground', () => {
    const a = analyze([slot({ species: 'rotomwash', ability: 'levitate' })]);
    const ground = a.types.rows.find((r) => r.type === 'Ground');
    expect(ground?.immune).toEqual([0]);
    expect(ground?.multipliers[0]?.byAbility).toBe(true);
  });

  it('recommends types that resist every stacked weakness first', () => {
    const a = analyze([incineroar, kingambit, archaludon]);
    // Ground and Fighting stack here; Flying and Bug take less from both.
    expect(a.types.stacked).toEqual(expect.arrayContaining(['Ground', 'Fighting']));
    const both = a.recommendedTypes.filter((t) => t.covers === a.types.stacked.length);
    expect(both.map((t) => t.type)).toEqual(expect.arrayContaining(['Bug', 'Flying']));
  });
});

describe('role checklist and archetypes', () => {
  it('finds Fake Out, Intimidate, pivot and Protect, and lists what is missing', () => {
    const a = analyze([incineroar, kingambit]);
    const filled = a.checklist.groups.filter((g) => g.filled).map((g) => g.group);
    expect(filled).toEqual(expect.arrayContaining(['fakeOut', 'intimidate', 'pivot', 'protect']));
    expect(a.checklist.missing).toEqual(expect.arrayContaining(['speedControl', 'redirection']));
    // Kingambit's Defiant answers Intimidate.
    expect(filled).toContain('intimidateAnswer');
  });

  it('spots a Trick Room team with only one setter', () => {
    const hatterene = slot({ species: 'hatterene', moves: ['trickroom', 'dazzlinggleam'] });
    const a = analyze([hatterene, kingambit, slot({ species: 'torkoal' })]);
    const tr = a.archetypes.find((x) => x.id === 'trickRoom');
    expect(tr?.setters).toEqual([0]);
    expect(tr?.missing.setters).toBe(1);
  });

  it('does not call a team Tailwind without a Tailwind setter', () => {
    const a = analyze([incineroar, kingambit, archaludon]);
    expect(a.archetypes.map((x) => x.id)).not.toContain('tailwind');
  });
});

describe('speed tiers', () => {
  it('puts the team and the meta on one ruler, fastest first', () => {
    const a = analyze([incineroar]);
    const ticks = a.speed.ticks;
    expect(ticks.some((t) => t.source === 'meta')).toBe(true);
    expect(ticks.every((t, i) => i === 0 || (ticks[i - 1]?.speed ?? 0) >= t.speed)).toBe(true);
    // Base 60, 0 SP, Careful: 60 + 20 = 80.
    const mine = ticks.find((t) => t.source === 'team');
    expect(mine?.speed).toBe(80);
    expect(mine?.tailwind).toBe(160);
  });
});

describe('suggestions', () => {
  it('ranks legal meta Pokémon that cover the stacked Ground weakness, with an explained score', () => {
    const a = analyze([incineroar, kingambit, archaludon]);
    expect(a.suggestions.length).toBeGreaterThan(0);
    const first = a.suggestions[0];
    const covers = first?.parts.find((p) => p.criterion === 'coversWeakness');
    expect(covers && 'types' in covers ? covers.types : []).toContain('Ground');
    // Never a species already on the team, never below the cutoff outside off-meta mode.
    for (const s of a.suggestions) {
      expect(['incineroar', 'kingambit', 'archaludon']).not.toContain(s.species.id);
      expect(s.usage).toBeGreaterThanOrEqual(OPTIONS.cutoff);
      expect(s.score).toBeCloseTo(
        s.parts.reduce((sum, p) => sum + p.points, 0),
        5,
      );
    }
  });

  it('keeps the Item Clause in the suggested set', () => {
    const a = analyze([incineroar, kingambit, archaludon]);
    for (const s of a.suggestions) {
      expect(['sitrusberry', 'blackglasses', 'leftovers']).not.toContain(s.set.item);
    }
  });
});

describe('damage and threats', () => {
  it('matches the Champions damage formula through @smogon/calc', () => {
    const team = resolveSlots([incineroar], ctx, index);
    const garchomp = index.species.get('garchomp');
    const earthquake = index.moves.get('earthquake');
    if (!garchomp || !earthquake || !team[0]) throw new Error('missing data');
    const r = calcDamage(
      {
        species: garchomp,
        ability: 'roughskin',
        item: null,
        nature: 'jolly',
        spread: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
        moves: [earthquake],
      },
      {
        species: team[0].battle,
        ability: 'intimidate',
        item: null,
        nature: 'careful',
        spread: incineroar.spread,
        moves: [],
      },
      earthquake,
      ctx,
      index,
    );
    // Spread move in Doubles (×0.75): 138–164 on 202 HP, as on the public calc.
    expect([r.minDamage, r.maxDamage, r.defenderHp]).toEqual([138, 164, 202]);
    expect(r.hitsWorst).toBe(2);
  });

  it('lists meta threats with the members they knock out and who answers them', () => {
    const slots = [incineroar, kingambit, archaludon];
    const team = resolveSlots(slots, ctx, index);
    const threats = analyzeThreats(team, slots, ctx, index, meta, rules);
    expect(threats.length).toBe(rules.thresholds.threatCount);
    const garchomp = threats.find((t) => t.species === 'garchomp');
    expect(garchomp?.matchups).toHaveLength(3);
    // Unanswered threats come first.
    const firstAnswered = threats.findIndex((t) => t.answeredBy.length > 0);
    if (firstAnswered > 0) expect(threats[firstAnswered - 1]?.answeredBy).toEqual([]);
  });
});

describe('weather from abilities', () => {
  it('applies the sun Drought sets to Charizard-Mega-Y', () => {
    const team = resolveSlots([incineroar], ctx, index);
    const zard = index.species.get('charizardmegay');
    const heatWave = index.moves.get('heatwave');
    if (!zard || !heatWave || !team[0]) throw new Error('missing data');
    const attacker = {
      species: zard,
      ability: 'drought',
      item: null,
      nature: 'modest',
      spread: { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
      moves: [heatWave],
    };
    const defender = { ...attacker, species: team[0].battle, ability: 'intimidate' };
    const plain = calcDamage(attacker, defender, heatWave, ctx, index);
    const sunny = calcDamage(attacker, defender, heatWave, ctx, index, { autoField: rules });
    expect(sunny.minDamage).toBeGreaterThan(plain.minDamage);
    expect(sunny.description).toContain('Sun');
  });
});

describe('suggested slots', () => {
  it('are legal to add, Mega sets included', async () => {
    const { checkLegality } = await import('../legality.js');
    const a = analyze([incineroar, kingambit, archaludon]);
    for (const s of a.suggestions) {
      const errors = checkLegality([s.slot], ctx, index).filter((i) => i.severity === 'error');
      expect(errors, s.species.id).toEqual([]);
    }
  });
});

describe('covering a stacked weakness', () => {
  it('names the member that resists it once one is added', () => {
    const before = analyze([incineroar, kingambit, archaludon]);
    const pick = before.suggestions.find((s) =>
      s.parts.some((p) => p.criterion === 'coversWeakness' && p.types.includes('Ground')),
    );
    if (!pick) throw new Error('no suggestion covers Ground');
    expect(before.stacked.find((s) => s.type === 'Ground')?.coveredBy).toEqual([]);
    const after = analyze([incineroar, kingambit, archaludon, pick.slot]);
    expect(after.stacked.find((s) => s.type === 'Ground')?.coveredBy).toEqual([3]);
  });
});

describe('top-cut bonus', () => {
  const withTopCut = (pokemon: { species: string; teams: number; share: number }[]) => ({
    ...meta,
    tournaments: {
      source: {
        name: 'Limitless (test)',
        url: 'https://play.limitlesstcg.com/tournaments/completed',
        retrievedAt: '2026-11-09T00:00:00.000Z',
      },
      from: '2026-10-12',
      to: '2026-11-09',
      minPlayers: 32,
      topPlacings: 8,
      events: [{ id: 'a', name: 'Test', date: '2026-11-01T12:00:00.000Z', players: 64 }],
      teams: 10,
      pokemon,
    },
  });

  it('adds points scaled by the top-cut share against the most common species', () => {
    const plain = analyze([incineroar, kingambit, archaludon]).suggestions;
    const [target, other] = plain;
    if (!target || !other) throw new Error('not enough suggestions');
    const id = target.species.id;
    const a = analyzeTeam(
      [incineroar, kingambit, archaludon],
      ctx,
      index,
      rules,
      withTopCut([
        { species: id, teams: 5, share: 0.5 },
        { species: other.species.id, teams: 10, share: 1 },
      ]),
      OPTIONS,
    );
    const s = a.suggestions.find((x) => x.species.id === id);
    const part = s?.parts.find((p) => p.criterion === 'topCut');
    const weight = rules.profiles.find((p) => p.id === 'doubles')?.weights.topCut ?? 0;
    expect(part).toEqual({
      criterion: 'topCut',
      points: Math.round(0.5 * weight * 100) / 100,
      share: 0.5,
      teams: 10,
      events: 1,
    });
  });

  it('sums the Megas into the base species', () => {
    const shares = topCutByBase(
      withTopCut([
        { species: 'charizard', teams: 2, share: 0.2 },
        { species: 'charizardmegay', teams: 1, share: 0.1 },
      ]),
      index,
    );
    expect(shares.get('charizard')).toBeCloseTo(0.3, 5);
    expect(shares.has('charizardmegay')).toBe(false);
  });

  it('has no top-cut part without tournament data', () => {
    const a = analyzeTeam(
      [incineroar, kingambit, archaludon],
      ctx,
      index,
      rules,
      {
        ...meta,
        tournaments: null,
      },
      OPTIONS,
    );
    for (const s of a.suggestions) {
      expect(s.parts.some((p) => p.criterion === 'topCut')).toBe(false);
    }
  });
});
