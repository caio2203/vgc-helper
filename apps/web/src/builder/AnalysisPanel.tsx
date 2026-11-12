import { isLegal, type LegalityIssue } from '@vgc-helper/engine';
import { useTranslation } from 'react-i18next';
import { Alert, type Tone } from '../components/ui/Alert';
import { Panel } from '../components/ui/Controls';
import type { Rules } from '../data/rules';
import { useDraft } from '../state/draft';
import { moveName, speciesName, useFormat } from './analysis/format';
import { Archetypes, RoleChecklist } from './analysis/Roles';
import { Section } from './analysis/Section';
import { Sources } from './analysis/Sources';
import { SpeedTiers } from './analysis/SpeedTiers';
import { Suggestions } from './analysis/Suggestions';
import { Threats } from './analysis/Threats';
import { TypeMatrix } from './analysis/TypeMatrix';
import { useAnalysis } from './analysis/useAnalysis';
import { describeIssue } from './legalityText';

const TONE: Record<LegalityIssue['severity'], Tone> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};
const ORDER: LegalityIssue['severity'][] = ['error', 'warning', 'info'];

/**
 * Live analysis column: legality, alerts, suggestions, type matrix, roles, archetype, speed tiers
 * and meta threats, each with its sources at the bottom. New alerts are announced politely.
 */
export function AnalysisPanel({ rules, issues }: { rules: Rules; issues: LegalityIssue[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const draftSlots = useDraft((d) => d.slots);
  const { analysis, analysisRules, meta, level, cutoff, slots } = useAnalysis(rules, draftSlots);
  const sorted = [...issues].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const legal = isLegal(issues);
  const empty = draftSlots.length === 0;

  const nameOf = (slot: number) => {
    const s = slots[slot];
    return s ? speciesName(rules.index, s.species) : '';
  };
  const names =
    analysis?.team.map((s) => ({
      slot: s.slot,
      short: s.species.name.slice(0, 3),
      full: s.species.name,
    })) ?? [];

  return (
    <Panel title={t('analysis.title')} labelledBy="analysis-heading">
      <Section title={t('analysis.legality', { regulation: rules.regulation.name })}>
        <div className="flex flex-col gap-2" aria-live="polite">
          {!empty && legal && (
            <Alert
              tone="success"
              title={t('analysis.legal', { regulation: rules.regulation.name })}
              toneLabel={t('tone.success')}
            >
              {t('analysis.legalDetail')}
            </Alert>
          )}
          {!empty &&
            sorted.map((issue, i) => (
              <Alert
                // biome-ignore lint/suspicious/noArrayIndexKey: issues have no id and are recomputed together
                key={`${issue.code}-${i}`}
                tone={TONE[issue.severity]}
                title={describeIssue(issue, draftSlots, rules.index, t)}
                toneLabel={t(`tone.${TONE[issue.severity]}`)}
              />
            ))}
          {empty && <p className="m-0 text-muted">{t('analysis.empty')}</p>}
        </div>
      </Section>

      {analysis && analysis.stacked.length > 0 && (
        <Section title={t('analysis.sections.alerts')}>
          <div className="flex flex-col gap-2" aria-live="polite">
            {analysis.stacked.map((s) => (
              <Alert
                key={s.type}
                tone={s.coveredBy.length > 0 ? 'warning' : 'error'}
                toneLabel={t(s.coveredBy.length > 0 ? 'tone.warning' : 'tone.error')}
                title={t('analysis.stacked.title', { count: s.slots.length, type: s.type })}
              >
                <p className="m-0">
                  {t('analysis.stacked.added', { name: nameOf(s.addedBy), count: s.slots.length })}{' '}
                  {s.users.length > 0 &&
                    t('analysis.stacked.users', {
                      list: f.list(
                        s.users.slice(0, 3).map((u) =>
                          t('analysis.stacked.user', {
                            name: speciesName(rules.index, u.species),
                            usage: f.share(u.usage),
                            move: moveName(rules.index, u.move),
                          }),
                        ),
                      ),
                    })}{' '}
                  {s.coveredBy.length > 0
                    ? t('analysis.stacked.covered', {
                        count: s.coveredBy.length,
                        list: f.list(s.coveredBy.map(nameOf)),
                      })
                    : analysis.recommendedTypes.length > 0 &&
                      t('analysis.stacked.recommended', {
                        list: f.list(analysis.recommendedTypes.map((r) => r.type)),
                      })}
                </p>
              </Alert>
            ))}
          </div>
        </Section>
      )}

      {analysis && meta && (
        <Section title={t('analysis.sections.suggestions')}>
          <Suggestions
            rules={rules}
            suggestions={analysis.suggestions}
            level={level}
            cutoff={cutoff}
            teamSpecies={slots.map((s) => s.species)}
          />
        </Section>
      )}

      {analysis && !empty && (
        <>
          <Section title={t('analysis.sections.types')}>
            <TypeMatrix types={analysis.types} names={names} />
          </Section>
          <Section title={t('analysis.sections.coverage')}>
            <p className="m-0 text-sm">
              {analysis.team.every((s) => s.moves.every((m) => m.category === 'Status'))
                ? t('analysis.coverage.noAttacks')
                : analysis.types.coverageGaps.length > 0
                  ? t('analysis.coverage.gaps', { list: f.list(analysis.types.coverageGaps) })
                  : t('analysis.coverage.full')}
            </p>
          </Section>
          <Section title={t('analysis.sections.checklist')}>
            <RoleChecklist checklist={analysis.checklist} nameOf={nameOf} level={level} />
          </Section>
          <Section title={t('analysis.sections.archetypes')}>
            <Archetypes findings={analysis.archetypes} nameOf={nameOf} />
          </Section>
          <Section title={t('analysis.sections.speed')}>
            <SpeedTiers speed={analysis.speed} index={rules.index} level={level} />
          </Section>
          {meta && analysisRules && (
            <Section title={t('analysis.sections.threats')}>
              <Threats
                rules={rules}
                team={analysis.team}
                slots={slots}
                meta={meta}
                analysisRules={analysisRules}
                level={level}
                nameOf={nameOf}
              />
            </Section>
          )}
        </>
      )}

      {analysisRules && (
        <Section title={t('analysis.sources.title')}>
          <Sources rules={rules} meta={meta} analysisRules={analysisRules} />
        </Section>
      )}
    </Panel>
  );
}
