/**
 * Builds the competitive data snapshot in packages/data/snapshots from:
 * - the hand-curated files in packages/data/manual (rules, dates, sources),
 * - the Pokémon Showdown mods published as @pkmn/mods (species, moves, items, learnsets),
 * - Smogon usage stats (meta),
 * - the manual corrections in packages/data/overrides.
 *
 * Run with `pnpm snapshot:build`. Writes nothing when the content did not change.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dexSnapshotSchema,
  type Manifest,
  type ManifestRegulation,
  type ManualData,
  manifestSchema,
  manualDataSchema,
  metaSnapshotSchema,
  type Override,
  overrideFileSchema,
} from '@vgc-helper/data';
import { stringify } from '../lib/json.js';
import { buildDexSnapshot } from './dex.js';
import { applyOverrides } from './overrides.js';
import { chaosToMeta, fetchLatestChaos, listStatsMonths, totalUsage } from './smogon.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DATA_DIR = join(ROOT, 'packages', 'data');
const SNAPSHOT_DIR = join(DATA_DIR, 'snapshots');
/** Allowed gap between total usage and team size before the meta is rejected. */
const USAGE_TOLERANCE = 0.1;

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

async function previousManifest(): Promise<Manifest | null> {
  try {
    return manifestSchema.parse(
      JSON.parse(await readFile(join(SNAPSHOT_DIR, 'manifest.json'), 'utf8')),
    );
  } catch {
    return null;
  }
}

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
      name: `Pokémon Showdown "${regulation.dexMod}" mod, via @pkmn/mods ${modsVersion}`,
      url: `https://github.com/smogon/pokemon-showdown/tree/master/data/mods/${regulation.dexMod}`,
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
    overridesApplied: [...new Set(overridesApplied)].sort(),
  };
  const hash = contentHash(new Map([...files, ['manifest', manifestBody]]));

  for (const warning of warnings) console.warn(`warning: ${warning}`);

  const previous = await previousManifest();
  if (previous?.version.endsWith(`.${hash}`)) {
    console.log(`Snapshot unchanged (${previous.version}).`);
    return;
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

  console.log(`Snapshot ${manifest.version} written:`);
  for (const path of files.keys()) console.log(`  ${path}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
