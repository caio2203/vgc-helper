import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { LoginError } from '@vgc-helper/shared';
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, api } from '../api/client';
import { authMethodsQuery, sessionQuery } from '../api/queries';
import { Footer } from '../components/Footer';
import { LanguageSelect } from '../components/LanguageSelect';

export function LoginPage({ error }: { error: LoginError | undefined }) {
  const { t } = useTranslation();
  const methods = useQuery(authMethodsQuery);

  return (
    <>
      <main>
        <h1>{t('login.title')}</h1>
        <p>{t('login.intro')}</p>
        {error && <p role="alert">{t(`login.errors.${error}`)}</p>}
        {methods.isPending && <p>{t('common.loading')}</p>}
        {methods.isError && <p role="alert">{t('common.error')}</p>}
        {methods.data?.mode === 'github' && (
          <p>
            <a href="/api/auth/github">{t('login.github')}</a>
          </p>
        )}
        {methods.data?.mode === 'local-password' && <PasswordForm />}
        <LanguageSelect signedIn={false} />
      </main>
      <Footer />
    </>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const id = useId();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<LoginError | 'unknown' | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    try {
      await api('/auth/login', { method: 'POST', body: { password } });
      // The cached session is the signed-out `null`; fetch the new one before routing.
      await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 });
      await navigate({ to: '/' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setFailure('invalid_credentials');
      else if (error instanceof ApiError && error.status === 429) setFailure('rate_limited');
      else setFailure('unknown');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <p>
        <label htmlFor={id}>{t('login.password')}</label>{' '}
        <input
          id={id}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={failure === 'invalid_credentials'}
        />
      </p>
      {failure && <p role="alert">{t(`login.errors.${failure}`)}</p>}
      <p>
        <button type="submit" disabled={pending}>
          {pending ? t('login.submitting') : t('login.submit')}
        </button>
      </p>
    </form>
  );
}
