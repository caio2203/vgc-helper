import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import type { TeamSlot } from '@vgc-helper/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DexIndex, RulesContext } from '../context.js';
import { parsePaste } from '../paste.js';
import { loadAnalysis } from '../test-support/snapshot.js';
import { commonSetTool, legalityTool, summarizeTeam, usageTool } from './summary.js';

let ctx: RulesContext;
let index: DexIndex;
let rules: AnalysisRules;
let meta: MetaSnapshot;
let team: TeamSlot[];
beforeAll(async () => {
  ({ ctx, index, rules, meta } = await loadAnalysis());
  // Three members weak to Ground, and one illegal move.
  team = parsePaste(
    `Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 32 HP / 2 Def / 32 SpD
Careful Nature
- Fake Out
- Flare Blitz
- Parting Shot
- Spore

Kingambit @ Black Glasses
Ability: Defiant
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect

Archaludon @ Leftovers
Ability: Stamina
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Electro Shot
- Draco Meteor
- Flash Cannon
- Protect`,
    index,
  ).slots;
});

describe('summarizeTeam', () => {
  it('gives the model names, percentages and the engine conclusions, with sources', () => {
    const summary = summarizeTeam(team, ctx, index, rules, meta, { cutoff: 0.04, offMeta: false });
    expect(summary.team.map((m) => m.species)).toEqual(['Incineroar', 'Kingambit', 'Archaludon']);
    expect(summary.legality).toContainEqual(
      expect.objectContaining({ code: 'moveNotLearnable', move: 'Spore', slot: 1 }),
    );
    const ground = summary.stackedWeaknesses.find((w) => w.type === 'Ground');
    expect(ground?.weakMembers).toEqual(['Incineroar', 'Kingambit', 'Archaludon']);
    expect(summary.suggestions.length).toBeGreaterThan(0);
    expect(summary.metaThreats.length).toBeGreaterThan(0);
    expect(summary.sources.map((s) => s.data)).toEqual(['game data', 'usage']);
    // Shares are percentages for the model, ids are names.
    for (const s of summary.suggestions) expect(s.usagePercent).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(summary)).not.toContain('"incineroar"');
  });
});

describe('tools', () => {
  it('report usage and rank from the snapshot', () => {
    const top = meta.pokemon.slice().sort((a, b) => b.usage - a.usage)[0];
    const name = index.species.get(top?.species ?? '')?.name ?? '';
    expect(usageTool(meta, index, name)).toMatchObject({ found: true, rank: 1, species: name });
    expect(usageTool(meta, index, 'Not A Pokemon')).toMatchObject({ found: false });
  });

  it('give the common set with shares', () => {
    const set = commonSetTool(meta, index, 'Incineroar');
    expect(set).toMatchObject({ found: true, species: 'Incineroar', period: meta.period });
    expect(set.found ? set.moves?.[0]?.percent : 0).toBeGreaterThan(0);
  });

  it('check a set against the regulation', () => {
    expect(legalityTool(ctx, index, { species: 'Incineroar', moves: ['Fake Out'] })).toMatchObject({
      legal: true,
    });
    const bad = legalityTool(ctx, index, { species: 'Incineroar', moves: ['Spore'] });
    expect(bad.legal).toBe(false);
    expect(bad.issues).toContainEqual(expect.objectContaining({ move: 'Spore' }));
  });
});
