import type { Team, TeamSlot } from '@vgc-helper/shared';
import { create } from 'zustand';

/** The part of a team the user edits; this is what undo and "unsaved changes" track. */
export interface Editable {
  name: string;
  formatId: string;
  regulationId: string;
  slots: TeamSlot[];
  notes: string;
}

export interface Draft extends Editable {
  teamId: string | null;
  version: number | null;
  gameId: string;
  /** JSON of the last saved Editable, to tell whether there are unsaved changes. */
  saved: string;
  selected: number;
  past: Editable[];
  future: Editable[];
}

interface Actions {
  /** Starts editing a saved team, or a new one with the given rules. */
  load: (
    team: Team | null,
    rules: { gameId: string; formatId: string; regulationId: string },
  ) => void;
  edit: (change: (current: Editable) => Editable) => void;
  select: (slot: number) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (team: Team) => void;
}

const HISTORY_LIMIT = 100;
const DRAFT_KEY = 'vgc.draft';

const pick = ({ name, formatId, regulationId, slots, notes }: Editable): Editable => ({
  name,
  formatId,
  regulationId,
  slots,
  notes,
});
const serialize = (e: Editable) => JSON.stringify(pick(e));

/** A new team survives a reload; read from storage defensively. */
function storedDraft(): Editable | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Editable) : null;
  } catch {
    return null;
  }
}

function storeDraft(e: Editable | null) {
  try {
    if (e) localStorage.setItem(DRAFT_KEY, serialize(e));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the draft lives only in memory.
  }
}

const EMPTY: Editable = { name: '', formatId: '', regulationId: '', slots: [], notes: '' };

export const useDraft = create<Draft & Actions>()((set, get) => ({
  ...EMPTY,
  teamId: null,
  version: null,
  gameId: '',
  saved: serialize(EMPTY),
  selected: 0,
  past: [],
  future: [],

  load: (team, rules) => {
    if (team) {
      const editable = pick(team);
      set({
        ...editable,
        teamId: team.id,
        version: team.version,
        gameId: team.gameId,
        saved: serialize(editable),
        selected: 0,
        past: [],
        future: [],
      });
    } else {
      const stored = storedDraft();
      const editable: Editable = {
        ...EMPTY,
        ...stored,
        formatId: stored?.formatId || rules.formatId,
        regulationId: stored?.regulationId || rules.regulationId,
      };
      const blank = { ...EMPTY, formatId: editable.formatId, regulationId: editable.regulationId };
      set({
        ...editable,
        teamId: null,
        version: null,
        gameId: rules.gameId,
        saved: serialize(blank),
        selected: 0,
        past: [],
        future: [],
      });
    }
  },

  edit: (change) => {
    const state = get();
    const next = pick(change(pick(state)));
    set({
      ...next,
      past: [...state.past, pick(state)].slice(-HISTORY_LIMIT),
      future: [],
      selected: Math.min(state.selected, Math.max(next.slots.length, 0)),
    });
    if (state.teamId === null) storeDraft(next);
  },

  select: (slot) => set({ selected: slot }),

  undo: () => {
    const { past, future, teamId } = get();
    const previous = past.at(-1);
    if (!previous) return;
    set({ ...previous, past: past.slice(0, -1), future: [pick(get()), ...future] });
    if (teamId === null) storeDraft(previous);
  },

  redo: () => {
    const { past, future, teamId } = get();
    const next = future[0];
    if (!next) return;
    set({ ...next, past: [...past, pick(get())], future: future.slice(1) });
    if (teamId === null) storeDraft(next);
  },

  markSaved: (team) => {
    if (get().teamId === null) storeDraft(null);
    set({ teamId: team.id, version: team.version, saved: serialize(pick(team)) });
  },
}));

export const isDirty = (d: Draft) => serialize(d) !== d.saved;
