import type {
  Ability,
  DexSnapshot,
  Format,
  Item,
  MechanicsProfile,
  Move,
  Nature,
  Regulation,
  Species,
} from '@vgc-helper/data';
import { toId } from './ids.js';

/** Everything the engine needs to judge a team: one regulation of one format. */
export interface RulesContext {
  dex: DexSnapshot;
  regulation: Regulation;
  format: Format;
  profile: MechanicsProfile;
}

/** Fast lookups over a dex snapshot. Build once per snapshot and reuse. */
export interface DexIndex {
  species: Map<string, Species>;
  moves: Map<string, Move>;
  items: Map<string, Item>;
  abilities: Map<string, Ability>;
  natures: Map<string, Nature>;
  learnsets: Map<string, Set<string>>;
  /** Mega forme name → the stone and base species that produce it. */
  megaFormes: Map<string, { stone: string; base: string }>;
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

export function indexDex(dex: DexSnapshot): DexIndex {
  const species = byId(dex.species);
  const megaFormes = new Map<string, { stone: string; base: string }>();
  for (const s of dex.species) {
    if (s.megaStone) megaFormes.set(s.id, { stone: s.megaStone, base: s.baseSpecies });
  }
  return {
    species,
    moves: byId(dex.moves),
    items: byId(dex.items),
    abilities: byId(dex.abilities),
    natures: byId(dex.natures),
    learnsets: new Map(Object.entries(dex.learnsets).map(([id, moves]) => [id, new Set(moves)])),
    megaFormes,
  };
}

/** The Mega forme a species turns into with this item, or null. */
export function megaFormeFor(
  index: DexIndex,
  speciesId: string,
  itemId: string | null,
): Species | null {
  if (!itemId) return null;
  const species = index.species.get(speciesId);
  const item = index.items.get(itemId);
  if (!species || !item?.megaStone) return null;
  const formeName = item.megaStone[species.name];
  return formeName ? (index.species.get(toId(formeName)) ?? null) : null;
}
