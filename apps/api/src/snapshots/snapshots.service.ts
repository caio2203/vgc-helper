import { Injectable, NotFoundException } from '@nestjs/common';
import type { DexSnapshot, Manifest, MetaSnapshot } from '@vgc-helper/data';
import { readDexSnapshot, readManifest, readMetaSnapshot } from '@vgc-helper/data/node';

/** Serves the committed snapshots. Files are read and validated once per instance. */
@Injectable()
export class SnapshotsService {
  private manifestPromise: Promise<Manifest> | undefined;
  private readonly files = new Map<string, Promise<DexSnapshot | MetaSnapshot>>();

  manifest(): Promise<Manifest> {
    this.manifestPromise ??= readManifest();
    return this.manifestPromise;
  }

  async dex(gameId: string, regulationId: string): Promise<DexSnapshot> {
    const path = (await this.regulation(gameId, regulationId)).files.dex;
    return this.cached(path, () => readDexSnapshot(path)) as Promise<DexSnapshot>;
  }

  async meta(gameId: string, regulationId: string, formatId: string): Promise<MetaSnapshot> {
    const path = (await this.regulation(gameId, regulationId)).files.meta[formatId];
    if (!path) throw new NotFoundException();
    return this.cached(path, () => readMetaSnapshot(path)) as Promise<MetaSnapshot>;
  }

  /** Only paths listed in the manifest are ever read, so request input never becomes a file path. */
  private async regulation(gameId: string, regulationId: string) {
    const found = (await this.manifest()).regulations.find(
      (r) => r.gameId === gameId && r.id === regulationId,
    );
    if (!found) throw new NotFoundException();
    return found;
  }

  private cached(path: string, load: () => Promise<DexSnapshot | MetaSnapshot>) {
    let file = this.files.get(path);
    if (!file) {
      file = load();
      this.files.set(path, file);
    }
    return file;
  }
}
