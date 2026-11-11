import type { MechanicsProfile, Nature, StatsTable } from '@vgc-helper/data';
import { describe, expect, it } from 'vitest';
import { calcMaxPp, calcStat, calcStats, validateSpread } from './stats.js';

const source = {
  name: 'test fixture',
  url: 'https://example.com/',
  retrievedAt: '2026-11-11T00:00:00.000Z',
};

const statPoints: MechanicsProfile = {
  id: 'sp-test',
  name: 'Stat Points',
  statSystem: { kind: 'statPoints', total: 66, maxPerStat: 32, fixedIv: 31 },
  nature: { plusPercent: 110, minusPercent: 90 },
  gimmick: { kind: 'mega', perBattle: 1 },
  pp: { maxBasePp: 20, formula: 'champions' },
  statusRules: {
    paralysisFullParaChance: 0.125,
    sleepTurns: { min: 2, max: 3 },
    freezeMaxTurns: 3,
    freezeThawChance: 0.25,
  },
  moveRestrictions: [],
  sources: [source],
};

const evIv: MechanicsProfile = {
  ...statPoints,
  id: 'ev-test',
  statSystem: { kind: 'evIv', evTotal: 510, evMaxPerStat: 252, ivMax: 31 },
  pp: { maxBasePp: null, formula: 'standard' },
};

const jolly: Nature = { id: 'jolly', name: 'Jolly', plus: 'spe', minus: 'spa' };
const brave: Nature = { id: 'brave', name: 'Brave', plus: 'atk', minus: 'spe' };
const hardy: Nature = { id: 'hardy', name: 'Hardy', plus: 'atk', minus: 'atk' };

const zero: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

describe('calcStat with Stat Points', () => {
  it('matches the level 50 shortcut: HP = base + SP + 75', () => {
    for (const sp of [0, 1, 2, 16, 32]) {
      expect(
        calcStat(statPoints, { stat: 'hp', base: 95, invested: sp, level: 50, nature: null }),
      ).toBe(95 + sp + 75);
    }
  });

  it('matches the level 50 shortcut for other stats: base + SP + 20, then nature', () => {
    for (const sp of [0, 1, 2, 16, 32]) {
      expect(
        calcStat(statPoints, { stat: 'def', base: 90, invested: sp, level: 50, nature: null }),
      ).toBe(90 + sp + 20);
    }
    // Garchomp, 32 Speed SP, Jolly: floor(154 × 1.1) = 169
    expect(
      calcStat(statPoints, { stat: 'spe', base: 102, invested: 32, level: 50, nature: jolly }),
    ).toBe(169);
    // Brave lowers Speed: floor(60 + 0 + 20) × 0.9 = 72
    expect(
      calcStat(statPoints, { stat: 'spe', base: 60, invested: 0, level: 50, nature: brave }),
    ).toBe(72);
  });

  it('treats neutral natures as no change', () => {
    expect(
      calcStat(statPoints, { stat: 'atk', base: 100, invested: 0, level: 50, nature: hardy }),
    ).toBe(120);
  });
});

describe('calcStat with EVs and IVs', () => {
  it('uses the main-series formula', () => {
    // Garchomp, 252 Speed EVs, 31 IV, Jolly, level 50 → 169
    expect(
      calcStat(evIv, { stat: 'spe', base: 102, invested: 252, iv: 31, level: 50, nature: jolly }),
    ).toBe(169);
    // Incineroar HP, 252 EVs, 31 IV, level 50 → 202
    expect(
      calcStat(evIv, { stat: 'hp', base: 95, invested: 252, iv: 31, level: 50, nature: null }),
    ).toBe(202);
    // Level 100, 0 EVs, 0 IV, base 100 Attack → 205
    expect(
      calcStat(evIv, { stat: 'atk', base: 100, invested: 0, iv: 0, level: 100, nature: null }),
    ).toBe(205);
  });

  it('calculates a whole table', () => {
    const base: StatsTable = { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 };
    const stats = calcStats(statPoints, base, { ...zero, atk: 32, spe: 32, hp: 2 }, 50, jolly);
    expect(stats).toEqual({ hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
  });
});

describe('validateSpread', () => {
  it('accepts a legal Champions spread', () => {
    expect(validateSpread(statPoints, { ...zero, hp: 2, atk: 32, spe: 32 })).toEqual([]);
  });

  it('flags more than 32 in one stat and more than 66 in total', () => {
    expect(validateSpread(statPoints, { ...zero, atk: 33, spe: 32, hp: 2 })).toEqual([
      { code: 'perStatExceeded', stat: 'atk', value: 33, max: 32 },
      { code: 'totalExceeded', total: 67, max: 66 },
    ]);
  });

  it('uses EV limits for the EV/IV profile', () => {
    expect(validateSpread(evIv, { ...zero, atk: 252, spe: 252, hp: 4 })).toEqual([]);
    expect(validateSpread(evIv, { ...zero, atk: 252, spe: 252, hp: 8 })).toEqual([
      { code: 'totalExceeded', total: 512, max: 510 },
    ]);
  });
});

describe('calcMaxPp', () => {
  it('applies the Champions cap and formula', () => {
    expect(calcMaxPp(statPoints, 5)).toBe(8); // Protect
    expect(calcMaxPp(statPoints, 10)).toBe(12);
    expect(calcMaxPp(statPoints, 15)).toBe(16);
    expect(calcMaxPp(statPoints, 35)).toBe(20); // capped at base 20
  });

  it('applies the standard formula', () => {
    expect(calcMaxPp(evIv, 5)).toBe(8);
    expect(calcMaxPp(evIv, 10)).toBe(16);
    expect(calcMaxPp(evIv, 35)).toBe(56);
  });
});
