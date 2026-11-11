import { useQueryClient } from '@tanstack/react-query';
import { type Locale, localeSchema, settingsSchema } from '@vgc-helper/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { settingsQuery } from '../api/queries';
import { applyLocale, LOCALES } from '../i18n';

/** Changes the interface language. When signed in, the choice is saved to the account. */
export function LanguageSelect({ signedIn }: { signedIn: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const id = useId();

  async function change(value: string) {
    const parsed = localeSchema.safeParse(value);
    if (!parsed.success) return;
    const locale: Locale = parsed.data;
    applyLocale(locale);
    if (signedIn) {
      const saved = await api('/settings', {
        method: 'PATCH',
        body: { locale },
        schema: settingsSchema,
      });
      queryClient.setQueryData(settingsQuery.queryKey, saved);
    }
  }

  return (
    <p>
      <label htmlFor={id}>{t('settings.language')}</label>{' '}
      <select id={id} value={i18n.language} onChange={(e) => void change(e.target.value)}>
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id} lang={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </p>
  );
}
