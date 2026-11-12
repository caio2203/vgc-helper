import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/**
 * Jargon with a dotted underline and a tooltip that explains it (DESIGN.md §10). A button, so the
 * explanation is reachable from the keyboard. Without a definition it renders the plain text.
 */
export function Term({ children, definition }: { children: ReactNode; definition?: string }) {
  if (!definition) return <>{children}</>;
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="cursor-help border-0 bg-transparent p-0 text-left font-[inherit] text-inherit underline decoration-muted decoration-dotted underline-offset-2"
          >
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={4}
            className="z-50 max-w-64 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            {definition}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
