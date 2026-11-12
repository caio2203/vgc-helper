import { useQueries, useQuery } from '@tanstack/react-query';
import type { DexSnapshot } from '@vgc-helper/data';
import {
  type DexIndex,
  indexDex,
  type Revalidation,
  regulationInForce,
  revalidateTeam,
  type SavedTeam,
} from '@vgc-helper/engine';
import { useMemo } from 'react';
import { changelogQuery, dexQuery, manifestQuery } from '../api/queries';

/**
 * Checks saved teams again with the data the app serves now (engine `revalidateTeam`), loading
 * the dex of each team's regulation and of the regulation in force. Teams map by id.
 */
export function useRevalidation(teams: (SavedTeam & { id: string })[] | undefined): {
  results: Map<string, Revalidation> | null;
  indexOf: (gameId: string, regulationId: string) => DexIndex | undefined;
} {
  const manifest = useQuery(manifestQuery);
  const changelog = useQuery(changelogQuery);
  const m = manifest.data;

  const keys = useMemo(() => {
    if (!m || !teams) return [];
    const wanted = new Set<string>();
    for (const team of teams) {
      wanted.add(`${team.gameId}/${team.regulationId}`);
      const current = regulationInForce(m, team.gameId);
      if (current) wanted.add(`${current.gameId}/${current.id}`);
    }
    return [...wanted]
      .map((key) => key.split('/') as [string, string])
      .filter(([gameId, id]) => m.regulations.some((r) => r.gameId === gameId && r.id === id));
  }, [m, teams]);

  const dexes = useQueries({ queries: keys.map(([gameId, id]) => dexQuery(gameId, id)) });
  const loaded = dexes.every((d) => d.data);
  const data = dexes.map((d) => d.data);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `data` is a new array every render; `loaded` and the keys say when it changed
  const indexes = useMemo(() => {
    const map = new Map<string, { dex: DexSnapshot; index: DexIndex }>();
    keys.forEach(([gameId, id], i) => {
      const dex = data[i];
      if (dex) map.set(`${gameId}/${id}`, { dex, index: indexDex(dex) });
    });
    return map;
  }, [keys, loaded]);

  const results = useMemo(() => {
    if (!m || !changelog.data || !teams || !loaded) return null;
    const result = new Map<string, Revalidation>();
    for (const team of teams) {
      const format = m.formats.find((f) => f.id === team.formatId);
      const game = m.games.find((g) => g.id === team.gameId);
      const profile = m.mechanicsProfiles.find((p) => p.id === game?.mechanicsProfileId);
      if (!format || !profile) continue;
      result.set(
        team.id,
        revalidateTeam(team, {
          manifest: m,
          changelog: changelog.data,
          rulesFor: (regulationId) => {
            const regulation = m.regulations.find(
              (r) => r.gameId === team.gameId && r.id === regulationId,
            );
            const loadedDex = indexes.get(`${team.gameId}/${regulationId}`);
            if (!regulation || !loadedDex) return null;
            return {
              ctx: { dex: loadedDex.dex, regulation, format, profile },
              index: loadedDex.index,
            };
          },
        }),
      );
    }
    return result;
  }, [m, changelog.data, teams, loaded, indexes]);

  return {
    results,
    indexOf: (gameId, regulationId) => indexes.get(`${gameId}/${regulationId}`)?.index,
  };
}
