import { X } from 'lucide-react';
import { Dialog as Radix } from 'radix-ui';
import type { ReactNode } from 'react';
import { cx } from './cx';

/** Radix dialog styled with the tokens: hairline border, 6 px radius, no shadow. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeLabel,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closeLabel: string;
  wide?: boolean;
}) {
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--ink)_35%,transparent)]" />
        <Radix.Content
          className={cx(
            'fixed top-[8vh] left-1/2 z-40 max-h-[84vh] w-[calc(100vw-32px)] -translate-x-1/2 overflow-auto',
            'rounded-md border border-line-strong bg-surface p-4 text-ink',
            wide ? 'max-w-3xl' : 'max-w-lg',
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="mb-3 flex items-start gap-3">
            <div className="min-w-0">
              <Radix.Title className="m-0 text-h3 font-[650]">{title}</Radix.Title>
              {description && (
                <Radix.Description className="m-0 mt-1 text-sm text-muted">
                  {description}
                </Radix.Description>
              )}
            </div>
            <Radix.Close
              className="ml-auto inline-flex size-8 items-center justify-center rounded-sm hover:bg-bg"
              aria-label={closeLabel}
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Radix.Close>
          </div>
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
