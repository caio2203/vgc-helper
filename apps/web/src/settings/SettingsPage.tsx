import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type Settings, type SettingsPatch, settingsSchema } from '@vgc-helper/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { manifestQuery, settingsQuery } from '../api/queries';
import { Alert } from '../components/ui/Alert';
import { Field, Panel, Select, TextInput } from '../components/ui/Controls';
import { applyLocale, LOCALES } from '../i18n';
import { useUi } from '../state/ui';

/** Language, experience level, density, theme and data preferences. Saved on change. */
export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQuery);
  const manifest = useQuery(manifestQuery);
  const announce = useUi((u) => u.announce);

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) =>
      api('/settings', { method: 'PATCH', body: patch, schema: settingsSchema }),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsQuery.queryKey, next);
      announce(t('settings.saved'));
    },
  });

  if (settings.isError) {
    return <Alert tone="error" title={t('common.error')} toneLabel={t('tone.error')} />;
  }
  const s = settings.data;
  if (!s) return <p className="text-muted">{t('common.loading')}</p>;

  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (key === 'locale' && value) applyLocale(value as NonNullable<Settings['locale']>);
    save.mutate({ [key]: value });
  };
  const defaultFormat = manifest.data?.formats.find(
    (f) => f.id === (s.defaultFormatId ?? manifest.data?.formats[0]?.id),
  );
  const defaultCutoff = defaultFormat
    ? Math.round(defaultFormat.viability.defaultCutoff * 1000) / 10
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="wdth-display m-0 text-h1 font-[750]">{t('settings.title')}</h1>
      <Panel title={t('settings.interface')} labelledBy={`${ids}-ui`}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label={t('settings.language')} htmlFor={`${ids}-lang`}>
            <Select
              id={`${ids}-lang`}
              value={s.locale ?? i18n.language}
              onChange={(e) => change('locale', e.target.value as Settings['locale'])}
            >
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id} lang={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('settings.level')}
            htmlFor={`${ids}-level`}
            hint={t(`settings.levelHint.${s.experienceLevel}`)}
          >
            <Select
              id={`${ids}-level`}
              value={s.experienceLevel}
              onChange={(e) =>
                change('experienceLevel', e.target.value as Settings['experienceLevel'])
              }
            >
              {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
                <option key={l} value={l}>
                  {t(`settings.levels.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('settings.density')} htmlFor={`${ids}-density`}>
            <Select
              id={`${ids}-density`}
              value={s.density}
              onChange={(e) => change('density', e.target.value as Settings['density'])}
            >
              <option value="comfortable">{t('settings.densities.comfortable')}</option>
              <option value="compact">{t('settings.densities.compact')}</option>
            </Select>
          </Field>
          <Field label={t('settings.theme')} htmlFor={`${ids}-theme`}>
            <Select
              id={`${ids}-theme`}
              value={s.theme}
              onChange={(e) => change('theme', e.target.value as Settings['theme'])}
            >
              {(['system', 'light', 'dark'] as const).map((th) => (
                <option key={th} value={th}>
                  {t(`settings.themes.${th}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>
      <Panel title={t('settings.data')} labelledBy={`${ids}-data`}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label={t('settings.defaultFormat')} htmlFor={`${ids}-format`}>
            <Select
              id={`${ids}-format`}
              value={s.defaultFormatId ?? ''}
              onChange={(e) => change('defaultFormatId', e.target.value || null)}
            >
              {manifest.data?.formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('settings.cutoff')}
            htmlFor={`${ids}-cutoff`}
            hint={
              defaultCutoff !== null
                ? t('settings.cutoffHint', { value: defaultCutoff })
                : undefined
            }
          >
            <TextInput
              id={`${ids}-cutoff`}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              placeholder={defaultCutoff !== null ? String(defaultCutoff) : ''}
              defaultValue={s.viabilityCutoff !== null ? s.viabilityCutoff * 100 : ''}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                change(
                  'viabilityCutoff',
                  raw === '' ? null : Math.min(100, Math.max(0, Number(raw))) / 100,
                );
              }}
            />
          </Field>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--ink)]"
              checked={s.offMetaMode}
              onChange={(e) => change('offMetaMode', e.target.checked)}
            />
            {t('settings.offMeta')}
          </label>
        </div>
      </Panel>
      {save.isError && (
        <Alert tone="error" title={t('settings.saveError')} toneLabel={t('tone.error')} />
      )}
      <p className="m-0 text-sm text-muted">
        {t('settings.adminHint')}{' '}
        <Link to="/admin" className="text-ink underline underline-offset-2">
          {t('admin.title')}
        </Link>
      </p>
    </div>
  );
}
