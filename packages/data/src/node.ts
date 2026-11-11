import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { type DexSnapshot, dexSnapshotSchema } from './schemas/dex.js';
import { type Manifest, manifestSchema } from './schemas/manifest.js';
import { type MetaSnapshot, metaSnapshotSchema } from './schemas/meta.js';

/** Folder with the committed snapshots, next to this package's `dist`. */
export const SNAPSHOT_DIR = fileURLToPath(new URL('../snapshots/', import.meta.url));

/** Resolves a manifest path and refuses anything that escapes the snapshot folder. */
export function resolveSnapshotPath(relativePath: string, dir = SNAPSHOT_DIR): string {
  const root = resolve(dir);
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Snapshot path escapes the snapshot folder: ${relativePath}`);
  }
  return target;
}

async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
  return schema.parse(raw);
}

export function readManifest(dir = SNAPSHOT_DIR): Promise<Manifest> {
  return readJson(join(dir, 'manifest.json'), manifestSchema);
}

export function readDexSnapshot(relativePath: string, dir = SNAPSHOT_DIR): Promise<DexSnapshot> {
  return readJson(resolveSnapshotPath(relativePath, dir), dexSnapshotSchema);
}

export function readMetaSnapshot(relativePath: string, dir = SNAPSHOT_DIR): Promise<MetaSnapshot> {
  return readJson(resolveSnapshotPath(relativePath, dir), metaSnapshotSchema);
}
