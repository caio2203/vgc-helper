import { z } from 'zod';
import { idSchema, sourceRefSchema, statIdSchema } from './common.js';

/**
 * Hand-curated rules the analysis engine reads: how abilities change type matchups, which moves
 * and abilities fill a VGC role, how archetypes are recognised, and the thresholds and weights
 * the engine uses. Nothing here is computed; every list is reviewed by PR and has a source.
 */

/** An ability that changes the damage a type deals to its holder. */
export const abilityMatchupSchema = z.object({
  ability: idSchema,
  type: z.string().min(1),
  /** 0 for an immunity, 0.5 for a halving, 2 for a weakness the ability adds. */
  multiplier: z.number().min(0),
});
export type AbilityMatchup = z.infer<typeof abilityMatchupSchema>;

/**
 * How a slot fills a role. `list` matches named moves, abilities or items. The others are
 * computed from the dex: spread moves by target, priority moves by priority.
 */
export const roleRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('list'),
    moves: z.array(idSchema),
    abilities: z.array(idSchema),
    items: z.array(idSchema),
  }),
  z.object({
    kind: z.literal('moveTarget'),
    targets: z.array(z.string().min(1)).min(1),
    damagingOnly: z.boolean(),
  }),
  z.object({
    kind: z.literal('movePriority'),
    min: z.int(),
    damagingOnly: z.boolean(),
  }),
]);
export type RoleRule = z.infer<typeof roleRuleSchema>;

export const weatherSchema = z.enum(['Sun', 'Rain', 'Sand', 'Snow']);
export const terrainSchema = z.enum(['Electric', 'Grassy', 'Psychic', 'Misty']);

export const roleSchema = z.object({
  id: z.string().regex(/^[a-zA-Z]+$/),
  /** Roles of one group count together in the checklist, e.g. Tailwind and Trick Room. */
  group: z.string().regex(/^[a-zA-Z]+$/),
  rule: roleRuleSchema,
  /** Weather or terrain a matching ability sets on entry; damage calcs apply it. */
  sets: z
    .object({ weather: weatherSchema.nullable(), terrain: terrainSchema.nullable() })
    .nullable(),
});
export type Role = z.infer<typeof roleSchema>;

/** A slot that profits from an archetype: by role, or by its base stat in a range. */
export const abuserRuleSchema = z.object({
  roles: z.array(z.string().min(1)),
  baseStat: z
    .object({ stat: statIdSchema, min: z.int().min(0).nullable(), max: z.int().min(0).nullable() })
    .nullable(),
});

export const archetypeSchema = z.object({
  id: z.string().regex(/^[a-zA-Z]+$/),
  setterRoles: z.array(z.string().min(1)).min(1),
  abuser: abuserRuleSchema,
  /** Fewer setters than this, with the archetype detected, is a missing piece. */
  minSetters: z.int().min(1),
  minAbusers: z.int().min(0),
  /** Recognise the archetype from abusers alone (3 slow attackers suggest Trick Room). */
  detectWithoutSetter: z.boolean(),
});
export type Archetype = z.infer<typeof archetypeSchema>;

export const suggestionWeightsSchema = z.object({
  /** Points per stacked weakness the candidate resists or is immune to. */
  coversWeakness: z.number().min(0),
  /** Points per missing checklist group the candidate's common set fills. */
  fillsRole: z.number().min(0),
  /** Points for usage, scaled from 0 at the cutoff to this value at the top species. */
  usage: z.number().min(0),
  /** Points scaled by how often the candidate is paired with the current members. */
  teammates: z.number().min(0),
  /** Points scaled by the candidate's top-cut share in recent tournaments, 0 without data. */
  topCut: z.number().min(0),
  /** Points taken off per stacked weakness the candidate adds to. */
  addsWeakness: z.number().min(0),
});
export type SuggestionWeights = z.infer<typeof suggestionWeightsSchema>;

/**
 * Team preview: which members to bring and lead against an opponent's team list. A matchup
 * between one of your members and one of theirs scores offense, defense and speed; a pick scores
 * how well it covers each opponent plus the roles it keeps.
 */
export const previewWeightsSchema = z.object({
  /** Points for the share of the opponent's HP your best hit takes (capped at 100%). */
  offense: z.number().min(0),
  /** Points for the share of your HP left after the opponent's best hit. */
  defense: z.number().min(0),
  /** Points when your member moves first. */
  speed: z.number().min(0),
  /** Points per checklist group the brought members still fill. */
  bringRole: z.number().min(0),
  /** Role groups that matter on turn one, e.g. Fake Out and speed control. */
  leadRoles: z.array(z.string().min(1)),
  /** Points per lead role group the lead fills. */
  leadRole: z.number().min(0),
  /** Picks shown, the best first. */
  alternatives: z.int().min(1),
});
export type PreviewWeights = z.infer<typeof previewWeightsSchema>;

export const analysisProfileSchema = z.object({
  /** Matches `Format.analysisProfile`. */
  id: z.enum(['doubles', 'singles']),
  /** Role groups the checklist expects, in display order. */
  checklist: z.array(z.string().min(1)).min(1),
  weights: suggestionWeightsSchema,
  preview: previewWeightsSchema,
});
export type AnalysisProfile = z.infer<typeof analysisProfileSchema>;

export const analysisRulesSchema = z.object({
  id: z.string().min(1),
  gameIds: z.array(z.string().min(1)).min(1),
  abilityMatchups: z.array(abilityMatchupSchema),
  roles: z.array(roleSchema).min(1),
  archetypes: z.array(archetypeSchema),
  profiles: z.array(analysisProfileSchema).min(1),
  thresholds: z.object({
    /** Members weak to one type before it counts as a stacked weakness. */
    stackedWeakness: z.int().min(2),
    /** Meta Pokémon checked as threats, by usage. */
    threatCount: z.int().min(1),
    /** Meta Pokémon shown on the speed ruler, by usage. */
    speedTierCount: z.int().min(1),
    /** A meta item share above this gets its own speed tick (Choice Scarf). */
    speedItemShare: z.number().min(0).max(1),
    /** Suggestions shown at most. */
    suggestionCount: z.int().min(1),
  }),
  speed: z.object({
    tailwindMultiplier: z.number().positive(),
    /** Item id → speed multiplier, e.g. Choice Scarf. */
    itemMultipliers: z.record(idSchema, z.number().positive()),
    /** One stage of speed drop, e.g. 2/3 after Icy Wind. */
    minusOneMultiplier: z.number().positive(),
  }),
  sources: z.array(sourceRefSchema).min(1),
});
export type AnalysisRules = z.infer<typeof analysisRulesSchema>;
