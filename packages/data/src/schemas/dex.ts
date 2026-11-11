import { z } from 'zod';
import { idSchema, sourceRefSchema, statIdSchema, statsTableSchema } from './common.js';

export const speciesSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  num: z.int(),
  baseSpecies: z.string().min(1),
  forme: z.string().min(1).nullable(),
  types: z.array(z.string().min(1)).min(1).max(2),
  baseStats: statsTableSchema,
  abilities: z.array(idSchema).min(1),
  weightkg: z.number().nonnegative(),
  tags: z.array(z.string().min(1)),
  /** Set when this species is a Mega forme: the stone that triggers it. */
  megaStone: idSchema.nullable(),
  /** Battle-only and Mega formes cannot be picked directly in the team builder. */
  selectable: z.boolean(),
});
export type Species = z.infer<typeof speciesSchema>;

export const moveSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: z.string().min(1),
  category: z.enum(['Physical', 'Special', 'Status']),
  basePower: z.int().min(0),
  accuracy: z.union([z.int().min(0), z.literal(true)]),
  basePp: z.int().positive(),
  /** PP after the mechanics profile formula. */
  maxPp: z.int().positive(),
  priority: z.int(),
  target: z.string().min(1),
  flags: z.array(z.string().min(1)),
  shortDesc: z.string(),
});
export type Move = z.infer<typeof moveSchema>;

export const itemSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** Base species → Mega forme for Mega Stones. */
  megaStone: z.record(z.string(), z.string()).nullable(),
  shortDesc: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

export const abilitySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  shortDesc: z.string(),
});
export type Ability = z.infer<typeof abilitySchema>;

export const natureSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  plus: statIdSchema.exclude(['hp']).nullable(),
  minus: statIdSchema.exclude(['hp']).nullable(),
});
export type Nature = z.infer<typeof natureSchema>;

/** Everything that is legal in one regulation. Anything missing here is not legal there. */
export const dexSnapshotSchema = z.object({
  gameId: z.string().min(1),
  regulationId: z.string().min(1),
  source: sourceRefSchema,
  types: z.array(z.string().min(1)).min(1),
  /** attacking type → defending type → damage multiplier. */
  typeChart: z.record(z.string(), z.record(z.string(), z.number().min(0))),
  natures: z.array(natureSchema).min(1),
  species: z.array(speciesSchema).min(1),
  moves: z.array(moveSchema).min(1),
  items: z.array(itemSchema).min(1),
  abilities: z.array(abilitySchema).min(1),
  /** species id → legal move ids, already including what it inherits from earlier formes. */
  learnsets: z.record(idSchema, z.array(idSchema)),
});
export type DexSnapshot = z.infer<typeof dexSnapshotSchema>;
