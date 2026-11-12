import { toID } from '@pkmn/dex';
import type { MetaPokemon, MetaSnapshot, Share, StatsTable } from '@vgc-helper/data';
import { z } from 'zod';
import { fetchText } from '../lib/http.js';

const STATS_ROOT = 'https://www.smogon.com/stats/';

/** How much of each list we keep. The full chaos file is about 16 MB per format. */
const LIMITS = { abilities: 5, items: 12, moves: 16, spreads: 10, teammates: 16 } as const;
/** Species below this usage share are dropped from the meta snapshot. */
const MIN_USAGE = 0.001;

const weightsSchema = z.record(z.string(), z.number());

const chaosSchema = z.object({
  info: z.object({
    metagame: z.string(),
    cutoff: z.number(),
    'number of battles': z.number(),
  }),
  data: z.record(
    z.string(),
    z.object({
      'Raw count': z.number(),
      usage: z.number(),
      Abilities: weightsSchema,
      Items: weightsSchema,
      Moves: weightsSchema,
      Spreads: weightsSchema,
      Teammates: weightsSchema,
    }),
  ),
});
type Chaos = z.infer<typeof chaosSchema>;

export async function listStatsMonths(): Promise<string[]> {
  const html = await fetchText(STATS_ROOT, { cache: false });
  if (!html) throw new Error('Smogon stats index not found');
  return [...html.matchAll(/href="(\d{4}-\d{2})\/"/g)]
    .map((m) => m[1] as string)
    .sort()
    .reverse();
}

function chaosUrl(month: string, statsId: string, cutoff: number): string {
  return `${STATS_ROOT}${month}/chaos/${statsId}-${cutoff}.json`;
}

/** Newest month that has a chaos file for this format, or null. */
export async function fetchLatestChaos(
  statsId: string,
  cutoff: number,
  months: string[],
): Promise<{ month: string; url: string; chaos: Chaos } | null> {
  for (const month of months.slice(0, 6)) {
    const url = chaosUrl(month, statsId, cutoff);
    const text = await fetchText(url);
    if (text) return { month, url, chaos: chaosSchema.parse(JSON.parse(text)) };
  }
  return null;
}

function topShares(weights: Record<string, number>, total: number, limit: number): Share[] {
  return Object.entries(weights)
    .filter(([key, w]) => key !== '' && key !== 'nothing' && w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, w]) => ({ id: toID(key), share: round(w / total) }));
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function parseSpread(key: string): { nature: string; spread: StatsTable } | null {
  const [nature, values] = key.split(':');
  const parts = values?.split('/').map(Number);
  if (!nature || !parts || parts.length !== 6 || parts.some((n) => !Number.isInteger(n)))
    return null;
  const [hp, atk, def, spa, spd, spe] = parts as [number, number, number, number, number, number];
  return { nature: toID(nature), spread: { hp, atk, def, spa, spd, spe } };
}

export function chaosToMeta(
  chaos: Chaos,
  ids: { formatId: string; regulationId: string; month: string; url: string },
  retrievedAt: string,
): MetaSnapshot {
  const pokemon: MetaPokemon[] = Object.entries(chaos.data)
    .filter(([, m]) => m.usage >= MIN_USAGE)
    .sort((a, b) => b[1].usage - a[1].usage)
    .map(([name, m]) => {
      const total = Object.values(m.Abilities).reduce((sum, w) => sum + w, 0) || 1;
      const spreads = Object.entries(m.Spreads)
        .sort((a, b) => b[1] - a[1])
        .slice(0, LIMITS.spreads)
        .flatMap(([key, w]) => {
          const parsed = parseSpread(key);
          return parsed ? [{ ...parsed, share: round(w / total) }] : [];
        });
      return {
        species: toID(name),
        usage: round(m.usage),
        rawCount: Math.round(m['Raw count']),
        abilities: topShares(m.Abilities, total, LIMITS.abilities),
        items: topShares(m.Items, total, LIMITS.items),
        moves: topShares(m.Moves, total, LIMITS.moves),
        spreads,
        teammates: topShares(m.Teammates, total, LIMITS.teammates),
      };
    });

  return {
    formatId: ids.formatId,
    regulationId: ids.regulationId,
    period: ids.month,
    ratingCutoff: chaos.info.cutoff,
    battles: Math.round(chaos.info['number of battles']),
    source: {
      name: `Smogon usage stats (${chaos.info.metagame}, ${ids.month}, rating ${chaos.info.cutoff}+)`,
      url: ids.url,
      retrievedAt,
    },
    pokemon,
    tournaments: null,
  };
}

/** Sum of usage over all species, before trimming. About the team size when the data is sound. */
export function totalUsage(chaos: Chaos): number {
  return Object.values(chaos.data).reduce((sum, m) => sum + m.usage, 0);
}
