import { z } from 'zod';

export const localeSchema = z.enum(['en', 'pt-BR']);
export type Locale = z.infer<typeof localeSchema>;

export const experienceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;

export const settingsSchema = z.object({
  /** `null` until the user picks one: the app follows the browser language. */
  locale: localeSchema.nullable(),
  experienceLevel: experienceLevelSchema,
  defaultFormatId: z.string().min(1).nullable(),
  /** Minimum usage share (0–1) for a suggestion. `null` uses the format default from the snapshot. */
  viabilityCutoff: z.number().min(0).max(1).nullable(),
  offMetaMode: z.boolean(),
  density: z.enum(['compact', 'comfortable']),
  theme: z.enum(['system', 'light', 'dark']),
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsPatchSchema = settingsSchema.partial();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const DEFAULT_SETTINGS: Settings = {
  locale: null,
  experienceLevel: 'intermediate',
  defaultFormatId: null,
  viabilityCutoff: null,
  offMetaMode: false,
  density: 'comfortable',
  theme: 'system',
};
