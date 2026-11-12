import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { LoginError } from '@vgc-helper/shared';
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, api } from '../api/client';
import { authMethodsQuery, sessionQuery } from '../api/queries';
import { Footer } from '../components/Footer';
import { LanguageSelect } from '../components/LanguageSelect';
import { Logo } from '../components/Logo';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Controls';

/** The only screen a signed-out visitor sees. No marketing, just the way in. */
export function LoginPage({ error }: { error: LoginError | undefined }) {
  const { t } = useTranslation();
  const methods = useQuery(authMethodsQuery);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
        <Logo />
        <section className="flex flex-col gap-4 rounded-md border border-line bg-surface p-5">
          <div>
            <h1 className="wdth-heading m-0 text-h2 font-bold">{t('login.title')}</h1>
            <p className="m-0 mt-1 text-muted">{t('login.intro')}</p>
          </div>
          {error && (
            <Alert tone="error" title={t(`login.errors.${error}`)} toneLabel={t('tone.error')} />
          )}
          {methods.isPending && <p className="m-0 text-muted">{t('common.loading')}</p>}
          {methods.isError && (
            <Alert tone="error" title={t('common.error')} toneLabel={t('tone.error')} />
          )}
          {methods.data?.mode === 'github' && (
            <a
              href="/api/auth/github"
              className="inline-flex h-[var(--control-h)] items-center justify-center rounded-sm border border-ink bg-ink px-3.5 font-semibold text-surface"
            >
              {t('login.github')}
            </a>
          )}
          {methods.data?.mode === 'local-password' && <PasswordForm />}
        </section>
        <LanguageSelect signedIn={false} />
      </main>
      <Footer showAbout={false} />
    </div>
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
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <Field label={t('login.password')} htmlFor={id}>
        <TextInput
          id={id}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={failure === 'invalid_credentials'}
        />
      </Field>
      {failure && (
        <p role="alert" className="m-0 text-danger">
          {t(`login.errors.${failure}`)}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? t('login.submitting') : t('login.submit')}
      </Button>
    </form>
  );
}
