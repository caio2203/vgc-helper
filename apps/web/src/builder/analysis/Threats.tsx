import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import type { ResolvedSlot } from '@vgc-helper/engine';
import type { DamageResult, Threat } from '@vgc-helper/engine/damage';
import type { ExperienceLevel, TeamSlot } from '@vgc-helper/shared';
import { OctagonAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TypeChips, TypeEdge } from '../../components/ui/Type';
import type { Rules } from '../../data/rules';
import { abilityName, itemName, moveName, useFormat } from './format';

type DamageModule = typeof import('@vgc-helper/engine/damage');

/** The calc is large, so it loads the first time a team needs it. */
function useDamageModule(): DamageModule | null {
  const [mod, setMod] = useState<DamageModule | null>(null);
  useEffect(() => {
    let alive = true;
    void import('@vgc-helper/engine/damage').then((m) => alive && setMod(m));
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}

export function Threats({
  rules,
  team,
  slots,
  meta,
  analysisRules,
  level,
  nameOf,
}: {
  rules: Rules;
  team: ResolvedSlot[];
  slots: TeamSlot[];
  meta: MetaSnapshot;
  analysisRules: AnalysisRules;
  level: ExperienceLevel;
  nameOf: (slot: number) => string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const damage = useDamageModule();
  const threats = useMemo(
    () =>
      damage
        ? damage.analyzeThreats(team, slots, rules.ctx, rules.index, meta, analysisRules)
        : null,
    [damage, team, slots, rules, meta, analysisRules],
  );

  if (!threats) return <p className="m-0 text-sm text-muted">{t('analysis.threats.loading')}</p>;

  const roll = (r: DamageResult) =>
    level === 'advanced'
      ? `${f.range(r.minPercent, r.maxPercent)} (${r.minDamage}–${r.maxDamage}/${r.defenderHp})`
      : f.range(r.minPercent, r.maxPercent);

  return (
    <>
      <ol className="m-0 flex list-none flex-col p-0">
        {threats.map((threat: Threat) => {
          const set = threat.set;
          const answered = threat.answeredBy.length > 0;
          return (
            <li key={threat.species} className="flex border-b border-line last:border-b-0">
              <TypeEdge types={set.species.types} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pl-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{set.species.name}</span>
                  <TypeChips types={set.species.types} short />
                  <span className="ml-auto text-muted">{f.share(threat.usage)}</span>
                </div>
                <span className={threat.ohko.length > 0 ? 'text-danger' : 'text-muted'}>
                  {threat.ohko.length > 0
                    ? `${t('analysis.threats.ohko', { count: threat.ohko.length })}: ${f.list(threat.ohko.map(nameOf))}`
                    : t('analysis.threats.ohkoNone')}
                </span>
                <span className="flex items-center gap-1.5">
                  {answered ? (
                    <ShieldCheck
                      className="size-3.5 text-success"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : (
                    <OctagonAlert
                      className="size-3.5 text-danger"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                  {answered
                    ? t('analysis.threats.answered', {
                        list: f.list(threat.answeredBy.map(nameOf)),
                      })
                    : t('analysis.threats.unanswered')}
                </span>
                {level !== 'beginner' && (
                  <details className="text-muted">
                    <summary className="cursor-pointer">{t('analysis.threats.details')}</summary>
                    <p className="m-0">
                      {t('analysis.threats.set', {
                        set: [
                          set.item && itemName(rules.index, set.item),
                          set.ability && abilityName(rules.index, set.ability),
                          ...set.moves.map((m) => m.name),
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      })}
                    </p>
                    <ul className="m-0 list-none p-0">
                      {threat.matchups.map((m) => (
                        <li key={m.slot}>
                          {m.taken
                            ? t('analysis.threats.taken', {
                                name: nameOf(m.slot),
                                range: roll(m.taken),
                                move: moveName(rules.index, m.taken.move),
                              })
                            : t('analysis.threats.noDamage', { name: set.species.name })}
                          {'; '}
                          {m.dealt
                            ? t('analysis.threats.dealt', {
                                name: nameOf(m.slot),
                                range: roll(m.dealt),
                                move: moveName(rules.index, m.dealt.move),
                              })
                            : t('analysis.threats.noDamage', { name: nameOf(m.slot) })}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="m-0 text-sm text-muted">{t('analysis.threats.rule')}</p>
    </>
  );
}
