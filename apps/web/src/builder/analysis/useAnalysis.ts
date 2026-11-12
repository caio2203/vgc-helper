import { useQuery } from '@tanstack/react-query';
import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import { analysisRulesFor, analyzeTeam, type TeamAnalysis } from '@vgc-helper/engine';
import type { ExperienceLevel, TeamSlot } from '@vgc-helper/shared';
import { useDeferredValue, useMemo } from 'react';
import { metaQuery, settingsQuery } from '../../api/queries';
import type { Rules } from '../../data/rules';

export interface AnalysisState {
  analysis: TeamAnalysis | null;
  analysisRules: AnalysisRules | null;
  meta: MetaSnapshot | null;
  level: ExperienceLevel;
  cutoff: number;
  offMeta: boolean;
  /** The slots the analysis was computed for (deferred while typing). */
  slots: TeamSlot[];
}

/**
 * Runs the engine on the draft. The meta snapshot of the format loads once; the analysis reruns on
 * every change, deferred so typing in the editor never waits for it.
 */
export function useAnalysis(rules: Rules, draftSlots: TeamSlot[]): AnalysisState {
  const settings = useQuery(settingsQuery);
  const { gameId, id: regulationId } = rules.regulation;
  const formatId = rules.ctx.format.id;
  const hasMeta = Boolean(rules.regulation.files.meta[formatId]);
  const meta = useQuery({ ...metaQuery(gameId, regulationId, formatId), enabled: hasMeta });
  const slots = useDeferredValue(draftSlots);

  const analysisRules = useMemo(
    () => analysisRulesFor(rules.manifest, gameId),
    [rules.manifest, gameId],
  );
  const cutoff = settings.data?.viabilityCutoff ?? rules.ctx.format.viability.defaultCutoff;
  const offMeta = settings.data?.offMetaMode ?? false;

  const analysis = useMemo(
    () =>
      analysisRules
        ? analyzeTeam(slots, rules.ctx, rules.index, analysisRules, meta.data ?? null, {
            cutoff,
            offMeta,
          })
        : null,
    [slots, rules, analysisRules, meta.data, cutoff, offMeta],
  );

  return {
    analysis,
    analysisRules,
    meta: meta.data ?? null,
    level: settings.data?.experienceLevel ?? 'intermediate',
    cutoff,
    offMeta,
    slots,
  };
}
