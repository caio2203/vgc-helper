import { useQueries, useQuery } from '@tanstack/react-query';
import type { Manifest, ManifestRegulation, MetaSnapshot } from '@vgc-helper/data';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { manifestQuery, metaQuery } from '../api/queries';
import { useFormat } from '../builder/analysis/format';
import { Alert } from '../components/ui/Alert';
import { Panel } from '../components/ui/Controls';
import { useRules } from '../data/rules';
import { useDateTime } from '../lib/dates';
import { FeedbackSummary } from './FeedbackSummary';

const DAY_MS = 24 * 60 * 60 * 1000;
const LINK = 'text-ink underline underline-offset-2';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-1.5 sm:grid-cols-[12rem_1fr]">
      <dt className="text-muted">{term}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}

/** Usage and top-cut data of one format, with the sample size and the date it was retrieved. */
function FormatData({
  manifest,
  regulation,
  formatId,
  meta,
}: {
  manifest: Manifest;
  regulation: ManifestRegulation;
  formatId: string;
  meta: MetaSnapshot | undefined;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const date = useDateTime();
  const format = manifest.formats.find((x) => x.id === formatId);
  const name = format?.name ?? formatId;
  const config = regulation.formats.find((x) => x.formatId === formatId)?.tournaments;
  if (!meta) return <Row term={name}>{t('common.loading')}</Row>;
  const small = format && meta.battles < format.viability.minBattles;
  const cut = meta.tournaments;
  return (
    <>
      <Row term={t('admin.usage', { format: name })}>
        {t('admin.usageValue', {
          period: meta.period,
          battles: f.number(meta.battles),
          rating: meta.ratingCutoff,
          date: date(meta.source.retrievedAt, false),
        })}{' '}
        <a className={LINK} href={meta.source.url} rel="noreferrer">
          smogon.com/stats
        </a>
        {small && (
          <span className="block text-warning">
            {t('admin.smallSample', { min: f.number(format.viability.minBattles) })}
          </span>
        )}
      </Row>
      <Row term={t('admin.topCut', { format: name })}>
        {cut ? (
          <>
            {t('admin.topCutValue', {
              events: f.number(cut.events.length),
              teams: f.number(cut.teams),
              players: cut.minPlayers,
              top: cut.topPlacings,
              from: date(`${cut.from}T00:00:00Z`, false),
              to: date(`${cut.to}T00:00:00Z`, false),
              date: date(cut.source.retrievedAt, false),
            })}{' '}
            <a className={LINK} href={cut.source.url} rel="noreferrer">
              limitlesstcg.com
            </a>
          </>
        ) : (
          <span className="text-muted">
            {config ? t('admin.topCutMissing') : t('admin.topCutNone')}
          </span>
        )}
      </Row>
    </>
  );
}

/**
 * The owner's view of the data: snapshot version, sources and their dates, what the last pipeline
 * run flagged, and how the suggestions were rated.
 */
export function AdminPage() {
  const { t } = useTranslation();
  const ids = useId();
  const date = useDateTime();
  const f = useFormat();
  const manifest = useQuery(manifestQuery);
  const { rules } = useRules();
  const m = manifest.data;
  const metaKeys =
    m?.regulations.flatMap((r) =>
      Object.keys(r.files.meta).map((formatId) => ({ regulation: r, formatId })),
    ) ?? [];
  const metas = useQueries({
    queries: metaKeys.map(({ regulation, formatId }) =>
      metaQuery(regulation.gameId, regulation.id, formatId),
    ),
  });

  if (manifest.isError) {
    return <Alert tone="error" title={t('common.error')} toneLabel={t('tone.error')} />;
  }
  if (!m) return <p className="text-muted">{t('common.loading')}</p>;
  const now = Date.now();
  const dex = rules?.ctx.dex.source;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="wdth-display m-0 text-h1 font-[750]">{t('admin.title')}</h1>
      <p className="m-0 text-muted">{t('admin.intro')}</p>

      <Panel title={t('admin.snapshot')} labelledBy={`${ids}-snapshot`}>
        <dl className="m-0 px-4 py-2.5 text-sm">
          <Row term={t('admin.version')}>
            <code>{m.version}</code>
          </Row>
          <Row term={t('admin.built')}>{date(m.generatedAt)}</Row>
          {dex && (
            <Row term={t('admin.dex')}>
              {t('admin.dexValue', { name: dex.name, date: date(dex.retrievedAt, false) })}
            </Row>
          )}
          <Row term={t('admin.overrides')}>
            {m.overridesApplied.length > 0 ? f.list(m.overridesApplied) : t('admin.overridesNone')}
          </Row>
        </dl>
      </Panel>

      <Panel title={t('admin.warnings')} labelledBy={`${ids}-warnings`}>
        <div className="flex flex-col gap-2 p-4">
          {m.warnings.length === 0 ? (
            <p className="m-0 text-sm">{t('admin.warningsNone')}</p>
          ) : (
            m.warnings.map((w) => (
              <Alert key={w} tone="warning" toneLabel={t('tone.warning')} title={w} />
            ))
          )}
          <p className="m-0 text-sm text-muted">{t('admin.warningsNote')}</p>
        </div>
      </Panel>

      {m.regulations.map((r) => {
        const daysLeft = r.endsAt ? Math.ceil((Date.parse(r.endsAt) - now) / DAY_MS) : null;
        return (
          <Panel key={r.id} title={r.name} labelledBy={`${ids}-${r.id}`}>
            <dl className="m-0 px-4 py-2.5 text-sm">
              <Row term={t('admin.dates')}>
                {r.endsAt
                  ? t('admin.datesValue', {
                      start: date(r.startsAt, false),
                      end: date(r.endsAt, false),
                    })
                  : t('admin.datesOpen', { start: date(r.startsAt, false) })}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="block text-muted">
                    {t('admin.daysLeft', { count: daysLeft })}
                  </span>
                )}
              </Row>
              <Row term={t('admin.verified')}>{date(r.verifiedAt, false)}</Row>
              {metaKeys.map((key, i) =>
                key.regulation.id === r.id ? (
                  <FormatData
                    key={key.formatId}
                    manifest={m}
                    regulation={r}
                    formatId={key.formatId}
                    meta={metas[i]?.data}
                  />
                ) : null,
              )}
            </dl>
          </Panel>
        );
      })}

      <FeedbackSummary nameOf={(id) => rules?.index.species.get(id)?.name ?? id} />
    </div>
  );
}
