import { useQuery } from '@tanstack/react-query';
import type { Change } from '@vgc-helper/data';
import { useTranslation } from 'react-i18next';
import { manifestQuery } from '../api/queries';
import { useFormat } from '../builder/analysis/format';
import { useDateTime } from '../lib/dates';
import { describeChange, type Formatters } from './describe';

export function useChangeFormatters(): Formatters {
  const { t } = useTranslation();
  const date = useDateTime();
  const f = useFormat();
  return { t, date, share: f.share, number: f.number, list: f.list };
}

/** Changes as ruled rows: one sentence each, usage moves below, the source and date at the end. */
export function ChangeList({ changes }: { changes: Change[] }) {
  const { t } = useTranslation();
  const manifest = useQuery(manifestQuery);
  const formatters = useChangeFormatters();
  return (
    <ul className="m-0 list-none p-0">
      {changes.map((change, i) => {
        const text = describeChange(change, manifest.data, formatters);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: changes have no id and never reorder
          <li key={i} className="border-b border-line px-4 py-2 text-sm last:border-b-0">
            {text.lines.map((line) => (
              <p key={line} className="m-0">
                {line}
              </p>
            ))}
            {text.details.length > 0 && (
              <ul className="m-0 mt-1 grid list-none gap-x-6 gap-y-0.5 p-0 sm:grid-cols-2">
                {text.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {text.source && (
              <p className="m-0 mt-1 text-muted">
                {t('changes.source', {
                  name: text.source.name,
                  date: formatters.date(text.source.retrievedAt, false),
                })}{' '}
                <a
                  className="text-ink underline underline-offset-2"
                  href={text.source.url}
                  rel="noreferrer"
                >
                  {new URL(text.source.url).host}
                </a>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
