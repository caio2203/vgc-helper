import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import type { DexIndex, RulesContext } from '../context.js';
import { type ArchetypeFinding, detectArchetypes } from './archetypes.js';
import { commonSet, rankedMeta } from './meta.js';
import { analysisProfileFor, isDamaging, type ResolvedSlot, resolveSlots } from './resolve.js';
import { buildChecklist, type Checklist, findRoles } from './roles.js';
import { type SpeedAnalysis, speedTiers } from './speed.js';
import { type Suggestion, type SuggestionOptions, suggest } from './suggestions.js';
import { analyzeTypes, type TypeAnalysis, typesResisting } from './types.js';

/** A type that hits too many members, the slot that tipped it and the meta Pokémon that use it. */
export interface StackedAlert {
  type: string;
  slots: number[];
  /** The last slot in team order among the weak ones: the addition that stacked the weakness. */
  addedBy: number;
  users: { species: string; usage: number; move: string }[];
}

export interface TeamAnalysis {
  team: ResolvedSlot[];
  types: TypeAnalysis;
  checklist: Checklist;
  archetypes: ArchetypeFinding[];
  speed: SpeedAnalysis;
  stacked: StackedAlert[];
  /** Types that resist the most stacked weaknesses. */
  recommendedTypes: { type: string; covers: number }[];
  suggestions: Suggestion[];
}

/**
 * The deterministic analysis of a team, without damage calculations (those load separately).
 * Runs in the browser on every change.
 */
export function analyzeTeam(
  slots: TeamSlot[],
  ctx: RulesContext,
  index: DexIndex,
  rules: AnalysisRules,
  meta: MetaSnapshot | null,
  options: SuggestionOptions,
): TeamAnalysis {
  const team = resolveSlots(slots, ctx, index);
  const profile = analysisProfileFor(rules, ctx);
  const types = analyzeTypes(team, ctx.dex, rules);
  const megaSlots = slots.flatMap((s, i) => (s.mega ? [i] : []));
  const checklist = buildChecklist(team, rules, profile, megaSlots);
  const roles = findRoles(team, rules);

  const metaSets = meta
    ? rankedMeta(meta, index)
        .slice(0, rules.thresholds.threatCount)
        .flatMap((e) => commonSet(e, index) ?? [])
    : [];
  const stacked = types.rows
    .filter((r) => r.stacked)
    .map((r) => ({
      type: r.type,
      slots: r.weak,
      addedBy: Math.max(...r.weak),
      users: metaSets.flatMap((set) => {
        const move = set.moves.find((m) => isDamaging(m) && m.type === r.type);
        return move ? [{ species: set.species.id, usage: set.usage, move: move.id }] : [];
      }),
    }));

  return {
    team,
    types,
    checklist,
    archetypes: detectArchetypes(team, roles, rules),
    speed: speedTiers(team, ctx, index, meta, rules),
    stacked,
    recommendedTypes: typesResisting(ctx.dex, types.stacked).slice(0, 4),
    suggestions:
      meta && slots.length < ctx.format.teamSize.max
        ? suggest(team, types, checklist.missing, ctx, index, meta, rules, profile, options)
        : [],
  };
}
