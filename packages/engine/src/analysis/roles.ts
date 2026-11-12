import type { AnalysisProfile, AnalysisRules, Move, Role, StatsTable } from '@vgc-helper/data';
import { isDamaging, type ResolvedSlot } from './resolve.js';

/** What makes a slot fill a role: the move, ability or item that matched. */
export interface RoleMatch {
  slot: number;
  /** For a base-stat role, `id` names the stats that reached the minimum, e.g. `hp+def`. */
  via: { kind: 'move' | 'ability' | 'item' | 'stat'; id: string };
}

/** A set to test against roles: a team slot, or a meta set for a suggestion. */
export interface RoleInput {
  slot: number;
  ability: string | null;
  item: string | null;
  moves: Move[];
  /** Base stats of the forme it battles in; team slots pass it through `battle`. */
  baseStats?: StatsTable;
  battle?: { baseStats: StatsTable };
}

export function matchRole(role: Role, input: RoleInput): RoleMatch | null {
  const { rule } = role;
  const moves = (m: Move) => !('damagingOnly' in rule) || !rule.damagingOnly || isDamaging(m);
  if (rule.kind === 'list') {
    const move = input.moves.find((m) => rule.moves.includes(m.id));
    if (move) return { slot: input.slot, via: { kind: 'move', id: move.id } };
    if (input.ability && rule.abilities.includes(input.ability))
      return { slot: input.slot, via: { kind: 'ability', id: input.ability } };
    if (input.item && rule.items.includes(input.item))
      return { slot: input.slot, via: { kind: 'item', id: input.item } };
    return null;
  }
  if (rule.kind === 'baseStat') {
    const stats = input.baseStats ?? input.battle?.baseStats;
    const sum =
      stats && rule.anyOf.find((ids) => ids.reduce((n, id) => n + stats[id], 0) >= rule.min);
    return sum ? { slot: input.slot, via: { kind: 'stat', id: sum.join('+') } } : null;
  }
  const move = input.moves.find((m) =>
    !moves(m)
      ? false
      : rule.kind === 'moveTarget'
        ? rule.targets.includes(m.target)
        : m.priority >= rule.min,
  );
  return move ? { slot: input.slot, via: { kind: 'move', id: move.id } } : null;
}

/** Every role and the slots that fill it. Roles nobody fills are listed with no matches. */
export function findRoles(
  inputs: RoleInput[],
  rules: Pick<AnalysisRules, 'roles'>,
): Map<string, RoleMatch[]> {
  return new Map(
    rules.roles.map((role) => [role.id, inputs.flatMap((input) => matchRole(role, input) ?? [])]),
  );
}

export interface ChecklistGroup {
  group: string;
  filled: boolean;
  roles: { role: string; matches: RoleMatch[] }[];
}

export interface Checklist {
  groups: ChecklistGroup[];
  missing: string[];
  /** Damaging moves by category, for the physical/special balance. */
  physical: number;
  special: number;
  /** Slots that plan to Mega Evolve. */
  megas: number[];
}

export function buildChecklist(
  team: ResolvedSlot[],
  rules: Pick<AnalysisRules, 'roles'>,
  profile: AnalysisProfile,
  megaSlots: number[],
): Checklist {
  const found = findRoles(team, rules);
  const groups = profile.checklist.map((group) => {
    const roles = rules.roles
      .filter((r) => r.group === group)
      .map((r) => ({ role: r.id, matches: found.get(r.id) ?? [] }));
    return { group, filled: roles.some((r) => r.matches.length > 0), roles };
  });
  const moves = team.flatMap((s) => s.moves.filter(isDamaging));
  return {
    groups,
    missing: groups.filter((g) => !g.filled).map((g) => g.group),
    physical: moves.filter((m) => m.category === 'Physical').length,
    special: moves.filter((m) => m.category === 'Special').length,
    megas: megaSlots,
  };
}
