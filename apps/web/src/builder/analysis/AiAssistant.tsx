import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AI_MAX_QUESTION,
  AI_MAX_TURNS,
  type AiAnswer,
  type AiErrorReason,
  type AiMessage,
  aiAnswerSchema,
  aiErrorReasonSchema,
  type ExperienceLevel,
  type TeamSlot,
} from '@vgc-helper/shared';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, api } from '../../api/client';
import { aiStatusQuery } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Controls';
import type { Rules } from '../../data/rules';
import { useDateTime } from '../../lib/dates';

/** Paragraphs and "- " bullet lines; the model is told to write nothing else. */
function Prose({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-2 text-sm">
      {blocks.map((block) => {
        const lines = block.split('\n').map((l) => l.trim());
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={block} className="m-0 flex list-disc flex-col gap-1 pl-5">
              {lines.map((l) => (
                <li key={l}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={block} className="m-0">
            {block.replace(/\*\*/g, '')}
          </p>
        );
      })}
    </div>
  );
}

function reasonOf(error: unknown): AiErrorReason {
  if (error instanceof ApiError) {
    const parsed = aiErrorReasonSchema.safeParse((error.body as { reason?: unknown })?.reason);
    if (parsed.success) return parsed.data;
  }
  return 'unavailable';
}

/**
 * Explain and Ask, on demand only. Hidden when the instance has no Gemini key; when the model
 * cannot answer, a short note says why and the analysis above stays complete without it.
 */
export function AiAssistant({
  rules,
  slots,
  level,
}: {
  rules: Rules;
  slots: TeamSlot[];
  level: ExperienceLevel;
}) {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const date = useDateTime();
  const status = useQuery(aiStatusQuery);
  const [explanation, setExplanation] = useState<{ answer: AiAnswer; team: string } | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [question, setQuestion] = useState('');

  const team = {
    gameId: rules.regulation.gameId,
    formatId: rules.ctx.format.id,
    regulationId: rules.regulation.id,
    slots,
  };
  const teamKey = JSON.stringify(team);
  const base = { team, locale: i18n.language === 'pt-BR' ? 'pt-BR' : 'en', level };

  const explain = useMutation({
    mutationFn: () => api('/ai/explain', { method: 'POST', body: base, schema: aiAnswerSchema }),
    onSuccess: (answer) => setExplanation({ answer, team: teamKey }),
  });
  const ask = useMutation({
    mutationFn: (conversation: AiMessage[]) =>
      api('/ai/chat', {
        method: 'POST',
        body: { ...base, messages: conversation },
        schema: aiAnswerSchema,
      }),
    onSuccess: (answer, conversation) => {
      setMessages([...conversation, { role: 'model', text: answer.text }]);
      setQuestion('');
    },
  });

  if (!status.data?.enabled || slots.length === 0) return null;

  const note = (answer: AiAnswer) =>
    t(answer.cached ? 'ai.noteCached' : 'ai.note', {
      model: answer.model,
      date: date(answer.createdAt),
    });
  const failure = (error: unknown): ReactNode => (
    <Alert tone="warning" toneLabel={t('tone.warning')} title={t(`ai.error.${reasonOf(error)}`)}>
      {t('ai.fallback')}
    </Alert>
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || ask.isPending) return;
    ask.mutate([...messages, { role: 'user' as const, text }].slice(-AI_MAX_TURNS));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => explain.mutate()} disabled={explain.isPending}>
          {explain.isPending ? t('ai.writing') : t('ai.explain')}
        </Button>
        <span className="text-sm text-muted">{t('ai.onDemand')}</span>
      </div>
      <div aria-live="polite" className="flex flex-col gap-2">
        {explain.isError && failure(explain.error)}
        {explanation && (
          <>
            {explanation.team !== teamKey && (
              <p className="m-0 text-sm text-warning">{t('ai.outdated')}</p>
            )}
            <Prose text={explanation.answer.text} />
            <p className="m-0 text-sm text-muted">{note(explanation.answer)}</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {messages.length > 0 && (
          <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t('ai.conversation')}>
            {messages.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: messages are only appended
              <li key={i} className={m.role === 'user' ? 'font-semibold' : ''}>
                <span className="label block">{t(m.role === 'user' ? 'ai.you' : 'ai.model')}</span>
                {m.role === 'user' ? (
                  <p className="m-0 text-sm">{m.text}</p>
                ) : (
                  <Prose text={m.text} />
                )}
              </li>
            ))}
          </ol>
        )}
        <div aria-live="polite">{ask.isError && failure(ask.error)}</div>
        <form onSubmit={submit} className="flex flex-col gap-1">
          <label htmlFor={`${ids}-q`} className="label">
            {t('ai.askLabel')}
          </label>
          <div className="flex gap-2">
            <TextInput
              id={`${ids}-q`}
              value={question}
              maxLength={AI_MAX_QUESTION}
              placeholder={t('ai.askPlaceholder')}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Button type="submit" disabled={ask.isPending || question.trim() === ''}>
              {ask.isPending ? t('ai.writing') : t('ai.ask')}
            </Button>
          </div>
        </form>
        {messages.length > 0 && (
          <Button variant="quiet" size="sm" className="self-start" onClick={() => setMessages([])}>
            {t('ai.clear')}
          </Button>
        )}
      </div>
    </div>
  );
}
