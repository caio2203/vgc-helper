import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { SessionResponse } from '@vgc-helper/shared';
import { LogOut, Search, Settings } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setCsrfToken } from '../api/client';
import { sessionQuery } from '../api/queries';
import { isMod, isTyping, modKey } from '../lib/keys';
import { useUi } from '../state/ui';
import { CommandPalette } from './CommandPalette';
import { Footer } from './Footer';
import { Logo } from './Logo';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Kbd } from './ui/Controls';

const navLink =
  'inline-flex h-12 items-center border-b-2 border-transparent px-1 text-sm font-semibold text-muted hover:text-ink';
const navActive = { className: 'border-ink text-ink' };

export function AppShell({ session, children }: { session: SessionResponse; children: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setPalette, setShortcuts, status } = useUi();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isMod(event) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette(true);
      } else if (event.key === '?' && !isTyping(event)) {
        event.preventDefault();
        setShortcuts(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, setShortcuts]);

  async function signOut() {
    await api('/auth/logout', { method: 'POST' });
    setCsrfToken(null);
    queryClient.setQueryData(sessionQuery.queryKey, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    await navigate({ to: '/login' });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('shell.skip')}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-4 sm:gap-4">
          <Link to="/" aria-label={t('shell.home')} className="shrink-0">
            <Logo compact />
          </Link>
          <nav
            aria-label={t('shell.nav')}
            // On phones the links scroll inside the header instead of widening the page.
            className="flex min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap sm:gap-4"
          >
            {/* On phones the logo already opens the builder. */}
            <Link
              to="/"
              className={`${navLink} max-sm:hidden`}
              activeProps={navActive}
              activeOptions={{ exact: true }}
            >
              {t('shell.builder')}
            </Link>
            <Link to="/teams" className={navLink} activeProps={navActive}>
              {t('shell.teams')}
            </Link>
            <Link to="/calc" className={navLink} activeProps={navActive}>
              {t('shell.calc')}
            </Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="inline-flex h-9 items-center gap-2 rounded-sm border border-line-strong px-2.5 text-sm text-muted hover:text-ink"
            >
              <Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t('shell.search')}</span>
              <span className="hidden md:inline">
                <Kbd>{modKey()} K</Kbd>
              </span>
            </button>
            <Link
              to="/settings"
              className="inline-flex size-9 items-center justify-center rounded-sm text-muted hover:text-ink"
              aria-label={t('shell.settings')}
            >
              <Settings className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex size-9 items-center justify-center rounded-sm text-muted hover:text-ink"
              aria-label={t('shell.signOut', { login: session.user.login })}
              title={t('shell.signOut', { login: session.user.login })}
            >
              <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4">
        {children}
      </main>
      <Footer />
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}
