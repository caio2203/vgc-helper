import type { DexIndex, LegalityIssue } from '@vgc-helper/engine';
import type { TeamSlot } from '@vgc-helper/shared';
import type { TFunction } from 'i18next';

const statKey = (stat: string) => `stats.${stat}`;

/** Template text for one legality issue in the current language. */
export function describeIssue(
  issue: LegalityIssue,
  slots: TeamSlot[],
  index: DexIndex,
  t: TFunction,
): string {
  const slotName = (i: number) => {
    const id = slots[i]?.species ?? '';
    return t('legality.slot', { n: i + 1, name: index.species.get(id)?.name ?? id });
  };
  const moveName = (id: string) => index.moves.get(id)?.name ?? id;
  const abilityName = (id: string) => index.abilities.get(id)?.name ?? id;

  switch (issue.code) {
    case 'unknownSpecies':
      return t('legality.unknownSpecies', { slot: slotName(issue.slot), id: issue.species });
    case 'formeNotSelectable':
      return t('legality.formeNotSelectable', { slot: slotName(issue.slot), name: issue.species });
    case 'unknownItem':
      return t('legality.unknownItem', { slot: slotName(issue.slot), id: issue.item });
    case 'abilityNotAllowed':
      return t('legality.abilityNotAllowed', {
        slot: slotName(issue.slot),
        ability: abilityName(issue.ability),
      });
    case 'unknownMove':
      return t('legality.unknownMove', { slot: slotName(issue.slot), id: issue.move });
    case 'moveNotLearnable':
      return t('legality.moveNotLearnable', {
        slot: slotName(issue.slot),
        move: moveName(issue.move),
      });
    case 'duplicateMove':
      return t('legality.duplicateMove', {
        slot: slotName(issue.slot),
        move: moveName(issue.move),
      });
    case 'tooManyMoves':
      return t('legality.tooManyMoves', { slot: slotName(issue.slot), max: issue.max });
    case 'noMoves':
      return t('legality.noMoves', { slot: slotName(issue.slot) });
    case 'unknownNature':
      return t('legality.unknownNature', { slot: slotName(issue.slot), id: issue.nature });
    case 'spread': {
      const s = issue.issue;
      if (s.code === 'perStatExceeded') {
        return t('legality.spreadPerStat', {
          slot: slotName(issue.slot),
          stat: t(statKey(s.stat)),
          value: s.value,
          max: s.max,
        });
      }
      if (s.code === 'totalExceeded') {
        return t('legality.spreadTotal', {
          slot: slotName(issue.slot),
          total: s.total,
          max: s.max,
        });
      }
      return t('legality.spreadNegative', { slot: slotName(issue.slot), stat: t(statKey(s.stat)) });
    }
    case 'ivsNotAllowed':
      return t('legality.ivsNotAllowed', { slot: slotName(issue.slot) });
    case 'teraNotAvailable':
      return t('legality.teraNotAvailable', { slot: slotName(issue.slot) });
    case 'megaWithoutStone':
      return t('legality.megaWithoutStone', { slot: slotName(issue.slot) });
    case 'stoneDoesNothing':
      return t('legality.stoneDoesNothing', { slot: slotName(issue.slot), item: issue.item });
    case 'itemClause':
      return t('legality.itemClause', {
        item: issue.item,
        slots: issue.slots.map((s) => s + 1).join(', '),
      });
    case 'speciesClause':
      return t('legality.speciesClause', {
        name: issue.species,
        slots: issue.slots.map((s) => s + 1).join(', '),
      });
    case 'gimmickLimit':
      return t('legality.gimmickLimit', { count: issue.slots.length, perBattle: issue.perBattle });
    case 'teamTooSmall':
      return t('legality.teamTooSmall', { count: issue.count, min: issue.min });
    case 'teamTooLarge':
      return t('legality.teamTooLarge', { count: issue.count, max: issue.max });
  }
}
