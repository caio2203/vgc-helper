import type { Changelog, DexSnapshot, Manifest } from '@vgc-helper/data';
import { readManifest } from '@vgc-helper/data/node';
import type { TeamSlot } from '@vgc-helper/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { type DexIndex, indexDex, type RulesContext } from './context.js';
import { emptySlot } from './paste.js';
import { changesSince, needsAttention, revalidateTeam, type SavedTeam } from './revalidate.js';
import { loadContext } from './test-support/snapshot.js';

let manifest: Manifest;
let ctx: RulesContext;
let index: DexIndex;
beforeAll(async () => {
  manifest = await readManifest();
  ({ ctx, index } = await loadContext());
});

const slot = (patch: Partial<TeamSlot> & { species: string }): TeamSlot => ({
  ...emptySlot(patch.species),
  ...patch,
});

const team = (): SavedTeam => ({
  gameId: 'champions',
  formatId: 'champions-vgc',
  regulationId: 'M-C',
  snapshotVersion: '2026-10-01.old',
  slots: [
    slot({
      species: 'incineroar',
      item: 'sitrusberry',
      ability: 'intimidate',
      moves: ['fakeout', 'partingshot', 'flareblitz', 'protect'],
      nature: 'careful',
      spread: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
    }),
  ],
});

const at = { gameId: 'champions', regulationId: 'M-C' };
const ref = (id: string, name: string) => ({ id, name });

function history(current: string): Changelog {
  return {
    schemaVersion: 1,
    entries: [
      {
        version: current,
        previousVersion: '2026-10-01.old',
        generatedAt: '2026-11-12T07:23:00.000Z',
        warnings: [],
        changes: [
          {
            kind: 'learnset',
            ...at,
            species: ref('incineroar', 'Incineroar'),
            added: [ref('uturn', 'U-turn')],
            removed: [ref('partingshot', 'Parting Shot'), ref('knockoff', 'Knock Off')],
          },
          {
            kind: 'moveChanged',
            ...at,
            move: ref('protect', 'Protect'),
            field: 'maxPp',
            from: 16,
            to: 8,
          },
          {
            kind: 'moveChanged',
            ...at,
            move: ref('earthquake', 'Earthquake'),
            field: 'basePower',
            from: 100,
            to: 90,
          },
          {
            kind: 'dexEntries',
            ...at,
            list: 'species',
            added: [ref('pelipper', 'Pelipper')],
            removed: [ref('gengar', 'Gengar')],
          },
          { kind: 'overrides', added: ['x'], removed: [] },
        ],
      },
      {
        version: '2026-10-01.old',
        previousVersion: null,
        generatedAt: '2026-10-01T07:23:00.000Z',
        warnings: [],
        changes: [],
      },
    ],
  };
}

describe('revalidateTeam', () => {
  it('keeps only the changes that touch the team, and says the team is fine otherwise', () => {
    const result = revalidateTeam(team(), {
      manifest,
      changelog: history(manifest.version),
      rulesFor: () => ({ ctx, index }),
      now: Date.parse('2026-11-12T12:00:00Z'),
    });
    expect(result.upToDate).toBe(false);
    expect(result.historyKnown).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.changes.map((c) => c.change)).toEqual([
      {
        kind: 'learnset',
        ...at,
        species: ref('incineroar', 'Incineroar'),
        added: [],
        removed: [ref('partingshot', 'Parting Shot')],
      },
      {
        kind: 'moveChanged',
        ...at,
        move: ref('protect', 'Protect'),
        field: 'maxPp',
        from: 16,
        to: 8,
      },
    ]);
    expect(needsAttention(result)).toBe(true);
  });

  it('reports a move the current data no longer allows as an error', () => {
    const t = team();
    // The saved team kept a move the new learnset dropped (here: one it never had).
    (t.slots[0] as TeamSlot).moves = ['fakeout', 'spore', 'flareblitz', 'protect'];
    const result = revalidateTeam(t, {
      manifest,
      changelog: history(manifest.version),
      rulesFor: () => ({ ctx, index }),
    });
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'moveNotLearnable', move: 'spore', slot: 0 }),
    ]);
  });

  it('checks a team of an ended regulation against the one in force', () => {
    // A next regulation that drops Incineroar, on top of the committed data.
    const mc = manifest.regulations[0];
    if (!mc) throw new Error('no regulation');
    const md = {
      ...mc,
      id: 'M-D',
      name: 'Regulation Set M-D',
      startsAt: mc.endsAt ?? '',
      endsAt: null,
    };
    const next: Manifest = { ...manifest, regulations: [mc, md] };
    const dex: DexSnapshot = {
      ...ctx.dex,
      regulationId: 'M-D',
      species: ctx.dex.species.filter((s) => s.id !== 'incineroar'),
    };
    const result = revalidateTeam(team(), {
      manifest: next,
      changelog: { schemaVersion: 1, entries: [] },
      rulesFor: (id) =>
        id === 'M-D'
          ? { ctx: { ...ctx, dex, regulation: md }, index: indexDex(dex) }
          : { ctx, index },
      now: Date.parse('2026-12-05T00:00:00Z'),
    });
    expect(result.regulation.status).toBe('ended');
    expect(result.issues).toEqual([]);
    expect(result.inForce).toMatchObject({
      regulationId: 'M-D',
      issues: [{ code: 'unknownSpecies', species: 'incineroar', slot: 0 }],
    });
    expect(result.historyKnown).toBe(false);
  });

  it('has nothing to say about a team saved with the current data', () => {
    const t = { ...team(), snapshotVersion: manifest.version };
    const result = revalidateTeam(t, {
      manifest,
      changelog: history(manifest.version),
      rulesFor: () => ({ ctx, index }),
      now: Date.parse('2026-11-12T12:00:00Z'),
    });
    expect(result).toMatchObject({ upToDate: true, changes: [], issues: [] });
    expect(needsAttention(result)).toBe(false);
  });
});

describe('changesSince', () => {
  it('falls back to the build date for a version older than the history', () => {
    const log = history('2026-11-12.new');
    expect(changesSince(log, '2026-10-01.old').entries).toHaveLength(1);
    expect(changesSince(log, '2026-09-30.gone')).toMatchObject({ known: false });
    expect(changesSince(log, '2026-09-30.gone').entries).toHaveLength(2);
  });
});
