import type {
  DexSnapshot,
  Format,
  MetaSnapshot,
  Move,
  Regulation,
  Species,
} from '@vgc-helper/data';
import { describe, expect, it } from 'vitest';
import { diffSnapshots, type SnapshotSet, sanityProblems, settingDiff } from './diff.js';
import { renderReport } from './report.js';

const source = {
  name: 'test',
  url: 'https://example.com/',
  retrievedAt: '2026-11-01T00:00:00.000Z',
};
const stats = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };

function species(id: string, name: string, extra: Partial<Species> = {}): Species {
  return {
    id,
    name,
    num: 1,
    baseSpecies: name,
    forme: null,
    types: ['Normal'],
    baseStats: stats,
    abilities: ['intimidate'],
    weightkg: 10,
    tags: [],
    megaStone: null,
    selectable: true,
    ...extra,
  };
}

function move(id: string, name: string, extra: Partial<Move> = {}): Move {
  return {
    id,
    name,
    type: 'Normal',
    category: 'Status',
    basePower: 0,
    accuracy: true,
    basePp: 10,
    maxPp: 12,
    priority: 0,
    target: 'self',
    flags: [],
    shortDesc: '',
    ...extra,
  };
}

function dex(parts: Partial<DexSnapshot> = {}): DexSnapshot {
  return {
    gameId: 'champions',
    regulationId: 'M-C',
    source,
    types: ['Normal'],
    typeChart: {},
    natures: [{ id: 'hardy', name: 'Hardy', plus: null, minus: null }],
    species: [species('incineroar', 'Incineroar'), species('garchomp', 'Garchomp')],
    moves: [
      move('protect', 'Protect', { maxPp: 16 }),
      move('knockoff', 'Knock Off'),
      move('fakeout', 'Fake Out'),
    ],
    items: [{ id: 'leftovers', name: 'Leftovers', megaStone: null, shortDesc: '' }],
    abilities: [{ id: 'intimidate', name: 'Intimidate', shortDesc: '' }],
    learnsets: { incineroar: ['fakeout', 'knockoff', 'protect'], garchomp: ['protect'] },
    ...parts,
  };
}

const regulation: Regulation = {
  id: 'M-C',
  gameId: 'champions',
  name: 'Regulation Set M-C',
  startsAt: '2026-09-09T02:00:00.000Z',
  endsAt: '2026-12-02T01:59:00.000Z',
  dexMod: 'champions',
  formats: [
    {
      formatId: 'champions-vgc',
      showdownFormatId: 'x',
      smogonStatsId: 'x',
      tournaments: null,
      timer: null,
    },
  ],
  clauses: ['species', 'item'],
  bannedTags: [],
  bannedTiers: [],
  restrictedTags: [],
  bannedSpecies: [],
  bannedItems: [],
  bannedMoves: [],
  bannedAbilities: [],
  restrictedLimit: null,
  sources: [source],
  verifiedAt: source.retrievedAt,
};

const format = {
  id: 'champions-vgc',
  viability: { defaultCutoff: 0.04 },
} as Format;

function meta(period: string, usage: Record<string, number>): MetaSnapshot {
  return {
    formatId: 'champions-vgc',
    regulationId: 'M-C',
    period,
    ratingCutoff: 1630,
    battles: 50_000,
    source,
    tournaments: null,
    pokemon: Object.entries(usage).map(([id, share]) => ({
      species: id,
      usage: share,
      rawCount: 1,
      abilities: [],
      items: [],
      moves: [],
      spreads: [],
      teammates: [],
    })),
  };
}

function set(
  parts: Partial<SnapshotSet> & { dexSnapshot?: DexSnapshot; metaSnapshot?: MetaSnapshot },
): SnapshotSet {
  const { dexSnapshot = dex(), metaSnapshot, ...rest } = parts;
  return {
    mechanicsProfiles: [],
    formats: [format],
    regulations: [regulation],
    analysisRules: [],
    overridesApplied: [],
    dex: new Map([['champions/M-C', dexSnapshot]]),
    meta: new Map(metaSnapshot ? [['champions/M-C/champions-vgc', metaSnapshot]] : []),
    ...rest,
  };
}

const options = { usageMinDelta: 0.02, usageMaxEntries: 15 };

describe('diffSnapshots', () => {
  it('reports nothing for identical snapshots', () => {
    expect(diffSnapshots(set({}), set({}), options)).toEqual([]);
  });

  it('names a lost move, a new Mega and a PP change like a patch note', () => {
    const next = dex({
      species: [
        species('incineroar', 'Incineroar'),
        species('garchomp', 'Garchomp'),
        species('garchompmega', 'Garchomp-Mega', { megaStone: 'garchompite', selectable: false }),
      ],
      moves: [
        move('protect', 'Protect', { maxPp: 8 }),
        move('knockoff', 'Knock Off'),
        move('fakeout', 'Fake Out'),
      ],
      learnsets: { incineroar: ['fakeout', 'protect'], garchomp: ['protect'] },
    });
    const changes = diffSnapshots(set({}), set({ dexSnapshot: next }), options);
    expect(changes).toContainEqual({
      kind: 'dexEntries',
      gameId: 'champions',
      regulationId: 'M-C',
      list: 'megas',
      added: [{ id: 'garchompmega', name: 'Garchomp-Mega' }],
      removed: [],
    });
    expect(changes).toContainEqual({
      kind: 'moveChanged',
      gameId: 'champions',
      regulationId: 'M-C',
      move: { id: 'protect', name: 'Protect' },
      field: 'maxPp',
      from: 16,
      to: 8,
    });
    expect(changes).toContainEqual({
      kind: 'learnset',
      gameId: 'champions',
      regulationId: 'M-C',
      species: { id: 'incineroar', name: 'Incineroar' },
      added: [],
      removed: [{ id: 'knockoff', name: 'Knock Off' }],
    });
    // A Mega is listed once, as a Mega, not again as a new species.
    expect(changes.filter((c) => c.kind === 'dexEntries')).toHaveLength(1);
  });

  it('keeps the name of a removed species from the old dex', () => {
    const next = dex({ species: [species('incineroar', 'Incineroar')] });
    const [change] = diffSnapshots(set({}), set({ dexSnapshot: next }), options);
    expect(change).toMatchObject({
      kind: 'dexEntries',
      list: 'species',
      removed: [{ id: 'garchomp', name: 'Garchomp' }],
    });
  });

  it('detects a new regulation and new dates', () => {
    const md: Regulation = { ...regulation, id: 'M-D', name: 'Regulation Set M-D', endsAt: null };
    const extended = { ...regulation, endsAt: '2026-12-09T01:59:00.000Z' };
    const changes = diffSnapshots(set({}), set({ regulations: [extended, md] }), options);
    expect(changes).toContainEqual({
      kind: 'regulationDates',
      gameId: 'champions',
      regulationId: 'M-C',
      field: 'endsAt',
      from: '2026-12-02T01:59:00.000Z',
      to: '2026-12-09T01:59:00.000Z',
    });
    expect(changes).toContainEqual(
      expect.objectContaining({ kind: 'regulationAdded', regulationId: 'M-D', endsAt: null }),
    );
  });

  it('lists new bans with their names', () => {
    const next = { ...regulation, bannedItems: ['leftovers'] };
    const changes = diffSnapshots(set({}), set({ regulations: [next] }), options);
    expect(changes).toEqual([
      {
        kind: 'bans',
        gameId: 'champions',
        regulationId: 'M-C',
        list: 'items',
        added: [{ id: 'leftovers', name: 'Leftovers' }],
        removed: [],
      },
    ]);
  });

  it('keeps only usage moves of 2 points or more, or across the cutoff', () => {
    const before = meta('2026-09', { incineroar: 0.48, garchomp: 0.3, pelipper: 0.045 });
    const after = meta('2026-10', { incineroar: 0.41, garchomp: 0.31, pelipper: 0.035 });
    const [change] = diffSnapshots(
      set({ metaSnapshot: before }),
      set({ metaSnapshot: after }),
      options,
    );
    expect(change).toMatchObject({
      kind: 'usage',
      fromPeriod: '2026-09',
      toPeriod: '2026-10',
      entries: [
        { species: { id: 'incineroar', name: 'Incineroar' }, from: 0.48, to: 0.41 },
        { species: { id: 'pelipper', name: 'pelipper' }, from: 0.045, to: 0.035 },
      ],
    });
  });

  it('skips usage when the month and the numbers did not change', () => {
    const m = meta('2026-10', { incineroar: 0.41 });
    expect(diffSnapshots(set({ metaSnapshot: m }), set({ metaSnapshot: m }), options)).toEqual([]);
  });
});

describe('settingDiff', () => {
  it('lists leaf changes and skips notes and sources', () => {
    expect(
      settingDiff(
        { statusRules: { paralysis: 0.25 }, note: 'a', sources: [1] },
        { statusRules: { paralysis: 0.125 }, note: 'b', sources: [2] },
        new Set(['note', 'sources']),
      ),
    ).toEqual([{ path: 'statusRules.paralysis', from: 0.25, to: 0.125 }]);
  });

  it('lists a new section field by field and treats missing and null alike', () => {
    expect(
      settingDiff(
        { tournaments: null, timer: undefined },
        { tournaments: { minPlayers: 32, note: 'x' }, timer: null },
        new Set(['note']),
      ),
    ).toEqual([{ path: 'tournaments.minPlayers', from: null, to: 32 }]);
  });
});

describe('sanityProblems', () => {
  it('flags a species list that lost more than the allowed share', () => {
    const next = dex({ species: [species('incineroar', 'Incineroar')] });
    expect(sanityProblems(set({}), set({ dexSnapshot: next }), 0.3)).toEqual([
      'champions/M-C: the species list changed by 50% (0 added, 1 removed), more than 30%',
    ]);
    expect(sanityProblems(set({}), set({}), 0.3)).toEqual([]);
  });
});

describe('renderReport', () => {
  it('writes a readable PR body grouped by regulation', () => {
    const next = dex({
      moves: [
        move('protect', 'Protect', { maxPp: 8 }),
        move('knockoff', 'Knock Off'),
        move('fakeout', 'Fake Out'),
      ],
    });
    const changes = diffSnapshots(set({}), set({ dexSnapshot: next }), options);
    const body = renderReport({
      version: '2026-11-13.abc',
      previousVersion: '2026-11-12.def',
      generatedAt: '2026-11-13T07:23:00.000Z',
      changes,
      warnings: ['champions/M-C: only 900 battles'],
    });
    expect(body).toContain('## champions/M-C');
    expect(body).toContain('- Protect: maxPp `16` → `8`');
    expect(body).toContain('## Warnings');
    expect(body).toContain('compared with `2026-11-12.def`');
  });
});
