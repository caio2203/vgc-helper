import type { AnalysisRules, MetaSnapshot } from '@vgc-helper/data';
import type { DexIndex, RulesContext } from '../context.js';
import { calcStat } from '../stats.js';
import { commonSet, rankedMeta } from './meta.js';
import type { ResolvedSlot } from './resolve.js';

export interface SpeedTick {
  species: string;
  name: string;
  speed: number;
  /** Speed under Tailwind. */
  tailwind: number;
  /** Speed after one stage of speed drop. */
  minusOne: number;
  source: 'team' | 'meta';
  slot: number | null;
  /** Item that changes speed (Choice Scarf), already applied. */
  item: string | null;
  /** Meta usage share; null for the team. */
  usage: number | null;
  /** Share of the meta Pokémon's sets with this item, when the tick is the item variant. */
  itemShare: number | null;
}

export interface SpeedAnalysis {
  ticks: SpeedTick[];
  tailwindMultiplier: number;
  minusOneMultiplier: number;
}

/** Sorted fastest first. Team ticks use the slot's stats; meta ticks the most common spread. */
export function speedTiers(
  team: ResolvedSlot[],
  ctx: RulesContext,
  index: DexIndex,
  meta: MetaSnapshot | null,
  rules: Pick<AnalysisRules, 'speed' | 'thresholds'>,
): SpeedAnalysis {
  const { tailwindMultiplier, minusOneMultiplier, itemMultipliers } = rules.speed;
  const tick = (base: Omit<SpeedTick, 'tailwind' | 'minusOne'>): SpeedTick => ({
    ...base,
    tailwind: Math.floor(base.speed * tailwindMultiplier),
    minusOne: Math.floor(base.speed * minusOneMultiplier),
  });

  const ticks: SpeedTick[] = team.map((s) => {
    const factor = s.item ? (itemMultipliers[s.item] ?? 1) : 1;
    return tick({
      species: s.battle.id,
      name: s.battle.name,
      speed: Math.floor(s.stats.spe * factor),
      source: 'team',
      slot: s.slot,
      item: factor !== 1 ? s.item : null,
      usage: null,
      itemShare: null,
    });
  });

  if (meta) {
    for (const entry of rankedMeta(meta, index).slice(0, rules.thresholds.speedTierCount)) {
      const set = commonSet(entry, index);
      if (!set) continue;
      const nature = set.nature ? (index.natures.get(set.nature) ?? null) : null;
      const speed = calcStat(ctx.profile, {
        stat: 'spe',
        base: set.species.baseStats.spe,
        invested: set.spread.spe,
        level: ctx.format.level,
        nature,
      });
      const common = {
        species: set.species.id,
        name: set.species.name,
        source: 'meta' as const,
        slot: null,
        usage: entry.usage,
      };
      ticks.push(tick({ ...common, speed, item: null, itemShare: null }));
      for (const [item, factor] of Object.entries(itemMultipliers)) {
        const share = entry.items.find((i) => i.id === item)?.share ?? 0;
        if (share < rules.thresholds.speedItemShare) continue;
        ticks.push(tick({ ...common, speed: Math.floor(speed * factor), item, itemShare: share }));
      }
    }
  }

  ticks.sort((a, b) => b.speed - a.speed || (a.source === 'team' ? -1 : 1));
  return { ticks, tailwindMultiplier, minusOneMultiplier };
}
