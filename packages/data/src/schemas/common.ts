import { z } from 'zod';

/** Showdown-style id: lowercase letters and digits only. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+$/, 'Expected a Showdown id (lowercase letters and digits)');

/** Where a piece of data came from. Every number shown in the app must trace back to one of these. */
export const sourceRefSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  retrievedAt: z.iso.datetime(),
  note: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const statIdSchema = z.enum(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
export type StatId = z.infer<typeof statIdSchema>;
export const STAT_IDS = statIdSchema.options;

export const statsTableSchema = z.object({
  hp: z.int().min(0),
  atk: z.int().min(0),
  def: z.int().min(0),
  spa: z.int().min(0),
  spd: z.int().min(0),
  spe: z.int().min(0),
});
export type StatsTable = z.infer<typeof statsTableSchema>;

export const shareSchema = z.object({
  id: z.string().min(1),
  share: z.number().min(0),
});
export type Share = z.infer<typeof shareSchema>;
