import type { DexIndex, Revalidation } from '@vgc-helper/engine';
import type { TeamSlot } from '@vgc-helper/shared';
import { Check, OctagonAlert, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { describeIssue } from '../builder/legalityText';
import { ChangeList } from '../changes/ChangeList';
import { useDateTime } from '../lib/dates';

/** Problems that make the team unusable as saved: illegal slots or a regulation that is gone. */
export function problemCount(r: Revalidation): number {
  return (
    r.issues.length +
    (r.inForce?.issues.length ?? 0) +
    (r.regulation.status === 'missing' || r.regulation.status === 'ended' ? 1 : 0)
  );
}

/** One line for the team list: current data, no problems, or how many problems and changes. */
export function RevalidationSummary({ result }: { result: Revalidation }) {
  const { t } = useTranslation();
  const problems = problemCount(result);
  const changes = result.changes.length;
  if (result.upToDate && problems === 0) {
    return <span className="text-muted">{t('revalidation.upToDate')}</span>;
  }
  if (problems === 0 && changes === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <Check className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {t('revalidation.fine')}
      </span>
    );
  }
  const Icon = problems > 0 ? OctagonAlert : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${problems > 0 ? 'text-danger' : 'text-warning'}`}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {[
        problems > 0 ? t('revalidation.problems', { count: problems }) : null,
        changes > 0 ? t('revalidation.changes', { count: changes }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </span>
  );
}

/**
 * What changed for one saved team: its regulation, the slots that are no longer legal (in its
 * regulation and in the one in force), and the history changes that touch its Pokémon and moves.
 */
export function RevalidationBody({
  result,
  slots,
  indexOf,
}: {
  result: Revalidation;
  slots: TeamSlot[];
  indexOf: (regulationId: string) => DexIndex | undefined;
}) {
  const { t } = useTranslation();
  const date = useDateTime();
  const { regulation, inForce } = result;
  const issueList = (regulationId: string, issues: Revalidation['issues']) => {
    const index = indexOf(regulationId);
    if (!index) return null;
    return (
      <ul className="m-0 list-disc pl-5">
        {issues.map((issue) => {
          const text = describeIssue(issue, slots, index, t);
          return (
            <li key={text} className="text-danger">
              {text}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      {regulation.status === 'ended' && regulation.endsAt && (
        <p className="m-0 text-warning">
          {t('revalidation.ended', {
            regulation: regulation.id,
            date: date(regulation.endsAt, false),
          })}
        </p>
      )}
      {regulation.status === 'missing' && (
        <p className="m-0 text-danger">
          {t('revalidation.missing', { regulation: regulation.id })}
        </p>
      )}
      {result.issues.length > 0 && (
        <div>
          <p className="m-0 font-semibold">
            {t('revalidation.ownIssues', { regulation: regulation.id })}
          </p>
          {issueList(regulation.id, result.issues)}
        </div>
      )}
      {inForce &&
        (inForce.issues.length > 0 ? (
          <div>
            <p className="m-0 font-semibold">
              {t('revalidation.inForce', { regulation: inForce.name })}
            </p>
            {issueList(inForce.regulationId, inForce.issues)}
          </div>
        ) : (
          <p className="m-0 text-success">
            {t('revalidation.inForceLegal', { regulation: inForce.name })}
          </p>
        ))}
      {!result.historyKnown && <p className="m-0 text-muted">{t('revalidation.historyUnknown')}</p>}
      {result.changes.length > 0 && (
        <div>
          <p className="m-0 font-semibold">{t('revalidation.changesTitle')}</p>
          <div className="-mx-4">
            <ChangeList changes={result.changes.map((c) => c.change)} />
          </div>
        </div>
      )}
    </div>
  );
}
