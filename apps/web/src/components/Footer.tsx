import { useTranslation } from 'react-i18next';

/** Project credit. Forks are asked to keep it (see README and NOTICE). */
export const REPOSITORY_URL = 'https://github.com/caio2203/vgc-helper';
export const AUTHOR = 'caio2203';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer>
      <p>
        {t('footer.createdBy')} <a href={REPOSITORY_URL}>{AUTHOR}</a>
      </p>
      <p>{t('footer.notAffiliated')}</p>
    </footer>
  );
}
