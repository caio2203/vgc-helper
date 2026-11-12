/**
 * The analysis as the AI layer sees it: plain JSON with names instead of ids, percentages
 * instead of shares, and only what the engine concluded. The model is told to use nothing else,
 * plus the tools below, which read the same snapshot.
 */
import type { AnalysisRules, MetaPokemon, MetaSnapshot } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import { analyzeTeam } from '../analysis/analyze.js';
import { rankedMeta } from '../analysis/meta.js';
import type { ScorePart, SuggestionOptions } from '../analysis/suggestions.js';
import type { DexIndex, RulesContext } from '../context.js';
import { toId } from '../ids.js';
import { checkLegality, type LegalityIssue } from '../legality.js';
import { analyzeThreats } from './calc.js';

const pct = (share: number) => Math.round(share * 1000) / 10;

/** Ids in an issue (species, move, item, ability) turned into names the model can quote. */
function namedIssue(issue: LegalityIssue, index: DexIndex): Record<string, unknown> {
  const out: Record<string, unknown> = { ...issue };
  if ('slot' in issue) out.slot = issue.slot + 1;
  if ('slots' in issue) out.slots = issue.slots.map((s) => s + 1);
  if ('move' in issue) out.move = index.moves.get(issue.move)?.name ?? issue.move;
  if ('ability' in issue) out.ability = index.abilities.get(issue.ability)?.name ?? issue.ability;
  return out;
}

/** A score part with percentages and names, as the model reads it. */
function scorePartForAi(p: ScorePart, species: (id: string) => string) {
  if (p.criterion === 'usage') {
    return { criterion: p.criterion, points: p.points, usagePercent: pct(p.usage) };
  }
  if (p.criterion === 'teammates') {
    return {
      criterion: p.criterion,
      points: p.points,
      partners: p.partners.map((x) => species(x.species)),
    };
  }
  if (p.criterion === 'topCut') {
    return {
      criterion: p.criterion,
      points: p.points,
      topCutPercent: pct(p.share),
      teams: p.teams,
      events: p.events,
    };
  }
  return p;
}

export function summarizeTeam(
  slots: TeamSlot[],
  ctx: RulesContext,
  index: DexIndex,
  rules: AnalysisRules,
  meta: MetaSnapshot | null,
  options: SuggestionOptions,
) {
  const analysis = analyzeTeam(slots, ctx, index, rules, meta, options);
  const name = (slot: number) => {
    const member = analysis.team.find((m) => m.slot === slot);
    return member?.battle.name ?? slots[slot]?.species ?? String(slot);
  };
  const names = (list: number[]) => list.map(name);
  const species = (id: string) => index.species.get(id)?.name ?? id;
  const move = (id: string) => index.moves.get(id)?.name ?? id;
  const item = (id: string | null) => (id ? (index.items.get(id)?.name ?? id) : null);
  const ability = (id: string | null) => (id ? (index.abilities.get(id)?.name ?? id) : null);
  const threats = meta
    ? analyzeThreats(analysis.team, slots, ctx, index, meta, rules).slice(0, 6)
    : [];

  return {
    format: {
      name: ctx.format.name,
      gameType: ctx.format.gameType,
      teamSize: ctx.format.teamSize.max,
      bring: ctx.format.pickCount,
      level: ctx.format.level,
    },
    regulation: { name: ctx.regulation.name, endsAt: ctx.regulation.endsAt },
    team: analysis.team.map((m) => ({
      slot: m.slot + 1,
      species: m.battle.name,
      types: m.battle.types,
      item: item(m.item),
      ability: ability(m.ability),
      moves: m.moves.map((x) => x.name),
      nature: slots[m.slot]?.nature ?? null,
      speed: m.stats.spe,
    })),
    legality: checkLegality(slots, ctx, index)
      .filter((i) => i.severity !== 'info')
      .map((i) => namedIssue(i, index)),
    stackedWeaknesses: analysis.stacked.map((s) => ({
      type: s.type,
      weakMembers: names(s.slots),
      coveredBy: names(s.coveredBy),
      metaUsers: s.users.slice(0, 5).map((u) => ({
        species: species(u.species),
        usagePercent: pct(u.usage),
        move: move(u.move),
      })),
    })),
    recommendedTypes: analysis.recommendedTypes.map((r) => r.type),
    roles: {
      filled: analysis.checklist.groups
        .filter((g) => g.filled)
        .map((g) => ({
          group: g.group,
          by: [...new Set(g.roles.flatMap((r) => r.matches.map((m) => name(m.slot))))],
        })),
      missing: analysis.checklist.missing,
    },
    archetypes: analysis.archetypes.map((a) => ({
      id: a.id,
      setters: names(a.setters),
      abusers: names(a.abusers),
      missingSetters: a.missing.setters,
      missingAbusers: a.missing.abusers,
    })),
    metaThreats: threats.map((t) => ({
      species: t.set.species.name,
      usagePercent: pct(t.usage),
      item: item(t.set.item),
      moves: t.set.moves.map((x) => x.name),
      knocksOutInOneHit: names(t.ohko),
      answeredBy: names(t.answeredBy),
    })),
    suggestions: analysis.suggestions.map((s) => ({
      species: s.species.name,
      usagePercent: pct(s.usage),
      score: s.score,
      reasons: s.parts.map((p) => scorePartForAi(p, species)),
      set: {
        item: item(s.set.item),
        ability: ability(s.set.ability),
        moves: s.set.moves.map((x) => x.name),
        nature: s.set.nature,
      },
    })),
    sources: [
      { data: 'game data', name: ctx.dex.source.name, retrievedAt: ctx.dex.source.retrievedAt },
      ...(meta
        ? [
            {
              data: 'usage',
              name: meta.source.name,
              period: meta.period,
              battles: meta.battles,
              retrievedAt: meta.source.retrievedAt,
            },
          ]
        : []),
    ],
  };
}
export type AiTeamSummary = ReturnType<typeof summarizeTeam>;

/** Finds a species by name or id, Megas included. */
function findSpecies(index: DexIndex, query: string) {
  return index.species.get(toId(query)) ?? null;
}

function metaEntry(meta: MetaSnapshot, id: string): { entry: MetaPokemon; rank: number } | null {
  const ranked = meta.pokemon.slice().sort((a, b) => b.usage - a.usage);
  const rank = ranked.findIndex((p) => p.species === id);
  const entry = ranked[rank];
  return entry ? { entry, rank: rank + 1 } : null;
}

const top = (list: { id: string; share: number }[], label: (id: string) => string, n: number) =>
  list.slice(0, n).map((x) => ({ name: label(x.id), percent: pct(x.share) }));

/** Tool: how much a species is used in the format, with its rank. */
export function usageTool(meta: MetaSnapshot | null, index: DexIndex, query: string) {
  const species = findSpecies(index, query);
  if (!species) return { found: false, reason: `No Pokémon named ${query} in this regulation` };
  if (!meta) return { found: false, reason: 'No usage data for this format' };
  const hit = metaEntry(meta, species.id);
  if (!hit) {
    return {
      found: false,
      species: species.name,
      reason: `${species.name} is not in the usage data of ${meta.period}`,
    };
  }
  return {
    found: true,
    species: species.name,
    usagePercent: pct(hit.entry.usage),
    rank: hit.rank,
    ranked: rankedMeta(meta, index).length,
    period: meta.period,
    source: meta.source.name,
  };
}

/** Tool: the most common set of a species, with the share of each choice. */
export function commonSetTool(meta: MetaSnapshot | null, index: DexIndex, query: string) {
  const species = findSpecies(index, query);
  if (!species) return { found: false, reason: `No Pokémon named ${query} in this regulation` };
  const hit = meta ? metaEntry(meta, species.id) : null;
  if (!meta || !hit) return { found: false, species: species.name, reason: 'No usage data' };
  const { entry } = hit;
  return {
    found: true,
    species: species.name,
    items: top(entry.items, (id) => index.items.get(id)?.name ?? id, 3),
    abilities: top(entry.abilities, (id) => index.abilities.get(id)?.name ?? id, 2),
    moves: top(entry.moves, (id) => index.moves.get(id)?.name ?? id, 6),
    spreads: entry.spreads.slice(0, 2).map((s) => ({
      nature: s.nature,
      statPoints: s.spread,
      percent: pct(s.share),
    })),
    teammates: top(entry.teammates, (id) => index.species.get(id)?.name ?? id, 5),
    period: meta.period,
    source: meta.source.name,
  };
}

/** Tool: whether a species, and optionally its moves, item and ability, are legal. */
export function legalityTool(
  ctx: RulesContext,
  index: DexIndex,
  query: { species: string; moves?: string[]; item?: string; ability?: string },
) {
  const species = findSpecies(index, query.species);
  if (!species) {
    return { legal: false, reason: `${query.species} is not legal in ${ctx.regulation.name}` };
  }
  const slot: TeamSlot = {
    species: species.id,
    item: query.item ? toId(query.item) : null,
    ability: query.ability ? toId(query.ability) : null,
    moves: (query.moves ?? []).map(toId),
    nature: null,
    spread: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: null,
    mega: false,
    teraType: null,
    notes: '',
  };
  const issues = checkLegality([slot], ctx, index).filter(
    (i) => i.severity === 'error' && i.code !== 'teamTooSmall',
  );
  return {
    legal: issues.length === 0,
    species: species.name,
    regulation: ctx.regulation.name,
    issues: issues.map((i) => namedIssue(i, index)),
  };
}
