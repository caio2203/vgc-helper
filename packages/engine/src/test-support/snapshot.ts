// Test-only: loads the committed Champions Reg M-C snapshot so engine tests use real data.
import { readDexSnapshot, readManifest, readMetaSnapshot } from '@vgc-helper/data/node';
import { type DexIndex, indexDex, type RulesContext } from '../context.js';

export async function loadContext(
  formatId = 'champions-vgc',
): Promise<{ ctx: RulesContext; index: DexIndex }> {
  const manifest = await readManifest();
  const regulation = manifest.regulations.find((r) => r.gameId === 'champions');
  const format = manifest.formats.find((f) => f.id === formatId);
  const game = manifest.games.find((g) => g.id === regulation?.gameId);
  const profile = manifest.mechanicsProfiles.find((p) => p.id === game?.mechanicsProfileId);
  if (!regulation || !format || !profile) throw new Error('Snapshot is missing Champions data');
  const dex = await readDexSnapshot(regulation.files.dex);
  return { ctx: { dex, regulation, format, profile }, index: indexDex(dex) };
}

/** The context plus the analysis rules and the VGC meta snapshot. */
export async function loadAnalysis(formatId = 'champions-vgc') {
  const { ctx, index } = await loadContext(formatId);
  const manifest = await readManifest();
  const rules = manifest.analysisRules.find((r) => r.gameIds.includes(ctx.regulation.gameId));
  const metaPath = manifest.regulations.find((r) => r.id === ctx.regulation.id)?.files.meta[
    formatId
  ];
  if (!rules || !metaPath) throw new Error('Snapshot is missing analysis rules or meta');
  return { ctx, index, rules, meta: await readMetaSnapshot(metaPath) };
}
