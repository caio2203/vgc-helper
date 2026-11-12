import type { AnalysisProfile, AnalysisRules, MetaSnapshot, Species } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import type { DexIndex, RulesContext } from '../context.js';
import { emptySlot } from '../paste.js';
import { commonSet, type MetaSet, topCutByBase, usageByBase } from './meta.js';
import type { ResolvedSlot } from './resolve.js';
import { findRoles } from './roles.js';
import { defensiveMultiplier, type TypeAnalysis } from './types.js';

export type ScorePart =
  | { criterion: 'coversWeakness'; points: number; types: string[] }
  | { criterion: 'fillsRole'; points: number; groups: string[] }
  | { criterion: 'usage'; points: number; usage: number }
  | { criterion: 'teammates'; points: number; partners: { species: string; share: number }[] }
  /** `share` of the `teams` top-cut teams in `events` recent tournaments. */
  | { criterion: 'topCut'; points: number; share: number; teams: number; events: number }
  | { criterion: 'addsWeakness'; points: number; types: string[] };

export interface Suggestion {
  /** The species to add: the base species when the common set Mega Evolves. */
  species: Species;
  set: MetaSet;
  /** The common set holds the stone and plans to Mega Evolve. */
  mega: boolean;
  /** Usage of the species with its Megas summed. */
  usage: number;
  offMeta: boolean;
  /** The common set as a team slot, ready to add. */
  slot: TeamSlot;
  score: number;
  parts: ScorePart[];
}

export interface SuggestionOptions {
  /** Minimum usage share (0–1). */
  cutoff: number;
  /** Also suggest Pokémon below the cutoff. */
  offMeta: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Ranks meta Pokémon the team could add. Each candidate is legal (it is in the regulation's dex),
 * keeps the Species Clause, and gets a score whose parts say what it covers and what it adds.
 */
export function suggest(
  team: ResolvedSlot[],
  types: TypeAnalysis,
  missingGroups: string[],
  ctx: RulesContext,
  index: DexIndex,
  meta: MetaSnapshot,
  rules: AnalysisRules,
  profile: AnalysisProfile,
  options: SuggestionOptions,
): Suggestion[] {
  const w = profile.weights;
  const groups = usageByBase(meta, index);
  const top = Math.max(0, ...[...groups.values()].map((g) => g.usage));
  const topCut = topCutByBase(meta, index);
  const topCutMax = Math.max(0, ...topCut.values());
  const teamNums = new Set(team.map((s) => s.species.num));
  const teamItems = new Set(team.flatMap((s) => (s.item ? [s.item] : [])));
  const teamIds = new Set(team.flatMap((s) => [s.species.id, s.battle.id]));
  const nearlyStacked = types.rows
    .filter((r) => r.weak.length >= rules.thresholds.stackedWeakness - 1)
    .map((r) => r.type);

  const out: Suggestion[] = [];
  for (const [baseId, group] of groups) {
    const species = index.species.get(baseId);
    const entry = group.entries[0];
    if (!species || !entry || !species.selectable) continue;
    if (teamNums.has(species.num)) continue;
    const offMeta = group.usage < options.cutoff;
    if (offMeta && !options.offMeta) continue;
    const set = commonSet(entry, index, teamItems);
    if (!set) continue;

    const defend = (type: string) =>
      defensiveMultiplier(ctx.dex, rules, type, set.species, set.ability);
    const covered = types.stacked.filter((t) => defend(t) < 1);
    const added = nearlyStacked.filter((t) => defend(t) > 1);
    const roles = findRoles(
      [
        {
          slot: -1,
          ability: set.ability,
          item: set.item,
          moves: set.moves,
          baseStats: set.species.baseStats,
        },
      ],
      rules,
    );
    const filled = missingGroups.filter((g) =>
      rules.roles.some((r) => r.group === g && (roles.get(r.id) ?? []).length > 0),
    );
    const usageScale =
      top > options.cutoff
        ? Math.min(1, Math.max(0, (group.usage - options.cutoff) / (top - options.cutoff)))
        : 0;
    const partners = entry.teammates.filter((t) => teamIds.has(t.id));
    const bestPartner = entry.teammates[0]?.share ?? 0;
    const partnerScale =
      team.length > 0 && bestPartner > 0
        ? Math.min(1, partners.reduce((a, t) => a + t.share, 0) / team.length / bestPartner)
        : 0;

    const parts: ScorePart[] = [];
    if (covered.length > 0)
      parts.push({
        criterion: 'coversWeakness',
        points: round(covered.length * w.coversWeakness),
        types: covered,
      });
    if (filled.length > 0)
      parts.push({
        criterion: 'fillsRole',
        points: round(filled.length * w.fillsRole),
        groups: filled,
      });
    parts.push({ criterion: 'usage', points: round(usageScale * w.usage), usage: group.usage });
    if (partners.length > 0)
      parts.push({
        criterion: 'teammates',
        points: round(partnerScale * w.teammates),
        partners: partners.map((p) => ({ species: p.id, share: p.share })),
      });
    const cutShare = topCut.get(baseId) ?? 0;
    if (cutShare > 0 && topCutMax > 0 && meta.tournaments)
      parts.push({
        criterion: 'topCut',
        points: round((cutShare / topCutMax) * w.topCut),
        share: cutShare,
        teams: meta.tournaments.teams,
        events: meta.tournaments.events.length,
      });
    if (added.length > 0)
      parts.push({
        criterion: 'addsWeakness',
        points: round(-added.length * w.addsWeakness),
        types: added,
      });

    const mega = set.species.id !== species.id;
    // A Mega set lists the Mega's ability; the slot keeps one the base species can have.
    const baseAbility =
      group.entries
        .find((e) => e.species === species.id)
        ?.abilities.find((a) => species.abilities.includes(a.id))?.id ??
      species.abilities[0] ??
      null;
    out.push({
      species,
      slot: {
        ...emptySlot(species.id),
        item: set.item,
        ability: mega ? baseAbility : set.ability,
        moves: set.moves.map((m) => m.id),
        nature: set.nature,
        spread: set.spread,
        mega,
      },
      set,
      mega,
      usage: group.usage,
      offMeta,
      score: round(parts.reduce((a, p) => a + p.points, 0)),
      parts,
    });
  }
  return out
    .sort((a, b) => b.score - a.score || b.usage - a.usage)
    .slice(0, rules.thresholds.suggestionCount);
}
