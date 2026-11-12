import { isLegal, type LegalityIssue } from '@vgc-helper/engine';
import { useTranslation } from 'react-i18next';
import { Alert, type Tone } from '../components/ui/Alert';
import { Panel } from '../components/ui/Controls';
import type { Rules } from '../data/rules';
import { useDraft } from '../state/draft';
import { describeIssue } from './legalityText';

const TONE: Record<LegalityIssue['severity'], Tone> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};
const ORDER: LegalityIssue['severity'][] = ['error', 'warning', 'info'];

/**
 * Live analysis column. Phase 2 shows legality; the type matrix, threats, speed tiers and
 * suggestions join it in Phase 3. New findings are announced politely to screen readers.
 */
export function AnalysisPanel({ rules, issues }: { rules: Rules; issues: LegalityIssue[] }) {
  const { t } = useTranslation();
  const slots = useDraft((d) => d.slots);
  const sorted = [...issues].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const legal = isLegal(issues);
  // An empty team needs no list of what is missing; the empty-state line says it.
  const shown = slots.length === 0 ? [] : sorted;
  const source = rules.regulation.sources[0];

  return (
    <Panel title={t('analysis.title')} labelledBy="analysis-heading">
      <div className="flex flex-col gap-2 p-4" aria-live="polite">
        <h3 className="label m-0">
          {t('analysis.legality', { regulation: rules.regulation.name })}
        </h3>
        {slots.length > 0 && legal && (
          <Alert
            tone="success"
            title={t('analysis.legal', { regulation: rules.regulation.name })}
            toneLabel={t('tone.success')}
          >
            {t('analysis.legalDetail')}
          </Alert>
        )}
        {shown.map((issue, i) => (
          <Alert
            // biome-ignore lint/suspicious/noArrayIndexKey: issues have no id and are recomputed together
            key={`${issue.code}-${i}`}
            tone={TONE[issue.severity]}
            title={describeIssue(issue, slots, rules.index, t)}
            toneLabel={t(`tone.${TONE[issue.severity]}`)}
          />
        ))}
        {slots.length === 0 && <p className="m-0 text-muted">{t('analysis.empty')}</p>}
        {source && (
          <p className="m-0 mt-2 text-sm text-muted">
            {t('analysis.source', { name: rules.regulation.name })}{' '}
            <a href={source.url} className="text-ink underline underline-offset-2">
              {source.name}
            </a>
          </p>
        )}
        <p className="m-0 border-t border-line pt-3 text-sm text-muted">
          {t('analysis.comingNext')}
        </p>
      </div>
    </Panel>
  );
}
