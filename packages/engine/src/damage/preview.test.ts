import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DexIndex, RulesContext } from '../context.js';
import { emptySlot } from '../paste.js';
import { loadAnalysis } from '../test-support/snapshot.js';
import { combinations, opponentSets, teamPreview } from './preview.js';

let ctx: RulesContext;
let index: DexIndex;
let rules: AnalysisRules;
let meta: MetaSnapshot;
beforeAll(async () => {
  ({ ctx, index, rules, meta } = await loadAnalysis());
});

/** The most common set of a meta Pokémon, as a team slot. */
function metaSlot(species: string, patch: Partial<TeamSlot> = {}): TeamSlot {
  const entry = meta.pokemon.find((p) => p.species === species);
  if (!entry) throw new Error(`${species} is not in the usage data`);
  const spread = entry.spreads[0];
  return {
    ...emptySlot(species),
    item: entry.items[0]?.id ?? null,
    ability: entry.abilities[0]?.id ?? null,
    moves: entry.moves.slice(0, 4).map((m) => m.id),
    nature: spread?.nature ?? null,
    spread: spread?.spread ?? emptySlot(species).spread,
    ...patch,
  };
}

/** A team list as the opponent shows it: no spread, no nature. */
const listed = (species: string, patch: Partial<TeamSlot> = {}): TeamSlot => {
  const s = metaSlot(species, patch);
  return { ...s, nature: null, spread: emptySlot(species).spread };
};

const myTeam = () => [
  metaSlot('basculegion'),
  metaSlot('kingambit'),
  metaSlot('archaludon'),
  metaSlot('whimsicott'),
  metaSlot('farigiraf'),
  metaSlot('sneasler'),
];

const fireTeam = () => [
  listed('charizardmegay', { species: 'charizard' }),
  listed('incineroar'),
  listed('volcarona'),
  listed('rillaboom'),
  listed('indeedeef'),
  listed('gholdengo'),
];

describe('combinations', () => {
  it('lists every pick once', () => {
    expect(combinations([0, 1, 2, 3, 4, 5], 4)).toHaveLength(15);
    expect(combinations([0, 1, 2], 2)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });
});

describe('opponentSets', () => {
  it('fills a bare team list from the usage data and Mega Evolves a stone holder', () => {
    const [charizard, garchomp] = opponentSets(
      [listed('charizardmegay', { species: 'charizard' }), emptySlot('garchomp')],
      ctx,
      index,
      meta,
      rules,
    );
    expect(charizard?.set.species.id).toBe('charizardmegay');
    expect(charizard?.assumed).toEqual(['spread']);
    expect(garchomp?.assumed).toEqual(['ability', 'item', 'moves', 'spread']);
    expect(garchomp?.set.moves.length).toBeGreaterThan(0);
  });
});

describe('teamPreview', () => {
  it('brings 4 and leads with 2 of them in VGC, best pick first', () => {
    const preview = teamPreview(myTeam(), fireTeam(), ctx, index, rules, meta);
    expect(preview.bringCount).toBe(4);
    expect(preview.leadCount).toBe(2);
    expect(preview.cells).toHaveLength(6);
    expect(preview.cells[0]).toHaveLength(6);
    expect(preview.plans).toHaveLength(rules.profiles[0]?.preview.alternatives ?? 3);
    const scores = preview.plans.map((p) => p.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const plan of preview.plans) {
      expect(new Set(plan.bring).size).toBe(4);
      expect(plan.lead.every((s) => plan.bring.includes(s))).toBe(true);
      expect(plan.lead).toHaveLength(2);
    }
  });

  it('finds the answers a player would name and leaves the weakest member home', () => {
    const preview = teamPreview(myTeam(), fireTeam(), ctx, index, rules, meta);
    // Kingambit knocks out Indeedee-F with Kowtow Cleave; Sneasler's Close Combat beats Incineroar.
    expect(preview.cells[1]?.[4]?.answers).toBe(true);
    expect(preview.cells[5]?.[1]?.answers).toBe(true);
    const [best] = preview.plans;
    expect(best?.bring).toEqual(expect.arrayContaining([1, 5]));
    // Farigiraf answers none of them and has the lowest matchups: it stays home.
    expect(preview.cells[4]?.some((c) => c.answers)).toBe(false);
    expect(best?.bring).not.toContain(4);
  });

  it('applies the sun of a Mega Charizard Y from the list to Water attacks', () => {
    const preview = teamPreview(myTeam(), fireTeam(), ctx, index, rules, meta);
    const charizard = preview.theirs[0];
    expect(charizard?.set.species.id).toBe('charizardmegay');
    expect(charizard?.assumed).toEqual(['spread']);
    // Basculegion is faster with Choice Scarf, but its Water moves are halved in the sun.
    const vsCharizard = preview.cells[0]?.[0];
    expect(vsCharizard?.speed).toBe(1);
    expect(vsCharizard?.answers).toBe(false);
  });

  it('keeps a lead role: the best lead fills Fake Out or speed control', () => {
    const preview = teamPreview(myTeam(), fireTeam(), ctx, index, rules, meta);
    expect(preview.plans[0]?.leadRoles.length).toBeGreaterThan(0);
  });

  it('brings 3 and leads with 1 in Singles', async () => {
    const singles = await loadAnalysis('champions-singles');
    const preview = teamPreview(
      myTeam(),
      fireTeam(),
      singles.ctx,
      singles.index,
      singles.rules,
      singles.meta,
    );
    expect(preview.bringCount).toBe(3);
    expect(preview.plans[0]?.bring).toHaveLength(3);
    expect(preview.plans[0]?.lead).toHaveLength(1);
  });
});
