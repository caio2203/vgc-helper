import { cx } from './ui/cx';

/**
 * Original mark (DESIGN.md §11): two parallelograms leaning right, the two Pokémon on the field in
 * Doubles, followed by the wordmark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M7 3h5L8 21H3z" />
      <path d="M16 3h5l-4 18h-5z" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <LogoMark className="size-6" />
      <span
        className={cx(
          'wdth-display text-[20px] leading-6 font-[750] tracking-[-0.01em]',
          compact && 'hidden sm:inline',
        )}
      >
        VGC Helper
      </span>
    </span>
  );
}
