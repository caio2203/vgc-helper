import { useQuery } from '@tanstack/react-query';
import { teamVersionSchema } from '@vgc-helper/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { teamVersionsQuery } from '../api/queries';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { useDateTime } from '../lib/dates';
import { useDraft } from '../state/draft';
import { useUi } from '../state/ui';

/** Earlier versions of a saved team. Opening one puts it in the editor as unsaved changes. */
export function HistoryDialog({
  teamId,
  open,
  onClose,
}: {
  teamId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formatDateTime = useDateTime();
  const versions = useQuery({ ...teamVersionsQuery(teamId), enabled: open });
  const current = useDraft((d) => d.version);
  const edit = useDraft((d) => d.edit);
  const announce = useUi((u) => u.announce);

  async function restore(version: number) {
    const data = await api(`/teams/${teamId}/versions/${version}`, { schema: teamVersionSchema });
    const { name, formatId, regulationId, slots, notes } = data.data;
    edit(() => ({ name, formatId, regulationId, slots, notes }));
    announce(t('history.restored', { version }));
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('history.title')}
      description={t('history.description')}
      closeLabel={t('common.close')}
    >
      {versions.isPending && <p className="text-muted">{t('common.loading')}</p>}
      {versions.isError && <p className="text-danger">{t('common.error')}</p>}
      <ol className="m-0 list-none p-0">
        {versions.data?.map((v) => (
          <li
            key={v.version}
            className="flex items-center gap-3 border-b border-line py-2 last:border-0"
          >
            <span className="font-semibold">{t('history.version', { version: v.version })}</span>
            <span className="text-sm text-muted">{formatDateTime(v.createdAt)}</span>
            <span className="ml-auto">
              {v.version === current ? (
                <span className="text-sm text-muted">{t('history.current')}</span>
              ) : (
                <Button size="sm" onClick={() => void restore(v.version)}>
                  {t('history.open')}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
