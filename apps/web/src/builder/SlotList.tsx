import type { LegalityIssue } from '@vgc-helper/engine';
import { OctagonAlert, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Kbd, Panel } from '../components/ui/Controls';
import { cx } from '../components/ui/cx';
import { TypeChips, TypeEdge } from '../components/ui/Type';
import type { Rules } from '../data/rules';
import { useDraft } from '../state/draft';
import { MAX_SLOTS } from './slots';

/** The six slots as rows of the scouting sheet, each with its type edge. */
export function SlotList({ rules, issues }: { rules: Rules; issues: LegalityIssue[] }) {
  const { t } = useTranslation();
  const { slots, selected, select, edit } = useDraft();
  const errorsBySlot = new Set(
    issues
      .filter((i) => i.severity === 'error' && 'slot' in i)
      .map((i) => (i as { slot: number }).slot),
  );

  return (
    <Panel
      title={t('builder.team', { count: slots.length, max: MAX_SLOTS })}
      labelledBy="team-heading"
    >
      <ol className="m-0 list-none p-0">
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const slot = slots[i];
          const species = slot ? rules.index.species.get(slot.species) : undefined;
          const item = slot?.item ? rules.index.items.get(slot.item)?.name : undefined;
          const isSelected = i === selected;
          // Only the first empty slot can take a new Pokémon.
          if (!slot && i > slots.length) return null;
          return (
            <li
              key={slot ? `${i}-${slot.species}` : `empty-${i}`}
              className="flex border-b border-line last:border-b-0"
            >
              <TypeEdge types={species?.types ?? []} />
              <button
                type="button"
                onClick={() => select(i)}
                aria-current={isSelected ? 'true' : undefined}
                className={cx(
                  'flex min-h-14 flex-1 items-center gap-3 px-3 py-2 text-left transition-state',
                  isSelected ? 'bg-bg' : 'hover:bg-bg',
                )}
              >
                <span className="hidden md:inline">
                  <Kbd>{i + 1}</Kbd>
                </span>
                {slot ? (
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {species?.name ?? slot.species}
                      {errorsBySlot.has(i) && (
                        <OctagonAlert
                          className="size-3.5 text-danger"
                          strokeWidth={1.75}
                          aria-label={t('builder.slotHasErrors')}
                        />
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                      {species && <TypeChips types={species.types} />}
                      {item && <span className="truncate">{item}</span>}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted">
                    <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t('builder.addPokemon')}
                  </span>
                )}
              </button>
              {slot && (
                <button
                  type="button"
                  onClick={() => edit((e) => ({ ...e, slots: e.slots.filter((_, j) => j !== i) }))}
                  className="inline-flex w-11 items-center justify-center text-muted hover:text-danger"
                  aria-label={t('builder.remove', { name: species?.name ?? slot.species })}
                  title={t('builder.remove', { name: species?.name ?? slot.species })}
                >
                  <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
