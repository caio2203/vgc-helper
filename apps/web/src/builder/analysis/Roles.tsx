import type { ArchetypeFinding, Checklist } from '@vgc-helper/engine';
import type { ExperienceLevel } from '@vgc-helper/shared';
import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Term } from '../../components/ui/Term';
import { useFormat } from './format';

/** The VGC role checklist: each group, who fills it, and the physical/special balance. */
export function RoleChecklist({
  checklist,
  nameOf,
  level,
}: {
  checklist: Checklist;
  nameOf: (slot: number) => string;
  level: ExperienceLevel;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <>
      <ul className="m-0 flex list-none flex-col p-0 text-sm">
        {checklist.groups.map((g) => {
          const slots = [...new Set(g.roles.flatMap((r) => r.matches.map((m) => m.slot)))];
          return (
            <li
              key={g.group}
              className="flex items-baseline gap-2 border-b border-line py-1 last:border-b-0"
            >
              {g.filled ? (
                <Check
                  className="size-3.5 shrink-0 text-success"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              ) : (
                <Minus
                  className="size-3.5 shrink-0 text-muted"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
              <span className="font-semibold">
                <Term
                  definition={level !== 'advanced' ? t(`analysis.glossary.${g.group}`) : undefined}
                >
                  {t(`analysis.groups.${g.group}`)}
                </Term>
              </span>
              <span className="ml-auto text-right text-muted">
                {g.filled ? f.list(slots.map(nameOf)) : t('analysis.checklist.missing')}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-sm text-muted">
        {t('analysis.checklist.balance', {
          physical: f.number(checklist.physical),
          special: f.number(checklist.special),
        })}{' '}
        {checklist.megas.length > 0
          ? t('analysis.checklist.megas', { list: f.list(checklist.megas.map(nameOf)) })
          : t('analysis.checklist.megasNone')}
      </p>
    </>
  );
}

export function Archetypes({
  findings,
  nameOf,
}: {
  findings: ArchetypeFinding[];
  nameOf: (slot: number) => string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  if (findings.length === 0) return <p className="m-0 text-sm">{t('analysis.archetype.none')}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
      {findings.map((a) => {
        const name = t(`analysis.archetype.names.${a.id}`);
        return (
          <li key={a.id}>
            <span className="font-semibold">
              {t('analysis.archetype.detected', {
                name,
                setters: a.setters.length > 0 ? f.list(a.setters.map(nameOf)) : '0',
                abusers: a.abusers.length > 0 ? f.list(a.abusers.map(nameOf)) : '0',
              })}
            </span>
            {a.missing.setters > 0 && (
              <span className="block text-warning">
                {t('analysis.archetype.missingSetters', { count: a.missing.setters, name })}
              </span>
            )}
            {a.missing.abusers > 0 && (
              <span className="block text-warning">
                {t('analysis.archetype.missingAbusers', { count: a.missing.abusers, name })}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
