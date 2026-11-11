// Pure display helpers for the 🚜 Estate stop (batch 27, task 143). No React, no DOM: every number comes from
// today's core exports, so the sim's pins stay the single source.
import {
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  machineCost,
  machineMaxTiers,
  machineTilesPerHour,
  marketFactor,
  plotCost,
  type Price,
} from '../core/balance'
import type { CropId } from '../core/data/crops'
import { fieldsOverview, plantedTiles } from '../core/fields'
import type { GameState, Machines } from '../core/state'
import { priceText } from './Mine'
import { shortOf } from './Workshop'

/** the row's ≈💰/h estimate: planted tiles × cycles per hour × (market-priced sale − seed). An estimate — it
 *  ignores pressure, orders and the sickle's doubles, which is why the UI marks it with ≈ */
export function estateCropIncomePerHour(state: GameState, crop: CropId): number {
  const { run, meta } = state
  const planted = plantedTiles(run.fields, crop)
  const grow = cropGrowTicks(crop, meta, run.upgrades.fertilizer)
  const net = cropSellPrice(crop, meta, run.upgrades.sellPrice) * marketFactor(crop, run.market[crop]) - cropSeedCost(crop, meta)
  return Math.round((planted * 3600 * net) / grow)
}

/** the sum of the rows' ≈💰/h (licensed crops only — an unlicensed crop has no row): the time-to-afford divisor */
export function estateIncomePerHour(state: GameState): number {
  return state.run.licenses.reduce((sum, c) => sum + estateCropIncomePerHour(state, c), 0)
}

/** the ghost row's price: the next plot */
export function ghostRowPrice(state: GameState): number {
  return plotCost(fieldsOverview(state.run).plots, state.meta)
}

/** "next in 3m" / "next in 2h": the nearest ripening, as text (ticks are seconds) */
export function nextReadyText(ticks: number): string {
  return ticks < 3600 ? `${Math.max(1, Math.round(ticks / 60))}m` : `${Math.round(ticks / 3600)}h`
}

/** the fleet's whole tiles per hour over the owned tiers (0 with no machine) */
export function fleetTilesPerHour(machines: Machines, kind: 'harvester' | 'seeder'): number {
  return machines[kind].reduce((rate, tier) => rate + machineTilesPerHour(kind, tier), 0)
}

/** the cheapest tier of `max` not in `owned` (branch 3/4 always enter with none owned, so this is tier 1) */
function cheapestMissingTier(owned: readonly number[], max: number): number {
  return Array.from({ length: max }, (_, i) => i + 1).find((t) => !owned.includes(t)) ?? max
}

export type EstateChip = { label: string; fix: string }

/**
 * The capacity strip's ONE bottleneck chip (batch 27, task 143c; a plots stopgap until task 148 adds pressure, dry
 * fields and the pump), first match wins: no crop picked → sowing (no seeder) → reaping (no harvester) → land. Each
 * fix that has a price also says when it is affordable: "now", a bar shortfall via shortOf ("needs 8🥉 more"), or the
 * cash gap ÷ the rows' ≈💰/h as "≈~N min" / "≈~N h".
 */
export function estateBottleneck(state: GameState): EstateChip {
  const { run, meta } = state
  const { emptyWet, ready } = fieldsOverview(run)
  const afford = (cost: Price): string => {
    const short = shortOf(cost, run)
    if (short.length === 0) return 'now'
    const bars = short.filter((token) => !token.startsWith('💰'))
    if (bars.length > 0) return `needs ${bars.join(', ')} more`
    const hours = estateIncomePerHour(state) > 0 ? (cost.cash - run.cash) / estateIncomePerHour(state) : Infinity
    return hours < 1 ? `≈~${Math.max(1, Math.round((hours * 60)))} min` : `≈~${Math.round(hours)} h`
  }
  // 1. empty plots in a pivoted field with no crop picked
  const unpicked = run.fields.list.findIndex((f) => f.pivot && f.crop === null && f.plots.some((p) => p.crop === null))
  if (unpicked >= 0) return { label: `⚠ Sowing — pick a crop for Field ${unpicked + 1}`, fix: 'pick a crop' }
  // 2. sowable plots, no seeder: nothing is being sown
  if (emptyWet >= 1 && run.fields.machines.seeder.length === 0) {
    const tier = cheapestMissingTier(run.fields.machines.seeder, machineMaxTiers('seeder'))
    const cost = machineCost('seeder', tier, meta)
    const fix = run.workers.certificates.includes('plant')
      ? `Seeder Mk${tier} ${priceText(cost)} · ${afford(cost)}`
      : `Seeder Mk${tier} needs the plant certificate`
    return { label: '⚠ Sowing', fix }
  }
  // 3. ready plots, no harvester to reap them
  if (ready >= 1 && run.fields.machines.harvester.length === 0) {
    const tier = cheapestMissingTier(run.fields.machines.harvester, machineMaxTiers('harvester'))
    const cost = machineCost('harvester', tier, meta)
    const fix = run.workers.certificates.includes('harvest')
      ? `Harvester Mk${tier} ${priceText(cost)} · ${afford(cost)}`
      : `Harvester Mk${tier} needs the harvest certificate`
    return { label: `⚠ Reaping — ${ready} ready`, fix }
  }
  // 4. nothing blocks: the next land is the move
  const ghost = { cash: ghostRowPrice(state) }
  return { label: '✓ Land — next plot', fix: `＋ Plot 💰${ghost.cash} · ${afford(ghost)}` }
}
