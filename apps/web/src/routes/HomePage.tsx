import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { SessionResponse } from '@vgc-helper/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setCsrfToken } from '../api/client';
import { manifestQuery, sessionQuery, settingsQuery } from '../api/queries';
import { Footer } from '../components/Footer';
import { LanguageSelect } from '../components/LanguageSelect';
import { applyLocale } from '../i18n';

/** Placeholder until the team builder (Phase 2). Shows that auth and snapshot delivery work. */
export function HomePage({ session }: { session: SessionResponse }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const settings = useQuery(settingsQuery);
  const manifest = useQuery(manifestQuery);

  const savedLocale = settings.data?.locale;
  useEffect(() => {
    if (savedLocale && savedLocale !== i18n.language) applyLocale(savedLocale);
  }, [savedLocale, i18n.language]);

  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
  // Regulations start and end at a precise moment; show it in the viewer's time zone.
  const moment = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );

  async function signOut() {
    await api('/auth/logout', { method: 'POST' });
    setCsrfToken(null);
    queryClient.setQueryData(sessionQuery.queryKey, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    await navigate({ to: '/login' });
  }

  return (
    <>
      <header>
        <p>
          {t('home.signedInAs', { login: session.user.login })}{' '}
          <button type="button" onClick={() => void signOut()}>
            {t('home.signOut')}
          </button>
        </p>
      </header>
      <main>
        <h1>{t('home.title')}</h1>
        <p>{t('home.placeholder')}</p>
        {manifest.isPending && <p>{t('common.loading')}</p>}
        {manifest.isError && <p role="alert">{t('common.error')}</p>}
        {manifest.data && (
          <section aria-labelledby="regulations-heading">
            <p>{t('home.snapshot', { version: manifest.data.version })}</p>
            <h2 id="regulations-heading">{t('home.regulations')}</h2>
            <ul>
              {manifest.data.regulations.map((r) => (
                <li key={`${r.gameId}/${r.id}`}>
                  <strong>{r.name}</strong>{' '}
                  {r.endsAt
                    ? t('home.regulationDates', {
                        start: moment(r.startsAt),
                        end: moment(r.endsAt),
                      })
                    : t('home.regulationOpenEnded', { start: moment(r.startsAt) })}
                  {r.sources[0] && (
                    <>
                      <br />
                      <small>
                        <a href={r.sources[0].url}>
                          {t('home.source', { name: r.sources[0].name, date: date(r.verifiedAt) })}
                        </a>
                      </small>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <LanguageSelect signedIn />
      </main>
      <Footer />
    </>
  );
}
