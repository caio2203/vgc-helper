import { Check, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone = 'error' | 'warning' | 'info' | 'success';

const TONES: Record<Tone, { box: string; text: string; Icon: typeof Info; label: string }> = {
  error: {
    box: 'border-danger bg-danger-bg',
    text: 'text-danger',
    Icon: OctagonAlert,
    label: 'error',
  },
  warning: {
    box: 'border-warning bg-warning-bg',
    text: 'text-warning',
    Icon: TriangleAlert,
    label: 'warning',
  },
  info: { box: 'border-line-strong bg-surface', text: 'text-ink', Icon: Info, label: 'info' },
  success: {
    box: 'border-success bg-success-bg',
    text: 'text-success',
    Icon: Check,
    label: 'success',
  },
};

/** Icon + title + one sentence (DESIGN.md §10). Color is never the only signal. */
export function Alert({
  tone,
  title,
  children,
  toneLabel,
}: {
  tone: Tone;
  title: ReactNode;
  children?: ReactNode;
  /** Visually hidden word for the severity, read by screen readers. */
  toneLabel?: string;
}) {
  const { box, text, Icon } = TONES[tone];
  return (
    <div className={cx('flex gap-2.5 rounded-md border px-3 py-2.5', box)}>
      <Icon aria-hidden="true" className={cx('mt-0.5 size-4 shrink-0', text)} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className={cx('m-0 font-semibold', text)}>
          {toneLabel && <span className="sr-only">{toneLabel}: </span>}
          {title}
        </p>
        {children && <div className="text-sm text-ink">{children}</div>}
      </div>
    </div>
  );
}
