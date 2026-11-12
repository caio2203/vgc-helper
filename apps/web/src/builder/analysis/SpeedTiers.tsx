import type { DexIndex, SpeedAnalysis } from '@vgc-helper/engine';
import type { ExperienceLevel } from '@vgc-helper/shared';
import { useTranslation } from 'react-i18next';
import { cx } from '../../components/ui/cx';
import { itemName, useFormat } from './format';

/**
 * DESIGN.md §3.3: a vertical ruler, ink ticks for the team and muted ticks for the meta, with the
 * number next to every tick.
 */
export function SpeedTiers({
  speed,
  index,
  level,
}: {
  speed: SpeedAnalysis;
  index: DexIndex;
  level: ExperienceLevel;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <>
      <table className="wdth-table w-full border-collapse text-sm">
        <caption className="sr-only">{t('analysis.speed.caption')}</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="py-1 pr-2 text-right font-semibold">
              {t('analysis.speed.speed')}
            </th>
            <th scope="col" className="w-3">
              <span className="sr-only">·</span>
            </th>
            <th scope="col" className="py-1 pl-2 text-left font-semibold">
              {t('analysis.speed.pokemon')}
            </th>
            {level !== 'beginner' && (
              <th scope="col" className="py-1 pl-2 text-right font-semibold">
                {t('analysis.speed.tailwind')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {speed.ticks.map((tick) => {
            const mine = tick.source === 'team';
            return (
              <tr
                key={`${tick.source}-${tick.slot ?? tick.species}-${tick.item ?? ''}`}
                className={cx(
                  'border-b border-line last:border-b-0',
                  mine ? 'text-ink' : 'text-muted',
                )}
              >
                <td className={cx('py-0.5 pr-2 text-right', mine && 'font-bold')}>
                  {f.number(tick.speed)}
                </td>
                <td aria-hidden="true">
                  <span className={cx('block h-0.5', mine ? 'w-3 bg-ink' : 'w-2 bg-line-strong')} />
                </td>
                <td className={cx('py-0.5 pl-2', mine && 'font-semibold')}>
                  {tick.name}
                  <span className="block text-muted font-normal">
                    {mine
                      ? t('analysis.speed.team')
                      : tick.usage !== null &&
                        t('analysis.speed.usage', { usage: f.share(tick.usage) })}
                    {tick.item &&
                      ` · ${
                        tick.itemShare === null
                          ? t('analysis.speed.teamItem', { item: itemName(index, tick.item) })
                          : t('analysis.speed.item', {
                              item: itemName(index, tick.item),
                              share: f.share(tick.itemShare),
                            })
                      }`}
                  </span>
                </td>
                {level !== 'beginner' && (
                  <td className="py-0.5 pl-2 text-right">{f.number(tick.tailwind)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="m-0 text-sm text-muted">{t('analysis.speed.note')}</p>
    </>
  );
}
