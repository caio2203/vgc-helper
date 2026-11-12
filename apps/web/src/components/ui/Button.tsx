import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface border border-ink hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-bg',
  quiet: 'bg-transparent text-ink border border-transparent underline-offset-2 hover:underline',
  danger: 'bg-surface text-danger border border-danger hover:bg-danger-bg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  ref?: Ref<HTMLButtonElement>;
}

/** DESIGN.md §10: primary (ink), secondary (outline), quiet (text). Labels are verbs. */
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition-state',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'h-[var(--control-h)] px-3.5' : 'h-7 px-2.5 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
