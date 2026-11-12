/**
 * Compares two snapshots and lists what changed, as structured changes the web app and the data
 * PR render. Pure: the builder loads both sides and passes them in.
 */
import type {
  AnalysisRules,
  BanList,
  Change,
  ChangeRef,
  ChangeValue,
  DexList,
  DexSnapshot,
  Format,
  MechanicsProfile,
  MetaSnapshot,
  Regulation,
  UsageChange,
} from '@vgc-helper/data';

export interface SnapshotSet {
  mechanicsProfiles: MechanicsProfile[];
  formats: Format[];
  regulations: Regulation[];
  analysisRules: AnalysisRules[];
  overridesApplied: string[];
  /** Key: `gameId/regulationId`. */
  dex: ReadonlyMap<string, DexSnapshot>;
  /** Key: `gameId/regulationId/formatId`. */
  meta: ReadonlyMap<string, MetaSnapshot>;
}

export interface DiffOptions {
  /** Usage moves smaller than this (0–1) are left out, unless they cross the format cutoff. */
  usageMinDelta: number;
  /** Usage moves listed per format at most, largest first. */
  usageMaxEntries: number;
}

export const regulationKey = (r: { gameId: string; id: string }) => `${r.gameId}/${r.id}`;
export const metaKey = (gameId: string, regulationId: string, formatId: string) =>
  `${gameId}/${regulationId}/${formatId}`;

const byName = (a: ChangeRef, b: ChangeRef) => a.name.localeCompare(b.name);

/** Entries of `next` missing from `prev` and the other way round, sorted by name. */
function setDiff(
  prev: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
): { added: ChangeRef[]; removed: ChangeRef[] } {
  const added = [...next].filter(([id]) => !prev.has(id)).map(([id, name]) => ({ id, name }));
  const removed = [...prev].filter(([id]) => !next.has(id)).map(([id, name]) => ({ id, name }));
  return { added: added.sort(byName), removed: removed.sort(byName) };
}

function dexLists(dex: DexSnapshot): Record<DexList, Map<string, string>> {
  const named = (list: { id: string; name: string }[]) => new Map(list.map((x) => [x.id, x.name]));
  return {
    species: named(dex.species.filter((s) => s.selectable && !s.megaStone)),
    megas: named(dex.species.filter((s) => s.megaStone)),
    moves: named(dex.moves),
    items: named(dex.items),
    abilities: named(dex.abilities),
  };
}

/** Looks a name up in the new dex first: removed entries only exist in the old one. */
function namer(...dexes: (DexSnapshot | undefined)[]) {
  const names = new Map<string, string>();
  for (const dex of [...dexes].reverse()) {
    if (!dex) continue;
    for (const list of [dex.species, dex.moves, dex.items, dex.abilities]) {
      for (const x of list) names.set(x.id, x.name);
    }
  }
  return (id: string): ChangeRef => ({ id, name: names.get(id) ?? id });
}

function toValue(value: unknown): ChangeValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value) && value.every((v) => typeof v !== 'object' || v === null)) {
    return value.map(String);
  }
  return JSON.stringify(value);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Leaf-level differences between two hand-curated objects, skipping notes and sources. */
export function settingDiff(
  prev: unknown,
  next: unknown,
  skip: ReadonlySet<string>,
  path = '',
): { path: string; from: ChangeValue; to: ChangeValue }[] {
  const empty = (v: unknown) => v === null || v === undefined;
  // A section that appears or disappears is listed field by field, like any other change.
  if (
    (isPlainObject(prev) || empty(prev)) &&
    (isPlainObject(next) || empty(next)) &&
    !(empty(prev) && empty(next))
  ) {
    const a = (prev ?? {}) as Record<string, unknown>;
    const b = (next ?? {}) as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys
      .filter((k) => !skip.has(k))
      .flatMap((k) => settingDiff(a[k], b[k], skip, path ? `${path}.${k}` : k));
  }
  if (JSON.stringify(prev ?? null) === JSON.stringify(next ?? null)) return [];
  return [{ path, from: toValue(prev), to: toValue(next) }];
}

const SETTING_SKIP = new Set(['sources', 'source', 'note', 'retrievedAt', 'verifiedAt', 'name']);
/** Regulation fields that have their own change kinds. */
const REGULATION_SKIP = new Set([
  ...SETTING_SKIP,
  'startsAt',
  'endsAt',
  'files',
  'bannedSpecies',
  'bannedItems',
  'bannedMoves',
  'bannedAbilities',
  'bannedTags',
]);

function settingChanges<T extends { id: string }>(
  scope: 'mechanics' | 'format' | 'regulation',
  prev: T[],
  next: T[],
  skip: ReadonlySet<string>,
  shape: (x: T) => unknown = (x) => x,
): Change[] {
  return next.flatMap((n) => {
    const p = prev.find((x) => x.id === n.id && sameGame(x, n));
    if (!p) return [];
    return settingDiff(shape(p), shape(n), skip).map(
      (d): Change => ({ kind: 'setting', scope, id: n.id, ...d }),
    );
  });
}

const sameGame = (a: object, b: object) =>
  !('gameId' in a && 'gameId' in b) || a.gameId === b.gameId;

/** A regulation's formats keyed by format id, so a reorder is not a change. */
const regulationShape = (r: Regulation) => ({
  ...r,
  formats: Object.fromEntries(r.formats.map((f) => [f.formatId, f])),
});

const BAN_FIELDS: Record<BanList, keyof Regulation> = {
  species: 'bannedSpecies',
  items: 'bannedItems',
  moves: 'bannedMoves',
  abilities: 'bannedAbilities',
  tags: 'bannedTags',
};

const MOVE_FIELDS = [
  'type',
  'category',
  'basePower',
  'accuracy',
  'maxPp',
  'priority',
  'target',
] as const;
const STAT_FIELDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

function dexChanges(
  regulation: Regulation,
  prev: DexSnapshot,
  next: DexSnapshot,
  name: (id: string) => ChangeRef,
): Change[] {
  const at = { gameId: regulation.gameId, regulationId: regulation.id };
  const changes: Change[] = [];
  const prevLists = dexLists(prev);
  const nextLists = dexLists(next);
  for (const list of Object.keys(nextLists) as DexList[]) {
    const { added, removed } = setDiff(prevLists[list], nextLists[list]);
    if (added.length > 0 || removed.length > 0) {
      changes.push({ kind: 'dexEntries', ...at, list, added, removed });
    }
  }

  const prevMoves = new Map(prev.moves.map((m) => [m.id, m]));
  for (const move of next.moves) {
    const old = prevMoves.get(move.id);
    if (!old) continue;
    for (const field of MOVE_FIELDS) {
      if (old[field] !== move[field]) {
        changes.push({
          kind: 'moveChanged',
          ...at,
          move: { id: move.id, name: move.name },
          field,
          from: toValue(old[field]),
          to: toValue(move[field]),
        });
      }
    }
  }

  const prevSpecies = new Map(prev.species.map((s) => [s.id, s]));
  for (const species of next.species) {
    const old = prevSpecies.get(species.id);
    if (!old) continue;
    const ref = { id: species.id, name: species.name };
    for (const field of ['types', 'abilities'] as const) {
      if (old[field].join() !== species[field].join()) {
        changes.push({
          kind: 'speciesChanged',
          ...at,
          species: ref,
          field,
          from: field === 'abilities' ? old[field].map((a) => name(a).name) : old[field],
          to: field === 'abilities' ? species[field].map((a) => name(a).name) : species[field],
        });
      }
    }
    for (const stat of STAT_FIELDS) {
      if (old.baseStats[stat] !== species.baseStats[stat]) {
        changes.push({
          kind: 'speciesChanged',
          ...at,
          species: ref,
          field: stat,
          from: old.baseStats[stat],
          to: species.baseStats[stat],
        });
      }
    }

    const before = new Set(prev.learnsets[species.id] ?? []);
    const after = new Set(next.learnsets[species.id] ?? []);
    const added = [...after].filter((m) => !before.has(m)).map(name);
    const removed = [...before].filter((m) => !after.has(m)).map(name);
    if (added.length > 0 || removed.length > 0) {
      changes.push({
        kind: 'learnset',
        ...at,
        species: ref,
        added: added.sort(byName),
        removed: removed.sort(byName),
      });
    }
  }
  return changes;
}

function usageChange(
  regulation: Regulation,
  format: Format | undefined,
  prev: MetaSnapshot | undefined,
  next: MetaSnapshot,
  name: (id: string) => ChangeRef,
  options: DiffOptions,
): Change | null {
  const before = new Map(prev?.pokemon.map((p) => [p.species, p.usage]) ?? []);
  const after = new Map(next.pokemon.map((p) => [p.species, p.usage]));
  const cutoff = format?.viability.defaultCutoff ?? 0;
  const entries: UsageChange[] = [];
  if (prev) {
    for (const species of new Set([...before.keys(), ...after.keys()])) {
      const from = before.get(species) ?? null;
      const to = after.get(species) ?? null;
      const delta = Math.abs((to ?? 0) - (from ?? 0));
      const crosses = (from ?? 0) >= cutoff !== (to ?? 0) >= cutoff;
      if (delta >= options.usageMinDelta || (crosses && delta > 0)) {
        entries.push({ species: name(species), from, to });
      }
    }
  }
  entries.sort(
    (a, b) =>
      Math.abs((b.to ?? 0) - (b.from ?? 0)) - Math.abs((a.to ?? 0) - (a.from ?? 0)) ||
      a.species.name.localeCompare(b.species.name),
  );
  if (prev?.period === next.period && entries.length === 0) return null;
  return {
    kind: 'usage',
    gameId: regulation.gameId,
    regulationId: regulation.id,
    formatId: next.formatId,
    fromPeriod: prev?.period ?? null,
    toPeriod: next.period,
    battles: next.battles,
    source: next.source,
    entries: entries.slice(0, options.usageMaxEntries),
  };
}

function refsFor(list: string[], name: (id: string) => ChangeRef, isTag: boolean): ChangeRef[] {
  return list.map((id) => (isTag ? { id, name: id } : name(id))).sort(byName);
}

/** Every change from `prev` to `next`, general changes first, then per regulation. */
export function diffSnapshots(
  prev: SnapshotSet,
  next: SnapshotSet,
  options: DiffOptions,
): Change[] {
  const changes: Change[] = [];

  changes.push(
    ...settingChanges('mechanics', prev.mechanicsProfiles, next.mechanicsProfiles, SETTING_SKIP),
    ...settingChanges('format', prev.formats, next.formats, SETTING_SKIP),
  );
  for (const rules of next.analysisRules) {
    const old = prev.analysisRules.find((r) => r.id === rules.id);
    if (!old) continue;
    const sections = (Object.keys(rules) as (keyof AnalysisRules)[]).filter(
      (k) => k !== 'id' && k !== 'sources' && JSON.stringify(old[k]) !== JSON.stringify(rules[k]),
    );
    if (sections.length > 0) changes.push({ kind: 'analysisRules', id: rules.id, sections });
  }
  const oldOverrides = new Set(prev.overridesApplied);
  const newOverrides = new Set(next.overridesApplied);
  const addedOverrides = [...newOverrides].filter((o) => !oldOverrides.has(o));
  const removedOverrides = [...oldOverrides].filter((o) => !newOverrides.has(o));
  if (addedOverrides.length > 0 || removedOverrides.length > 0) {
    changes.push({ kind: 'overrides', added: addedOverrides, removed: removedOverrides });
  }

  const prevRegulations = new Map(prev.regulations.map((r) => [regulationKey(r), r]));
  const nextKeys = new Set(next.regulations.map(regulationKey));
  for (const old of prev.regulations) {
    if (!nextKeys.has(regulationKey(old))) {
      changes.push({
        kind: 'regulationRemoved',
        gameId: old.gameId,
        regulationId: old.id,
        name: old.name,
      });
    }
  }

  for (const regulation of next.regulations) {
    const key = regulationKey(regulation);
    const old = prevRegulations.get(key);
    const at = { gameId: regulation.gameId, regulationId: regulation.id };
    if (!old) {
      changes.push({
        kind: 'regulationAdded',
        ...at,
        name: regulation.name,
        startsAt: regulation.startsAt,
        endsAt: regulation.endsAt,
      });
      continue;
    }
    const oldDex = prev.dex.get(key);
    const newDex = next.dex.get(key);
    const name = namer(newDex, oldDex);

    for (const field of ['startsAt', 'endsAt'] as const) {
      if (old[field] !== regulation[field]) {
        changes.push({
          kind: 'regulationDates',
          ...at,
          field,
          from: old[field],
          to: regulation[field],
        });
      }
    }
    for (const [list, field] of Object.entries(BAN_FIELDS) as [BanList, keyof Regulation][]) {
      const before = new Set(old[field] as string[]);
      const after = new Set(regulation[field] as string[]);
      const added = [...after].filter((x) => !before.has(x));
      const removed = [...before].filter((x) => !after.has(x));
      if (added.length > 0 || removed.length > 0) {
        changes.push({
          kind: 'bans',
          ...at,
          list,
          added: refsFor(added, name, list === 'tags'),
          removed: refsFor(removed, name, list === 'tags'),
        });
      }
    }
    changes.push(
      ...settingChanges('regulation', [old], [regulation], REGULATION_SKIP, regulationShape),
    );
    if (oldDex && newDex) changes.push(...dexChanges(regulation, oldDex, newDex, name));

    for (const { formatId } of regulation.formats) {
      const meta = next.meta.get(metaKey(regulation.gameId, regulation.id, formatId));
      if (!meta) continue;
      const format = next.formats.find((f) => f.id === formatId);
      const change = usageChange(
        regulation,
        format,
        prev.meta.get(metaKey(regulation.gameId, regulation.id, formatId)),
        meta,
        name,
        options,
      );
      if (change) changes.push(change);
    }
  }
  return changes;
}

/**
 * Changes too large to be a normal update, which usually means a source broke. The builder
 * refuses to write the snapshot when this returns anything, unless the owner accepts it.
 */
export function sanityProblems(prev: SnapshotSet, next: SnapshotSet, maxShare: number): string[] {
  const problems: string[] = [];
  for (const regulation of next.regulations) {
    const key = regulationKey(regulation);
    const oldDex = prev.dex.get(key);
    const newDex = next.dex.get(key);
    if (!oldDex || !newDex) continue;
    const before = dexLists(oldDex);
    const after = dexLists(newDex);
    for (const list of ['species', 'moves'] as const) {
      const { added, removed } = setDiff(before[list], after[list]);
      const share = (added.length + removed.length) / Math.max(before[list].size, 1);
      if (share > maxShare) {
        problems.push(
          `${key}: the ${list} list changed by ${Math.round(share * 100)}% ` +
            `(${added.length} added, ${removed.length} removed), more than ${Math.round(maxShare * 100)}%`,
        );
      }
    }
  }
  return problems;
}
