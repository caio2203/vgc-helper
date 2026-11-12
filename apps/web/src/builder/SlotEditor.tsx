import { megaFormeFor, search } from '@vgc-helper/engine';
import type { TeamSlot } from '@vgc-helper/shared';
import { type Ref, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Combobox, type ComboOption } from '../components/ui/Combobox';
import { Field, Panel, Select, TextArea } from '../components/ui/Controls';
import { TypeChips, TypeEdge, typeText } from '../components/ui/Type';
import type { Rules } from '../data/rules';
import { useDraft } from '../state/draft';
import { StatsEditor } from './StatsEditor';
import { newSlot, placeSpecies, updateSlot } from './slots';

const MOVE_SLOTS = 4;

export function SlotEditor({
  rules,
  speciesInput,
}: {
  rules: Rules;
  speciesInput?: Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  const ids = useId();
  const { slots, selected, edit, select } = useDraft();
  const slot = slots[selected];
  const { index } = rules;

  const speciesOptions = (q: string): ComboOption[] =>
    search(rules.search, q, { kinds: ['species'], limit: 15 }).map((h) => ({
      id: h.id,
      name: h.name,
      detail: index.species.get(h.id)?.types.join(' · '),
    }));

  if (!slot) {
    return (
      <Panel title={t('builder.slot', { n: selected + 1 })} labelledBy={`${ids}-h`}>
        <div className="flex flex-col gap-4 p-4">
          <Field label={t('builder.species')} htmlFor={`${ids}-species`}>
            <Combobox
              id={`${ids}-species`}
              inputRef={speciesInput}
              value={null}
              valueLabel=""
              placeholder={t('builder.speciesPlaceholder')}
              emptyText={t('builder.noMatch')}
              search={speciesOptions}
              onChange={(id) => {
                if (!id) return;
                edit((e) => placeSpecies(e, selected, index, id)?.team ?? e);
              }}
            />
          </Field>
          <p className="m-0 text-lead text-muted">{t('builder.emptyHint')}</p>
        </div>
      </Panel>
    );
  }

  const species = index.species.get(slot.species);
  const set = (change: Partial<TeamSlot>) => edit((e) => updateSlot(e, selected, change));
  const mega = megaFormeFor(index, slot.species, slot.item);
  const learnset = index.learnsets.get(slot.species) ?? new Set<string>();

  const moveOptions =
    (current: string | null) =>
    (q: string): ComboOption[] => {
      const taken = new Set(slot.moves.filter((m) => m !== current));
      const ids = q.trim()
        ? search(rules.search, q, { kinds: ['move'], limit: 60 }).map((h) => h.id)
        : [...learnset].sort();
      return ids
        .filter((id) => learnset.has(id) && !taken.has(id))
        .slice(0, 40)
        .map((id) => {
          const move = index.moves.get(id);
          return {
            id,
            name: move?.name ?? id,
            detail: move
              ? `${move.type} · ${t(`move.${move.category}`)}${move.basePower ? ` · ${move.basePower}` : ''}`
              : undefined,
          };
        });
    };

  const itemOptions = (q: string): ComboOption[] =>
    search(rules.search, q, { kinds: ['item'], limit: 15 }).map((h) => ({
      id: h.id,
      name: h.name,
    }));

  return (
    <Panel
      title={t('builder.slot', { n: selected + 1 })}
      labelledBy={`${ids}-h`}
      actions={
        <span className="text-sm text-muted">{t('builder.slotKey', { n: selected + 1 })}</span>
      }
    >
      <div className="flex border-b border-line">
        <TypeEdge types={species?.types ?? []} />
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <h3 className="wdth-heading m-0 text-h2 font-bold">{species?.name ?? slot.species}</h3>
          {species && <TypeChips types={species.types} />}
          {mega && slot.mega && (
            <span className="text-sm text-muted">
              {t('builder.megaInto', { name: mega.name })} · <TypeChips types={mega.types} short />
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <Field label={t('builder.species')} htmlFor={`${ids}-species`}>
          <Combobox
            id={`${ids}-species`}
            inputRef={speciesInput}
            value={slot.species}
            valueLabel={species?.name ?? slot.species}
            emptyText={t('builder.noMatch')}
            search={speciesOptions}
            onChange={(id) => {
              if (!id || id === slot.species) return;
              const fresh = newSlot(index, id);
              const keep = slot.moves.filter((m) => index.learnsets.get(id)?.has(m));
              edit((e) =>
                updateSlot(e, selected, {
                  ...fresh,
                  item: slot.item,
                  nature: slot.nature,
                  spread: slot.spread,
                  moves: keep,
                  notes: slot.notes,
                }),
              );
              select(selected);
            }}
          />
        </Field>

        <Field label={t('builder.item')} htmlFor={`${ids}-item`}>
          <Combobox
            id={`${ids}-item`}
            value={slot.item}
            valueLabel={slot.item ? (index.items.get(slot.item)?.name ?? slot.item) : ''}
            placeholder={t('builder.none')}
            emptyText={t('builder.noMatch')}
            search={itemOptions}
            onChange={(id) => {
              const willMega = megaFormeFor(index, slot.species, id) !== null;
              set({ item: id, mega: willMega });
            }}
          />
        </Field>

        <Field label={t('builder.ability')} htmlFor={`${ids}-ability`}>
          <Select
            id={`${ids}-ability`}
            value={slot.ability ?? ''}
            onChange={(e) => set({ ability: e.target.value || null })}
          >
            <option value="">{t('builder.none')}</option>
            {species?.abilities.map((a) => (
              <option key={a} value={a}>
                {index.abilities.get(a)?.name ?? a}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('builder.nature')} htmlFor={`${ids}-nature`}>
          <Select
            id={`${ids}-nature`}
            value={slot.nature ?? ''}
            onChange={(e) => set({ nature: e.target.value || null })}
          >
            <option value="">{t('builder.none')}</option>
            {rules.ctx.dex.natures.map((n) => (
              <option key={n.id} value={n.id}>
                {n.plus && n.minus && n.plus !== n.minus
                  ? `${n.name} (+${t(`stats.${n.plus}`)} −${t(`stats.${n.minus}`)})`
                  : `${n.name} (${t('builder.neutral')})`}
              </option>
            ))}
          </Select>
        </Field>

        {mega && (
          <label className="flex items-center gap-2 lg:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--ink)]"
              checked={slot.mega}
              onChange={(e) => set({ mega: e.target.checked })}
            />
            {t('builder.planMega', { name: mega.name })}
          </label>
        )}

        <fieldset className="m-0 grid gap-2 border-0 p-0 lg:col-span-2 lg:grid-cols-2">
          <legend className="label mb-1">{t('builder.moves')}</legend>
          {Array.from({ length: MOVE_SLOTS }, (_, m) => {
            const move = slot.moves[m] ?? null;
            const moveData = move ? index.moves.get(move) : undefined;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: four fixed move positions; the move id remounts the field when it changes
              <div key={`${m}-${move ?? ''}`} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="w-1 self-stretch rounded-sm"
                  style={{ background: moveData ? typeText(moveData.type) : 'var(--line)' }}
                />
                <Combobox
                  id={`${ids}-move-${m}`}
                  className="flex-1"
                  ariaLabel={t('builder.move', { n: m + 1 })}
                  value={move}
                  valueLabel={moveData?.name ?? move ?? ''}
                  placeholder={t('builder.movePlaceholder', { n: m + 1 })}
                  emptyText={t('builder.noLearnableMove')}
                  search={moveOptions(move)}
                  onChange={(id) => {
                    const moves = [...slot.moves];
                    if (id) moves[m] = id;
                    else moves.splice(m, 1);
                    set({ moves: moves.filter(Boolean).slice(0, MOVE_SLOTS) });
                  }}
                />
              </div>
            );
          })}
        </fieldset>

        {species && (
          <div className="lg:col-span-2">
            <StatsEditor
              rules={rules}
              slot={slot}
              species={species}
              mega={slot.mega ? mega : null}
              onChange={(spread) => set({ spread })}
            />
          </div>
        )}

        <Field label={t('builder.notes')} htmlFor={`${ids}-notes`} className="lg:col-span-2">
          <TextArea
            id={`${ids}-notes`}
            rows={2}
            className="font-sans text-base"
            value={slot.notes}
            maxLength={2000}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      </div>
    </Panel>
  );
}
