import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { settingsQuery } from '../api/queries';
import { applyLocale } from '../i18n';

/** Applies the saved theme, density and language to the document. */
export function useAppearance(enabled: boolean) {
  const settings = useQuery({ ...settingsQuery, enabled });
  const s = settings.data;

  useEffect(() => {
    const root = document.documentElement;
    if (!s) return;
    if (s.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = s.theme;
    root.dataset.density = s.density;
  }, [s]);

  useEffect(() => {
    if (s?.locale) applyLocale(s.locale);
  }, [s?.locale]);
}
