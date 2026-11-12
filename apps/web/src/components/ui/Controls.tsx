import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';

const CONTROL =
  'h-[var(--control-h)] w-full rounded-sm border border-line-strong bg-surface px-2 text-base text-ink placeholder:text-muted';

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

export function TextInput({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cx(CONTROL, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cx(CONTROL, 'pr-6', className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'w-full rounded-sm border border-line-strong bg-surface p-2 font-mono text-sm text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-line-strong px-1.5 font-sans text-micro font-semibold text-ink">
      {children}
    </kbd>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  labelledBy,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cx('rounded-md border border-line bg-surface', className)}
    >
      {(title || actions) && (
        <header className="flex min-h-10 items-center gap-2 border-b border-line px-4 py-2">
          {title && (
            <h2 id={labelledBy} className="label m-0">
              {title}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}
