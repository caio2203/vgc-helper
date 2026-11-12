import { z } from 'zod';
import { analysisRulesSchema } from './analysis.js';
import { idSchema, sourceRefSchema } from './common.js';

export const statSystemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('statPoints'),
    total: z.int().positive(),
    maxPerStat: z.int().positive(),
    /** Every IV counts as this value. */
    fixedIv: z.int().min(0),
  }),
  z.object({
    kind: z.literal('evIv'),
    evTotal: z.int().positive(),
    evMaxPerStat: z.int().positive(),
    ivMax: z.int().positive(),
  }),
]);
export type StatSystem = z.infer<typeof statSystemSchema>;

export const mechanicsProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  statSystem: statSystemSchema,
  /** Nature effect in whole percent, e.g. 110 and 90. */
  nature: z.object({
    plusPercent: z.int().positive(),
    minusPercent: z.int().positive(),
  }),
  gimmick: z.object({
    kind: z.enum(['mega', 'tera', 'dynamax', 'zmove', 'none']),
    perBattle: z.int().min(0),
    /** Types a Pokémon can Terastallize into, for the `tera` gimmick. */
    teraTypes: z.array(z.string().min(1)).default([]),
  }),
  pp: z.object({
    /** Base PP above this value is lowered to it before the formula runs. */
    maxBasePp: z.int().positive().nullable(),
    /** `champions`: (base / 5 + 1) × 4. `standard`: base × 8 / 5 (all PP Ups). */
    formula: z.enum(['champions', 'standard']),
  }),
  statusRules: z.object({
    paralysisFullParaChance: z.number().min(0).max(1),
    sleepTurns: z.object({ min: z.int().min(1), max: z.int().min(1) }),
    freezeMaxTurns: z.int().positive().nullable(),
    freezeThawChance: z.number().min(0).max(1),
  }),
  moveRestrictions: z.array(
    z.object({
      move: idSchema,
      restriction: z.enum(['firstActionOnly']),
      note: z.string().min(1),
    }),
  ),
  sources: z.array(sourceRefSchema).min(1),
});
export type MechanicsProfile = z.infer<typeof mechanicsProfileSchema>;

export const gameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mechanicsProfileId: z.string().min(1),
});
export type Game = z.infer<typeof gameSchema>;

export const formatSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  name: z.string().min(1),
  gameType: z.enum(['doubles', 'singles']),
  teamSize: z.object({ min: z.int().min(1), max: z.int().min(1) }),
  pickCount: z.int().min(1),
  level: z.int().min(1).max(100),
  /** Which weight set the engine uses. */
  analysisProfile: z.enum(['doubles', 'singles']),
  viability: z.object({
    /** Default minimum usage share (0–1) for suggestions. Mega formes count toward the base species. */
    defaultCutoff: z.number().min(0).max(1),
    /** Months with fewer battles than this are flagged as a small sample. */
    minBattles: z.int().positive(),
    /** Smogon ladder rating cutoff used for usage stats. */
    ratingCutoff: z.int().min(0),
    note: z.string().min(1),
  }),
  sources: z.array(sourceRefSchema).min(1),
});
export type Format = z.infer<typeof formatSchema>;

export const regulationFormatSchema = z.object({
  formatId: z.string().min(1),
  showdownFormatId: z.string().min(1),
  smogonStatsId: z.string().min(1).nullable(),
  /** Which recent tournaments count as top-cut data (Limitless API). */
  tournaments: z
    .object({
      /** Limitless `format` id for this regulation, e.g. M-C. */
      limitlessFormat: z.string().min(1),
      /** Smaller tournaments are left out. */
      minPlayers: z.int().min(2),
      /** Placings at or above this count as top cut. */
      topPlacings: z.int().min(1),
      /** Days of tournaments, ending at the start of the current week (Monday, UTC). */
      windowDays: z.int().min(1),
      /** The largest tournaments in the window, at most this many. */
      maxEvents: z.int().min(1),
      /** Limitless species id → dex id, for entries Limitless names differently. */
      aliases: z.record(z.string().min(1), idSchema).default({}),
      note: z.string().min(1),
      source: sourceRefSchema,
    })
    .nullable()
    .default(null),
  timer: z
    .object({
      playerSeconds: z.int().positive(),
      turnSeconds: z.int().positive(),
      previewSeconds: z.int().positive(),
    })
    .nullable(),
});
export type RegulationFormat = z.infer<typeof regulationFormatSchema>;

export const regulationSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  name: z.string().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  /** Showdown mod that holds this regulation's dex. */
  dexMod: z.string().min(1),
  formats: z.array(regulationFormatSchema).min(1),
  clauses: z.array(z.enum(['species', 'item', 'nickname'])),
  bannedTags: z.array(z.string().min(1)),
  /** Showdown tiers left out, for Smogon formats (e.g. Uber and AG in OU). */
  bannedTiers: z.array(z.string().min(1)).default([]),
  bannedSpecies: z.array(idSchema),
  bannedItems: z.array(idSchema),
  bannedMoves: z.array(idSchema),
  bannedAbilities: z.array(idSchema),
  restrictedLimit: z.int().min(0).nullable(),
  /** Species tags that count toward `restrictedLimit`, e.g. Restricted Legendary. */
  restrictedTags: z.array(z.string().min(1)).default([]),
  sources: z.array(sourceRefSchema).min(1),
  verifiedAt: z.iso.datetime(),
});
export type Regulation = z.infer<typeof regulationSchema>;

/**
 * One hand-curated file, reviewed by PR. The snapshot builder merges every file in
 * packages/data/manual and copies the result into the manifest, which requires each list.
 */
export const manualDataSchema = z.object({
  games: z.array(gameSchema).default([]),
  mechanicsProfiles: z.array(mechanicsProfileSchema).default([]),
  formats: z.array(formatSchema).default([]),
  regulations: z.array(regulationSchema).default([]),
  analysisRules: z.array(analysisRulesSchema).default([]),
});
export type ManualData = z.infer<typeof manualDataSchema>;
