import { useTranslation } from 'react-i18next';

/** Dates in the viewer's language and time zone. */
export function useDateTime() {
  const { i18n } = useTranslation();
  return (iso: string, withTime = true) =>
    new Intl.DateTimeFormat(
      i18n.language,
      withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
    ).format(new Date(iso));
}
