import { z } from 'zod';
import { experienceLevelSchema } from './settings.js';

/** "Useful / not useful" on a suggestion, with what the engine knew when it made it. */
export const feedbackInputSchema = z.object({
  kind: z.literal('suggestion'),
  /** Suggested species id. */
  subject: z.string().regex(/^[a-z0-9]+$/),
  helpful: z.boolean(),
  gameId: z.string().min(1).max(40),
  formatId: z.string().min(1).max(60),
  regulationId: z.string().min(1).max(40),
  snapshotVersion: z.string().min(1).max(60),
  score: z.number().finite(),
  /** 1-based position in the list. */
  rank: z.int().min(1).max(50),
  experienceLevel: experienceLevelSchema,
  /** Species ids on the team at the time. */
  team: z.array(z.string().regex(/^[a-z0-9]+$/)).max(6),
});
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const feedbackSummarySchema = z.object({
  total: z.int().min(0),
  helpful: z.int().min(0),
  bySubject: z.array(
    z.object({ subject: z.string(), helpful: z.int().min(0), notHelpful: z.int().min(0) }),
  ),
});
export type FeedbackSummary = z.infer<typeof feedbackSummarySchema>;
