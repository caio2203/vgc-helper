import { useMutation } from '@tanstack/react-query';
import type { ScorePart, Suggestion } from '@vgc-helper/engine';
import type { ExperienceLevel, FeedbackInput } from '@vgc-helper/shared';
import { Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TypeChips, TypeEdge } from '../../components/ui/Type';
import type { Rules } from '../../data/rules';
import { useDraft } from '../../state/draft';
import { useUi } from '../../state/ui';
import { MAX_SLOTS } from '../slots';
import { abilityName, itemName, speciesName, useFormat } from './format';

export function Suggestions({
  rules,
  suggestions,
  level,
  cutoff,
  teamSpecies,
}: {
  rules: Rules;
  suggestions: Suggestion[];
  level: ExperienceLevel;
  cutoff: number;
  teamSpecies: string[];
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const { announce } = useUi();
  const slots = useDraft((d) => d.slots);
  const [rated, setRated] = useState<Record<string, boolean>>({});
  const feedback = useMutation({
    mutationFn: (body: FeedbackInput) => api('/feedback', { method: 'POST', body }),
    onSuccess: (_, body) => {
      setRated((r) => ({ ...r, [body.subject]: body.helpful }));
      announce(t('analysis.suggestions.thanks'));
    },
    onError: () => announce(t('analysis.suggestions.feedbackError')),
  });

  const full = slots.length >= MAX_SLOTS;
  const typeList = (types: string[]) => f.list(types);
  const partText = (p: ScorePart) => {
    switch (p.criterion) {
      case 'coversWeakness':
      case 'addsWeakness':
        return t(`analysis.suggestions.parts.${p.criterion}`, { list: typeList(p.types) });
      case 'fillsRole':
        return t('analysis.suggestions.parts.fillsRole', {
          list: f.list(p.groups.map((g) => t(`analysis.groups.${g}`))),
        });
      case 'usage':
        return t('analysis.suggestions.parts.usage', { usage: f.share(p.usage) });
      case 'teammates':
        return t('analysis.suggestions.parts.teammates', {
          list: f.list(
            p.partners.map((x) =>
              level === 'beginner'
                ? speciesName(rules.index, x.species)
                : `${speciesName(rules.index, x.species)} (${f.share(x.share)})`,
            ),
          ),
        });
    }
  };

  function add(s: Suggestion) {
    const n = useDraft.getState().slots.length;
    if (n >= MAX_SLOTS) return;
    useDraft.getState().edit((e) => ({ ...e, slots: [...e.slots, s.slot] }));
    useDraft.getState().select(n);
    announce(t('analysis.suggestions.added', { name: s.species.name, n: n + 1 }));
  }

  function rate(s: Suggestion, rank: number, helpful: boolean) {
    feedback.mutate({
      kind: 'suggestion',
      subject: s.species.id,
      helpful,
      gameId: rules.regulation.gameId,
      formatId: rules.ctx.format.id,
      regulationId: rules.regulation.id,
      snapshotVersion: rules.manifest.version,
      score: s.score,
      rank,
      experienceLevel: level,
      team: teamSpecies,
    });
  }

  if (full) return <p className="m-0 text-sm text-muted">{t('analysis.suggestions.full')}</p>;
  if (suggestions.length === 0)
    return <p className="m-0 text-sm">{t('analysis.suggestions.none')}</p>;

  return (
    <>
      <p className="m-0 text-sm text-muted">
        {t('analysis.suggestions.cutoff', { cutoff: f.share(cutoff) })}
      </p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {suggestions.map((s, i) => {
          const set = s.set;
          const vote = rated[s.species.id];
          return (
            <li key={s.species.id} className="flex rounded-md border border-line">
              <TypeEdge types={set.species.types} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{set.species.name}</span>
                  <TypeChips types={set.species.types} short />
                  {s.offMeta && (
                    <span className="rounded-sm border border-line-strong px-1 text-micro text-muted">
                      {t('analysis.suggestions.offMeta')}
                    </span>
                  )}
                  {level !== 'beginner' && (
                    <span className="ml-auto font-semibold">
                      {t('analysis.suggestions.score', { score: f.number(s.score) })}
                    </span>
                  )}
                </div>
                <ul className="m-0 flex list-none flex-col p-0">
                  {s.parts.map((p) => (
                    <li
                      key={p.criterion}
                      className={
                        p.criterion === 'addsWeakness' ? 'flex gap-2 text-danger' : 'flex gap-2'
                      }
                    >
                      <span className="min-w-0 flex-1">{partText(p)}</span>
                      {level === 'advanced' && (
                        <span className="text-muted">
                          {t('analysis.suggestions.points', {
                            points: `${p.points > 0 ? '+' : ''}${f.number(p.points)}`,
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="m-0 text-muted">
                  <span className="sr-only">{t('analysis.suggestions.set')}: </span>
                  {[
                    set.item && itemName(rules.index, set.item),
                    set.ability && abilityName(rules.index, set.ability),
                    set.moves.map((m) => m.name).join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {level === 'advanced' && set.nature && (
                    <span className="block">
                      {rules.index.natures.get(set.nature)?.name} ·{' '}
                      {Object.entries(set.spread)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => `${v} ${t(`stats.${k}`)}`)
                        .join(' / ')}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" onClick={() => add(s)}>
                    <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t('analysis.suggestions.add', { name: s.species.name })}
                  </Button>
                  <span className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="quiet"
                      className="aria-pressed:underline aria-pressed:opacity-100"
                      aria-pressed={vote === true}
                      disabled={vote !== undefined || feedback.isPending}
                      onClick={() => rate(s, i + 1, true)}
                    >
                      <ThumbsUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      {t('analysis.suggestions.useful')}
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      className="aria-pressed:underline aria-pressed:opacity-100"
                      aria-pressed={vote === false}
                      disabled={vote !== undefined || feedback.isPending}
                      onClick={() => rate(s, i + 1, false)}
                    >
                      <ThumbsDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      {t('analysis.suggestions.notUseful')}
                    </Button>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
