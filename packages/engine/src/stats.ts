import type { MechanicsProfile, Nature, StatId, StatsTable } from '@vgc-helper/data';
import { STAT_IDS } from '@vgc-helper/data';

export interface StatInput {
  stat: StatId;
  base: number;
  /** Stat Points or EVs, depending on the profile. */
  invested: number;
  /** Ignored when the profile fixes IVs. */
  iv?: number;
  level: number;
  nature: Nature | null;
}

function natureFactor(profile: MechanicsProfile, nature: Nature | null, stat: StatId): number {
  if (!nature || stat === 'hp') return 100;
  if (nature.plus === stat && nature.minus !== stat) return profile.nature.plusPercent;
  if (nature.minus === stat && nature.plus !== stat) return profile.nature.minusPercent;
  return 100;
}

/**
 * Final stat before boosts.
 *
 * - `evIv`: the main-series formula.
 * - `statPoints` (Champions): Showdown's level formula with each Stat Point worth
 *   `2 × SP − 1` "EV-quarters". At level 50 this reduces to `base + SP + 75` for HP
 *   and `base + SP + 20` for the rest, before the nature.
 */
export function calcStat(profile: MechanicsProfile, input: StatInput): number {
  const { stat, base, invested, level } = input;
  const system = profile.statSystem;

  let iv: number;
  let effort: number;
  if (system.kind === 'statPoints') {
    iv = system.fixedIv;
    effort = Math.max(2 * invested - 1, 0);
  } else {
    iv = input.iv ?? system.ivMax;
    effort = Math.floor(invested / 4);
  }

  const core = Math.floor(((2 * base + iv + effort) * level) / 100);
  if (stat === 'hp') return core + level + 10;
  return Math.floor(((core + 5) * natureFactor(profile, input.nature, stat)) / 100);
}

export function calcStats(
  profile: MechanicsProfile,
  base: StatsTable,
  invested: StatsTable,
  level: number,
  nature: Nature | null,
  ivs?: StatsTable | null,
): StatsTable {
  const out = {} as StatsTable;
  for (const stat of STAT_IDS) {
    out[stat] = calcStat(profile, {
      stat,
      base: base[stat],
      invested: invested[stat],
      ...(ivs ? { iv: ivs[stat] } : {}),
      level,
      nature,
    });
  }
  return out;
}

export type SpreadIssue =
  | { code: 'negative'; stat: StatId }
  | { code: 'perStatExceeded'; stat: StatId; value: number; max: number }
  | { code: 'totalExceeded'; total: number; max: number };

export function validateSpread(profile: MechanicsProfile, invested: StatsTable): SpreadIssue[] {
  const system = profile.statSystem;
  const maxPerStat = system.kind === 'statPoints' ? system.maxPerStat : system.evMaxPerStat;
  const maxTotal = system.kind === 'statPoints' ? system.total : system.evTotal;
  const issues: SpreadIssue[] = [];
  let total = 0;

  for (const stat of STAT_IDS) {
    const value = invested[stat];
    total += value;
    if (value < 0) issues.push({ code: 'negative', stat });
    else if (value > maxPerStat)
      issues.push({ code: 'perStatExceeded', stat, value, max: maxPerStat });
  }
  if (total > maxTotal) issues.push({ code: 'totalExceeded', total, max: maxTotal });
  return issues;
}

/** Max PP after the profile's cap and formula. */
export function calcMaxPp(profile: MechanicsProfile, basePp: number, noPpBoosts = false): number {
  const capped = profile.pp.maxBasePp ? Math.min(basePp, profile.pp.maxBasePp) : basePp;
  if (noPpBoosts) return capped;
  if (profile.pp.formula === 'champions') return Math.floor((capped / 5 + 1) * 4);
  return Math.floor((capped * 8) / 5);
}
