import { useTranslation } from 'react-i18next';
import { modKey } from '../lib/keys';
import { useUi } from '../state/ui';
import { Kbd } from './ui/Controls';
import { Dialog } from './ui/Dialog';

/** "?" lists every shortcut (DESIGN.md §10). */
export function ShortcutsDialog() {
  const { t } = useTranslation();
  const { shortcutsOpen, setShortcuts } = useUi();
  const mod = modKey();
  const rows: [string[], string][] = [
    [[mod, 'K'], t('shortcuts.palette')],
    [['1', '–', '6'], t('shortcuts.slot')],
    [[mod, 'Z'], t('shortcuts.undo')],
    [[mod, 'Shift', 'Z'], t('shortcuts.redo')],
    [[mod, 'S'], t('shortcuts.save')],
    [[mod, 'V'], t('shortcuts.paste')],
    [['Esc'], t('shortcuts.escape')],
    [['?'], t('shortcuts.help')],
  ];
  return (
    <Dialog
      open={shortcutsOpen}
      onOpenChange={setShortcuts}
      title={t('shortcuts.title')}
      closeLabel={t('common.close')}
    >
      <table className="w-full border-collapse">
        <tbody>
          {rows.map(([keys, label]) => (
            <tr key={label} className="border-b border-line last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap">
                <span className="inline-flex gap-1">
                  {keys.map((k) => (k === '–' ? <span key={k}>–</span> : <Kbd key={k}>{k}</Kbd>))}
                </span>
              </td>
              <td className="py-2">{label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
