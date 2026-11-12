import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { analysisRulesFor, parsePaste } from '@vgc-helper/engine';
import type {
  DamageResult,
  PreviewCell,
  PreviewMember,
  TeamPreview,
} from '@vgc-helper/engine/damage';
import type { TeamSlot } from '@vgc-helper/shared';
import { Check } from 'lucide-react';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaQuery, settingsQuery, teamsQuery } from '../api/queries';
import { moveName, useFormat } from '../builder/analysis/format';
import { Alert } from '../components/ui/Alert';
import { Field, Panel, Select, TextArea } from '../components/ui/Controls';
import { cx } from '../components/ui/cx';
import { TypeEdge } from '../components/ui/Type';
import { type Rules, useRules } from '../data/rules';
import { useDateTime } from '../lib/dates';
import { useDraft } from '../state/draft';

type DamageModule = typeof import('@vgc-helper/engine/damage');

/** The calc is large, so it loads the first time the page needs it. */
function useDamageModule(): DamageModule | null {
  const [mod, setMod] = useState<DamageModule | null>(null);
  useEffect(() => {
    let alive = true;
    void import('@vgc-helper/engine/damage').then((m) => alive && setMod(m));
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}

const STORAGE_KEY = 'vgc-helper.preview.opponent';
const DRAFT = 'draft';

function readStored(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

interface TeamChoice {
  id: string;
  name: string;
  slots: TeamSlot[];
  gameId: string;
  formatId: string;
  regulationId: string;
}

function Member({ member, rules }: { member: PreviewMember; rules: Rules }) {
  const species = member.set.species;
  return (
    <span className="inline-flex items-stretch gap-1.5">
      <TypeEdge types={species.types} />
      <span>{rules.index.species.get(species.id)?.name ?? species.name}</span>
    </span>
  );
}

/** One matchup: your best hit, their best hit and who moves first. */
function CellText({ cell }: { cell: PreviewCell }) {
  const { t } = useTranslation();
  const f = useFormat();
  const range = (r: DamageResult | null) => (r ? f.range(r.minPercent, r.maxPercent) : '0%');
  return (
    <div
      className={cx(
        'flex flex-col items-end whitespace-nowrap leading-tight',
        cell.answers && 'font-semibold',
      )}
    >
      <span>
        <span className="sr-only">{t('preview.dealt')} </span>
        <span aria-hidden="true">→ </span>
        {range(cell.dealt)}
      </span>
      <span className="text-muted">
        <span className="sr-only">{t('preview.taken')} </span>
        <span aria-hidden="true">← </span>
        {range(cell.taken)}
      </span>
      <span className="text-micro text-muted">
        {t(`preview.speed.${cell.speed === 1 ? 'faster' : cell.speed === -1 ? 'slower' : 'tie'}`)}
        {cell.answers && (
          <>
            {' · '}
            <Check className="inline size-3 text-success" strokeWidth={2} aria-hidden="true" />
            <span className="text-success">{t('preview.answers')}</span>
          </>
        )}
      </span>
    </div>
  );
}

function Plan({
  preview,
  rules,
  roleName,
}: {
  preview: TeamPreview;
  rules: Rules;
  roleName: (group: string) => string;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [best, ...others] = preview.plans;
  if (!best) return null;
  const bySlot = new Map(preview.mine.map((m) => [m.slot, m]));
  const theirBySlot = new Map(preview.theirs.map((m) => [m.slot, m]));
  const names = (slots: number[], side = bySlot) =>
    f.list(
      slots.map((s) => {
        const m = side.get(s);
        return m ? (rules.index.species.get(m.set.species.id)?.name ?? m.set.species.name) : '';
      }),
    );
  const back = best.bring.filter((s) => !best.lead.includes(s));
  const home = preview.mine.map((m) => m.slot).filter((s) => !best.bring.includes(s));

  const row = (label: string, slots: number[], extra?: ReactNode) => (
    <div className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0 sm:grid-cols-[9rem_1fr]">
      <dt className="label self-center">{label}</dt>
      <dd className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
        {slots.map((s) => {
          const m = bySlot.get(s);
          return m ? <Member key={s} member={m} rules={rules} /> : null;
        })}
        {extra}
      </dd>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <dl className="m-0">
        {row(
          t('preview.lead'),
          best.lead,
          best.leadRoles.length > 0 && (
            <span className="text-sm text-muted">
              {t('preview.leadRoles', { roles: f.list(best.leadRoles.map(roleName)) })}
            </span>
          ),
        )}
        {back.length > 0 && row(t('preview.back'), back)}
        {home.length > 0 && row(t('preview.home'), home)}
      </dl>
      <p className="m-0 px-4 text-sm text-muted">
        {t('preview.score', {
          score: f.number(best.score),
          coverage: f.number(best.coverage),
          roles: f.list(best.roles.map(roleName)) || t('changes.none'),
        })}
      </p>
      {best.unanswered.length > 0 && (
        <div className="px-4">
          <Alert
            tone="warning"
            toneLabel={t('tone.warning')}
            title={t('preview.unanswered', { names: names(best.unanswered, theirBySlot) })}
          >
            {t('preview.unansweredHint')}
          </Alert>
        </div>
      )}
      {others.length > 0 && (
        <div className="border-t border-line px-4 py-2.5">
          <h3 className="label m-0">{t('preview.alternatives')}</h3>
          <ul className="m-0 mt-1 list-none p-0 text-sm">
            {others.map((plan) => (
              <li key={plan.bring.join()} className="py-0.5">
                {t('preview.alternative', {
                  bring: names(plan.bring),
                  lead: names(plan.lead),
                  score: f.number(plan.score),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** How each of their members is handled by the pick: who answers it, with which hit. */
function Answers({ preview, rules }: { preview: TeamPreview; rules: Rules }) {
  const { t } = useTranslation();
  const f = useFormat();
  const best = preview.plans[0];
  if (!best) return null;
  const rows = preview.mine.map((m, i) => ({ member: m, cells: preview.cells[i] ?? [] }));
  return (
    <ul className="m-0 list-none p-0">
      {preview.theirs.map((their, col) => {
        const options = rows
          .filter((r) => best.bring.includes(r.member.slot))
          .map((r) => ({ member: r.member, cell: r.cells[col] }))
          .filter((o): o is { member: PreviewMember; cell: PreviewCell } => Boolean(o.cell))
          .sort((a, b) => b.cell.score - a.cell.score);
        const top = options[0];
        const name = (m: PreviewMember) =>
          rules.index.species.get(m.set.species.id)?.name ?? m.set.species.name;
        return (
          <li
            key={their.slot}
            className="flex items-stretch gap-2 border-b border-line px-4 py-2 text-sm last:border-b-0"
          >
            <TypeEdge types={their.set.species.types} />
            <div className="min-w-0">
              <p className="m-0 font-semibold">{name(their)}</p>
              {top?.cell.dealt ? (
                <p className="m-0">
                  {t(top.cell.answers ? 'preview.answeredBy' : 'preview.bestOption', {
                    mine: name(top.member),
                    move: moveName(rules.index, top.cell.dealt.move),
                    range: f.range(top.cell.dealt.minPercent, top.cell.dealt.maxPercent),
                    speed: t(
                      `preview.speed.${top.cell.speed === 1 ? 'faster' : top.cell.speed === -1 ? 'slower' : 'tie'}`,
                    ),
                    taken: top.cell.taken
                      ? f.range(top.cell.taken.minPercent, top.cell.taken.maxPercent)
                      : '0%',
                  })}
                </p>
              ) : (
                <p className="m-0 text-warning">{t('preview.noHit')}</p>
              )}
              {their.assumed.length > 0 && (
                <p className="m-0 text-muted">
                  {t('preview.assumed', {
                    fields: f.list(their.assumed.map((a) => t(`preview.field.${a}`))),
                  })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Team preview: your team against the opponent's team list. Who to bring and who to lead, from
 * damage calcs both ways and speed, scored with the weights of the analysis profile.
 */
export function PreviewPage() {
  const { t } = useTranslation();
  const ids = useId();
  const f = useFormat();
  const date = useDateTime();
  const damage = useDamageModule();
  const draftSlots = useDraft((s) => s.slots);
  const draft = useDraft();
  const teams = useQuery(teamsQuery);
  const settings = useQuery(settingsQuery);
  const [text, setText] = useState(readStored);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, text);
    } catch {
      // Private windows may refuse storage; the text just is not kept.
    }
  }, [text]);

  const choices = useMemo((): TeamChoice[] => {
    const list: TeamChoice[] = [];
    if (draftSlots.length > 0 && draft.gameId) {
      list.push({
        id: DRAFT,
        name: t('preview.draft', { name: draft.name || t('builder.untitled') }),
        slots: draftSlots,
        gameId: draft.gameId,
        formatId: draft.formatId,
        regulationId: draft.regulationId,
      });
    }
    for (const team of teams.data ?? []) {
      if (team.id === draft.teamId && list[0]?.id === DRAFT) continue;
      list.push(team);
    }
    return list;
  }, [draftSlots, draft, teams.data, t]);
  const team = choices.find((c) => c.id === choice) ?? choices[0];

  const { rules } = useRules({
    gameId: team?.gameId,
    formatId: team?.formatId,
    regulationId: team?.regulationId,
  });
  const formatId = rules?.ctx.format.id ?? '';
  const meta = useQuery({
    ...metaQuery(rules?.regulation.gameId ?? '', rules?.regulation.id ?? '', formatId),
    enabled: Boolean(rules?.regulation.files.meta[formatId]),
  });
  const analysisRules = rules ? analysisRulesFor(rules.manifest, rules.regulation.gameId) : null;

  const parsed = useMemo(
    () => (rules && text.trim() ? parsePaste(text, rules.index) : null),
    [rules, text],
  );
  const preview = useMemo(() => {
    if (!damage || !rules || !team || !analysisRules || !parsed || parsed.slots.length === 0)
      return null;
    return damage.teamPreview(
      team.slots,
      parsed.slots.slice(0, rules.ctx.format.teamSize.max),
      rules.ctx,
      rules.index,
      analysisRules,
      meta.data ?? null,
    );
  }, [damage, rules, team, analysisRules, parsed, meta.data]);

  const roleName = (group: string) => t(`analysis.groups.${group}`, { defaultValue: group });
  const advanced = settings.data?.experienceLevel === 'advanced';
  const brought = new Set(preview?.plans[0]?.bring ?? []);
  const rowOrder = preview
    ? preview.mine
        .map((m, i) => ({ m, i }))
        .sort((a, b) => Number(brought.has(b.m.slot)) - Number(brought.has(a.m.slot)))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="wdth-display m-0 text-h1 font-[750]">{t('preview.title')}</h1>
      <p className="m-0 max-w-3xl text-muted">{t('preview.intro')}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={t('preview.yours')} labelledBy={`${ids}-yours`}>
          <div className="flex flex-col gap-3 p-4">
            {choices.length === 0 ? (
              <p className="m-0 text-lead">
                {t('preview.noTeam')}{' '}
                <Link to="/" className="text-ink underline underline-offset-2">
                  {t('teams.buildFirst')}
                </Link>
              </p>
            ) : (
              <Field label={t('preview.team')} htmlFor={`${ids}-team`}>
                <Select
                  id={`${ids}-team`}
                  value={team?.id ?? ''}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {team && rules && (
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
                {team.slots.map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a team can hold the same species twice while illegal
                  <li key={`${s.species}-${i}`} className="flex items-stretch gap-1.5">
                    <TypeEdge types={rules.index.species.get(s.species)?.types ?? []} />
                    {rules.index.species.get(s.species)?.name ?? s.species}
                  </li>
                ))}
              </ul>
            )}
            {rules && (
              <p className="m-0 text-sm text-muted">
                {t('preview.rules', {
                  format: rules.ctx.format.name,
                  regulation: rules.regulation.name,
                  bring: rules.ctx.format.pickCount,
                })}
              </p>
            )}
          </div>
        </Panel>

        <Panel title={t('preview.theirs')} labelledBy={`${ids}-theirs`}>
          <div className="flex flex-col gap-2 p-4">
            <Field label={t('preview.list')} htmlFor={`${ids}-list`} hint={t('preview.listHint')}>
              <TextArea
                id={`${ids}-list`}
                rows={8}
                value={text}
                spellCheck={false}
                placeholder={t('preview.placeholder')}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            {parsed && parsed.problems.length > 0 && (
              <Alert
                tone="warning"
                title={t('paste.problems', { count: parsed.problems.length })}
                toneLabel={t('tone.warning')}
              >
                <ul className="m-0 pl-4">
                  {parsed.problems.slice(0, 8).map((p) => (
                    <li key={p.line}>
                      {t('paste.line', { line: p.line })}{' '}
                      <code className="font-mono">{p.text}</code>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        </Panel>
      </div>

      {!parsed || parsed.slots.length === 0 ? (
        <p className="m-0 text-lead">{t('preview.empty')}</p>
      ) : !preview ? (
        <p className="m-0 text-muted">{t('preview.loading')}</p>
      ) : (
        <>
          <Panel
            title={t('preview.pick', { count: preview.bringCount })}
            labelledBy={`${ids}-pick`}
          >
            <div className="py-2">
              {preview.bringCount >= (rules as Rules).ctx.format.teamSize.max && (
                <p className="m-0 px-4 pb-2 text-sm text-muted">
                  {t('preview.allIn', { format: (rules as Rules).ctx.format.name })}
                </p>
              )}
              <Plan preview={preview} rules={rules as Rules} roleName={roleName} />
            </div>
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel title={t('preview.matrix')} labelledBy={`${ids}-matrix`} className="min-w-0">
              {/* Scrolls sideways on phones; focusable so the keyboard can scroll it too. */}
              <section
                className="relative overflow-x-auto"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1, a scrollable region with no focusable content must take focus to be scrolled by keyboard (axe scrollable-region-focusable)
                tabIndex={0}
                aria-label={t('preview.matrixCaption')}
              >
                <table className="wdth-table w-full border-collapse text-sm">
                  <caption className="sr-only">{t('preview.matrixCaption')}</caption>
                  <thead>
                    <tr className="border-b border-line-strong">
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        {t('preview.mineHeader')}
                      </th>
                      {preview.theirs.map((m) => (
                        <th
                          key={m.slot}
                          scope="col"
                          className="px-2 py-2 text-right align-bottom font-semibold"
                        >
                          <Member member={m} rules={rules as Rules} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowOrder.map(({ m, i }) => (
                      <tr
                        key={m.slot}
                        className={cx(
                          'border-b border-line last:border-b-0',
                          !brought.has(m.slot) && 'text-muted',
                        )}
                      >
                        <th
                          scope="row"
                          className="px-3 py-2 text-left font-normal whitespace-nowrap"
                        >
                          <Member member={m} rules={rules as Rules} />
                          {!brought.has(m.slot) && (
                            <span className="block text-micro">{t('preview.homeShort')}</span>
                          )}
                        </th>
                        {(preview.cells[i] ?? []).map((cell) => (
                          <td key={cell.theirs} className="px-2 py-2 text-right align-top">
                            <CellText cell={cell} />
                            {advanced && (
                              <span className="block text-micro text-muted">
                                {t('preview.cellScore', { score: f.number(cell.score) })}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <p className="m-0 border-t border-line px-4 py-2 text-sm text-muted">
                {t('preview.legend')}
              </p>
            </Panel>

            <Panel title={t('preview.answersTitle')} labelledBy={`${ids}-answers`}>
              <Answers preview={preview} rules={rules as Rules} />
            </Panel>
          </div>

          <p className="m-0 text-sm text-muted">
            {meta.data
              ? t('preview.source', {
                  version: (rules as Rules).manifest.version,
                  name: meta.data.source.name,
                  date: date(meta.data.source.retrievedAt, false),
                })
              : t('preview.sourceNoMeta', { version: (rules as Rules).manifest.version })}
          </p>
        </>
      )}
    </div>
  );
}
