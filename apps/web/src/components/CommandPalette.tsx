import { useNavigate } from '@tanstack/react-router';
import { search as engineSearch } from '@vgc-helper/engine';
import { Search } from 'lucide-react';
import { Dialog as Radix } from 'radix-ui';
import { type KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { placeSpecies, updateSlot } from '../builder/slots';
import { useRules } from '../data/rules';
import { useDraft } from '../state/draft';
import { type BuilderAction, useUi } from '../state/ui';
import { cx } from './ui/cx';

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

/** Ctrl K: search Pokémon, moves, items and abilities, and run app actions, from the keyboard. */
export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { paletteOpen, setPalette, request, announce, setShortcuts } = useUi();
  const draft = useDraft();
  const { rules } = useRules({
    formatId: draft.formatId || undefined,
    regulationId: draft.regulationId || undefined,
  });
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  const close = () => {
    setPalette(false);
    setQuery('');
    setActive(0);
  };

  const toBuilder = async (action?: BuilderAction) => {
    await navigate({
      to: draft.teamId ? '/teams/$teamId' : '/',
      params: { teamId: draft.teamId ?? '' },
    });
    if (action) request(action);
  };

  // Recomputed on every render: searching ~1,300 entries per key press is cheap.
  const actions: Command[] = [
    {
      id: 'new',
      label: t('palette.new'),
      hint: t('palette.action'),
      run: () => {
        void navigate({ to: '/' }).then(() => request('new'));
      },
    },
    {
      id: 'import',
      label: t('palette.import'),
      hint: t('palette.action'),
      run: () => void toBuilder('import'),
    },
    {
      id: 'export',
      label: t('palette.export'),
      hint: t('palette.action'),
      run: () => void toBuilder('export'),
    },
    {
      id: 'save',
      label: t('palette.save'),
      hint: t('palette.action'),
      run: () => void toBuilder('save'),
    },
    {
      id: 'teams',
      label: t('palette.teams'),
      hint: t('palette.page'),
      run: () => void navigate({ to: '/teams' }),
    },
    {
      id: 'settings',
      label: t('palette.settings'),
      hint: t('palette.page'),
      run: () => void navigate({ to: '/settings' }),
    },
    {
      id: 'shortcuts',
      label: t('palette.shortcuts'),
      hint: t('palette.action'),
      run: () => setShortcuts(true),
    },
  ];

  const results: Command[] = (() => {
    const q = query.trim().toLowerCase();
    const matchingActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
    if (!rules || !q) return matchingActions;
    const hits = engineSearch(rules.search, query, { limit: 12 });
    const data = hits.map(
      (hit): Command => ({
        id: `${hit.kind}:${hit.id}`,
        label: hit.name,
        hint: t(`palette.kind.${hit.kind}`),
        run: () => {
          const state = useDraft.getState();
          if (hit.kind === 'species') {
            const placed = placeSpecies(state, state.selected, rules.index, hit.id);
            if (!placed) return announce(t('builder.teamFull'));
            state.edit(() => placed.team);
            state.select(placed.slot);
            announce(t('builder.added', { name: hit.name, slot: placed.slot + 1 }));
          } else {
            const slot = state.slots[state.selected];
            if (!slot) return announce(t('palette.pickSlotFirst'));
            if (hit.kind === 'item')
              state.edit((e) => updateSlot(e, state.selected, { item: hit.id }));
            if (hit.kind === 'ability')
              state.edit((e) => updateSlot(e, state.selected, { ability: hit.id }));
            if (hit.kind === 'move') {
              if (slot.moves.includes(hit.id) || slot.moves.length >= 4)
                return announce(t('palette.movesFull'));
              state.edit((e) => updateSlot(e, state.selected, { moves: [...slot.moves, hit.id] }));
            }
            announce(t('palette.applied', { name: hit.name, slot: state.selected + 1 }));
          }
          void toBuilder();
        },
      }),
    );
    return [...data, ...matchingActions];
  })();

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      results[active].run();
      close();
    }
  }

  return (
    <Radix.Root open={paletteOpen} onOpenChange={(open) => (open ? setPalette(true) : close())}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 bg-[color-mix(in_srgb,var(--ink)_35%,transparent)]" />
        <Radix.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 rounded-md border border-line-strong bg-surface text-ink"
        >
          <Radix.Title className="sr-only">{t('palette.title')}</Radix.Title>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
              aria-label={t('palette.title')}
              placeholder={t('palette.placeholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-12 w-full bg-transparent text-lead outline-none placeholder:text-muted"
            />
          </div>
          {results.length === 0 && (
            <p className="m-0 px-3 py-2 text-sm text-muted">{t('palette.empty')}</p>
          )}
          <div id={listId} role="listbox" className="max-h-[50vh] overflow-auto py-1">
            {results.map((command, i) => (
              // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the input, which drives the options with aria-activedescendant
              // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the arrow keys and Enter for every option
              <div
                key={command.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => {
                  command.run();
                  close();
                }}
                className={cx(
                  'flex cursor-pointer items-center gap-3 px-3 py-2',
                  i === active && 'bg-bg',
                )}
              >
                <span className="font-semibold">{command.label}</span>
                <span className="ml-auto text-sm text-muted">{command.hint}</span>
              </div>
            ))}
          </div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
