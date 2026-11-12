import type { TeamSlot } from '@vgc-helper/shared';
import { type DexIndex, megaFormeFor, type RulesContext } from './context.js';
import { type SpreadIssue, validateSpread } from './stats.js';

export type Severity = 'error' | 'warning' | 'info';

/** One legality finding. `slot` is the 0-based slot index. Texts come from i18n templates. */
export type LegalityIssue = { severity: Severity } & (
  | { code: 'unknownSpecies'; slot: number; species: string }
  | { code: 'formeNotSelectable'; slot: number; species: string }
  | { code: 'unknownItem'; slot: number; item: string }
  | { code: 'abilityNotAllowed'; slot: number; ability: string; species: string }
  | { code: 'unknownMove'; slot: number; move: string }
  | { code: 'moveNotLearnable'; slot: number; move: string; species: string }
  | { code: 'duplicateMove'; slot: number; move: string }
  | { code: 'tooManyMoves'; slot: number; max: number }
  | { code: 'noMoves'; slot: number }
  | { code: 'unknownNature'; slot: number; nature: string }
  | { code: 'spread'; slot: number; issue: SpreadIssue }
  | { code: 'ivsNotAllowed'; slot: number }
  | { code: 'teraNotAvailable'; slot: number }
  | { code: 'unknownTeraType'; slot: number; teraType: string }
  | { code: 'megaWithoutStone'; slot: number }
  | { code: 'stoneDoesNothing'; slot: number; item: string; species: string }
  | { code: 'itemClause'; item: string; slots: number[] }
  | { code: 'speciesClause'; species: string; slots: number[] }
  | { code: 'gimmickLimit'; slots: number[]; perBattle: number }
  | { code: 'restrictedLimit'; slots: number[]; limit: number }
  | { code: 'teamTooSmall'; count: number; min: number }
  | { code: 'teamTooLarge'; count: number; max: number }
);

export const MAX_MOVES = 4;

function checkSlot(slot: TeamSlot, i: number, ctx: RulesContext, index: DexIndex): LegalityIssue[] {
  const issues: LegalityIssue[] = [];
  const species = index.species.get(slot.species);
  if (!species)
    return [{ severity: 'error', code: 'unknownSpecies', slot: i, species: slot.species }];
  if (!species.selectable) {
    issues.push({ severity: 'error', code: 'formeNotSelectable', slot: i, species: species.name });
  }

  if (slot.item && !index.items.has(slot.item)) {
    issues.push({ severity: 'error', code: 'unknownItem', slot: i, item: slot.item });
  }
  if (slot.ability && !species.abilities.includes(slot.ability)) {
    issues.push({
      severity: 'error',
      code: 'abilityNotAllowed',
      slot: i,
      ability: slot.ability,
      species: species.name,
    });
  }

  const learnset = index.learnsets.get(species.id) ?? new Set<string>();
  const seen = new Set<string>();
  for (const move of slot.moves) {
    if (seen.has(move)) issues.push({ severity: 'error', code: 'duplicateMove', slot: i, move });
    seen.add(move);
    if (!index.moves.has(move))
      issues.push({ severity: 'error', code: 'unknownMove', slot: i, move });
    else if (!learnset.has(move)) {
      issues.push({
        severity: 'error',
        code: 'moveNotLearnable',
        slot: i,
        move,
        species: species.name,
      });
    }
  }
  if (slot.moves.length > MAX_MOVES) {
    issues.push({ severity: 'error', code: 'tooManyMoves', slot: i, max: MAX_MOVES });
  }
  if (slot.moves.length === 0) issues.push({ severity: 'warning', code: 'noMoves', slot: i });

  if (slot.nature && !index.natures.has(slot.nature)) {
    issues.push({ severity: 'error', code: 'unknownNature', slot: i, nature: slot.nature });
  }
  for (const issue of validateSpread(ctx.profile, slot.spread)) {
    issues.push({ severity: 'error', code: 'spread', slot: i, issue });
  }
  if (ctx.profile.statSystem.kind === 'statPoints' && slot.ivs) {
    issues.push({ severity: 'error', code: 'ivsNotAllowed', slot: i });
  }
  if (slot.teraType && ctx.profile.gimmick.kind !== 'tera') {
    issues.push({ severity: 'error', code: 'teraNotAvailable', slot: i });
  } else if (slot.teraType && !ctx.profile.gimmick.teraTypes.includes(slot.teraType)) {
    issues.push({ severity: 'error', code: 'unknownTeraType', slot: i, teraType: slot.teraType });
  }

  const item = slot.item ? index.items.get(slot.item) : undefined;
  const mega = megaFormeFor(index, species.id, slot.item);
  if (slot.mega && !mega) issues.push({ severity: 'error', code: 'megaWithoutStone', slot: i });
  if (item?.megaStone && !mega) {
    issues.push({
      severity: 'warning',
      code: 'stoneDoesNothing',
      slot: i,
      item: item.name,
      species: species.name,
    });
  }
  return issues;
}

/** Slots (0-based) that share the same key, for clauses. */
function duplicates(keys: (string | null)[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  keys.forEach((key, i) => {
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  return new Map([...groups].filter(([, slots]) => slots.length > 1));
}

/** Checks a team against one regulation. Errors make the team illegal; warnings and info do not. */
export function checkLegality(
  slots: TeamSlot[],
  ctx: RulesContext,
  index: DexIndex,
): LegalityIssue[] {
  const issues = slots.flatMap((slot, i) => checkSlot(slot, i, ctx, index));

  if (ctx.regulation.clauses.includes('item')) {
    for (const [item, at] of duplicates(slots.map((s) => s.item))) {
      issues.push({
        severity: 'error',
        code: 'itemClause',
        item: index.items.get(item)?.name ?? item,
        slots: at,
      });
    }
  }
  if (ctx.regulation.clauses.includes('species')) {
    const nums = slots.map((s) => {
      const sp = index.species.get(s.species);
      return sp ? String(sp.num) : null;
    });
    for (const [num, at] of duplicates(nums)) {
      const name = index.species.get(slots[at[0] as number]?.species ?? '')?.baseSpecies ?? num;
      issues.push({ severity: 'error', code: 'speciesClause', species: name, slots: at });
    }
  }

  const { restrictedLimit, restrictedTags } = ctx.regulation;
  if (restrictedLimit !== null && restrictedTags.length > 0) {
    const restricted = slots.flatMap((s, i) => {
      const tags = index.species.get(s.species)?.tags ?? [];
      return tags.some((t) => restrictedTags.includes(t)) ? [i] : [];
    });
    if (restricted.length > restrictedLimit) {
      issues.push({
        severity: 'error',
        code: 'restrictedLimit',
        slots: restricted,
        limit: restrictedLimit,
      });
    }
  }

  const gimmick = ctx.profile.gimmick;
  if (gimmick.kind === 'mega') {
    const planned = slots.flatMap((s, i) => (s.mega ? [i] : []));
    if (planned.length > gimmick.perBattle) {
      issues.push({
        severity: 'info',
        code: 'gimmickLimit',
        slots: planned,
        perBattle: gimmick.perBattle,
      });
    }
  }

  const { min, max } = ctx.format.teamSize;
  if (slots.length < min)
    issues.push({ severity: 'info', code: 'teamTooSmall', count: slots.length, min });
  if (slots.length > max)
    issues.push({ severity: 'error', code: 'teamTooLarge', count: slots.length, max });
  return issues;
}

export const isLegal = (issues: LegalityIssue[]) => !issues.some((i) => i.severity === 'error');
