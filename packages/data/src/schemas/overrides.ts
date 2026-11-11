import { z } from 'zod';
import { idSchema, sourceRefSchema } from './common.js';
import { itemSchema, moveSchema, speciesSchema } from './dex.js';

const overrideBase = {
  /** Stable id so the diff report can name the override. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  gameId: z.string().min(1),
  /** `null` applies to every regulation of the game. */
  regulationIds: z.array(z.string().min(1)).nullable(),
  reason: z.string().min(1),
  source: sourceRefSchema,
};

/** A manual correction applied on top of the automatic data. */
export const overrideSchema = z.discriminatedUnion('kind', [
  z.object({
    ...overrideBase,
    kind: z.literal('learnset'),
    species: idSchema,
    add: z.array(idSchema),
    remove: z.array(idSchema),
  }),
  z.object({
    ...overrideBase,
    kind: z.literal('move'),
    move: idSchema,
    patch: moveSchema.omit({ id: true }).partial(),
  }),
  z.object({
    ...overrideBase,
    kind: z.literal('species'),
    species: idSchema,
    patch: speciesSchema.omit({ id: true }).partial(),
  }),
  z.object({
    ...overrideBase,
    kind: z.literal('item'),
    item: idSchema,
    patch: itemSchema.omit({ id: true }).partial(),
  }),
]);
export type Override = z.infer<typeof overrideSchema>;

export const overrideFileSchema = z.array(overrideSchema);
