import { z } from 'zod';

export const statsTableSchema = z.object({
  hp: z.int().min(0),
  atk: z.int().min(0),
  def: z.int().min(0),
  spa: z.int().min(0),
  spd: z.int().min(0),
  spe: z.int().min(0),
});
export type StatsTable = z.infer<typeof statsTableSchema>;

export const MAX_TEAM_SIZE = 6;
export const MAX_MOVES = 4;

/**
 * One team member. Ids follow the Showdown convention (lowercase, no spaces).
 * `spread` holds Stat Points or EVs, depending on the game's mechanics profile.
 * `ivs` is null when the profile fixes IVs (Pokémon Champions).
 */
export const teamSlotSchema = z.object({
  species: z.string().min(1),
  item: z.string().min(1).nullable(),
  ability: z.string().min(1).nullable(),
  moves: z.array(z.string().min(1)).max(MAX_MOVES),
  nature: z.string().min(1).nullable(),
  spread: statsTableSchema,
  ivs: statsTableSchema.nullable(),
  mega: z.boolean(),
  teraType: z.string().min(1).nullable(),
  notes: z.string().max(2000),
});
export type TeamSlot = z.infer<typeof teamSlotSchema>;

export const teamInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  gameId: z.string().min(1),
  formatId: z.string().min(1),
  regulationId: z.string().min(1),
  snapshotVersion: z.string().min(1),
  slots: z.array(teamSlotSchema).max(MAX_TEAM_SIZE),
  notes: z.string().max(5000),
});
export type TeamInput = z.infer<typeof teamInputSchema>;

export const teamSchema = teamInputSchema.extend({
  id: z.string(),
  version: z.int().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Team = z.infer<typeof teamSchema>;

/** Saving needs the version the client last saw, so two tabs cannot overwrite each other silently. */
export const teamUpdateSchema = teamInputSchema.extend({
  expectedVersion: z.int().min(1),
});
export type TeamUpdate = z.infer<typeof teamUpdateSchema>;

export const teamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  gameId: z.string(),
  formatId: z.string(),
  regulationId: z.string(),
  snapshotVersion: z.string(),
  species: z.array(z.string()),
  /** The full slots, so the list can revalidate each team against the current data. */
  slots: z.array(teamSlotSchema),
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
});
export type TeamSummary = z.infer<typeof teamSummarySchema>;

export const teamVersionSummarySchema = z.object({
  version: z.int().min(1),
  snapshotVersion: z.string(),
  createdAt: z.iso.datetime(),
});
export type TeamVersionSummary = z.infer<typeof teamVersionSummarySchema>;

export const teamVersionSchema = teamVersionSummarySchema.extend({ data: teamInputSchema });
export type TeamVersion = z.infer<typeof teamVersionSchema>;
