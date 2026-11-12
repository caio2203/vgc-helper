import type { Change, Changelog, ChangelogEntry, ChangeRef, Manifest } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import type { DexIndex, RulesContext } from './context.js';
import { checkLegality, type LegalityIssue } from './legality.js';

/** What a saved team needs to be checked again: its slots, its rules and the data it was saved with. */
export interface SavedTeam {
  slots: TeamSlot[];
  gameId: string;
  formatId: string;
  regulationId: string;
  snapshotVersion: string;
}

/** A change from the history, narrowed to what the team uses, with the snapshot it came in. */
export interface TeamChange {
  change: Change;
  version: string;
  generatedAt: string;
}

export type RegulationStatus = 'active' | 'ended' | 'upcoming' | 'missing';

export interface Revalidation {
  /** Saved with the snapshot the app serves now: nothing to check. */
  upToDate: boolean;
  /** The saved snapshot is in the history, so `changes` is complete. */
  historyKnown: boolean;
  regulation: { id: string; status: RegulationStatus; endsAt: string | null };
  /** Errors against the team's own regulation in the current data; empty when it is missing. */
  issues: LegalityIssue[];
  /** When the team's regulation is not in force: errors against the one that is. */
  inForce: { regulationId: string; name: string; issues: LegalityIssue[] } | null;
  changes: TeamChange[];
}

/** The regulation in force at `now`, or else the latest one that started, from the snapshot dates. */
export function regulationInForce(manifest: Manifest, gameId: string, now = Date.now()) {
  const ofGame = manifest.regulations.filter((r) => r.gameId === gameId);
  const active = ofGame.find(
    (r) => Date.parse(r.startsAt) <= now && (r.endsAt === null || now < Date.parse(r.endsAt)),
  );
  return (
    active ??
    [...ofGame]
      .filter((r) => Date.parse(r.startsAt) <= now)
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ??
    ofGame[0]
  );
}

const dayOf = (version: string) => version.slice(0, 10);

/**
 * History entries newer than `version`, newest first. Versions start with the build date, so a
 * version that is not in the history (older than it) still gets every entry from that day on.
 */
export function changesSince(
  changelog: Changelog,
  version: string,
): { entries: ChangelogEntry[]; known: boolean } {
  const at = changelog.entries.findIndex((e) => e.version === version);
  if (at >= 0) return { entries: changelog.entries.slice(0, at), known: true };
  return {
    entries: changelog.entries.filter((e) => dayOf(e.version) >= dayOf(version)),
    known: false,
  };
}

const keep = (refs: ChangeRef[], used: ReadonlySet<string>) => refs.filter((r) => used.has(r.id));

/** The part of one change that touches the team, or null when it does not. */
export function narrowChange(
  change: Change,
  team: Omit<SavedTeam, 'snapshotVersion'>,
): Change | null {
  const species = new Set(team.slots.map((s) => s.species));
  const moves = new Set(team.slots.flatMap((s) => s.moves));
  const items = new Set(team.slots.flatMap((s) => (s.item ? [s.item] : [])));
  const abilities = new Set(team.slots.flatMap((s) => (s.ability ? [s.ability] : [])));
  const megaBases = team.slots.filter((s) => s.mega).map((s) => s.species);
  const sameRegulation =
    'regulationId' in change &&
    change.gameId === team.gameId &&
    change.regulationId === team.regulationId;
  const used = { species, moves, items, abilities, tags: new Set<string>() };

  switch (change.kind) {
    case 'regulationAdded':
      return change.gameId === team.gameId ? change : null;
    case 'regulationRemoved':
    case 'regulationDates':
      return sameRegulation ? change : null;
    case 'dexEntries': {
      if (!sameRegulation) return null;
      const removed =
        change.list === 'megas'
          ? change.removed.filter((r) => megaBases.some((base) => r.id.startsWith(base)))
          : keep(change.removed, used[change.list]);
      return removed.length > 0 ? { ...change, added: [], removed } : null;
    }
    case 'bans': {
      if (!sameRegulation) return null;
      const added = keep(change.added, used[change.list]);
      return added.length > 0 ? { ...change, added, removed: [] } : null;
    }
    case 'moveChanged':
      return sameRegulation && moves.has(change.move.id) ? change : null;
    case 'speciesChanged':
      return sameRegulation && species.has(change.species.id) ? change : null;
    case 'learnset': {
      if (!sameRegulation) return null;
      const slotMoves = new Set(
        team.slots.filter((s) => s.species === change.species.id).flatMap((s) => s.moves),
      );
      const removed = keep(change.removed, slotMoves);
      return removed.length > 0 ? { ...change, added: [], removed } : null;
    }
    case 'usage': {
      if (!sameRegulation || change.formatId !== team.formatId) return null;
      const entries = change.entries.filter((e) => species.has(e.species.id));
      return entries.length > 0 ? { ...change, entries } : null;
    }
    case 'setting':
      if (change.scope === 'mechanics') return change;
      if (change.scope === 'format') return change.id === team.formatId ? change : null;
      return change.id === team.regulationId ? change : null;
    case 'overrides':
    case 'analysisRules':
      return null;
  }
}

export interface RevalidationData {
  manifest: Manifest;
  changelog: Changelog;
  /** Rules of one regulation of the team's game and format, or null while it is not loaded. */
  rulesFor: (regulationId: string) => { ctx: RulesContext; index: DexIndex } | null;
  now?: number;
}

const errorsOnly = (issues: LegalityIssue[]) => issues.filter((i) => i.severity === 'error');

/**
 * Checks a saved team again with the data the app serves now: legality in its own regulation and
 * in the one in force, plus the changes since it was saved that touch its Pokémon, moves and items.
 */
export function revalidateTeam(team: SavedTeam, data: RevalidationData): Revalidation {
  const now = data.now ?? Date.now();
  const own = data.manifest.regulations.find(
    (r) => r.gameId === team.gameId && r.id === team.regulationId,
  );
  const status: RegulationStatus = !own
    ? 'missing'
    : Date.parse(own.startsAt) > now
      ? 'upcoming'
      : own.endsAt !== null && Date.parse(own.endsAt) <= now
        ? 'ended'
        : 'active';

  const ownRules = own ? data.rulesFor(own.id) : null;
  const issues = ownRules
    ? errorsOnly(checkLegality(team.slots, ownRules.ctx, ownRules.index))
    : [];

  let inForce: Revalidation['inForce'] = null;
  const current = regulationInForce(data.manifest, team.gameId, now);
  if (status !== 'active' && current && current.id !== team.regulationId) {
    const rules = data.rulesFor(current.id);
    if (rules) {
      inForce = {
        regulationId: current.id,
        name: current.name,
        issues: errorsOnly(checkLegality(team.slots, rules.ctx, rules.index)),
      };
    }
  }

  const upToDate = team.snapshotVersion === data.manifest.version;
  const since = upToDate
    ? { entries: [], known: true }
    : changesSince(data.changelog, team.snapshotVersion);
  const changes = since.entries.flatMap((entry) =>
    entry.changes.flatMap((change) => {
      const narrowed = narrowChange(change, team);
      return narrowed
        ? [{ change: narrowed, version: entry.version, generatedAt: entry.generatedAt }]
        : [];
    }),
  );

  return {
    upToDate,
    historyKnown: since.known,
    regulation: { id: team.regulationId, status, endsAt: own?.endsAt ?? null },
    issues,
    inForce,
    changes,
  };
}

/** Whether the team needs the owner's attention after the data changed. */
export const needsAttention = (r: Revalidation) =>
  r.issues.length > 0 ||
  (r.inForce?.issues.length ?? 0) > 0 ||
  r.regulation.status === 'missing' ||
  r.regulation.status === 'ended' ||
  r.changes.some((c) => c.change.kind !== 'usage');
