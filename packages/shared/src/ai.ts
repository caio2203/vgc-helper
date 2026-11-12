import { z } from 'zod';
import { experienceLevelSchema, localeSchema } from './settings.js';
import { MAX_TEAM_SIZE, teamSlotSchema } from './team.js';

/**
 * On-demand AI explanations. The client sends the team, not an analysis: the API runs the engine
 * itself and gives the model only that analysis, so nothing the model reads comes from the browser
 * except the team and the questions.
 */
export const aiTeamSchema = z.object({
  gameId: z.string().min(1),
  formatId: z.string().min(1),
  regulationId: z.string().min(1),
  slots: z.array(teamSlotSchema).min(1).max(MAX_TEAM_SIZE),
});
export type AiTeam = z.infer<typeof aiTeamSchema>;

export const aiExplainSchema = z.object({
  team: aiTeamSchema,
  locale: localeSchema,
  level: experienceLevelSchema,
});
export type AiExplainInput = z.infer<typeof aiExplainSchema>;

export const AI_MAX_QUESTION = 500;
export const AI_MAX_TURNS = 12;

export const aiMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().trim().min(1).max(4000),
});
export type AiMessage = z.infer<typeof aiMessageSchema>;

export const aiChatSchema = aiExplainSchema.extend({
  /** The conversation so far; the last message is the user's question. */
  messages: z
    .array(aiMessageSchema)
    .min(1)
    .max(AI_MAX_TURNS)
    .refine((m) => m.at(-1)?.role === 'user', 'The last message must be a question')
    .refine(
      (m) => (m.at(-1)?.text.length ?? 0) <= AI_MAX_QUESTION,
      `Questions have at most ${AI_MAX_QUESTION} characters`,
    ),
});
export type AiChatInput = z.infer<typeof aiChatSchema>;

export const aiStatusSchema = z.object({
  /** False when the instance has no GEMINI_API_KEY: the AI features stay hidden. */
  enabled: z.boolean(),
  model: z.string().nullable(),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;

export const aiAnswerSchema = z.object({
  text: z.string(),
  model: z.string(),
  /** Served from the cache: same team, data version, language and level. */
  cached: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type AiAnswer = z.infer<typeof aiAnswerSchema>;

/** Why there is no answer; the app keeps working with its own template explanations. */
export const aiErrorReasonSchema = z.enum(['disabled', 'quota', 'dailyLimit', 'unavailable']);
export type AiErrorReason = z.infer<typeof aiErrorReasonSchema>;
