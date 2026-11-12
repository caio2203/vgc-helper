import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { manifestQuery } from '../api/queries';
import { AUTHOR, REPOSITORY_URL } from '../components/Footer';
import { LogoMark } from '../components/Logo';
import { Panel } from '../components/ui/Controls';
import { useDateTime } from '../lib/dates';

const LINK = 'text-ink underline underline-offset-2';

/** Credits, data sources and license (README "Data sources and credits"). */
export function AboutPage() {
  const { t } = useTranslation();
  const formatDate = useDateTime();
  const manifest = useQuery(manifestQuery);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <LogoMark className="size-8" />
        <h1 className="wdth-display m-0 text-h1 font-[750]">{t('about.title')}</h1>
      </div>
      <p className="m-0 text-lead">
        {t('about.createdBy')}{' '}
        <a className={LINK} href={REPOSITORY_URL}>
          {AUTHOR}
        </a>
        . {t('about.license')}
      </p>
      <Panel title={t('about.data')} labelledBy="about-data">
        <ul className="m-0 flex list-none flex-col gap-2 p-4">
          <li>
            <a className={LINK} href="https://github.com/smogon/pokemon-showdown">
              Pokémon Showdown
            </a>{' '}
            — {t('about.showdown')}
          </li>
          <li>
            <a className={LINK} href="https://github.com/pkmn/ps">
              pkmn
            </a>{' '}
            — {t('about.pkmn')}
          </li>
          <li>
            <a className={LINK} href="https://www.smogon.com/stats/">
              Smogon
            </a>{' '}
            — {t('about.smogon')}
          </li>
          <li>
            <a className={LINK} href="https://play.limitlesstcg.com">
              Limitless
            </a>{' '}
            — {t('about.limitless')}
          </li>
          <li>
            <a className={LINK} href="https://github.com/smogon/damage-calc">
              @smogon/calc
            </a>{' '}
            — {t('about.calc')}
          </li>
          {manifest.data && (
            <li className="text-sm text-muted">
              {t('about.snapshot', {
                version: manifest.data.version,
                date: formatDate(manifest.data.generatedAt),
              })}
            </li>
          )}
        </ul>
      </Panel>
      <p className="m-0 text-sm text-muted">{t('footer.notAffiliated')}</p>
    </div>
  );
}
