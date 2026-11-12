import { describe, expect, it } from 'vitest';
import { analyzeTeam } from './analysis/analyze.js';
import { analyzeThreats } from './damage/calc.js';
import { checkLegality, isLegal } from './legality.js';
import { parsePaste } from './paste.js';
import { calcStats } from './stats.js';
import { loadAnalysis, loadContext } from './test-support/snapshot.js';

const REG_G = `Koraidon @ Choice Scarf
Ability: Orichalcum Pulse
Tera Type: Fire
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Flare Blitz
- Collision Course
- U-turn
- Close Combat

Incineroar @ Safety Goggles
Ability: Intimidate
Tera Type: Grass
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Fake Out
- Knock Off
- Parting Shot
- Flare Blitz

Rillaboom @ Assault Vest
Ability: Grassy Surge
Tera Type: Fire
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Fake Out
- Grassy Glide
- Wood Hammer
- U-turn

Urshifu-Rapid-Strike @ Focus Sash
Ability: Unseen Fist
Tera Type: Water
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Surging Strikes
- Close Combat
- Aqua Jet
- Detect`;

describe('Scarlet/Violet VGC Reg G', () => {
  it('reads EVs and Tera Types, and the set is legal with one Restricted Legendary', async () => {
    const { ctx, index } = await loadContext('sv-vgc');
    const { slots } = parsePaste(REG_G, index);
    expect(slots[0]).toMatchObject({ teraType: 'Fire', spread: { atk: 252, spe: 252, hp: 4 } });
    const issues = checkLegality(slots, ctx, index);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(isLegal(issues)).toBe(true);
  });

  it('allows only one Restricted Legendary, no Mythicals and only real Tera Types', async () => {
    const { ctx, index } = await loadContext('sv-vgc');
    const { slots } = parsePaste(`${REG_G}\n\nMiraidon\n- Electro Drift`, index);
    expect(checkLegality(slots, ctx, index)).toContainEqual(
      expect.objectContaining({ code: 'restrictedLimit', slots: [0, 4], limit: 1 }),
    );
    expect(index.species.has('mew')).toBe(false);
    const [first] = slots;
    if (!first) throw new Error('no slot');
    expect(
      checkLegality([{ ...first, teraType: 'Shadow' }], ctx, index).map((i) => i.code),
    ).toContain('unknownTeraType');
  });

  it('uses the main-series stat formula at level 50', async () => {
    const { ctx, index } = await loadContext('sv-vgc');
    const koraidon = index.species.get('koraidon');
    if (!koraidon) throw new Error('Koraidon missing');
    const stats = calcStats(
      ctx.profile,
      koraidon.baseStats,
      { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      50,
      index.natures.get('jolly') ?? null,
      null,
    );
    // Base 100 HP, 135 Speed: 176 HP and 205 Speed with 252 EVs and a Jolly nature.
    expect(stats.hp).toBe(176);
    expect(stats.spe).toBe(205);
  });

  it('learns only what Scarlet/Violet teaches, from every stage', async () => {
    const { index } = await loadContext('sv-vgc');
    // Garchomp keeps moves Gible learns; Return was cut from Scarlet/Violet.
    expect(index.learnsets.get('garchomp')?.has('earthquake')).toBe(true);
    expect(index.learnsets.get('garchomp')?.has('return')).toBe(false);
  });
});

describe('Smogon OU', () => {
  it('leaves out Ubers and the banned moves, abilities and items', async () => {
    const { index } = await loadContext('sv-ou');
    expect(index.species.has('fluttermane')).toBe(false);
    expect(index.species.has('koraidon')).toBe(false);
    expect(index.species.has('gholdengo')).toBe(true);
    expect(index.moves.has('spore')).toBe(false);
    expect(index.moves.has('batonpass')).toBe(false);
    expect(index.abilities.has('shadowtag')).toBe(false);
    expect(index.items.has('kingsrock')).toBe(false);
  });

  it('runs the Singles analysis and the damage calcs at level 100 with EVs', async () => {
    const { ctx, index, rules, meta } = await loadAnalysis('sv-ou');
    const { slots } = parsePaste(
      `Great Tusk @ Leftovers
Ability: Protosynthesis
EVs: 252 HP / 4 Atk / 252 Def
Impish Nature
- Headlong Rush
- Rapid Spin
- Knock Off
- Stealth Rock

Gholdengo @ Choice Scarf
Ability: Good as Gold
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Trick
- Focus Blast`,
      index,
    );
    const analysis = analyzeTeam(slots, ctx, index, rules, meta, {
      cutoff: ctx.format.viability.defaultCutoff,
      offMeta: false,
    });
    const groups = Object.fromEntries(analysis.checklist.groups.map((g) => [g.group, g.filled]));
    expect(groups).toMatchObject({ hazards: true, hazardRemoval: true, wallbreaker: true });
    expect(analysis.team[0]?.stats.hp).toBe(linearHp(115));
    const threats = analyzeThreats(analysis.team, slots, ctx, index, meta, rules);
    expect(threats.length).toBeGreaterThan(0);
    expect(threats[0]?.matchups[0]?.taken?.maxPercent).toBeGreaterThan(0);
  });
});

/** HP at level 100 with 31 IVs and 252 EVs: 2 × base + 31 + 63 + 110. */
function linearHp(base: number) {
  return 2 * base + 31 + 63 + 110;
}
