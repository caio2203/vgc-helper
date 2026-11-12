import { z } from 'zod';
import { analysisRulesSchema } from './analysis.js';
import { formatSchema, gameSchema, mechanicsProfileSchema, regulationSchema } from './rules.js';

const snapshotPathSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._/-]+\.json$/)
  .refine((path) => !path.split('/').includes('..'), 'Path must stay inside the snapshot folder');

export const manifestRegulationSchema = regulationSchema.extend({
  files: z.object({
    dex: snapshotPathSchema,
    /** format id → meta snapshot path, for formats that have usage data. */
    meta: z.record(z.string(), snapshotPathSchema),
  }),
});
export type ManifestRegulation = z.infer<typeof manifestRegulationSchema>;

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  /** Saved with every team so it can be revalidated when the data changes. */
  version: z.string().min(1),
  generatedAt: z.iso.datetime(),
  games: z.array(gameSchema).min(1),
  mechanicsProfiles: z.array(mechanicsProfileSchema).min(1),
  formats: z.array(formatSchema).min(1),
  regulations: z.array(manifestRegulationSchema).min(1),
  /** Rules the analysis engine reads, per game. */
  analysisRules: z.array(analysisRulesSchema).min(1),
  overridesApplied: z.array(z.string()),
  /** What the last build flagged (small samples, unknown species, a source that failed). */
  warnings: z.array(z.string()).default([]),
});
export type Manifest = z.infer<typeof manifestSchema>;
