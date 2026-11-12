import type { Change, ChangeRef, ChangeValue, Manifest, SourceRef } from '@vgc-helper/data';
import type { TFunction } from 'i18next';

/** Names listed inline before the rest is summed up as "and N more". */
const MAX_NAMES = 12;

export interface ChangeText {
  /** One sentence per line; most changes have one. */
  lines: string[];
  /** Usage moves, one per species. */
  details: string[];
  /** Where the numbers come from, for changes that carry them. */
  source: SourceRef | null;
}

export interface Formatters {
  t: TFunction;
  date: (iso: string, withTime?: boolean) => string;
  share: (n: number) => string;
  number: (n: number) => string;
  list: (items: string[]) => string;
}

/** Text for every kind of change in the history, in the interface language. */
export function describeChange(
  change: Change,
  manifest: Manifest | undefined,
  f: Formatters,
): ChangeText {
  const { t } = f;
  const names = (refs: ChangeRef[]) => {
    const shown = refs.slice(0, MAX_NAMES).map((r) => r.name);
    const rest = refs.length - shown.length;
    return rest > 0 ? t('changes.more', { names: shown.join(', '), count: rest }) : f.list(shown);
  };
  const value = (v: ChangeValue, field?: string): string => {
    if (v === null) return t('changes.none');
    if (Array.isArray(v)) return v.length > 0 ? v.join(' / ') : t('changes.none');
    if (typeof v === 'boolean') {
      return field === 'accuracy' && v
        ? t('changes.alwaysHits')
        : t(v ? 'changes.yes' : 'changes.no');
    }
    if (typeof v === 'number') return f.number(v);
    return v;
  };
  const day = (iso: string | null) => (iso ? f.date(iso, false) : t('changes.noEnd'));
  const regulationName = (id: string) => manifest?.regulations.find((r) => r.id === id)?.name ?? id;
  const formatName = (id: string) => manifest?.formats.find((x) => x.id === id)?.name ?? id;
  const result = (lines: string[], details: string[] = [], source: SourceRef | null = null) => ({
    lines,
    details,
    source,
  });

  switch (change.kind) {
    case 'regulationAdded':
      return result([
        change.endsAt
          ? t('changes.regulationAdded', {
              name: change.name,
              start: day(change.startsAt),
              end: day(change.endsAt),
            })
          : t('changes.regulationAddedOpen', { name: change.name, start: day(change.startsAt) }),
      ]);
    case 'regulationRemoved':
      return result([t('changes.regulationRemoved', { name: change.name })]);
    case 'regulationDates':
      return result([
        t(`changes.dates.${change.field}`, {
          regulation: regulationName(change.regulationId),
          from: day(change.from),
          to: day(change.to),
        }),
      ]);
    case 'dexEntries':
      return result([
        ...(change.added.length > 0
          ? [t(`changes.legalAdded.${change.list}`, { names: names(change.added) })]
          : []),
        ...(change.removed.length > 0
          ? [t(`changes.legalRemoved.${change.list}`, { names: names(change.removed) })]
          : []),
      ]);
    case 'bans':
      return result([
        ...(change.added.length > 0 ? [t('changes.banned', { names: names(change.added) })] : []),
        ...(change.removed.length > 0
          ? [t('changes.unbanned', { names: names(change.removed) })]
          : []),
      ]);
    case 'moveChanged':
      return result([
        t('changes.field', {
          name: change.move.name,
          field: t(`changes.moveField.${change.field}`),
          from: value(change.from, change.field),
          to: value(change.to, change.field),
        }),
      ]);
    case 'speciesChanged':
      return result([
        t('changes.field', {
          name: change.species.name,
          field: t(`changes.speciesField.${change.field}`),
          from: value(change.from),
          to: value(change.to),
        }),
      ]);
    case 'learnset':
      return result([
        ...(change.removed.length > 0
          ? [t('changes.unlearned', { species: change.species.name, moves: names(change.removed) })]
          : []),
        ...(change.added.length > 0
          ? [t('changes.learned', { species: change.species.name, moves: names(change.added) })]
          : []),
      ]);
    case 'usage':
      return result(
        [
          change.fromPeriod && change.fromPeriod !== change.toPeriod
            ? t('changes.usageMonths', {
                format: formatName(change.formatId),
                from: change.fromPeriod,
                to: change.toPeriod,
                battles: f.number(change.battles),
              })
            : t('changes.usage', {
                format: formatName(change.formatId),
                period: change.toPeriod,
                battles: f.number(change.battles),
              }),
        ],
        change.entries.map((e) =>
          t('changes.usageEntry', {
            species: e.species.name,
            from: e.from === null ? t('changes.none') : f.share(e.from),
            to: e.to === null ? t('changes.none') : f.share(e.to),
          }),
        ),
        change.source,
      );
    case 'setting':
      return result([
        t('changes.setting', {
          scope: t(`changes.scope.${change.scope}`),
          id:
            change.scope === 'format'
              ? formatName(change.id)
              : change.scope === 'regulation'
                ? regulationName(change.id)
                : change.id,
          path: change.path,
          from: value(change.from),
          to: value(change.to),
        }),
      ]);
    case 'overrides':
      return result([
        ...(change.added.length > 0
          ? [t('changes.overridesAdded', { ids: f.list(change.added) })]
          : []),
        ...(change.removed.length > 0
          ? [t('changes.overridesRemoved', { ids: f.list(change.removed) })]
          : []),
      ]);
    case 'analysisRules':
      return result([t('changes.analysisRules', { sections: f.list(change.sections) })]);
  }
}

/** The regulation a change belongs to, or null for game-wide changes. */
export const changeRegulation = (change: Change) =>
  'regulationId' in change ? change.regulationId : null;
