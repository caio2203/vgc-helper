import type { AnalysisRules, DexSnapshot, Species } from '@vgc-helper/data';
import { isDamaging, type ResolvedSlot } from './resolve.js';

/** Damage multiplier of an attacking type against a forme, with its ability applied. */
export function defensiveMultiplier(
  dex: Pick<DexSnapshot, 'typeChart'>,
  rules: Pick<AnalysisRules, 'abilityMatchups'>,
  attackType: string,
  species: Pick<Species, 'types'>,
  ability: string | null,
): number {
  let m = 1;
  for (const t of species.types) m *= dex.typeChart[attackType]?.[t] ?? 1;
  if (ability) {
    for (const rule of rules.abilityMatchups) {
      if (rule.ability === ability && rule.type === attackType) m *= rule.multiplier;
    }
  }
  return m;
}

export interface TypeRow {
  /** Attacking type. */
  type: string;
  /** Multiplier per resolved slot, in the same order as the team. */
  multipliers: { slot: number; value: number; byAbility: boolean }[];
  weak: number[];
  resist: number[];
  immune: number[];
  /** Weak members reach the stacked-weakness threshold. */
  stacked: boolean;
}

export interface CoverageRow {
  /** Defending type. */
  type: string;
  /** Best multiplier any damaging move on the team reaches. 0 when the team has no damaging move. */
  best: number;
  slots: number[];
}

export interface TypeAnalysis {
  rows: TypeRow[];
  stacked: string[];
  coverage: CoverageRow[];
  /** Defending types no damaging move hits for more than neutral damage. */
  coverageGaps: string[];
}

export function analyzeTypes(
  team: ResolvedSlot[],
  dex: Pick<DexSnapshot, 'typeChart' | 'types'>,
  rules: Pick<AnalysisRules, 'abilityMatchups' | 'thresholds'>,
): TypeAnalysis {
  const rows: TypeRow[] = dex.types.map((type) => {
    const multipliers = team.map((s) => {
      const value = defensiveMultiplier(dex, rules, type, s.battle, s.ability);
      const plain = defensiveMultiplier(dex, { abilityMatchups: [] }, type, s.battle, null);
      return { slot: s.slot, value, byAbility: value !== plain };
    });
    const weak = multipliers.filter((m) => m.value > 1).map((m) => m.slot);
    return {
      type,
      multipliers,
      weak,
      resist: multipliers.filter((m) => m.value > 0 && m.value < 1).map((m) => m.slot),
      immune: multipliers.filter((m) => m.value === 0).map((m) => m.slot),
      stacked: weak.length >= rules.thresholds.stackedWeakness,
    };
  });

  const coverage: CoverageRow[] = dex.types.map((type) => {
    let best = 0;
    let slots: number[] = [];
    for (const s of team) {
      for (const move of s.moves.filter(isDamaging)) {
        const m = dex.typeChart[move.type]?.[type] ?? 1;
        if (m > best) {
          best = m;
          slots = [s.slot];
        } else if (m === best && !slots.includes(s.slot)) {
          slots.push(s.slot);
        }
      }
    }
    return { type, best, slots };
  });

  const hasAttacks = team.some((s) => s.moves.some(isDamaging));
  return {
    rows,
    stacked: rows.filter((r) => r.stacked).map((r) => r.type),
    coverage,
    coverageGaps: hasAttacks ? coverage.filter((c) => c.best <= 1).map((c) => c.type) : [],
  };
}

/** Single types that take less than neutral damage from every one of the given attacking types. */
export function typesResisting(
  dex: Pick<DexSnapshot, 'typeChart' | 'types'>,
  attackTypes: string[],
): { type: string; covers: number }[] {
  if (attackTypes.length === 0) return [];
  return dex.types
    .map((type) => ({
      type,
      covers: attackTypes.filter((a) => (dex.typeChart[a]?.[type] ?? 1) < 1).length,
    }))
    .filter((t) => t.covers > 0)
    .sort((a, b) => b.covers - a.covers || a.type.localeCompare(b.type));
}
