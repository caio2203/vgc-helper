import type { TeamSlot } from '@vgc-helper/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DexIndex, RulesContext } from './context.js';
import { checkLegality, isLegal } from './legality.js';
import { emptySlot } from './paste.js';
import { loadContext } from './test-support/snapshot.js';

let ctx: RulesContext;
let index: DexIndex;
beforeAll(async () => {
  ({ ctx, index } = await loadContext());
});

const slot = (patch: Partial<TeamSlot> & { species: string }): TeamSlot => ({
  ...emptySlot(patch.species),
  ...patch,
});

const incineroar = slot({
  species: 'incineroar',
  item: 'sitrusberry',
  ability: 'intimidate',
  moves: ['fakeout', 'partingshot', 'flareblitz', 'protect'],
  nature: 'careful',
  spread: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
});
const garchomp = slot({
  species: 'garchomp',
  item: 'garchompitez',
  ability: 'roughskin',
  moves: ['earthquake', 'dragonclaw', 'rockslide', 'protect'],
  nature: 'jolly',
  spread: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  mega: true,
});
const codes = (slots: TeamSlot[]) => checkLegality(slots, ctx, index).map((i) => i.code);

describe('checkLegality with Reg M-C data', () => {
  it('accepts a legal pair and only notes that the team is not full', () => {
    const issues = checkLegality([incineroar, garchomp], ctx, index);
    expect(isLegal(issues)).toBe(true);
    expect(issues.map((i) => i.code)).toEqual(['teamTooSmall']);
  });

  it('knows Incineroar lost Knock Off in Champions', () => {
    expect(codes([{ ...incineroar, moves: ['knockoff', 'fakeout'] }])).toContain(
      'moveNotLearnable',
    );
  });

  it('rejects species outside the regulation and battle-only formes', () => {
    expect(codes([slot({ species: 'mewtwo' })])).toContain('unknownSpecies');
    expect(codes([slot({ species: 'garchompmegaz' })])).toContain('formeNotSelectable');
  });

  it('enforces Item Clause and Species Clause', () => {
    const issues = checkLegality(
      [incineroar, { ...incineroar }, { ...garchomp, item: 'sitrusberry', mega: false }],
      ctx,
      index,
    );
    const item = issues.find((i) => i.code === 'itemClause');
    const species = issues.find((i) => i.code === 'speciesClause');
    expect(item).toMatchObject({ item: 'Sitrus Berry', slots: [0, 1, 2] });
    expect(species).toMatchObject({ species: 'Incineroar', slots: [0, 1] });
  });

  it('checks the 66 / 32 Stat Point limits', () => {
    const issues = checkLegality(
      [{ ...incineroar, spread: { hp: 33, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 } }],
      ctx,
      index,
    );
    expect(
      issues.filter((i) => i.code === 'spread').map((i) => i.code === 'spread' && i.issue.code),
    ).toEqual(['perStatExceeded', 'totalExceeded']);
  });

  it('flags a Mega plan without the right stone and a stone on the wrong Pokémon', () => {
    expect(codes([{ ...garchomp, item: 'sitrusberry' }])).toContain('megaWithoutStone');
    expect(codes([{ ...incineroar, item: 'garchompitez' }])).toContain('stoneDoesNothing');
  });

  it('notes that only one Mega can evolve per battle, without making the team illegal', () => {
    const charizard = slot({
      species: 'charizard',
      item: 'charizarditey',
      ability: 'blaze',
      moves: ['heatwave', 'protect'],
      mega: true,
    });
    const issues = checkLegality([garchomp, charizard], ctx, index);
    expect(issues.find((i) => i.code === 'gimmickLimit')).toMatchObject({
      severity: 'info',
      perBattle: 1,
    });
    expect(isLegal(issues)).toBe(true);
  });

  it('rejects abilities the species cannot have, Tera Types and IVs in Champions', () => {
    expect(codes([{ ...incineroar, ability: 'levitate' }])).toContain('abilityNotAllowed');
    expect(codes([{ ...incineroar, teraType: 'Fire' }])).toContain('teraNotAvailable');
    expect(
      codes([{ ...incineroar, ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 } }]),
    ).toContain('ivsNotAllowed');
  });
});
