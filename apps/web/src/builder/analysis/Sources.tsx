import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import { useTranslation } from 'react-i18next';
import type { Rules } from '../../data/rules';
import { useDateTime } from '../../lib/dates';
import { useFormat } from './format';

const Link = ({ href, children }: { href: string; children: string }) => (
  <a href={href} className="text-ink underline underline-offset-2" rel="noreferrer">
    {children}
  </a>
);

/** Every number in the column traces back to one of these (DESIGN.md §2.4). */
export function Sources({
  rules,
  meta,
  analysisRules,
}: {
  rules: Rules;
  meta: MetaSnapshot | null;
  analysisRules: AnalysisRules;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const date = useDateTime();
  const dex = rules.ctx.dex.source;
  const ruleSource = analysisRules.sources.at(-1);
  const regulationSource = rules.regulation.sources[0];
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-muted">
      {regulationSource && (
        <li>
          {t('analysis.source', { name: rules.regulation.name })}{' '}
          <Link href={regulationSource.url}>{regulationSource.name}</Link>
        </li>
      )}
      {meta && (
        <li>
          {t('analysis.sources.meta', {
            name: meta.source.name,
            battles: f.number(meta.battles),
            date: date(meta.source.retrievedAt, false),
          })}{' '}
          <Link href={meta.source.url}>smogon.com/stats</Link>
        </li>
      )}
      <li>{t('analysis.sources.dex', { name: dex.name, date: date(dex.retrievedAt, false) })}</li>
      {ruleSource && (
        <li>
          {t('analysis.sources.rules', {
            name: ruleSource.name,
            date: date(ruleSource.retrievedAt, false),
          })}{' '}
          <Link href={ruleSource.url}>analysis.json</Link>
        </li>
      )}
      <li>{t('analysis.sources.calc', { level: rules.ctx.format.level })}</li>
    </ul>
  );
}
