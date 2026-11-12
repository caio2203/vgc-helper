import type { MetaPokemon, MetaSnapshot, Move, Species, StatsTable } from '@vgc-helper/data';
import type { DexIndex } from '../context.js';
import { toId } from '../ids.js';
import { isDamaging } from './resolve.js';

/** The most common set of a meta Pokémon, ready for stats and damage. */
export interface MetaSet {
  species: Species;
  usage: number;
  ability: string | null;
  item: string | null;
  nature: string | null;
  spread: StatsTable;
  /** Up to four moves by share, damaging moves first so threats are checked with attacks. */
  moves: Move[];
}

const EMPTY: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/**
 * Builds the common set from the usage data. `excludeItems` skips items already on the team, so
 * a suggested set respects the Item Clause.
 */
export function commonSet(
  entry: MetaPokemon,
  index: DexIndex,
  excludeItems: ReadonlySet<string> = new Set(),
): MetaSet | null {
  const species = index.species.get(entry.species);
  if (!species) return null;
  const moves = entry.moves.flatMap((m) => index.moves.get(m.id) ?? []).slice(0, 4);
  const item = entry.items.find((i) => index.items.has(i.id) && !excludeItems.has(i.id));
  const spread = entry.spreads[0];
  return {
    species,
    usage: entry.usage,
    ability: entry.abilities.find((a) => index.abilities.has(a.id))?.id ?? null,
    item: item?.id ?? null,
    nature: spread?.nature ?? null,
    spread: spread?.spread ?? EMPTY,
    moves: [...moves.filter(isDamaging), ...moves.filter((m) => !isDamaging(m))],
  };
}

/** Meta entries with known species, by usage, highest first. */
export function rankedMeta(meta: MetaSnapshot, index: DexIndex): MetaPokemon[] {
  return meta.pokemon.filter((p) => index.species.has(p.species)).sort((a, b) => b.usage - a.usage);
}

/** Megas count toward their base species; other formes (Indeedee-F, Rotom-Wash) stay apart. */
export function baseSpeciesId(index: DexIndex, speciesId: string): string {
  const mega = index.megaFormes.get(speciesId);
  if (!mega) return speciesId;
  const id = toId(mega.base);
  return index.species.has(id) ? id : speciesId;
}

/** Usage summed per base species, with the entry used most as its representative. */
export function usageByBase(
  meta: MetaSnapshot,
  index: DexIndex,
): Map<string, { usage: number; entries: MetaPokemon[] }> {
  const out = new Map<string, { usage: number; entries: MetaPokemon[] }>();
  for (const entry of rankedMeta(meta, index)) {
    const base = baseSpeciesId(index, entry.species);
    const group = out.get(base) ?? { usage: 0, entries: [] };
    group.usage += entry.usage;
    group.entries.push(entry);
    out.set(base, group);
  }
  return out;
}

/** Top-cut share per base species (Megas summed into the base), or empty without data. */
export function topCutByBase(meta: MetaSnapshot, index: DexIndex): Map<string, number> {
  const out = new Map<string, number>();
  for (const entry of meta.tournaments?.pokemon ?? []) {
    if (!index.species.has(entry.species)) continue;
    const base = baseSpeciesId(index, entry.species);
    out.set(base, Math.min(1, (out.get(base) ?? 0) + entry.share));
  }
  return out;
}
