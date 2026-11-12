import { cx } from './cx';

const fill = (type: string) => `var(--type-${type.toLowerCase()}-fill)`;
export const typeText = (type: string) => `var(--type-${type.toLowerCase()}-text)`;

/** A type chip always shows the type name, never color alone (DESIGN.md §3.2). */
export function TypeChip({ type, short = false }: { type: string; short?: boolean }) {
  return (
    <span
      className="inline-block rounded-sm px-1.5 text-micro font-semibold text-ink"
      style={{ background: fill(type) }}
      title={short ? type : undefined}
    >
      {short ? type.slice(0, 3) : type}
    </span>
  );
}

export function TypeChips({ types, short }: { types: string[]; short?: boolean }) {
  return (
    <span className="inline-flex gap-1">
      {types.map((t) => (
        <TypeChip key={t} type={t} short={short} />
      ))}
    </span>
  );
}

/**
 * The signature detail (DESIGN.md §8): a 4 px edge split between the Pokémon's two types.
 * Decorative: the type names are always written next to it.
 */
export function TypeEdge({ types, className }: { types: string[]; className?: string }) {
  const [a, b] = types;
  const background = !a
    ? 'var(--line)'
    : b
      ? `linear-gradient(${fill(a)} 50%, ${fill(b)} 50%)`
      : fill(a);
  return (
    <span
      aria-hidden="true"
      className={cx('block w-1 shrink-0 self-stretch', className)}
      style={{ background }}
    />
  );
}
