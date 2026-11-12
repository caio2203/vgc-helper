import { useQuery } from '@tanstack/react-query';
import type { StatsTable } from '@vgc-helper/data';
import { commonSet, isDamaging, search, usageByBase } from '@vgc-helper/engine';
import type { CalcSet, FieldOptions } from '@vgc-helper/engine/damage';
import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaQuery } from '../api/queries';
import { useFormat } from '../builder/analysis/format';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Combobox, type ComboOption } from '../components/ui/Combobox';
import { Field, Panel, Select, TextInput } from '../components/ui/Controls';
import { TypeChips, TypeEdge } from '../components/ui/Type';
import { type Rules, useRules } from '../data/rules';
import { useDateTime } from '../lib/dates';
import { useDraft } from '../state/draft';

type DamageModule = typeof import('@vgc-helper/engine/damage');

interface Side {
  species: string | null;
  ability: string | null;
  item: string | null;
  nature: string | null;
  spread: StatsTable;
  stage: number;
  move: string | null;
  /** Filled from the usage data, so the page can say so. */
  fromMeta?: boolean;
}

const ZERO: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const EMPTY: Side = {
  species: null,
  ability: null,
  item: null,
  nature: null,
  spread: ZERO,
  stage: 0,
  move: null,
};
const STAGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const WEATHERS = ['Sun', 'Rain', 'Sand', 'Snow'] as const;
const TERRAINS = ['Electric', 'Grassy', 'Psychic', 'Misty'] as const;

/** A simple damage calculator on the same calc as the analysis (DESIGN.md: one source of truth). */
export function CalcPage() {
  const { t } = useTranslation();
  const draft = useDraft();
  const { rules, isError } = useRules({
    gameId: draft.gameId || undefined,
    formatId: draft.formatId || undefined,
    regulationId: draft.regulationId || undefined,
  });
  const [damage, setDamage] = useState<DamageModule | null>(null);
  useEffect(() => {
    let alive = true;
    void import('@vgc-helper/engine/damage').then((m) => alive && setDamage(m));
    return () => {
      alive = false;
    };
  }, []);

  if (isError) {
    return <Alert tone="error" title={t('builder.loadDataError')} toneLabel={t('tone.error')} />;
  }
  if (!rules || !damage) return <p className="m-0 text-muted">{t('common.loading')}</p>;
  return <Calculator rules={rules} damage={damage} />;
}

function Calculator({ rules, damage }: { rules: Rules; damage: DamageModule }) {
  const { t } = useTranslation();
  const f = useFormat();
  const date = useDateTime();
  const slots = useDraft((d) => d.slots);
  const { gameId, id: regulationId } = rules.regulation;
  const formatId = rules.ctx.format.id;
  const meta = useQuery({
    ...metaQuery(gameId, regulationId, formatId),
    enabled: Boolean(rules.regulation.files.meta[formatId]),
  });
  const analysisRules = useMemo(
    () => rules.manifest.analysisRules.find((r) => r.gameIds.includes(gameId)) ?? null,
    [rules.manifest, gameId],
  );
  const [attacker, setAttacker] = useState<Side>(EMPTY);
  const [defender, setDefender] = useState<Side>(EMPTY);
  const [weather, setWeather] = useState<string>('auto');
  const [terrain, setTerrain] = useState<string>('auto');
  const [flags, setFlags] = useState({
    reflect: false,
    lightScreen: false,
    helpingHand: false,
    critical: false,
  });

  /** The most common set of a species (or of its Mega group) from the usage data. */
  const fromMeta = (speciesId: string): Side => {
    const species = rules.index.species.get(speciesId);
    const entry = meta.data
      ? (meta.data.pokemon.find((p) => p.species === speciesId) ??
        usageByBase(meta.data, rules.index).get(speciesId)?.entries[0])
      : undefined;
    const set = entry ? commonSet(entry, rules.index) : null;
    if (!set || set.species.id !== speciesId) {
      return { ...EMPTY, species: speciesId, ability: species?.abilities[0] ?? null };
    }
    return {
      species: speciesId,
      ability: set.ability,
      item: set.item,
      nature: set.nature,
      spread: set.spread,
      stage: 0,
      move: set.moves.find(isDamaging)?.id ?? null,
      fromMeta: true,
    };
  };

  const fromSlot = (i: number): Side => {
    const s = slots[i];
    if (!s) return EMPTY;
    const mega = s.mega && s.item ? rules.index.items.get(s.item)?.megaStone : null;
    const base = rules.index.species.get(s.species);
    const megaName = mega && base ? mega[base.name] : undefined;
    const megaId = megaName ? megaName.toLowerCase().replace(/[^a-z0-9]/g, '') : null;
    const battle = megaId && rules.index.species.has(megaId) ? megaId : s.species;
    const battleSpecies = rules.index.species.get(battle);
    return {
      species: battle,
      ability: battle !== s.species ? (battleSpecies?.abilities[0] ?? null) : s.ability,
      item: s.item,
      nature: s.nature,
      spread: s.spread,
      stage: 0,
      move:
        s.moves.find((m) => {
          const move = rules.index.moves.get(m);
          return move ? isDamaging(move) : false;
        }) ?? null,
    };
  };

  const toSet = (side: Side): CalcSet | null => {
    const species = side.species ? rules.index.species.get(side.species) : undefined;
    if (!species) return null;
    return {
      species,
      ability: side.ability,
      item: side.item,
      nature: side.nature,
      spread: side.spread,
      moves: side.move ? [rules.index.moves.get(side.move)].flatMap((m) => m ?? []) : [],
    };
  };

  const a = toSet(attacker);
  const d = toSet(defender);
  const move = attacker.move ? rules.index.moves.get(attacker.move) : undefined;
  const options: FieldOptions = {
    weather: weather === 'auto' ? undefined : weather === 'none' ? null : (weather as never),
    terrain: terrain === 'auto' ? undefined : terrain === 'none' ? null : (terrain as never),
    attackerBoost: attacker.stage,
    defenderBoost: defender.stage,
    ...flags,
    autoField: analysisRules ?? undefined,
  };
  const result =
    a && d && move && isDamaging(move)
      ? damage.calcDamage(a, d, move, rules.ctx, rules.index, options)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="wdth-display m-0 text-h1 font-[750]">{t('calc.title')}</h1>
          <p className="m-0 text-muted">{t('calc.intro')}</p>
        </div>
        <Button
          className="ml-auto"
          onClick={() => {
            setAttacker({ ...defender, move: null });
            setDefender({ ...attacker, move: null });
          }}
        >
          <ArrowLeftRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {t('calc.swap')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SideEditor
          title={t('calc.attacker')}
          kind="attacker"
          rules={rules}
          side={attacker}
          onChange={setAttacker}
          fromMeta={fromMeta}
          fromSlot={fromSlot}
        />
        <SideEditor
          title={t('calc.defender')}
          kind="defender"
          rules={rules}
          side={defender}
          onChange={setDefender}
          fromMeta={fromMeta}
          fromSlot={fromSlot}
        />
      </div>

      <Panel title={t('calc.field')} labelledBy="calc-field">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldSelect
            label={t('calc.weather')}
            value={weather}
            onChange={setWeather}
            options={WEATHERS.map((w) => ({ id: w, name: t(`calc.weathers.${w}`) }))}
          />
          <FieldSelect
            label={t('calc.terrain')}
            value={terrain}
            onChange={setTerrain}
            options={TERRAINS.map((x) => ({ id: x, name: t(`calc.terrains.${x}`) }))}
          />
          <div className="flex flex-col gap-1 sm:col-span-2">
            {(['reflect', 'lightScreen', 'helpingHand', 'critical'] as const).map((k) => (
              <label key={k} className="flex min-h-7 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--ink)]"
                  checked={flags[k]}
                  onChange={(e) => setFlags((x) => ({ ...x, [k]: e.target.checked }))}
                />
                {t(`calc.${k}`)}
              </label>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title={t('calc.result')} labelledBy="calc-result">
        <div className="flex flex-col gap-2 p-4" aria-live="polite">
          {!result && <p className="m-0 text-lead text-muted">{t('calc.pickBoth')}</p>}
          {result && result.maxDamage === 0 && (
            <p className="m-0 text-lead">{t('calc.noDamage')}</p>
          )}
          {result && result.maxDamage > 0 && (
            <>
              <p className="wdth-display m-0 text-h2 font-bold">
                {f.range(result.minPercent, result.maxPercent)}
              </p>
              <p className="m-0">
                {t('calc.range', {
                  min: f.number(result.minDamage),
                  max: f.number(result.maxDamage),
                  hp: f.number(result.defenderHp),
                })}
              </p>
              <p className="m-0">
                {t('calc.hits', { worst: result.hitsWorst, best: result.hitsBest })}
              </p>
              <p className="m-0 text-sm text-muted">
                <span className="label mr-2">{t('calc.text')}</span>
                <span lang="en">{result.description}</span>
              </p>
            </>
          )}
          <p className="m-0 border-t border-line pt-2 text-sm text-muted">
            {t('analysis.sources.calc', { level: rules.ctx.format.level })}{' '}
            {t('analysis.sources.dex', {
              name: rules.ctx.dex.source.name,
              date: date(rules.ctx.dex.source.retrievedAt, false),
            })}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="auto">{t('calc.auto')}</option>
        <option value="none">{t('calc.none')}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function SideEditor({
  title,
  kind,
  rules,
  side,
  onChange,
  fromMeta,
  fromSlot,
}: {
  title: string;
  kind: 'attacker' | 'defender';
  rules: Rules;
  side: Side;
  onChange: (side: Side) => void;
  fromMeta: (species: string) => Side;
  fromSlot: (i: number) => Side;
}) {
  const { t } = useTranslation();
  const ids = useId();
  const slots = useDraft((d) => d.slots);
  const { index } = rules;
  const species = side.species ? index.species.get(side.species) : undefined;
  const set = (patch: Partial<Side>) => onChange({ ...side, ...patch, fromMeta: false });

  const speciesOptions = (q: string): ComboOption[] =>
    search(rules.search, q, { kinds: ['species'], limit: 15 }).map((h) => ({
      id: h.id,
      name: h.name,
      detail: index.species.get(h.id)?.types.join(' · '),
    }));
  const itemOptions = (q: string): ComboOption[] =>
    search(rules.search, q, { kinds: ['item'], limit: 15 }).map((h) => ({
      id: h.id,
      name: h.name,
    }));
  const learnset = side.species
    ? (index.learnsets.get(side.species) ?? new Set<string>())
    : new Set<string>();
  const moves = [...learnset]
    .flatMap((m) => index.moves.get(m) ?? [])
    .filter(isDamaging)
    .sort((x, y) => x.name.localeCompare(y.name));
  const stats: (keyof StatsTable)[] =
    kind === 'attacker' ? ['atk', 'spa', 'spe'] : ['hp', 'def', 'spd'];

  return (
    <Panel title={title} labelledBy={`${ids}-title`}>
      <div className="flex">
        <TypeEdge types={species?.types ?? []} />
        <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2">
          {slots.length > 0 && (
            <Field label={t('calc.fromTeam')} htmlFor={`${ids}-team`} className="sm:col-span-2">
              <Select
                id={`${ids}-team`}
                value=""
                onChange={(e) =>
                  e.target.value !== '' && onChange(fromSlot(Number(e.target.value)))
                }
              >
                <option value="">{t('calc.fromTeamNone')}</option>
                {slots.map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a slot is identified by its position
                  <option key={`${i}-${s.species}`} value={i}>
                    {i + 1}. {index.species.get(s.species)?.name ?? s.species}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label={t('calc.species')}
            htmlFor={`${ids}-species`}
            className="sm:col-span-2"
            hint={species ? <TypeChips types={species.types} /> : undefined}
          >
            <Combobox
              id={`${ids}-species`}
              value={side.species}
              valueLabel={species?.name ?? ''}
              emptyText={t('builder.noMatch')}
              search={speciesOptions}
              onChange={(id) => onChange(id ? fromMeta(id) : EMPTY)}
            />
          </Field>
          <Field label={t('calc.ability')} htmlFor={`${ids}-ability`}>
            <Select
              id={`${ids}-ability`}
              value={side.ability ?? ''}
              onChange={(e) => set({ ability: e.target.value || null })}
            >
              <option value="">{t('builder.none')}</option>
              {(species?.abilities ?? []).map((a) => (
                <option key={a} value={a}>
                  {index.abilities.get(a)?.name ?? a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('calc.item')} htmlFor={`${ids}-item`}>
            <Combobox
              id={`${ids}-item`}
              value={side.item}
              valueLabel={side.item ? (index.items.get(side.item)?.name ?? side.item) : ''}
              placeholder={t('builder.none')}
              emptyText={t('builder.noMatch')}
              search={itemOptions}
              onChange={(id) => set({ item: id })}
            />
          </Field>
          <Field label={t('calc.nature')} htmlFor={`${ids}-nature`}>
            <Select
              id={`${ids}-nature`}
              value={side.nature ?? ''}
              onChange={(e) => set({ nature: e.target.value || null })}
            >
              <option value="">{t('builder.none')}</option>
              {rules.ctx.dex.natures.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={kind === 'attacker' ? t('calc.stageAttack') : t('calc.stageDefense')}
            htmlFor={`${ids}-stage`}
          >
            <Select
              id={`${ids}-stage`}
              value={side.stage}
              onChange={(e) => set({ stage: Number(e.target.value) })}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s > 0 ? `+${s}` : s}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            {stats.map((stat) => (
              <Field
                key={stat}
                label={`${t(`stats.${stat}`)} ${t('stats.sp')}`}
                htmlFor={`${ids}-${stat}`}
              >
                <TextInput
                  id={`${ids}-${stat}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={
                    rules.ctx.profile.statSystem.kind === 'statPoints'
                      ? rules.ctx.profile.statSystem.maxPerStat
                      : 252
                  }
                  value={side.spread[stat]}
                  onChange={(e) =>
                    set({
                      spread: { ...side.spread, [stat]: Math.max(0, Number(e.target.value) || 0) },
                    })
                  }
                  className="text-right"
                />
              </Field>
            ))}
          </div>
          {kind === 'attacker' && (
            <Field label={t('calc.move')} htmlFor={`${ids}-move`} className="sm:col-span-2">
              <Select
                id={`${ids}-move`}
                value={side.move ?? ''}
                onChange={(e) => set({ move: e.target.value || null })}
              >
                <option value="">{t('builder.none')}</option>
                {moves.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.type} · {m.basePower}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {side.fromMeta && (
            <p className="m-0 text-sm text-muted sm:col-span-2">{t('calc.prefilled')}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
