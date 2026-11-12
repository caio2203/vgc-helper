import { Controller, Get, Header, Param } from '@nestjs/common';
import type { Changelog, DexSnapshot, Manifest, MetaSnapshot } from '@vgc-helper/data';
import { SnapshotsService } from './snapshots.service.js';

/**
 * The web app gets competitive data only through these authenticated routes,
 * never as public static files. Express adds an ETag, so unchanged data costs a 304.
 */
@Controller('snapshots')
export class SnapshotsController {
  constructor(private readonly snapshots: SnapshotsService) {}

  @Get('manifest')
  @Header('Cache-Control', 'private, no-cache')
  manifest(): Promise<Manifest> {
    return this.snapshots.manifest();
  }

  @Get('changelog')
  @Header('Cache-Control', 'private, no-cache')
  changelog(): Promise<Changelog> {
    return this.snapshots.changelog();
  }

  @Get(':gameId/:regulationId/dex')
  @Header('Cache-Control', 'private, no-cache')
  dex(
    @Param('gameId') gameId: string,
    @Param('regulationId') regulationId: string,
  ): Promise<DexSnapshot> {
    return this.snapshots.dex(gameId, regulationId);
  }

  @Get(':gameId/:regulationId/meta/:formatId')
  @Header('Cache-Control', 'private, no-cache')
  meta(
    @Param('gameId') gameId: string,
    @Param('regulationId') regulationId: string,
    @Param('formatId') formatId: string,
  ): Promise<MetaSnapshot> {
    return this.snapshots.meta(gameId, regulationId, formatId);
  }
}
