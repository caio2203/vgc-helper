import type { AnalysisRules } from '@vgc-helper/data';
import type { ResolvedSlot } from './resolve.js';
import type { RoleMatch } from './roles.js';

export interface ArchetypeFinding {
  id: string;
  setters: number[];
  abusers: number[];
  minSetters: number;
  minAbusers: number;
  /** The team leans this way but lacks setters or abusers. */
  missing: { setters: number; abusers: number };
}

/**
 * An archetype is detected when the team has a setter and an abuser, or enough abusers that the
 * plan is clear without the setter (three slow attackers and no Trick Room).
 */
export function detectArchetypes(
  team: ResolvedSlot[],
  roles: Map<string, RoleMatch[]>,
  rules: Pick<AnalysisRules, 'archetypes'>,
  profileId: 'doubles' | 'singles' = 'doubles',
): ArchetypeFinding[] {
  const findings: ArchetypeFinding[] = [];
  for (const a of rules.archetypes) {
    if (!a.profiles.includes(profileId)) continue;
    const setters = [
      ...new Set(a.setterRoles.flatMap((r) => (roles.get(r) ?? []).map((m) => m.slot))),
    ];
    const byRole = a.abuser.roles.flatMap((r) => (roles.get(r) ?? []).map((m) => m.slot));
    const byStat = a.abuser.baseStat
      ? team
          .filter((s) => {
            const { stat, min, max } = a.abuser.baseStat ?? { stat: 'spe', min: null, max: null };
            const v = s.battle.baseStats[stat];
            return (min === null || v >= min) && (max === null || v <= max);
          })
          .map((s) => s.slot)
      : [];
    const abusers = [...new Set([...byRole, ...byStat])].filter((s) => !setters.includes(s));
    const leaning =
      (setters.length > 0 && abusers.length > 0) ||
      (a.detectWithoutSetter && abusers.length >= Math.max(a.minAbusers, 2) + 1);
    if (!leaning) continue;
    findings.push({
      id: a.id,
      setters,
      abusers,
      minSetters: a.minSetters,
      minAbusers: a.minAbusers,
      missing: {
        setters: Math.max(0, a.minSetters - setters.length),
        abusers: Math.max(0, a.minAbusers - abusers.length),
      },
    });
  }
  // Strongest plan first: most pieces in place.
  return findings.sort(
    (x, y) => y.setters.length + y.abusers.length - (x.setters.length + x.abusers.length),
  );
}
