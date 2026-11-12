import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangelogEntry } from '@vgc-helper/data';
import { settingsSchema } from '@vgc-helper/shared';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { changelogQuery, manifestQuery, settingsQuery } from '../api/queries';
import { Alert } from '../components/ui/Alert';
import { Panel } from '../components/ui/Controls';
import { useDateTime } from '../lib/dates';
import { ChangeList } from './ChangeList';
import { changeRegulation } from './describe';

/** Entries newer than the one the user last saw; all of them before the first visit. */
export function unreadEntries(entries: ChangelogEntry[], seen: string | null): ChangelogEntry[] {
  const withChanges = entries.filter((e) => e.previousVersion !== null);
  if (!seen) return withChanges;
  const at = entries.findIndex((e) => e.version === seen);
  return at < 0 ? withChanges : entries.slice(0, at).filter((e) => e.previousVersion !== null);
}

/** How many history entries the user has not seen, for the header link. */
export function useUnreadCount(): number {
  const changelog = useQuery(changelogQuery);
  const settings = useQuery(settingsQuery);
  if (!changelog.data || !settings.data) return 0;
  return unreadEntries(changelog.data.entries, settings.data.whatsNewSeenVersion).length;
}

function Entry({ entry, isNew }: { entry: ChangelogEntry; isNew: boolean }) {
  const { t } = useTranslation();
  const ids = useId();
  const date = useDateTime();
  const manifest = useQuery(manifestQuery);
  const regulationName = (id: string) =>
    manifest.data?.regulations.find((r) => r.id === id)?.name ?? id;
  // General changes first, then each regulation in the order the history lists them.
  const groups = new Map<string, typeof entry.changes>();
  for (const change of entry.changes) {
    const key = changeRegulation(change) ?? '';
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  const ordered = [...groups].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0));

  return (
    <Panel
      labelledBy={`${ids}-title`}
      title={
        <>
          {date(entry.generatedAt)}
          {isNew && (
            <span className="ml-2 rounded-sm border border-ink px-1 text-ink">
              {t('whatsNew.new')}
            </span>
          )}
        </>
      }
      actions={<code className="text-sm text-muted">{entry.version}</code>}
    >
      {entry.previousVersion === null ? (
        <p className="m-0 px-4 py-3 text-sm">{t('whatsNew.baseline')}</p>
      ) : entry.changes.length === 0 ? (
        <p className="m-0 px-4 py-3 text-sm">{t('whatsNew.noChanges')}</p>
      ) : (
        ordered.map(([regulationId, changes]) => (
          <section
            key={regulationId}
            aria-label={regulationId ? regulationName(regulationId) : t('whatsNew.general')}
          >
            <h3 className="label m-0 border-b border-line bg-bg px-4 py-1.5">
              {regulationId ? regulationName(regulationId) : t('whatsNew.general')}
            </h3>
            <ChangeList changes={changes} />
          </section>
        ))
      )}
      {entry.warnings.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line p-4">
          {entry.warnings.map((w) => (
            <Alert key={w} tone="warning" toneLabel={t('tone.warning')} title={w} />
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * The history of data changes: new regulations, Pokémon and moves that became legal or not,
 * balance changes and usage moves, one panel per snapshot. Visiting marks everything as seen.
 */
export function WhatsNewPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const changelog = useQuery(changelogQuery);
  const settings = useQuery(settingsQuery);
  // What was new when the page opened stays marked while the user reads it.
  const [seenOnOpen, setSeenOnOpen] = useState<string | null | undefined>(undefined);
  const latest = changelog.data?.entries[0]?.version;

  const markSeen = useMutation({
    mutationFn: (version: string) =>
      api('/settings', {
        method: 'PATCH',
        body: { whatsNewSeenVersion: version },
        schema: settingsSchema,
      }),
    onSuccess: (next) => queryClient.setQueryData(settingsQuery.queryKey, next),
  });

  useEffect(() => {
    if (!settings.data || !latest || seenOnOpen !== undefined) return;
    setSeenOnOpen(settings.data.whatsNewSeenVersion);
    if (settings.data.whatsNewSeenVersion !== latest) markSeen.mutate(latest);
  }, [settings.data, latest, seenOnOpen, markSeen]);

  if (changelog.isError) {
    return <Alert tone="error" title={t('common.error')} toneLabel={t('tone.error')} />;
  }
  const entries = changelog.data?.entries;
  const unread = new Set(
    entries && seenOnOpen !== undefined
      ? unreadEntries(entries, seenOnOpen).map((e) => e.version)
      : [],
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="wdth-display m-0 text-h1 font-[750]">{t('whatsNew.title')}</h1>
      <p className="m-0 text-muted">{t('whatsNew.intro')}</p>
      {!entries && <p className="m-0 text-muted">{t('common.loading')}</p>}
      {entries?.length === 0 && <p className="m-0 text-lead">{t('whatsNew.empty')}</p>}
      {entries?.map((entry) => (
        <Entry key={entry.version} entry={entry} isNew={unread.has(entry.version)} />
      ))}
    </div>
  );
}
