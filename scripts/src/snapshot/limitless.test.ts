import { describe, expect, it } from 'vitest';
import { aggregateTopCut, pickEvents, weekStart } from './limitless.js';

const team = (...ids: string[]) => ids.map((id) => ({ id, name: id }));

describe('Limitless top cut', () => {
  it('counts each species once per top-cut team and skips the rest', () => {
    const { teams, pokemon } = aggregateTopCut(
      [
        [
          { placing: 1, decklist: team('incineroar', 'garchomp', 'rotom-wash') },
          { placing: 2, decklist: team('incineroar', 'sneasler') },
          { placing: 9, decklist: team('pelipper') },
          { placing: null, decklist: team('pelipper') },
        ],
        [
          { placing: 1, decklist: null },
          { placing: 3, decklist: team('garchomp', 'garchomp') },
        ],
      ],
      8,
    );
    expect(teams).toBe(3);
    expect(pokemon).toEqual([
      { species: 'garchomp', teams: 2, share: 0.6667 },
      { species: 'incineroar', teams: 2, share: 0.6667 },
      { species: 'rotomwash', teams: 1, share: 0.3333 },
      { species: 'sneasler', teams: 1, share: 0.3333 },
    ]);
  });

  it('maps species ids through the curated aliases', () => {
    const { pokemon } = aggregateTopCut([[{ placing: 1, decklist: team('floette') }]], 8, {
      floette: 'floetteeternal',
    });
    expect(pokemon).toEqual([{ species: 'floetteeternal', teams: 1, share: 1 }]);
  });

  it('picks the largest tournaments of the format inside the window', () => {
    const config = {
      limitlessFormat: 'M-C',
      minPlayers: 32,
      topPlacings: 8,
      windowDays: 28,
      maxEvents: 2,
      aliases: {},
      note: 'test',
      source: { name: 'x', url: 'https://example.com', retrievedAt: '2026-11-01T00:00:00.000Z' },
    };
    const t = (id: string, date: string, players: number, format = 'M-C') => ({
      id,
      name: id,
      date: `${date}T12:00:00.000Z`,
      players,
      format,
    });
    const picked = pickEvents(
      [
        t('a', '2026-11-08', 100),
        t('b', '2026-11-09', 300), // after the window
        t('c', '2026-11-01', 20), // too small
        t('d', '2026-11-02', 64, 'M-B'),
        t('e', '2026-10-20', 80),
        t('f', '2026-10-21', 40),
      ],
      config,
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-11-09T00:00:00.000Z'),
    );
    expect(picked.map((e) => e.id)).toEqual(['a', 'e']);
  });

  it('ends the window on the Monday of the current week', () => {
    expect(weekStart(new Date('2026-11-12T15:00:00.000Z')).toISOString()).toBe(
      '2026-11-09T00:00:00.000Z',
    );
    expect(weekStart(new Date('2026-11-09T00:00:00.000Z')).toISOString()).toBe(
      '2026-11-09T00:00:00.000Z',
    );
    expect(weekStart(new Date('2026-11-15T23:59:00.000Z')).toISOString()).toBe(
      '2026-11-09T00:00:00.000Z',
    );
  });
});
