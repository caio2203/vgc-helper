import { type Species, STAT_IDS, type StatId } from '@vgc-helper/data';
import { calcStats } from '@vgc-helper/engine';
import type { StatsTable, TeamSlot } from '@vgc-helper/shared';
import { useTranslation } from 'react-i18next';
import { cx } from '../components/ui/cx';
import type { Rules } from '../data/rules';

/** Stat Points (or EVs) per stat, with the final stats they give, base and Mega forme. */
export function StatsEditor({
  rules,
  slot,
  species,
  mega,
  onChange,
}: {
  rules: Rules;
  slot: TeamSlot;
  species: Species;
  mega: Species | null;
  onChange: (spread: StatsTable) => void;
}) {
  const { t } = useTranslation();
  const { profile, format } = rules.ctx;
  const system = profile.statSystem;
  const maxPerStat = system.kind === 'statPoints' ? system.maxPerStat : system.evMaxPerStat;
  const maxTotal = system.kind === 'statPoints' ? system.total : system.evTotal;
  const unit = system.kind === 'statPoints' ? t('stats.sp') : t('stats.ev');
  const nature = slot.nature ? (rules.index.natures.get(slot.nature) ?? null) : null;
  const final = calcStats(profile, species.baseStats, slot.spread, format.level, nature, slot.ivs);
  const megaFinal = mega
    ? calcStats(profile, mega.baseStats, slot.spread, format.level, nature, slot.ivs)
    : null;
  const used = STAT_IDS.reduce((sum, s) => sum + slot.spread[s], 0);
  const over = used > maxTotal;

  const set = (stat: StatId, raw: string) => {
    const value = Math.max(0, Math.min(maxPerStat, Number.parseInt(raw, 10) || 0));
    onChange({ ...slot.spread, [stat]: value });
  };

  const mark = (stat: StatId) => {
    if (!nature || nature.plus === nature.minus) return null;
    if (nature.plus === stat) return <Mark sign="+" label={t('stats.boosted')} />;
    if (nature.minus === stat) return <Mark sign="−" label={t('stats.lowered')} />;
    return null;
  };

  return (
    <table className="wdth-table w-full border-collapse">
      <caption className="label pb-1 text-left">{t('stats.caption', { unit })}</caption>
      <thead>
        <tr className="border-b border-line-strong text-sm">
          <th className="py-1 pr-2 text-left font-semibold">{t('stats.stat')}</th>
          <th className="px-2 py-1 text-right font-semibold">{t('stats.base')}</th>
          <th className="px-2 py-1 text-right font-semibold">{unit}</th>
          <th className="px-2 py-1 text-right font-semibold">{t('stats.final')}</th>
          {megaFinal && <th className="py-1 pl-2 text-right font-semibold">{t('stats.mega')}</th>}
        </tr>
      </thead>
      <tbody>
        {STAT_IDS.map((stat) => (
          <tr key={stat} className="h-[var(--row-h)] border-b border-line">
            <th scope="row" className="pr-2 text-left font-normal">
              {t(`stats.${stat}`)} <span className="text-muted">{mark(stat)}</span>
            </th>
            <td className="px-2 text-right text-muted">{species.baseStats[stat]}</td>
            <td className="px-2 text-right">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={maxPerStat}
                value={slot.spread[stat]}
                onChange={(e) => set(stat, e.target.value)}
                aria-label={t('stats.input', { stat: t(`stats.${stat}`), unit })}
                className="h-8 w-16 rounded-sm border border-line-strong bg-surface px-1.5 text-right"
              />
            </td>
            <td className="px-2 text-right font-semibold">{final[stat]}</td>
            {megaFinal && <td className="pl-2 text-right">{megaFinal[stat]}</td>}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="pt-2 pr-2 text-left font-normal text-muted">
            {t('stats.total')}
          </th>
          <td />
          <td className={cx('px-2 pt-2 text-right font-semibold', over && 'text-danger')}>
            {used} / {maxTotal}
          </td>
          <td colSpan={megaFinal ? 2 : 1} className="pt-2 text-right text-sm text-muted">
            {over
              ? t('stats.over', { count: used - maxTotal })
              : t('stats.left', { count: maxTotal - used })}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function Mark({ sign, label }: { sign: string; label: string }) {
  return (
    <>
      <span aria-hidden="true">{sign}</span>
      <span className="sr-only">{label}</span>
    </>
  );
}
