import { useQuery } from '@tanstack/react-query';
import type { Manifest, ManifestRegulation } from '@vgc-helper/data';
import {
  buildSearchIndex,
  type DexIndex,
  indexDex,
  type RulesContext,
  type SearchIndex,
} from '@vgc-helper/engine';
import { useMemo } from 'react';
import { dexQuery, manifestQuery, settingsQuery } from '../api/queries';

/** The regulation in force now, or else the latest one that started, from the snapshot dates. */
export function currentRegulation(manifest: Manifest, gameId: string, now = Date.now()) {
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

export interface RulesSelection {
  gameId?: string;
  formatId?: string;
  regulationId?: string;
}

export interface Rules {
  manifest: Manifest;
  regulation: ManifestRegulation;
  ctx: RulesContext;
  index: DexIndex;
  search: SearchIndex;
}

/**
 * Loads everything the builder needs for one format and regulation. Without a selection it uses
 * the default format from the settings and the regulation in force today.
 */
export function useRules(selection: RulesSelection = {}): {
  rules: Rules | null;
  isError: boolean;
} {
  const manifest = useQuery(manifestQuery);
  const settings = useQuery(settingsQuery);

  const resolved = useMemo(() => {
    const m = manifest.data;
    if (!m) return null;
    const format =
      m.formats.find((f) => f.id === selection.formatId) ??
      m.formats.find((f) => f.id === settings.data?.defaultFormatId) ??
      m.formats[0];
    if (!format) return null;
    const gameId = selection.gameId ?? format.gameId;
    const regulation =
      m.regulations.find((r) => r.gameId === gameId && r.id === selection.regulationId) ??
      currentRegulation(m, gameId);
    const game = m.games.find((g) => g.id === gameId);
    const profile = m.mechanicsProfiles.find((p) => p.id === game?.mechanicsProfileId);
    return regulation && profile ? { manifest: m, format, regulation, profile } : null;
  }, [
    manifest.data,
    settings.data?.defaultFormatId,
    selection.formatId,
    selection.gameId,
    selection.regulationId,
  ]);

  const dex = useQuery({
    ...dexQuery(resolved?.regulation.gameId ?? '', resolved?.regulation.id ?? ''),
    enabled: resolved !== null,
  });

  const rules = useMemo((): Rules | null => {
    if (!resolved || !dex.data) return null;
    const { manifest: m, format, regulation, profile } = resolved;
    const index = indexDex(dex.data);
    const search = buildSearchIndex([
      ...dex.data.species
        .filter((s) => s.selectable)
        .map((s) => ({ id: s.id, name: s.name, kind: 'species' as const })),
      ...dex.data.moves.map((x) => ({ id: x.id, name: x.name, kind: 'move' as const })),
      ...dex.data.items.map((x) => ({ id: x.id, name: x.name, kind: 'item' as const })),
      ...dex.data.abilities.map((x) => ({ id: x.id, name: x.name, kind: 'ability' as const })),
    ]);
    return {
      manifest: m,
      regulation,
      ctx: { dex: dex.data, regulation, format, profile },
      index,
      search,
    };
  }, [resolved, dex.data]);

  return { rules, isError: manifest.isError || dex.isError };
}
