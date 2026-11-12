import type {
  AnalysisProfile,
  AnalysisRules,
  Manifest,
  Move,
  Species,
  StatsTable,
} from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import { type DexIndex, megaFormeFor, type RulesContext } from '../context.js';
import { calcStats } from '../stats.js';

/** A team slot with everything looked up: the forme it battles in, its ability, moves and stats. */
export interface ResolvedSlot {
  /** Position in the team, 0-based. */
  slot: number;
  species: Species;
  /** The Mega forme when the slot plans to Mega Evolve, otherwise the species. */
  battle: Species;
  /** Ability id it battles with: the Mega's, the chosen one, or the only one it can have. */
  ability: string | null;
  item: string | null;
  moves: Move[];
  stats: StatsTable;
}

/** Slots with an unknown species are left out: legality already reports them. */
export function resolveSlots(
  slots: TeamSlot[],
  ctx: RulesContext,
  index: DexIndex,
): ResolvedSlot[] {
  const out: ResolvedSlot[] = [];
  slots.forEach((s, i) => {
    const species = index.species.get(s.species);
    if (!species) return;
    const mega = s.mega ? megaFormeFor(index, species.id, s.item) : null;
    const battle = mega ?? species;
    const ability = mega
      ? (mega.abilities[0] ?? null)
      : (s.ability ?? (species.abilities.length === 1 ? (species.abilities[0] ?? null) : null));
    const nature = s.nature ? (index.natures.get(s.nature) ?? null) : null;
    out.push({
      slot: i,
      species,
      battle,
      ability,
      item: s.item,
      moves: s.moves.flatMap((m) => index.moves.get(m) ?? []),
      stats: calcStats(ctx.profile, battle.baseStats, s.spread, ctx.format.level, nature, s.ivs),
    });
  });
  return out;
}

/** The analysis rules for a game, from the manifest. */
export function analysisRulesFor(manifest: Pick<Manifest, 'analysisRules'>, gameId: string) {
  return manifest.analysisRules.find((r) => r.gameIds.includes(gameId)) ?? null;
}

export function analysisProfileFor(rules: AnalysisRules, ctx: RulesContext): AnalysisProfile {
  const profile =
    rules.profiles.find((p) => p.id === ctx.format.analysisProfile) ?? rules.profiles[0];
  if (!profile) throw new Error(`No analysis profile in ${rules.id}`);
  return profile;
}

export const isDamaging = (move: Move) => move.category !== 'Status';
