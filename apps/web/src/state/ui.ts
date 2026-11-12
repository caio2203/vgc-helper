import { create } from 'zustand';

export type BuilderAction = 'import' | 'export' | 'save' | 'new' | 'history';

/** App-wide UI state: global dialogs, requests for the builder, and the last status message. */
interface UiState {
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  /** An action asked for from outside the builder (command palette); the builder consumes it. */
  pending: BuilderAction | null;
  /** Announced through an aria-live region. */
  status: string;
  setPalette: (open: boolean) => void;
  setShortcuts: (open: boolean) => void;
  request: (action: BuilderAction | null) => void;
  announce: (message: string) => void;
}

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  pending: null,
  status: '',
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  request: (pending) => set({ pending }),
  announce: (status) => set({ status }),
}));
