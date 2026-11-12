import { exportPaste, type PasteProblem, parsePaste } from '@vgc-helper/engine';
import { Tabs } from 'radix-ui';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextArea } from '../components/ui/Controls';
import { Dialog } from '../components/ui/Dialog';
import type { Rules } from '../data/rules';
import { useDraft } from '../state/draft';
import { useUi } from '../state/ui';
import { MAX_SLOTS } from './slots';

export type PasteMode = 'import' | 'export';

/** Import and export in Showdown's paste format. Stat Points travel on the "EVs:" line. */
export function PasteDialog({
  rules,
  mode,
  onClose,
  onModeChange,
}: {
  rules: Rules;
  mode: PasteMode | null;
  onClose: () => void;
  onModeChange: (mode: PasteMode) => void;
}) {
  const { t } = useTranslation();
  const ids = useId();
  const { slots, edit, select } = useDraft();
  const announce = useUi((u) => u.announce);
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<PasteProblem[]>([]);
  const [copied, setCopied] = useState(false);
  const exported = exportPaste(slots, rules.ctx, rules.index);

  function doImport() {
    const parsed = parsePaste(text, rules.index);
    setProblems(parsed.problems);
    if (parsed.slots.length === 0) return;
    edit((e) => ({ ...e, slots: parsed.slots.slice(0, MAX_SLOTS) }));
    select(0);
    announce(t('paste.imported', { count: Math.min(parsed.slots.length, MAX_SLOTS) }));
    if (parsed.problems.length === 0) {
      setText('');
      onClose();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
      announce(t('paste.copied'));
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('paste.title')}
      description={t('paste.description')}
      closeLabel={t('common.close')}
      wide
    >
      <Tabs.Root value={mode ?? 'import'} onValueChange={(v) => onModeChange(v as PasteMode)}>
        <Tabs.List aria-label={t('paste.title')} className="mb-3 flex gap-4 border-b border-line">
          {(['import', 'export'] as const).map((m) => (
            <Tabs.Trigger
              key={m}
              value={m}
              className="-mb-px border-b-2 border-transparent pb-2 font-semibold text-muted data-[state=active]:border-ink data-[state=active]:text-ink"
            >
              {t(`paste.${m}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="import" className="flex flex-col gap-3">
          <label htmlFor={`${ids}-in`} className="label">
            {t('paste.importLabel')}
          </label>
          <TextArea
            id={`${ids}-in`}
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              'Incineroar @ Sitrus Berry\nAbility: Intimidate\nEVs: 32 HP / 2 Def / 32 SpD\nCareful Nature\n- Fake Out'
            }
          />
          {problems.length > 0 && (
            <Alert
              tone="warning"
              title={t('paste.problems', { count: problems.length })}
              toneLabel={t('tone.warning')}
            >
              <ul className="m-0 pl-4">
                {problems.slice(0, 8).map((p) => (
                  <li key={p.line}>
                    {t('paste.line', { line: p.line })} <code className="font-mono">{p.text}</code>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="primary" onClick={doImport} disabled={text.trim() === ''}>
              {t('paste.replace')}
            </Button>
          </div>
        </Tabs.Content>
        <Tabs.Content value="export" className="flex flex-col gap-3">
          <label htmlFor={`${ids}-out`} className="label">
            {t('paste.exportLabel')}
          </label>
          <TextArea
            id={`${ids}-out`}
            rows={14}
            readOnly
            value={exported}
            onFocus={(e) => e.target.select()}
          />
          <div className="flex items-center justify-end gap-3">
            {copied && <span className="text-sm text-success">{t('paste.copied')}</span>}
            <Button variant="primary" onClick={() => void copy()} disabled={slots.length === 0}>
              {t('paste.copy')}
            </Button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>
  );
}
