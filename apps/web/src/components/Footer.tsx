import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/** Project credit. Forks are asked to keep it (see README and NOTICE). */
export const REPOSITORY_URL = 'https://github.com/caio2203/vgc-helper';
export const AUTHOR = 'caio2203';

export function Footer({ showAbout = true }: { showAbout?: boolean }) {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm text-muted">
        <span>
          {t('footer.createdBy')}{' '}
          <a href={REPOSITORY_URL} className="text-ink underline underline-offset-2">
            {AUTHOR}
          </a>
        </span>
        {showAbout && (
          <>
            <Link to="/about" className="text-ink underline underline-offset-2">
              {t('footer.about')}
            </Link>
            <Link to="/admin" className="text-ink underline underline-offset-2">
              {t('footer.admin')}
            </Link>
          </>
        )}
        <span>{t('footer.notAffiliated')}</span>
      </div>
    </footer>
  );
}
