import type { DexSnapshot, Override } from '@vgc-helper/data';

/**
 * Applies manual corrections on top of the generated dex. Fails loudly when an override
 * points at something that no longer exists, so stale overrides get noticed and removed.
 * Returns the ids of the overrides that applied.
 */
export function applyOverrides(dex: DexSnapshot, overrides: Override[]): string[] {
  const applied: string[] = [];

  for (const override of overrides) {
    if (override.gameId !== dex.gameId) continue;
    if (override.regulationIds && !override.regulationIds.includes(dex.regulationId)) continue;

    switch (override.kind) {
      case 'learnset': {
        const current = dex.learnsets[override.species];
        if (!current)
          throw new Error(`Override ${override.id}: no learnset for ${override.species}`);
        const moves = new Set(current);
        for (const move of override.remove) moves.delete(move);
        for (const move of override.add) {
          if (!dex.moves.some((m) => m.id === move)) {
            throw new Error(`Override ${override.id}: move ${move} is not in this regulation`);
          }
          moves.add(move);
        }
        dex.learnsets[override.species] = [...moves].sort();
        break;
      }
      case 'move': {
        const move = dex.moves.find((m) => m.id === override.move);
        if (!move) throw new Error(`Override ${override.id}: unknown move ${override.move}`);
        Object.assign(move, override.patch);
        break;
      }
      case 'species': {
        const species = dex.species.find((s) => s.id === override.species);
        if (!species)
          throw new Error(`Override ${override.id}: unknown species ${override.species}`);
        Object.assign(species, override.patch);
        break;
      }
      case 'item': {
        const item = dex.items.find((i) => i.id === override.item);
        if (!item) throw new Error(`Override ${override.id}: unknown item ${override.item}`);
        Object.assign(item, override.patch);
        break;
      }
    }
    applied.push(override.id);
  }

  return applied;
}
