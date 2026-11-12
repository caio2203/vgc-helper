import type { TypeAnalysis } from '@vgc-helper/engine';
import { OctagonAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../components/ui/cx';
import { TypeChip } from '../../components/ui/Type';
import { useFormat } from './format';

/** DESIGN.md §3.3: the value is written in every cell; color only adds to it. */
function Cell({ value, byAbility, label }: { value: number; byAbility: boolean; label: string }) {
  let text: string;
  let style: string;
  if (value === 0) {
    text = '0';
    style = 'hatch text-ink';
  } else if (value >= 4) {
    text = '4×';
    style = 'bg-danger-bg font-bold text-danger';
  } else if (value > 1) {
    text = value === 2 ? '2×' : `${value}×`;
    style = 'text-danger underline decoration-danger decoration-1 underline-offset-2';
  } else if (value === 1) {
    text = '·';
    style = 'text-muted';
  } else if (value <= 0.25) {
    text = '¼';
    style = 'bg-resist-2 font-bold text-ink';
  } else {
    text = value === 0.5 ? '½' : `${value}×`;
    style = 'bg-resist text-ink';
  }
  return (
    <td className={cx('h-7 border-l border-line text-center', style)} title={label}>
      {text}
      {byAbility && <sup aria-hidden="true">*</sup>}
    </td>
  );
}

export function TypeMatrix({
  types,
  names,
}: {
  types: TypeAnalysis;
  /** Short and full name per slot, in team order. */
  names: { slot: number; short: string; full: string }[];
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="overflow-x-auto">
      <table className="wdth-table w-full border-collapse text-sm">
        <caption className="sr-only">{t('analysis.matrix.caption')}</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="py-1 pr-2 text-left font-semibold">
              {t('analysis.matrix.type')}
            </th>
            {names.map((n) => (
              <th key={n.slot} scope="col" className="px-0.5 py-1 text-center font-semibold">
                <abbr title={n.full} className="no-underline">
                  <span aria-hidden="true">{n.short}</span>
                  <span className="sr-only">{n.full}</span>
                </abbr>
              </th>
            ))}
            <th scope="col" className="py-1 pl-2 text-right font-semibold">
              {t('analysis.matrix.weak')}
            </th>
          </tr>
        </thead>
        <tbody>
          {types.rows.map((row) => (
            <tr key={row.type} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-0.5 pr-2 text-left font-normal whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <TypeChip type={row.type} short />
                  {row.stacked && (
                    <OctagonAlert
                      className="size-3.5 text-danger"
                      strokeWidth={1.75}
                      aria-label={t('analysis.matrix.stacked')}
                    />
                  )}
                </span>
              </th>
              {row.multipliers.map((m) => {
                const name = names.find((n) => n.slot === m.slot)?.full ?? '';
                return (
                  <Cell
                    key={m.slot}
                    value={m.value}
                    byAbility={m.byAbility}
                    label={`${row.type} → ${name}: ${m.value}×${m.byAbility ? `, ${t('analysis.matrix.byAbility')}` : ''}`}
                  />
                );
              })}
              <td
                className={cx(
                  'border-l border-line pl-2 text-right',
                  row.stacked ? 'font-bold text-danger' : 'text-muted',
                )}
              >
                {f.number(row.weak.length)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {types.rows.some((r) => r.multipliers.some((m) => m.byAbility)) && (
        <p className="m-0 mt-1 text-sm text-muted">* {t('analysis.matrix.byAbility')}</p>
      )}
    </div>
  );
}
