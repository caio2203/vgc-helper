import { Dex, type ID, type ModData, toID } from '@pkmn/dex';
import type {
  Ability,
  DexSnapshot,
  Item,
  MechanicsProfile,
  Move,
  Nature,
  Regulation,
  SourceRef,
  Species,
} from '@vgc-helper/data';
import { calcMaxPp } from '@vgc-helper/engine';

type ModuleData = ModData & {
  Learnsets?: Record<string, { inherit?: boolean; learnset?: Record<string, unknown> }>;
  Scripts?: { inherit?: string };
};

type ModdedDex = ReturnType<typeof Dex.mod>;

const DAMAGE_TAKEN: Record<number, number> = { 0: 1, 1: 2, 2: 0.5, 3: 0 };

async function importMod(mod: string): Promise<ModuleData> {
  const loaded = (await import(`@pkmn/mods/${mod}`)) as { default?: ModuleData } & ModuleData;
  return loaded.default ?? loaded;
}

/** Loads a Showdown mod, loading its parent mod first when it inherits from one. */
export async function loadModdedDex(mod: string): Promise<{ dex: ModdedDex; data: ModuleData }> {
  const data = await importMod(mod);
  const parent = data.Scripts?.inherit;
  if (parent && !/^gen\d+$/.test(parent)) await loadModdedDex(parent);
  return { dex: Dex.mod(mod as ID, data), data };
}

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

export async function buildDexSnapshot(
  regulation: Regulation,
  profile: MechanicsProfile,
  source: SourceRef,
): Promise<DexSnapshot> {
  const { dex, data } = await loadModdedDex(regulation.dexMod);

  const items: Item[] = dex.items
    .all()
    .filter((i) => !i.isNonstandard && !regulation.bannedItems.includes(i.id))
    .map((i) => ({
      id: i.id,
      name: i.name,
      megaStone: (i.megaStone as Record<string, string> | undefined) ?? null,
      shortDesc: i.shortDesc,
    }))
    .sort(byId);
  const itemIds = new Set(items.map((i) => i.id));

  const abilities: Ability[] = dex.abilities
    .all()
    .filter(
      (a) => !a.isNonstandard && a.id !== 'noability' && !regulation.bannedAbilities.includes(a.id),
    )
    .map((a) => ({ id: a.id, name: a.name, shortDesc: a.shortDesc }))
    .sort(byId);
  const abilityIds = new Set(abilities.map((a) => a.id));

  const moves: Move[] = dex.moves
    .all()
    .filter((m) => !m.isNonstandard && !m.isZ && !m.isMax && !regulation.bannedMoves.includes(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category,
      basePower: m.basePower,
      accuracy: m.accuracy,
      basePp: m.pp,
      maxPp: calcMaxPp(profile, m.pp, Boolean(m.noPPBoosts)),
      priority: m.priority,
      target: m.target,
      flags: Object.entries(m.flags)
        .filter(([, on]) => on)
        .map(([flag]) => flag)
        .sort(),
      shortDesc: m.shortDesc,
    }))
    .sort(byId);
  const moveIds = new Set(moves.map((m) => m.id));

  /** Mega Stone that turns this species into this forme, or null. Not every Mega has `isMega` set. */
  const megaStoneOf = (s: ReturnType<ModdedDex['species']['get']>): string | null => {
    if (!s.requiredItem) return null;
    const stone = dex.items.get(s.requiredItem);
    const targets = Object.values((stone.megaStone as Record<string, string> | undefined) ?? {});
    return s.isMega || targets.includes(s.name) ? stone.id : null;
  };

  const bannedTags = new Set(regulation.bannedTags);
  const available = dex.species
    .all()
    .filter((s) => !s.isNonstandard)
    .filter(
      (s) => !regulation.bannedSpecies.includes(s.id) && !s.tags.some((t) => bannedTags.has(t)),
    );
  const availableNames = new Set(available.map((s) => s.name));

  const species: Species[] = available
    // A battle-only forme needs its out-of-battle forme in the game.
    .filter((s) => {
      if (!s.battleOnly) return true;
      const bases = Array.isArray(s.battleOnly) ? s.battleOnly : [s.battleOnly];
      return bases.some((name) => availableNames.has(name));
    })
    // A Mega forme is only legal if its stone is.
    .filter((s) => {
      const stone = megaStoneOf(s);
      return stone === null || itemIds.has(stone);
    })
    .map((s) => {
      const ids = Object.values(s.abilities).map((a) => toID(a));
      const legalAbilities = ids.filter((a) => abilityIds.has(a));
      const megaStone = megaStoneOf(s);
      return {
        id: s.id,
        name: s.name,
        num: s.num,
        baseSpecies: s.baseSpecies,
        forme: s.forme || null,
        types: [...s.types],
        baseStats: { ...s.baseStats },
        abilities: legalAbilities.length > 0 ? legalAbilities : ids,
        weightkg: s.weightkg,
        tags: [...s.tags],
        megaStone,
        selectable: !s.battleOnly && megaStone === null,
      };
    })
    .sort(byId);

  const learnsets = await buildLearnsets(dex, data, species, moveIds);

  const types = [...new Set(species.flatMap((s) => s.types))].sort();
  const typeChart: DexSnapshot['typeChart'] = {};
  for (const attacking of types) {
    const row: Record<string, number> = {};
    for (const defending of types) {
      const code = dex.types.get(defending).damageTaken[attacking] ?? 0;
      row[defending] = DAMAGE_TAKEN[code] ?? 1;
    }
    typeChart[attacking] = row;
  }

  const natures: Nature[] = dex.natures
    .all()
    .map((n) => ({
      id: n.id,
      name: n.name,
      plus: (n.plus as Nature['plus']) ?? null,
      minus: (n.minus as Nature['minus']) ?? null,
    }))
    .sort(byId);

  return {
    gameId: regulation.gameId,
    regulationId: regulation.id,
    source,
    types,
    typeChart,
    natures,
    species,
    moves,
    items,
    abilities,
    learnsets,
  };
}

/**
 * The Champions mod lists the full learnset of each species, so prevolutions are not merged in
 * (their base-game learnsets would bring back removed moves). Cosmetic, Mega and battle-only
 * formes without an entry of their own use their base forme's learnset.
 */
async function buildLearnsets(
  dex: ModdedDex,
  data: ModuleData,
  species: Species[],
  legalMoves: Set<string>,
): Promise<Record<string, string[]>> {
  const modLearnsets = data.Learnsets ?? {};

  /** The species' own learnset in the mod, or null when it has none (or an empty one). */
  async function own(id: string): Promise<string[] | null> {
    const entry = modLearnsets[id];
    if (!entry) return null;
    const moves = entry.inherit
      ? Object.keys((await dex.learnsets.get(id as ID)).learnset ?? {})
      : Object.keys(entry.learnset ?? {});
    return moves.length > 0 ? moves : null;
  }

  const result: Record<string, string[]> = {};
  for (const s of species) {
    const full = dex.species.get(s.id);
    const battleOnly = Array.isArray(full.battleOnly) ? full.battleOnly[0] : full.battleOnly;
    const fallbacks: string[] = [full.changesFrom, battleOnly, full.baseSpecies].filter(
      (name) => typeof name === 'string',
    );

    let moves = await own(s.id);
    for (const name of fallbacks) {
      if (moves) break;
      moves = await own(toID(name));
    }
    result[s.id] = [...new Set(moves ?? [])].filter((m) => legalMoves.has(m)).sort();
  }
  return result;
}
