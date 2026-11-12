/**
 * Renders a changelog entry as the Markdown body of the data PR, in English, so the owner can
 * review the update without reading JSON. The web app renders the same entry from i18n templates.
 */
import type { Change, ChangelogEntry, ChangeRef, ChangeValue } from '@vgc-helper/data';

/** GitHub refuses PR bodies over 65,536 characters. */
export const MAX_REPORT_LENGTH = 60_000;
/** Names listed inline per change before the rest is summed up. */
const MAX_NAMES = 30;

const pct = (share: number | null) => (share === null ? '—' : `${(share * 100).toFixed(1)}%`);

function names(refs: ChangeRef[]): string {
  const shown = refs.slice(0, MAX_NAMES).map((r) => r.name);
  const rest = refs.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

function value(v: ChangeValue): string {
  if (v === null) return 'none';
  if (Array.isArray(v)) return v.length > 0 ? v.join(' / ') : 'none';
  return `\`${String(v)}\``;
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : 'open');

const LIST_LABEL = {
  species: 'Pokémon',
  megas: 'Megas',
  moves: 'moves',
  items: 'items',
  abilities: 'abilities',
  tags: 'tags',
} as const;

function addedRemoved(label: string, added: ChangeRef[], removed: ChangeRef[]): string[] {
  const lines: string[] = [];
  if (added.length > 0) lines.push(`${label} added (${added.length}): ${names(added)}`);
  if (removed.length > 0) lines.push(`${label} removed (${removed.length}): ${names(removed)}`);
  return lines;
}

/** One or more bullet lines for a change. */
export function describeChange(change: Change): string[] {
  switch (change.kind) {
    case 'regulationAdded':
      return [
        `New regulation detected: **${change.name}** (${change.regulationId}), ` +
          `from ${day(change.startsAt)} to ${day(change.endsAt)}`,
      ];
    case 'regulationRemoved':
      return [`Regulation removed from the data: **${change.name}** (${change.regulationId})`];
    case 'regulationDates':
      return [
        `${change.field === 'startsAt' ? 'Start' : 'End'} date: ${day(change.from)} → ${day(change.to)}`,
      ];
    case 'dexEntries':
      return addedRemoved(`Legal ${LIST_LABEL[change.list]}`, change.added, change.removed);
    case 'bans':
      return [
        ...(change.added.length > 0
          ? [`Banned ${LIST_LABEL[change.list]}: ${names(change.added)}`]
          : []),
        ...(change.removed.length > 0
          ? [`No longer banned (${LIST_LABEL[change.list]}): ${names(change.removed)}`]
          : []),
      ];
    case 'moveChanged':
      return [`${change.move.name}: ${change.field} ${value(change.from)} → ${value(change.to)}`];
    case 'speciesChanged':
      return [
        `${change.species.name}: ${change.field} ${value(change.from)} → ${value(change.to)}`,
      ];
    case 'learnset':
      return [
        ...(change.removed.length > 0
          ? [`${change.species.name} no longer learns ${names(change.removed)}`]
          : []),
        ...(change.added.length > 0
          ? [`${change.species.name} now learns ${names(change.added)}`]
          : []),
      ];
    case 'usage': {
      const head =
        `Usage in ${change.formatId}: ` +
        (change.fromPeriod && change.fromPeriod !== change.toPeriod
          ? `${change.fromPeriod} → ${change.toPeriod}`
          : change.toPeriod) +
        `, ${change.battles.toLocaleString('en')} battles ([source](${change.source.url}))`;
      return [
        head,
        ...change.entries.map((e) => `  - ${e.species.name}: ${pct(e.from)} → ${pct(e.to)}`),
      ];
    }
    case 'setting':
      return [
        `${change.scope} \`${change.id}\`: ${change.path} ${value(change.from)} → ${value(change.to)}`,
      ];
    case 'overrides':
      return [
        ...(change.added.length > 0 ? [`Overrides applied: ${change.added.join(', ')}`] : []),
        ...(change.removed.length > 0
          ? [`Overrides no longer applied: ${change.removed.join(', ')}`]
          : []),
      ];
    case 'analysisRules':
      return [`Analysis rules \`${change.id}\` changed: ${change.sections.join(', ')}`];
  }
}

function bullets(changes: Change[]): string[] {
  return changes
    .flatMap(describeChange)
    .map((line) => (line.startsWith('  ') ? line : `- ${line}`));
}

const regulationOf = (c: Change) =>
  'regulationId' in c && 'gameId' in c ? `${c.gameId}/${c.regulationId}` : null;

/** The PR body for one changelog entry. */
export function renderReport(entry: ChangelogEntry): string {
  const lines: string[] = [
    'Automatic update from the data pipeline (`pnpm snapshot:build`).',
    '',
    `Snapshot \`${entry.version}\`` +
      (entry.previousVersion ? `, compared with \`${entry.previousVersion}\`.` : '.'),
    '',
  ];

  const general = entry.changes.filter((c) => regulationOf(c) === null);
  const byRegulation = new Map<string, Change[]>();
  for (const change of entry.changes) {
    const key = regulationOf(change);
    if (key) byRegulation.set(key, [...(byRegulation.get(key) ?? []), change]);
  }

  if (entry.changes.length === 0) {
    lines.push('No change in the data itself (only retrieval dates).', '');
  }
  if (general.length > 0) lines.push('## Rules and settings', '', ...bullets(general), '');
  for (const [key, changes] of byRegulation) {
    lines.push(`## ${key}`, '', ...bullets(changes), '');
  }
  if (entry.warnings.length > 0) {
    lines.push('## Warnings', '', ...entry.warnings.map((w) => `- ${w}`), '');
  }
  lines.push(
    'Review the changed files in `packages/data/snapshots` before merging. The full list is in',
    "`packages/data/snapshots/changelog.json` and on the What's new page after the merge.",
  );

  const report = lines.join('\n');
  if (report.length <= MAX_REPORT_LENGTH) return `${report}\n`;
  return (
    `${report.slice(0, MAX_REPORT_LENGTH)}\n\n` +
    '_The report was cut to fit a pull request. See `changelog.json` for the rest._\n'
  );
}
