import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useId, useState } from 'react';
import { cx } from './cx';

export interface ComboOption {
  id: string;
  name: string;
  detail?: ReactNode;
}

/**
 * Accessible autocomplete (ARIA combobox + listbox). Typing filters through `search`, which is
 * the typo-tolerant engine search. Clearing the text and leaving the field clears the value.
 */
export function Combobox({
  id,
  value,
  valueLabel,
  onChange,
  search,
  placeholder,
  emptyText,
  ariaLabel,
  ariaInvalid,
  inputRef,
  className,
}: {
  id: string;
  value: string | null;
  valueLabel: string;
  onChange: (id: string | null) => void;
  search: (query: string) => ComboOption[];
  placeholder?: string;
  emptyText: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(valueLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = open ? search(text === valueLabel ? '' : text) : [];

  useEffect(() => setText(valueLabel), [valueLabel]);

  function choose(option: ComboOption) {
    onChange(option.id);
    setText(option.name);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      setText(valueLabel);
    }
  }

  return (
    <div className={cx('relative', className)}>
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid || undefined}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => e.target.select()}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (text.trim() === '') {
            if (value !== null) onChange(null);
          } else {
            setText(valueLabel);
          }
        }}
        onKeyDown={onKeyDown}
        className={cx(
          'h-[var(--control-h)] w-full rounded-sm border bg-surface px-2 text-base text-ink placeholder:text-muted',
          ariaInvalid ? 'border-danger' : 'border-line-strong',
        )}
      />
      {open && options.length === 0 && text.trim() !== '' && text !== valueLabel && (
        <p className="absolute z-20 m-0 mt-1 w-full min-w-56 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-muted">
          {emptyText}
        </p>
      )}
      {open && options.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full min-w-56 overflow-auto rounded-md border border-line-strong bg-surface py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((option, i) => (
            // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the input, which drives the options with aria-activedescendant
            // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the arrow keys and Enter for every option
            <div
              key={option.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => choose(option)}
              onMouseMove={() => setActive(i)}
              className={cx(
                'flex cursor-pointer items-center gap-2 px-2.5 py-1.5',
                i === active && 'bg-bg',
              )}
            >
              <span className="font-semibold">{option.name}</span>
              {option.detail && <span className="ml-auto text-sm text-muted">{option.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
