import { Link } from '@tanstack/react-router';
import type { Team } from '@vgc-helper/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangeList } from '../changes/ChangeList';
import { Alert } from '../components/ui/Alert';
import type { Rules } from '../data/rules';
import { useDateTime } from '../lib/dates';
import { useRevalidation } from '../teams/useRevalidation';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The end of a regulation is announced in the builder this many days before it. */
const END_NOTICE_DAYS = 30;

/**
 * Notices above the builder: the regulation is ending or has ended, and the data changed since
 * the open team was saved (with the changes that touch it). Legality itself is in the analysis.
 */
export function DataNotices({ rules, saved }: { rules: Rules; saved: Team | undefined }) {
  const { t } = useTranslation();
  const date = useDateTime();
  const teams = useMemo(() => (saved ? [saved] : undefined), [saved]);
  const { results } = useRevalidation(teams);
  const check = saved ? results?.get(saved.id) : undefined;
  const { regulation } = rules;
  const now = Date.now();
  const endsAt = regulation.endsAt ? Date.parse(regulation.endsAt) : null;
  const daysLeft = endsAt === null ? null : Math.ceil((endsAt - now) / DAY_MS);

  return (
    <>
      {endsAt !== null && daysLeft !== null && daysLeft <= 0 && (
        <Alert
          tone="warning"
          toneLabel={t('tone.warning')}
          title={t('revalidation.endedTitle', {
            regulation: regulation.name,
            date: date(regulation.endsAt ?? '', false),
          })}
        >
          {t('revalidation.endedHint')}
        </Alert>
      )}
      {daysLeft !== null && daysLeft > 0 && daysLeft <= END_NOTICE_DAYS && (
        <Alert
          tone="info"
          toneLabel={t('tone.info')}
          title={t('revalidation.endsTitle', {
            regulation: regulation.name,
            date: date(regulation.endsAt ?? '', false),
          })}
        >
          {t('revalidation.endsHint', { count: daysLeft })}
        </Alert>
      )}
      {/* Only when a change touches this team; a usage move of other Pokémon is not worth it. */}
      {saved && check && !check.upToDate && check.changes.length > 0 && (
        <Alert tone="warning" toneLabel={t('tone.warning')} title={t('revalidation.bannerTitle')}>
          <p className="m-0">
            {t('revalidation.bannerHint', {
              saved: saved.snapshotVersion,
              current: rules.manifest.version,
            })}{' '}
            <Link to="/whats-new" className="text-ink underline underline-offset-2">
              {t('revalidation.seeAll')}
            </Link>
          </p>
          <div className="-mx-3 mt-2 border-t border-warning">
            <ChangeList changes={check.changes.map((c) => c.change)} />
          </div>
        </Alert>
      )}
    </>
  );
}
