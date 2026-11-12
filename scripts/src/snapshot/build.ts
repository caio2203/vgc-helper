/**
 * Builds the competitive data snapshot in packages/data/snapshots from:
 * - the hand-curated files in packages/data/manual (rules, dates, sources),
 * - the Pokémon Showdown mods published as @pkmn/mods (species, moves, items, learnsets),
 * - Smogon usage stats (meta),
 * - Limitless tournament standings (top-cut presence, counts only),
 * - the manual corrections in packages/data/overrides.
 *
 * Run with `pnpm snapshot:build`. Writes nothing when the content did not change. Otherwise it also
 * adds an entry to snapshots/changelog.json with what changed since the previous snapshot.
 *
 * Options:
 *   --report <file>          write the change report (Markdown, the data PR body) to this file
 *   --accept-large-changes   write the snapshot even when the sanity checks fail
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Changelog,
  type ChangelogEntry,
  changelogSchema,
  type DexSnapshot,
  dexSnapshotSchema,
  type Manifest,
  type ManifestRegulation,
  type ManualData,
  type MetaSnapshot,
  manifestSchema,
  manualDataSchema,
  metaSnapshotSchema,
  type Override,
  overrideFileSchema,
} from '@vgc-helper/data';
import { readChangelog } from '@vgc-helper/data/node';
import { z } from 'zod';
import { stringify } from '../lib/json.js';
import { buildDexSnapshot } from './dex.js';
import { diffSnapshots, metaKey, regulationKey, type SnapshotSet, sanityProblems } from './diff.js';
import { fetchTopCut } from './limitless.js';
import { applyOverrides } from './overrides.js';
import { renderReport } from './report.js';
import { chaosToMeta, fetchLatestChaos, listStatsMonths, totalUsage } from './smogon.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DATA_DIR = join(ROOT, 'packages', 'data');
const SNAPSHOT_DIR = join(DATA_DIR, 'snapshots');
/** Allowed gap between total usage and team size before the meta is rejected. */
const USAGE_TOLERANCE = 0.1;
/** A legal species or move list that changes by more than this share needs the owner's OK. */
const MAX_LIST_CHANGE = 0.3;
/** Usage moves in the change report: at least 2 points, or crossing the viability cutoff. */
const DIFF_OPTIONS = { usageMinDelta: 0.02, usageMaxEntries: 15 };

function parseArgs(argv: string[]) {
  const reportAt = argv.indexOf('--report');
  return {
    report: reportAt >= 0 ? (argv[reportAt + 1] ?? null) : null,
    acceptLargeChanges: argv.includes('--accept-large-changes'),
  };
}

async function readJsonFiles(dir: string): Promise<unknown[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'))));
}

async function loadManual(): Promise<ManualData> {
  const parts = (await readJsonFiles(join(DATA_DIR, 'manual'))).map((p) =>
    manualDataSchema.parse(p),
  );
  return {
    games: parts.flatMap((p) => p.games),
    mechanicsProfiles: parts.flatMap((p) => p.mechanicsProfiles),
    formats: parts.flatMap((p) => p.formats),
    regulations: parts.flatMap((p) => p.regulations),
    analysisRules: parts.flatMap((p) => p.analysisRules),
  };
}

async function loadOverrides(): Promise<Override[]> {
  return (await readJsonFiles(join(DATA_DIR, 'overrides'))).flatMap((p) =>
    overrideFileSchema.parse(p),
  );
}

async function pkmnModsVersion(): Promise<string> {
  const entry = fileURLToPath(import.meta.resolve('@pkmn/mods/champions'));
  const marker = join('node_modules', '@pkmn', 'mods');
  const pkg = join(entry.slice(0, entry.indexOf(marker) + marker.length), 'package.json');
  return (JSON.parse(await readFile(pkg, 'utf8')) as { version: string }).version;
}

/** Top-cut teams below this are flagged as a small sample. */
const MIN_TOP_CUT_TEAMS = 64;

async function previousMeta(path: string): Promise<MetaSnapshot | null> {
  try {
    return metaSnapshotSchema.parse(JSON.parse(await readFile(join(SNAPSHOT_DIR, path), 'utf8')));
  } catch {
    return null;
  }
}

/** The committed snapshot, loaded before anything is overwritten, to diff against. */
async function previousSet(manifest: Manifest | null): Promise<SnapshotSet | null> {
  if (!manifest) return null;
  const dex = new Map<string, DexSnapshot>();
  const meta = new Map<string, MetaSnapshot>();
  for (const regulation of manifest.regulations) {
    try {
      const raw = JSON.parse(await readFile(join(SNAPSHOT_DIR, regulation.files.dex), 'utf8'));
      dex.set(regulationKey(regulation), dexSnapshotSchema.parse(raw));
    } catch {
      // A missing or invalid old dex only means its changes are not listed.
    }
    for (const [formatId, path] of Object.entries(regulation.files.meta)) {
      const m = await previousMeta(path);
      if (m) meta.set(metaKey(regulation.gameId, regulation.id, formatId), m);
    }
  }
  return { ...manifest, dex, meta };
}

async function writeReport(path: string | null, body: string): Promise<void> {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

async function writeChangelog(changelog: Changelog): Promise<void> {
  const body = stringify(changelogSchema.parse(changelog));
  await writeFile(join(SNAPSHOT_DIR, 'changelog.json'), `${body}\n`);
}

/**
 * The committed manifest. When a schema change made it invalid (a new required field), it is
 * still used for the comparison and the history, as long as the parts the builder reads are there.
 */
async function previousManifest(): Promise<Manifest | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(SNAPSHOT_DIR, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
  const strict = manifestSchema.safeParse(raw);
  if (strict.success) return strict.data;
  const loose = previousManifestSchema.safeParse(raw);
  if (!loose.success) return null;
  console.warn('warning: the committed manifest predates the current schema; compared as-is');
  return loose.data as unknown as Manifest;
}

/** What the builder needs from an older manifest; other fields pass through unchecked. */
const previousManifestSchema = z.looseObject({
  version: z.string().min(1),
  generatedAt: z.iso.datetime(),
  warnings: z.array(z.string()).default([]),
  overridesApplied: z.array(z.string()).default([]),
  mechanicsProfiles: z.array(z.looseObject({ id: z.string() })).default([]),
  formats: z.array(z.looseObject({ id: z.string() })).default([]),
  analysisRules: z.array(z.looseObject({ id: z.string() })).default([]),
  regulations: z.array(
    z.looseObject({
      id: z.string(),
      gameId: z.string(),
      files: z.object({ dex: z.string(), meta: z.record(z.string(), z.string()) }),
    }),
  ),
});

/** Hash of the content without timestamps, so re-running with unchanged data is a no-op. */
function contentHash(files: Map<string, unknown>): string {
  const hash = createHash('sha256');
  for (const [path, value] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(path);
    hash.update(
      JSON.stringify(value, (key, v) =>
        key === 'retrievedAt' || key === 'generatedAt' ? undefined : v,
      ),
    );
  }
  return hash.digest('hex').slice(0, 10);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date().toISOString();
  const manual = await loadManual();
  const overrides = await loadOverrides();
  const modsVersion = await pkmnModsVersion();
  const months = await listStatsMonths();

  const files = new Map<string, unknown>();
  const regulations: ManifestRegulation[] = [];
  const overridesApplied: string[] = [];
  const warnings: string[] = [];

  for (const regulation of manual.regulations) {
    const game = manual.games.find((g) => g.id === regulation.gameId);
    const profile = manual.mechanicsProfiles.find((p) => p.id === game?.mechanicsProfileId);
    if (!game || !profile)
      throw new Error(`Regulation ${regulation.id}: unknown game or mechanics profile`);

    const dex = await buildDexSnapshot(regulation, profile, {
      // A base generation (gen9) is Showdown's main data; anything else is one of its mods.
      ...(/^gen\d+$/.test(regulation.dexMod)
        ? {
            name: `Pokémon Showdown ${regulation.dexMod} data, via @pkmn/dex ${modsVersion}`,
            url: 'https://github.com/smogon/pokemon-showdown/tree/master/data',
          }
        : {
            name: `Pokémon Showdown "${regulation.dexMod}" mod, via @pkmn/mods ${modsVersion}`,
            url: `https://github.com/smogon/pokemon-showdown/tree/master/data/mods/${regulation.dexMod}`,
          }),
      retrievedAt: now,
    });
    overridesApplied.push(...applyOverrides(dex, overrides));
    const dexPath = `${game.id}/${regulation.id}/dex.json`;
    files.set(dexPath, dexSnapshotSchema.parse(dex));
    const speciesIds = new Set(dex.species.map((s) => s.id));

    const metaPaths: Record<string, string> = {};
    for (const entry of regulation.formats) {
      const format = manual.formats.find((f) => f.id === entry.formatId);
      if (!format) throw new Error(`Regulation ${regulation.id}: unknown format ${entry.formatId}`);
      if (!entry.smogonStatsId) continue;

      const latest = await fetchLatestChaos(
        entry.smogonStatsId,
        format.viability.ratingCutoff,
        months,
      );
      if (!latest) {
        warnings.push(
          `${regulation.id}/${format.id}: no Smogon stats found for ${entry.smogonStatsId}`,
        );
        continue;
      }

      const usage = totalUsage(latest.chaos);
      const expected = format.teamSize.max;
      if (Math.abs(usage - expected) > expected * USAGE_TOLERANCE) {
        throw new Error(
          `${regulation.id}/${format.id}: total usage ${usage.toFixed(2)} is far from the team size ${expected}`,
        );
      }

      const meta = chaosToMeta(
        latest.chaos,
        { formatId: format.id, regulationId: regulation.id, month: latest.month, url: latest.url },
        now,
      );
      if (meta.battles < format.viability.minBattles) {
        warnings.push(
          `${regulation.id}/${format.id}: only ${meta.battles} battles in ${latest.month}`,
        );
      }
      const unknown = meta.pokemon.filter((p) => !speciesIds.has(p.species)).map((p) => p.species);
      if (unknown.length > 0) {
        warnings.push(
          `${regulation.id}/${format.id}: usage for species not in the dex: ${unknown.join(', ')}`,
        );
      }

      const metaPath = `${game.id}/${regulation.id}/meta/${format.id}.json`;
      if (entry.tournaments) {
        const label = `${regulation.id}/${format.id}`;
        try {
          const topCut = await fetchTopCut(entry.tournaments, new Date(now), now);
          if (topCut.teams < MIN_TOP_CUT_TEAMS) {
            warnings.push(`${label}: only ${topCut.teams} top-cut teams on Limitless`);
          }
          const unknownTopCut = topCut.pokemon
            .filter((p) => !speciesIds.has(p.species))
            .map((p) => p.species);
          if (unknownTopCut.length > 0) {
            warnings.push(`${label}: top-cut species not in the dex: ${unknownTopCut.join(', ')}`);
          }
          meta.tournaments = topCut;
        } catch (error) {
          // Keep the last good tournament data instead of dropping the bonus.
          meta.tournaments = (await previousMeta(metaPath))?.tournaments ?? null;
          warnings.push(`${label}: Limitless failed, kept the previous top-cut data: ${error}`);
        }
      }
      files.set(metaPath, metaSnapshotSchema.parse(meta));
      metaPaths[format.id] = metaPath;
    }

    regulations.push({ ...regulation, files: { dex: dexPath, meta: metaPaths } });
  }

  const manifestBody = {
    games: manual.games,
    mechanicsProfiles: manual.mechanicsProfiles,
    formats: manual.formats,
    regulations,
    analysisRules: manual.analysisRules,
    overridesApplied: [...new Set(overridesApplied)].sort(),
    warnings,
  };
  const hash = contentHash(new Map([...files, ['manifest', manifestBody]]));

  for (const warning of warnings) console.warn(`warning: ${warning}`);

  const previous = await previousManifest();
  const changelog = await readChangelog(SNAPSHOT_DIR);
  // The first run with a history records the committed snapshot as its starting point.
  const baseline: ChangelogEntry[] =
    previous && changelog.entries.length === 0
      ? [
          {
            version: previous.version,
            previousVersion: null,
            generatedAt: previous.generatedAt,
            changes: [],
            warnings: previous.warnings,
          },
        ]
      : [];

  if (previous?.version.endsWith(`.${hash}`)) {
    if (baseline.length > 0) await writeChangelog({ ...changelog, entries: baseline });
    await writeReport(args.report, `Snapshot unchanged (${previous.version}).\n`);
    console.log(`Snapshot unchanged (${previous.version}).`);
    return;
  }

  const before = await previousSet(previous);
  const newDex = new Map<string, DexSnapshot>();
  const newMeta = new Map<string, MetaSnapshot>();
  for (const regulation of regulations) {
    newDex.set(regulationKey(regulation), files.get(regulation.files.dex) as DexSnapshot);
    for (const [formatId, path] of Object.entries(regulation.files.meta)) {
      const key = metaKey(regulation.gameId, regulation.id, formatId);
      newMeta.set(key, files.get(path) as MetaSnapshot);
    }
  }
  const after: SnapshotSet = { ...manifestBody, dex: newDex, meta: newMeta };

  if (before) {
    const problems = sanityProblems(before, after, MAX_LIST_CHANGE);
    if (problems.length > 0 && !args.acceptLargeChanges) {
      for (const problem of problems) console.error(`sanity check failed: ${problem}`);
      const list = problems.map((p) => `- ${p}`).join('\n');
      await writeReport(
        args.report,
        `The sanity checks failed, so the snapshot was not written:\n\n${list}\n\n` +
          'Run the workflow again with "accept large changes" if this is expected.\n',
      );
      process.exitCode = 1;
      return;
    }
    // Recorded in the manifest too, so the Admin page shows that a large change was accepted.
    for (const problem of problems) manifestBody.warnings.push(`Accepted large change: ${problem}`);
  }

  for (const [path, value] of files) {
    const target = join(SNAPSHOT_DIR, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${stringify(value)}\n`);
  }

  const manifest: Manifest = manifestSchema.parse({
    schemaVersion: 1,
    version: `${now.slice(0, 10)}.${hash}`,
    generatedAt: now,
    ...manifestBody,
  });
  await writeFile(join(SNAPSHOT_DIR, 'manifest.json'), `${stringify(manifest)}\n`);

  const entry: ChangelogEntry = {
    version: manifest.version,
    previousVersion: previous?.version ?? null,
    generatedAt: now,
    changes: before ? diffSnapshots(before, after, DIFF_OPTIONS) : [],
    warnings: manifest.warnings,
  };
  await writeChangelog({ ...changelog, entries: [entry, ...baseline, ...changelog.entries] });
  await writeReport(args.report, renderReport(entry));
  console.log(`${entry.changes.length} changes since ${entry.previousVersion ?? 'nothing'}.`);

  console.log(`Snapshot ${manifest.version} written:`);
  for (const path of files.keys()) console.log(`  ${path}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
