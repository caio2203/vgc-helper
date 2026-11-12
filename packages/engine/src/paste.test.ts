import { beforeAll, describe, expect, it } from 'vitest';
import type { DexIndex, RulesContext } from './context.js';
import { exportPaste, parsePaste } from './paste.js';
import { loadContext } from './test-support/snapshot.js';

let ctx: RulesContext;
let index: DexIndex;
beforeAll(async () => {
  ({ ctx, index } = await loadContext());
});

const PASTE = `Big Cat (Incineroar) (M) @ Sitrus Berry
Ability: Intimidate
Level: 50
Shiny: Yes
EVs: 32 HP / 2 Def / 32 SpD
Careful Nature
- Fake Out
- Parting Shot
- Flare Blitz
- Protect

Garchomp-Mega-Z @ Garchompite Z
Ability: Rough Skin
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect
`;

describe('Showdown paste', () => {
  it('reads Stat Points from the EVs line, nicknames, genders and Mega formes', () => {
    const { slots, problems } = parsePaste(PASTE, index);
    expect(problems).toEqual([]);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      species: 'incineroar',
      item: 'sitrusberry',
      ability: 'intimidate',
      nature: 'careful',
      moves: ['fakeout', 'partingshot', 'flareblitz', 'protect'],
      spread: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
      mega: false,
    });
    expect(slots[1]).toMatchObject({ species: 'garchomp', item: 'garchompitez', mega: true });
  });

  it('round-trips through export', () => {
    const { slots } = parsePaste(PASTE, index);
    const exported = exportPaste(slots, ctx, index);
    expect(exported).toContain(
      'Incineroar @ Sitrus Berry\nAbility: Intimidate\nLevel: 50\nEVs: 32 HP / 2 Def / 32 SpD\nCareful Nature',
    );
    expect(parsePaste(exported, index).slots).toEqual(slots);
  });

  it('reports lines it does not understand, with their line number', () => {
    const { slots, problems } = parsePaste(
      'Incineroar\nThis is not a paste line\n- Fake Out',
      index,
    );
    expect(slots[0]?.moves).toEqual(['fakeout']);
    expect(problems).toEqual([{ line: 2, text: 'This is not a paste line' }]);
  });

  it('accepts Windows line endings and trailing spaces', () => {
    const { slots } = parsePaste(
      'Incineroar @ Sitrus Berry  \r\nAbility: Intimidate\r\n- Fake Out\r\n',
      index,
    );
    expect(slots[0]).toMatchObject({
      item: 'sitrusberry',
      ability: 'intimidate',
      moves: ['fakeout'],
    });
  });
});
