import type { ReactNode } from 'react';

/** One block of the analysis column: a sheet label, then the content. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0">
      <h3 className="label m-0">{title}</h3>
      {children}
    </section>
  );
}
