import type { StatId } from '@vgc-helper/data';
import type { StatsTable, TeamSlot } from '@vgc-helper/shared';
import { type DexIndex, megaFormeFor, type RulesContext } from './context.js';
import { toId } from './ids.js';

/**
 * Showdown team paste ("export" format). In Pokémon Champions, Showdown keeps Stat Points on the
 * normal `EVs:` line (e.g. `EVs: 2 HP / 32 Atk / 32 Spe`) and leaves out IVs, so the same line
 * holds whatever the mechanics profile uses.
 */

const STAT_LABELS: Record<StatId, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};
const STAT_BY_LABEL = new Map(
  Object.entries(STAT_LABELS).map(([id, label]) => [label.toLowerCase(), id as StatId]),
);

const zero = (): StatsTable => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

export function emptySlot(species: string): TeamSlot {
  return {
    species,
    item: null,
    ability: null,
    moves: [],
    nature: null,
    spread: zero(),
    ivs: null,
    mega: false,
    teraType: null,
    notes: '',
  };
}

export interface PasteProblem {
  /** 1-based line number in the pasted text. */
  line: number;
  text: string;
}

export interface ParsedPaste {
  slots: TeamSlot[];
  /** Lines that were not understood. Names that are not in the dex are kept and flagged by legality. */
  problems: PasteProblem[];
}

function parseStats(text: string): StatsTable | null {
  const stats = zero();
  for (const part of text.split('/')) {
    const match = /^\s*(\d+)\s+([A-Za-z]+)\s*$/.exec(part);
    const stat = match ? STAT_BY_LABEL.get((match[2] as string).toLowerCase()) : undefined;
    if (!match || !stat) return null;
    stats[stat] = Number(match[1]);
  }
  return stats;
}

/** First line: `Nickname (Species) (F) @ Item`, `Species (M) @ Item`, or just `Species`. */
function parseHeader(
  line: string,
  index: DexIndex,
): { species: string; item: string | null; mega: boolean } {
  const [left, item] = line.split(' @ ') as [string, string | undefined];
  let name = left.replace(/\s*\((?:M|F)\)\s*$/, '').trim();
  const nicknamed = /\(([^()]+)\)\s*$/.exec(name);
  if (nicknamed) name = (nicknamed[1] as string).trim();

  let species = toId(name);
  let mega = false;
  // A Mega forme in the paste means: base species, holding its stone, planning to Mega Evolve.
  const forme = index.megaFormes.get(species);
  if (forme) {
    species = toId(forme.base);
    mega = true;
  }
  return { species, item: item ? toId(item) : null, mega };
}

export function parsePaste(text: string, index: DexIndex): ParsedPaste {
  const slots: TeamSlot[] = [];
  const problems: PasteProblem[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let current: TeamSlot | null = null;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') {
      current = null;
      return;
    }
    if (!current) {
      const header = parseHeader(line, index);
      current = { ...emptySlot(header.species), item: header.item, mega: header.mega };
      slots.push(current);
      return;
    }

    const slot: TeamSlot = current;
    if (line.startsWith('- ')) {
      slot.moves.push(toId(line.slice(2).replace(/\s*\[.*\]$/, '')));
    } else if (/^Ability:/i.test(line)) {
      slot.ability = toId(line.slice(line.indexOf(':') + 1));
    } else if (/^EVs:/i.test(line)) {
      const stats = parseStats(line.slice(4));
      if (stats) slot.spread = stats;
      else problems.push({ line: i + 1, text: raw });
    } else if (/^IVs:/i.test(line)) {
      const stats = parseStats(line.slice(4));
      if (stats)
        slot.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...nonZero(stats, line) };
      else problems.push({ line: i + 1, text: raw });
    } else if (/ Nature$/i.test(line)) {
      slot.nature = toId(line.replace(/ Nature$/i, ''));
    } else if (/^Tera Type:/i.test(line)) {
      slot.teraType = line.slice(line.indexOf(':') + 1).trim() || null;
    } else if (
      /^(Level|Shiny|Happiness|Gender|Hidden Power|Dynamax Level|Gigantamax|Pokeball):/i.test(line)
    ) {
      // Not part of a team in these formats.
    } else {
      // A known Pokémon without a blank line before it starts the next set, so a team list
      // with one name per line reads as a team.
      const header = parseHeader(line, index);
      if (index.species.has(header.species)) {
        current = { ...emptySlot(header.species), item: header.item, mega: header.mega };
        slots.push(current);
      } else problems.push({ line: i + 1, text: raw });
    }
  });

  // Holding its own Mega Stone means the player plans to Mega Evolve (Showdown exports the base species).
  for (const slot of slots) {
    if (megaFormeFor(index, slot.species, slot.item)) slot.mega = true;
  }
  return { slots, problems };
}

/** IVs lines list only the stats that are not 31. */
function nonZero(stats: StatsTable, line: string): Partial<StatsTable> {
  const listed: Partial<StatsTable> = {};
  for (const [stat, label] of Object.entries(STAT_LABELS) as [StatId, string][]) {
    if (new RegExp(`\\b${label}\\b`, 'i').test(line)) listed[stat] = stats[stat];
  }
  return listed;
}

function statsLine(
  label: string,
  stats: StatsTable,
  skip: (value: number) => boolean,
): string | null {
  const parts = (Object.keys(STAT_LABELS) as StatId[])
    .filter((stat) => !skip(stats[stat]))
    .map((stat) => `${stats[stat]} ${STAT_LABELS[stat]}`);
  return parts.length > 0 ? `${label}: ${parts.join(' / ')}` : null;
}

export function exportPaste(slots: TeamSlot[], ctx: RulesContext, index: DexIndex): string {
  return slots
    .map((slot) => {
      const name = index.species.get(slot.species)?.name ?? slot.species;
      const item = slot.item ? (index.items.get(slot.item)?.name ?? slot.item) : null;
      const lines = [item ? `${name} @ ${item}` : name];
      if (slot.ability)
        lines.push(`Ability: ${index.abilities.get(slot.ability)?.name ?? slot.ability}`);
      lines.push(`Level: ${ctx.format.level}`);
      if (slot.teraType) lines.push(`Tera Type: ${slot.teraType}`);
      const evs = statsLine('EVs', slot.spread, (v) => v === 0);
      if (evs) lines.push(evs);
      if (slot.nature) lines.push(`${index.natures.get(slot.nature)?.name ?? slot.nature} Nature`);
      if (slot.ivs) {
        const max = ctx.profile.statSystem.kind === 'evIv' ? ctx.profile.statSystem.ivMax : 31;
        const ivs = statsLine('IVs', slot.ivs, (v) => v === max);
        if (ivs) lines.push(ivs);
      }
      for (const move of slot.moves) lines.push(`- ${index.moves.get(move)?.name ?? move}`);
      return lines.join('\n');
    })
    .join('\n\n')
    .concat('\n');
}
