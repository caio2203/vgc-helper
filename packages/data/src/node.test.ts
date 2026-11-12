import { describe, expect, it } from 'vitest';
import {
  readChangelog,
  readDexSnapshot,
  readManifest,
  readMetaSnapshot,
  resolveSnapshotPath,
} from './node.js';

describe('resolveSnapshotPath', () => {
  it('keeps paths inside the snapshot folder', () => {
    expect(resolveSnapshotPath('dex/x.json', '/snap')).toMatch(/snap[\\/]dex[\\/]x\.json$/);
  });

  it('rejects paths that escape the folder', () => {
    expect(() => resolveSnapshotPath('../secret.json', '/snap')).toThrow();
    expect(() => resolveSnapshotPath('/etc/passwd', '/snap')).toThrow();
  });
});

describe('committed snapshot', () => {
  it('passes schema validation and every manifest file loads', async () => {
    const manifest = await readManifest();
    expect(manifest.regulations.length).toBeGreaterThan(0);

    for (const regulation of manifest.regulations) {
      const dex = await readDexSnapshot(regulation.files.dex);
      expect(dex.regulationId).toBe(regulation.id);
      for (const metaPath of Object.values(regulation.files.meta)) {
        const meta = await readMetaSnapshot(metaPath);
        expect(meta.regulationId).toBe(regulation.id);
      }
    }
  });

  it('only references games, profiles and formats that exist', async () => {
    const manifest = await readManifest();
    const profileIds = new Set(manifest.mechanicsProfiles.map((p) => p.id));
    const gameIds = new Set(manifest.games.map((g) => g.id));
    const formatIds = new Set(manifest.formats.map((f) => f.id));

    for (const game of manifest.games) expect(profileIds).toContain(game.mechanicsProfileId);
    for (const format of manifest.formats) expect(gameIds).toContain(format.gameId);
    for (const regulation of manifest.regulations) {
      expect(gameIds).toContain(regulation.gameId);
      for (const f of regulation.formats) expect(formatIds).toContain(f.formatId);
    }
  });

  it('has a change history whose newest entry is the committed snapshot', async () => {
    const [manifest, changelog] = await Promise.all([readManifest(), readChangelog()]);
    expect(changelog.entries[0]?.version).toBe(manifest.version);
    const versions = changelog.entries.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const [i, entry] of changelog.entries.entries()) {
      const older = changelog.entries[i + 1];
      expect(entry.previousVersion).toBe(older ? older.version : null);
    }
  });
});
