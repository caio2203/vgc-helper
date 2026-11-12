import { type DexIndex, emptySlot } from '@vgc-helper/engine';
import type { TeamSlot } from '@vgc-helper/shared';
import type { Editable } from '../state/draft';

export const MAX_SLOTS = 6;

/** A new slot for a species, with its first ability filled in. */
export function newSlot(index: DexIndex, speciesId: string): TeamSlot {
  const species = index.species.get(speciesId);
  return { ...emptySlot(speciesId), ability: species?.abilities[0] ?? null };
}

/**
 * Puts a species in the selected slot when it is empty, otherwise in the first free slot.
 * Returns the slot it went to, or null when the team is full.
 */
export function placeSpecies(
  team: Editable,
  selected: number,
  index: DexIndex,
  speciesId: string,
): { team: Editable; slot: number } | null {
  const slots = [...team.slots];
  const slot = Math.min(selected, slots.length);
  if (slot < slots.length) {
    slots[slot] = newSlot(index, speciesId);
  } else if (slots.length < MAX_SLOTS) {
    slots.push(newSlot(index, speciesId));
  } else {
    return null;
  }
  return { team: { ...team, slots }, slot };
}

export function updateSlot(team: Editable, i: number, change: Partial<TeamSlot>): Editable {
  return { ...team, slots: team.slots.map((s, j) => (j === i ? { ...s, ...change } : s)) };
}
