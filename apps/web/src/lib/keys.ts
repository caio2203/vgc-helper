/** True for elements where typing goes to text, so app shortcuts must stay out of the way. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** True when a key press should go to a text field instead of the app shortcuts. */
export const isTyping = (event: KeyboardEvent) => isTextTarget(event.target);

export const isMod = (event: KeyboardEvent) => event.ctrlKey || event.metaKey;

/** Shortcut label for the current platform. */
export const modKey = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl');
