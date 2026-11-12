import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { checkLegality, parsePaste } from '@vgc-helper/engine';
import { type Team, teamSchema } from '@vgc-helper/shared';
import { Download, FilePlus2, History, Redo2, Save, Undo2, Upload } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, api } from '../api/client';
import { manifestQuery, teamQuery } from '../api/queries';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Select, TextInput } from '../components/ui/Controls';
import { cx } from '../components/ui/cx';
import { currentRegulation, useRules } from '../data/rules';
import { isMod, isTextTarget, isTyping } from '../lib/keys';
import { isDirty, useDraft } from '../state/draft';
import { useUi } from '../state/ui';
import { AnalysisPanel } from './AnalysisPanel';
import { DataNotices } from './DataNotices';
import { HistoryDialog } from './HistoryDialog';
import { PasteDialog, type PasteMode } from './PasteDialog';
import { SlotEditor } from './SlotEditor';
import { SlotList } from './SlotList';
import { MAX_SLOTS } from './slots';

type MobileTab = 'team' | 'analysis';

export function BuilderPage({ teamId }: { teamId?: string }) {
  const { t } = useTranslation();
  const ids = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useDraft();
  const dirty = isDirty(draft);
  const { announce, pending, request } = useUi();
  const manifest = useQuery(manifestQuery);
  const saved = useQuery({ ...teamQuery(teamId ?? ''), enabled: Boolean(teamId) });
  const [paste, setPaste] = useState<PasteMode | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tab, setTab] = useState<MobileTab>('team');
  const [conflict, setConflict] = useState(false);
  const speciesInput = useRef<HTMLInputElement>(null);

  // Load the saved team, or the new-team draft, once the rules are known.
  useEffect(() => {
    const state = useDraft.getState();
    if (teamId) {
      if (saved.data && state.teamId !== teamId) state.load(saved.data, saved.data);
    } else if (manifest.data && (state.teamId !== null || state.gameId === '')) {
      const format = manifest.data.formats[0];
      const regulation = format ? currentRegulation(manifest.data, format.gameId) : undefined;
      if (format && regulation) {
        state.load(null, {
          gameId: format.gameId,
          formatId: format.id,
          regulationId: regulation.id,
        });
      }
    }
  }, [teamId, saved.data, manifest.data]);

  const { rules, isError } = useRules({
    gameId: draft.gameId || undefined,
    formatId: draft.formatId || undefined,
    regulationId: draft.regulationId || undefined,
  });
  const issues = useMemo(
    () => (rules ? checkLegality(draft.slots, rules.ctx, rules.index) : []),
    [rules, draft.slots],
  );

  const save = useMutation({
    mutationFn: async (): Promise<Team> => {
      if (!rules) throw new Error('Rules not loaded');
      const state = useDraft.getState();
      if (state.name.trim() === '') state.edit((e) => ({ ...e, name: t('builder.untitled') }));
      const d = useDraft.getState();
      const body = {
        name: d.name.trim(),
        gameId: d.gameId,
        formatId: d.formatId,
        regulationId: d.regulationId,
        snapshotVersion: rules.manifest.version,
        slots: d.slots,
        notes: d.notes,
      };
      return d.teamId
        ? api(`/teams/${d.teamId}`, {
            method: 'PUT',
            body: { ...body, expectedVersion: d.version },
            schema: teamSchema,
          })
        : api('/teams', { method: 'POST', body, schema: teamSchema });
    },
    onSuccess: async (team) => {
      const wasNew = useDraft.getState().teamId === null;
      useDraft.getState().markSaved(team);
      queryClient.setQueryData(teamQuery(team.id).queryKey, team);
      await queryClient.invalidateQueries({ queryKey: ['teams'], exact: true });
      setConflict(false);
      announce(t('builder.saved', { name: team.name }));
      if (wasNew)
        await navigate({ to: '/teams/$teamId', params: { teamId: team.id }, replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
    },
  });

  // Keyboard: 1–6 pick a slot, Ctrl Z / Ctrl Shift Z undo and redo, Ctrl S saves.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const state = useDraft.getState();
      if (isMod(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!save.isPending) save.mutate();
        return;
      }
      if (isTyping(event)) return;
      if (isMod(event) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (isMod(event) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
      } else if (!isMod(event) && !event.altKey && /^[1-6]$/.test(event.key)) {
        const slot = Number(event.key) - 1;
        if (slot <= state.slots.length) {
          state.select(slot);
          setTab('team');
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Paste anywhere on the page (outside text fields) imports a Showdown team.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (!rules || isTextTarget(event.target)) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      const parsed = parsePaste(text, rules.index);
      const known = parsed.slots.filter((s) => rules.index.species.has(s.species));
      if (known.length === 0) return;
      event.preventDefault();
      useDraft.getState().edit((e) => ({ ...e, slots: parsed.slots.slice(0, MAX_SLOTS) }));
      useDraft.getState().select(0);
      announce(t('paste.importedUndo', { count: Math.min(parsed.slots.length, MAX_SLOTS) }));
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [rules, announce, t]);

  // Requests from the command palette.
  useEffect(() => {
    if (!pending) return;
    request(null);
    if (pending === 'import' || pending === 'export') setPaste(pending);
    if (pending === 'save') save.mutate();
    if (pending === 'history' && draft.teamId) setHistoryOpen(true);
    if (pending === 'new') startNew();
  });

  // Warn before leaving with unsaved changes to a saved team (new drafts are kept locally).
  useEffect(() => {
    if (!dirty || !draft.teamId) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, draft.teamId]);

  function startNew() {
    try {
      localStorage.removeItem('vgc.draft');
    } catch {
      // Storage blocked.
    }
    const state = useDraft.getState();
    state.load(null, {
      gameId: state.gameId,
      formatId: state.formatId,
      regulationId: state.regulationId,
    });
    if (teamId) void navigate({ to: '/' });
  }

  if (isError || saved.isError) {
    return (
      <Alert
        tone="error"
        title={saved.isError ? t('builder.loadTeamError') : t('builder.loadDataError')}
        toneLabel={t('tone.error')}
      >
        {t('builder.loadErrorHint')}
      </Alert>
    );
  }
  if (!rules || (teamId && draft.teamId !== teamId)) {
    return <BuilderSkeleton label={t('common.loading')} />;
  }

  const regulations = rules.manifest.regulations.filter((r) => r.gameId === draft.gameId);
  const formats = rules.manifest.formats.filter((f) =>
    rules.regulation.formats.some((rf) => rf.formatId === f.id),
  );
  const saveLabel = save.isPending
    ? t('builder.saving')
    : dirty || !draft.teamId
      ? t('builder.unsaved')
      : t('builder.allSaved');

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-0">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label htmlFor={`${ids}-name`} className="label">
            {t('builder.teamName')}
          </label>
          <TextInput
            id={`${ids}-name`}
            value={draft.name}
            maxLength={80}
            placeholder={t('builder.untitled')}
            onChange={(e) => draft.edit((x) => ({ ...x, name: e.target.value }))}
            className="wdth-heading text-h3 font-[650]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-format`} className="label">
            {t('builder.format')}
          </label>
          <Select
            id={`${ids}-format`}
            value={draft.formatId}
            onChange={(e) => draft.edit((x) => ({ ...x, formatId: e.target.value }))}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-reg`} className="label">
            {t('builder.regulation')}
          </label>
          <Select
            id={`${ids}-reg`}
            value={draft.regulationId}
            onChange={(e) => draft.edit((x) => ({ ...x, regulationId: e.target.value }))}
          >
            {regulations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="quiet"
            size="md"
            onClick={() => draft.undo()}
            disabled={draft.past.length === 0}
            aria-label={t('builder.undo')}
            title={t('builder.undo')}
          >
            <Undo2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <Button
            variant="quiet"
            onClick={() => draft.redo()}
            disabled={draft.future.length === 0}
            aria-label={t('builder.redo')}
            title={t('builder.redo')}
          >
            <Redo2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <Button onClick={() => setPaste('import')}>
            <Upload className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t('builder.import')}
          </Button>
          <Button onClick={() => setPaste('export')} disabled={draft.slots.length === 0}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t('builder.export')}
          </Button>
          {draft.teamId && (
            <Button onClick={() => setHistoryOpen(true)}>
              <History className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {t('builder.history')}
            </Button>
          )}
          <Button onClick={startNew}>
            <FilePlus2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t('builder.new')}
          </Button>
          <Button
            variant="primary"
            onClick={() => save.mutate()}
            disabled={save.isPending || draft.slots.length === 0}
          >
            <Save className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t('builder.save')}
          </Button>
          <span className="text-sm text-muted" aria-live="polite">
            {saveLabel}
          </span>
        </div>
      </div>

      {conflict && (
        <Alert tone="warning" title={t('builder.conflict')} toneLabel={t('tone.warning')}>
          {t('builder.conflictHint')}
        </Alert>
      )}
      <DataNotices rules={rules} saved={teamId ? saved.data : undefined} />
      {save.isError && !conflict && (
        <Alert tone="error" title={t('builder.saveError')} toneLabel={t('tone.error')}>
          {t('builder.saveErrorHint')}
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_380px]">
        <div className={cx('flex flex-col gap-4', tab !== 'team' && 'hidden md:flex')}>
          <SlotList rules={rules} issues={issues} />
        </div>
        <div className={cx('min-w-0', tab !== 'team' && 'hidden md:block')}>
          <SlotEditor rules={rules} speciesInput={speciesInput} />
        </div>
        <div
          className={cx(
            'md:col-span-2 xl:sticky xl:top-4 xl:col-span-1 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto',
            tab !== 'analysis' && 'hidden md:block',
          )}
        >
          <AnalysisPanel rules={rules} issues={issues} />
        </div>
      </div>

      {/* Phone: Team / Analysis tabs at the bottom (DESIGN.md §7). */}
      <nav
        aria-label={t('builder.views')}
        className="fixed inset-x-0 bottom-0 z-30 grid h-14 grid-cols-2 border-t border-line bg-surface md:hidden"
      >
        {(['team', 'analysis'] as const).map((v) => {
          const errors = issues.filter((i) => i.severity === 'error').length;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={tab === v}
              onClick={() => setTab(v)}
              className={cx('font-semibold', tab === v ? 'text-ink' : 'text-muted')}
            >
              {t(`builder.tab.${v}`)}
              {v === 'analysis' && errors > 0 && (
                <span className="ml-1.5 rounded-sm border border-danger px-1 text-micro text-danger">
                  {t('builder.errorCount', { count: errors })}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <PasteDialog
        rules={rules}
        mode={paste}
        onClose={() => setPaste(null)}
        onModeChange={setPaste}
      />
      {draft.teamId && (
        <HistoryDialog
          teamId={draft.teamId}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

/** Static skeleton with the shape of the builder (DESIGN.md §9: no shimmer). */
function BuilderSkeleton({ label }: { label: string }) {
  return (
    <div
      className="grid gap-4 md:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_380px]"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cx('rounded-md border border-line bg-surface', i === 2 && 'hidden xl:block')}
        >
          <div className="h-10 border-b border-line" />
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <div
              key={r}
              className="flex h-14 items-center gap-3 border-b border-line px-3 last:border-0"
            >
              <div className="h-3 w-24 rounded-sm bg-line" />
              <div className="h-3 w-12 rounded-sm bg-line" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
