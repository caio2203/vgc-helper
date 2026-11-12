import { useQuery } from '@tanstack/react-query';
import { feedbackSummarySchema } from '@vgc-helper/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useFormat } from '../builder/analysis/format';
import { Panel } from '../components/ui/Controls';

/** How the owner rated the suggestions, to tune the engine's weights. */
export function FeedbackSummary({ nameOf }: { nameOf: (id: string) => string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const summary = useQuery({
    queryKey: ['feedback', 'summary'],
    queryFn: () => api('/feedback/summary', { schema: feedbackSummarySchema }),
  });
  const data = summary.data;
  return (
    <Panel title={t('admin.feedback.title')} labelledBy="admin-feedback">
      <div className="flex flex-col gap-2 p-4">
        {!data && <p className="m-0 text-muted">{t('common.loading')}</p>}
        {data && data.total === 0 && <p className="m-0">{t('admin.feedback.empty')}</p>}
        {data && data.total > 0 && (
          <>
            <p className="m-0">
              {t('admin.feedback.total', {
                total: f.number(data.total),
                helpful: f.number(data.helpful),
              })}
            </p>
            <table className="wdth-table w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left">
                  <th scope="col" className="py-1 font-semibold">
                    {t('admin.feedback.pokemon')}
                  </th>
                  <th scope="col" className="py-1 text-right font-semibold">
                    {t('admin.feedback.helpful')}
                  </th>
                  <th scope="col" className="py-1 text-right font-semibold">
                    {t('admin.feedback.notHelpful')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.bySubject.slice(0, 10).map((row) => (
                  <tr key={row.subject} className="border-b border-line last:border-b-0">
                    <td className="py-1">{nameOf(row.subject)}</td>
                    <td className="py-1 text-right">{f.number(row.helpful)}</td>
                    <td className="py-1 text-right">{f.number(row.notHelpful)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Panel>
  );
}
