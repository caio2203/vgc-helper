import { describe, expect, it } from 'vitest';
import { parsePaste } from '../paste.js';
import { loadAnalysis } from '../test-support/snapshot.js';
import { analyzeTeam } from './analyze.js';

/** A Singles core with a setup sweeper, a fast attacker and a recovery wall, but no hazards. */
const PASTE = `Dragonite @ Lum Berry
Ability: Multiscale
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Fire Punch

Hippowdon @ Leftovers
Ability: Sand Stream
EVs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Slack Off
- Earthquake
- Whirlwind
- Yawn

Gholdengo @ Choice Scarf
Ability: Good as Gold
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Trick
- Focus Blast`;

async function analyze(formatId: string, paste = PASTE) {
  const { ctx, index, rules, meta } = await loadAnalysis(formatId);
  const slots = parsePaste(paste, index).slots;
  return analyzeTeam(slots, ctx, index, rules, meta, {
    cutoff: ctx.format.viability.defaultCutoff,
    offMeta: false,
  });
}

describe('Singles profile', () => {
  it('checks hazards, removal, pivots, win conditions, wallbreakers and walls, not Fake Out', async () => {
    const { checklist } = await analyze('champions-singles');
    const groups = Object.fromEntries(checklist.groups.map((g) => [g.group, g.filled]));
    expect(Object.keys(groups)).toEqual([
      'hazards',
      'hazardRemoval',
      'pivot',
      'winCondition',
      'wallbreaker',
      'wall',
      'priority',
    ]);
    // Dragon Dance, Gholdengo's 133 Sp. Atk, Slack Off and Extreme Speed are in place.
    expect(groups).toMatchObject({
      winCondition: true,
      wallbreaker: true,
      wall: true,
      priority: true,
    });
    expect(checklist.missing).toEqual(['hazards', 'hazardRemoval', 'pivot']);
  });

  it('suggests a Pokémon that brings the missing hazards', async () => {
    const { suggestions } = await analyze('champions-singles');
    const hazardSetters = suggestions.filter((s) =>
      s.parts.some((p) => p.criterion === 'fillsRole' && p.groups.includes('hazards')),
    );
    expect(hazardSetters.length).toBeGreaterThan(0);
  });

  it('keeps the Doubles checklist for VGC', async () => {
    const { checklist } = await analyze('champions-vgc');
    expect(checklist.groups.map((g) => g.group)).toContain('fakeOut');
    expect(checklist.groups.map((g) => g.group)).not.toContain('wall');
  });

  it('reads three slow attackers as Trick Room only in Doubles', async () => {
    const slow = `Kingambit
- Kowtow Cleave

Conkeldurr
- Mach Punch

Hatterene
- Dazzling Gleam`;
    const doubles = await analyze('champions-vgc', slow);
    const singles = await analyze('champions-singles', slow);
    expect(doubles.archetypes.map((a) => a.id)).toContain('trickRoom');
    expect(singles.archetypes.map((a) => a.id)).not.toContain('trickRoom');
  });
});
