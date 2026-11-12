import type { DexIndex } from '@vgc-helper/engine';
import { useTranslation } from 'react-i18next';

/** Number, percent and list formatting in the interface language. */
export function useFormat() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const percent = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat(lang);
  const list = new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' });
  return {
    /** 0.356 → "35.6%". */
    share: (n: number) => percent.format(n),
    /** 81.1 (already a percent) → "81.1%". */
    pct: (n: number) => percent.format(n / 100),
    range: (min: number, max: number) =>
      `${percent.format(min / 100)}–${percent.format(max / 100)}`,
    number: (n: number) => number.format(n),
    list: (items: string[]) => list.format(items),
  };
}

export const speciesName = (index: DexIndex, id: string) => index.species.get(id)?.name ?? id;
export const moveName = (index: DexIndex, id: string) => index.moves.get(id)?.name ?? id;
export const itemName = (index: DexIndex, id: string) => index.items.get(id)?.name ?? id;
export const abilityName = (index: DexIndex, id: string) => index.abilities.get(id)?.name ?? id;
