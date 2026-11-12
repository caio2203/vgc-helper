import { z } from 'zod';
import { idSchema, shareSchema, sourceRefSchema, statsTableSchema } from './common.js';

export const metaSpreadSchema = z.object({
  nature: idSchema,
  spread: statsTableSchema,
  share: z.number().min(0).max(1),
});
export type MetaSpread = z.infer<typeof metaSpreadSchema>;

export const metaPokemonSchema = z.object({
  species: idSchema,
  /** Share of teams that carry this species (0–1). */
  usage: z.number().min(0).max(1),
  rawCount: z.int().min(0),
  /** Shares are relative to this species' sets. Moves add up to about 4, the rest to about 1. */
  abilities: z.array(shareSchema),
  items: z.array(shareSchema),
  moves: z.array(shareSchema),
  spreads: z.array(metaSpreadSchema),
  teammates: z.array(shareSchema),
});
export type MetaPokemon = z.infer<typeof metaPokemonSchema>;

export const topCutPokemonSchema = z.object({
  species: idSchema,
  /** Top-cut teams that carry this species. */
  teams: z.int().min(1),
  /** `teams` over all counted top-cut teams (0–1). */
  share: z.number().min(0).max(1),
});
export type TopCutPokemon = z.infer<typeof topCutPokemonSchema>;

/** How often species reach the top cut of recent tournaments. Only counts, no player data. */
export const tournamentSummarySchema = z.object({
  source: sourceRefSchema,
  /** Tournaments from `from` (inclusive) to `to` (exclusive), ISO dates. */
  from: z.iso.date(),
  to: z.iso.date(),
  minPlayers: z.int().min(2),
  topPlacings: z.int().min(1),
  /** Tournaments counted, largest first. */
  events: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      date: z.iso.datetime(),
      players: z.int().min(0),
    }),
  ),
  /** Top-cut teams with a team list. */
  teams: z.int().min(0),
  pokemon: z.array(topCutPokemonSchema),
});
export type TournamentSummary = z.infer<typeof tournamentSummarySchema>;

export const metaSnapshotSchema = z.object({
  formatId: z.string().min(1),
  regulationId: z.string().min(1),
  /** Calendar month of the data, e.g. 2026-10. */
  period: z.string().regex(/^\d{4}-\d{2}$/),
  ratingCutoff: z.int().min(0),
  battles: z.int().min(0),
  source: sourceRefSchema,
  pokemon: z.array(metaPokemonSchema),
  /** Top-cut presence in recent tournaments, when the format has a tournament source. */
  tournaments: tournamentSummarySchema.nullable().default(null),
});
export type MetaSnapshot = z.infer<typeof metaSnapshotSchema>;
