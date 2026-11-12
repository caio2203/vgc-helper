import { z } from 'zod';
import { sourceRefSchema } from './common.js';

/**
 * What changed between two snapshots, written by the snapshot builder. The web app renders each
 * change from an i18n template and the data PR lists them, so changes are structured, not text.
 * Names are stored next to ids because a removed entry is no longer in the current dex.
 */
export const changeRefSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
export type ChangeRef = z.infer<typeof changeRefSchema>;

/** A scalar or a short list, as it was before and after the change. */
export const changeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);
export type ChangeValue = z.infer<typeof changeValueSchema>;

const inRegulation = { gameId: z.string().min(1), regulationId: z.string().min(1) };

export const dexListSchema = z.enum(['species', 'megas', 'moves', 'items', 'abilities']);
export type DexList = z.infer<typeof dexListSchema>;

export const banListSchema = z.enum(['species', 'items', 'moves', 'abilities', 'tags']);
export type BanList = z.infer<typeof banListSchema>;

export const usageChangeSchema = z.object({
  species: changeRefSchema,
  /** Usage share (0–1); null when the species was not in that month's data. */
  from: z.number().min(0).max(1).nullable(),
  to: z.number().min(0).max(1).nullable(),
});
export type UsageChange = z.infer<typeof usageChangeSchema>;

export const changeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('regulationAdded'),
    ...inRegulation,
    name: z.string().min(1),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullable(),
  }),
  z.object({ kind: z.literal('regulationRemoved'), ...inRegulation, name: z.string().min(1) }),
  z.object({
    kind: z.literal('regulationDates'),
    ...inRegulation,
    field: z.enum(['startsAt', 'endsAt']),
    from: z.iso.datetime().nullable(),
    to: z.iso.datetime().nullable(),
  }),
  /** Entries added to or removed from a regulation's dex: what is legal there. */
  z.object({
    kind: z.literal('dexEntries'),
    ...inRegulation,
    list: dexListSchema,
    added: z.array(changeRefSchema),
    removed: z.array(changeRefSchema),
  }),
  z.object({
    kind: z.literal('bans'),
    ...inRegulation,
    list: banListSchema,
    added: z.array(changeRefSchema),
    removed: z.array(changeRefSchema),
  }),
  z.object({
    kind: z.literal('moveChanged'),
    ...inRegulation,
    move: changeRefSchema,
    field: z.enum(['type', 'category', 'basePower', 'accuracy', 'maxPp', 'priority', 'target']),
    from: changeValueSchema,
    to: changeValueSchema,
  }),
  z.object({
    kind: z.literal('speciesChanged'),
    ...inRegulation,
    species: changeRefSchema,
    field: z.enum(['types', 'abilities', 'hp', 'atk', 'def', 'spa', 'spd', 'spe']),
    from: changeValueSchema,
    to: changeValueSchema,
  }),
  /** Moves a species that stays legal gained or lost. */
  z.object({
    kind: z.literal('learnset'),
    ...inRegulation,
    species: changeRefSchema,
    added: z.array(changeRefSchema),
    removed: z.array(changeRefSchema),
  }),
  /** Usage moves of one format, from one month of stats to the next. */
  z.object({
    kind: z.literal('usage'),
    ...inRegulation,
    formatId: z.string().min(1),
    fromPeriod: z.string().nullable(),
    toPeriod: z.string().min(1),
    battles: z.int().min(0),
    source: sourceRefSchema,
    entries: z.array(usageChangeSchema),
  }),
  /** A hand-curated rule changed: mechanics profile, format or regulation settings. */
  z.object({
    kind: z.literal('setting'),
    scope: z.enum(['mechanics', 'format', 'regulation']),
    id: z.string().min(1),
    path: z.string().min(1),
    from: changeValueSchema,
    to: changeValueSchema,
  }),
  z.object({
    kind: z.literal('overrides'),
    added: z.array(z.string().min(1)),
    removed: z.array(z.string().min(1)),
  }),
  /** The analysis rules changed (roles, archetypes, weights): top-level sections only. */
  z.object({
    kind: z.literal('analysisRules'),
    id: z.string().min(1),
    sections: z.array(z.string().min(1)).min(1),
  }),
]);
export type Change = z.infer<typeof changeSchema>;
export type ChangeKind = Change['kind'];

export const changelogEntrySchema = z.object({
  version: z.string().min(1),
  /** `null` for the first snapshot in the history: nothing to compare with. */
  previousVersion: z.string().min(1).nullable(),
  generatedAt: z.iso.datetime(),
  changes: z.array(changeSchema),
  /** What the build flagged, copied from the manifest. */
  warnings: z.array(z.string()),
});
export type ChangelogEntry = z.infer<typeof changelogEntrySchema>;

/** Every snapshot the builder wrote, newest first. */
export const changelogSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(changelogEntrySchema),
});
export type Changelog = z.infer<typeof changelogSchema>;
