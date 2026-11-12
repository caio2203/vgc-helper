import { toID } from '@pkmn/dex';
import type { RegulationFormat, TournamentSummary } from '@vgc-helper/data';
import { z } from 'zod';
import { fetchText } from '../lib/http.js';

/**
 * Top-cut presence from the Limitless public API (no key, 50 requests per 5 minutes). Only species
 * counts leave this file: player names, countries and records are dropped by the schemas below.
 */
const API = 'https://play.limitlesstcg.com/api';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Pages of the tournament list read at most (newest first). */
const MAX_PAGES = 5;
const PAGE_SIZE = 200;

type TournamentConfig = NonNullable<RegulationFormat['tournaments']>;

const listSchema = z.array(
  z.object({
    id: z.string().regex(/^[a-z0-9]+$/),
    format: z.string().nullable(),
    name: z.string().min(1),
    date: z.iso.datetime(),
    players: z.int().min(0),
  }),
);
type ListedTournament = z.infer<typeof listSchema>[number];

const standingsSchema = z.array(
  z.object({
    placing: z.int().nullable(),
    /** `id` follows Showdown with dashes (arcanine-hisui); `name` is for display (Hisuian Arcanine). */
    decklist: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).nullable(),
  }),
);
export type Standings = z.infer<typeof standingsSchema>;

/** Monday 00:00 UTC of the week `now` is in, so the data changes once a week. */
export function weekStart(now: Date): Date {
  const day = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** Counts each species once per top-cut team. Teams without a team list are skipped. */
export function aggregateTopCut(
  standings: Standings[],
  topPlacings: number,
  aliases: Record<string, string> = {},
): { teams: number; pokemon: TournamentSummary['pokemon'] } {
  const counts = new Map<string, number>();
  let teams = 0;
  for (const event of standings) {
    for (const entry of event) {
      if (entry.placing === null || entry.placing > topPlacings || !entry.decklist?.length)
        continue;
      teams += 1;
      for (const id of new Set(
        entry.decklist.map((p) => {
          const id = toID(p.id);
          return aliases[id] ?? id;
        }),
      )) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }
  const pokemon = [...counts]
    .map(([species, n]) => ({ species, teams: n, share: round(n / Math.max(1, teams)) }))
    .sort((a, b) => b.teams - a.teams || a.species.localeCompare(b.species));
  return { teams, pokemon };
}

/** The largest tournaments of the format in the window. */
export function pickEvents(
  listed: ListedTournament[],
  config: TournamentConfig,
  from: Date,
  to: Date,
): ListedTournament[] {
  return listed
    .filter((t) => {
      const date = Date.parse(t.date);
      return (
        t.format === config.limitlessFormat &&
        t.players >= config.minPlayers &&
        date >= from.getTime() &&
        date < to.getTime()
      );
    })
    .sort((a, b) => b.players - a.players || a.date.localeCompare(b.date))
    .slice(0, config.maxEvents);
}

async function listTournaments(format: string, from: Date): Promise<ListedTournament[]> {
  const out: ListedTournament[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      game: 'VGC',
      format,
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    const text = await fetchText(`${API}/tournaments?${params}`, { cache: false });
    const items = text ? listSchema.parse(JSON.parse(text)) : [];
    out.push(...items);
    const oldest = items.at(-1);
    if (items.length < PAGE_SIZE || !oldest || Date.parse(oldest.date) < from.getTime()) break;
  }
  return out;
}

export async function fetchTopCut(
  config: TournamentConfig,
  now: Date,
  retrievedAt: string,
): Promise<TournamentSummary> {
  const to = weekStart(now);
  const from = new Date(to.getTime() - config.windowDays * DAY_MS);
  const events = pickEvents(await listTournaments(config.limitlessFormat, from), config, from, to);
  const standings: Standings[] = [];
  for (const event of events) {
    // Finished tournaments do not change, so their standings are cached for local reruns.
    const text = await fetchText(`${API}/tournaments/${event.id}/standings`);
    standings.push(text ? standingsSchema.parse(JSON.parse(text)) : []);
  }
  const { teams, pokemon } = aggregateTopCut(standings, config.topPlacings, config.aliases);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);
  return {
    source: {
      name: `Limitless (${config.limitlessFormat}, ${events.length} tournaments with ${config.minPlayers}+ players, top ${config.topPlacings}, ${fromDate} to ${toDate})`,
      url: `https://play.limitlesstcg.com/tournaments/completed?game=VGC&format=${encodeURIComponent(config.limitlessFormat)}`,
      retrievedAt,
    },
    from: fromDate,
    to: toDate,
    minPlayers: config.minPlayers,
    topPlacings: config.topPlacings,
    events: events.map((e) => ({ id: e.id, name: e.name, date: e.date, players: e.players })),
    teams,
    pokemon,
  };
}
