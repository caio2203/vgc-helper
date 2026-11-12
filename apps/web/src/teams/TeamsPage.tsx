import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { TeamSummary } from '@vgc-helper/shared';
import { Copy, FilePlus2, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { teamsQuery } from '../api/queries';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Controls';
import { Dialog } from '../components/ui/Dialog';
import { TypeEdge } from '../components/ui/Type';
import { useRules } from '../data/rules';
import { useDateTime } from '../lib/dates';
import { useUi } from '../state/ui';

/** Saved teams: open, duplicate, delete, start a new one or import a paste. */
export function TeamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formatDate = useDateTime();
  const teams = useQuery(teamsQuery);
  const { rules } = useRules();
  const { request, announce } = useUi();
  const [toDelete, setToDelete] = useState<TeamSummary | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['teams'] });
  const duplicate = useMutation({
    mutationFn: (team: TeamSummary) =>
      api(`/teams/${team.id}/duplicate`, {
        method: 'POST',
        body: { name: t('teams.copyName', { name: team.name }).slice(0, 80) },
      }),
    onSuccess: async () => {
      await refresh();
      announce(t('teams.duplicated'));
    },
  });
  const remove = useMutation({
    mutationFn: (team: TeamSummary) => api(`/teams/${team.id}`, { method: 'DELETE' }),
    onSuccess: async (_, team) => {
      setToDelete(null);
      await refresh();
      announce(t('teams.deleted', { name: team.name }));
    },
  });

  const speciesTypes = (id: string) => rules?.index.species.get(id)?.types ?? [];
  const speciesName = (id: string) => rules?.index.species.get(id)?.name ?? id;
  const formatName = (id: string) => rules?.manifest.formats.find((f) => f.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="wdth-display m-0 text-h1 font-[750]">{t('teams.title')}</h1>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => void navigate({ to: '/' }).then(() => request('import'))}>
            <Upload className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t('teams.import')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void navigate({ to: '/' }).then(() => request('new'))}
          >
            <FilePlus2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t('teams.new')}
          </Button>
        </div>
      </div>

      {teams.isError && (
        <Alert tone="error" title={t('teams.loadError')} toneLabel={t('tone.error')}>
          {t('builder.loadErrorHint')}
        </Alert>
      )}

      <Panel
        title={t('teams.count', { count: teams.data?.length ?? 0 })}
        labelledBy="teams-heading"
      >
        {teams.isPending && <p className="m-0 p-4 text-muted">{t('common.loading')}</p>}
        {teams.data?.length === 0 && (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="m-0 text-lead">{t('teams.empty')}</p>
            <Button variant="primary" onClick={() => void navigate({ to: '/' })}>
              {t('teams.buildFirst')}
            </Button>
          </div>
        )}
        {teams.data && teams.data.length > 0 && (
          <table className="wdth-table w-full border-collapse">
            <thead className="sr-only md:table-header-group md:not-sr-only">
              <tr className="border-b border-line-strong text-left text-sm">
                <th className="px-4 py-2 font-semibold">{t('teams.name')}</th>
                <th className="px-2 py-2 font-semibold">{t('teams.pokemon')}</th>
                <th className="px-2 py-2 font-semibold">{t('teams.format')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('teams.updated')}</th>
                <th className="px-4 py-2 text-right font-semibold">
                  <span className="sr-only">{t('teams.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.data.map((team) => (
                <tr key={team.id} className="flex flex-col border-b border-line md:table-row">
                  <td className="px-4 pt-3 md:py-2">
                    <Link
                      to="/teams/$teamId"
                      params={{ teamId: team.id }}
                      className="font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-1 md:px-2 md:py-2">
                    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                      {team.species.map((s, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a team can list the same species twice while illegal
                        <li key={`${s}-${i}`} className="flex items-stretch gap-1.5 text-sm">
                          <TypeEdge types={speciesTypes(s)} />
                          {speciesName(s)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-1 text-sm text-muted md:px-2 md:py-2">
                    {formatName(team.formatId)} · {team.regulationId}
                  </td>
                  <td className="px-4 py-1 text-sm text-muted md:px-2 md:py-2 md:text-right">
                    {formatDate(team.updatedAt)}
                  </td>
                  <td className="px-4 pb-3 md:py-2">
                    <div className="flex gap-1 md:justify-end">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => duplicate.mutate(team)}
                        aria-label={t('teams.duplicate', { name: team.name })}
                        title={t('teams.duplicate', { name: team.name })}
                      >
                        <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setToDelete(team)}
                        aria-label={t('teams.delete', { name: team.name })}
                        title={t('teams.delete', { name: team.name })}
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t('teams.deleteTitle', { name: toDelete?.name ?? '' })}
        description={t('teams.deleteHint')}
        closeLabel={t('common.close')}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setToDelete(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => toDelete && remove.mutate(toDelete)}
            disabled={remove.isPending}
          >
            {t('teams.confirmDelete')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
