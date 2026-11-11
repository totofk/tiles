// Pure display helpers for the 🚜 Estate stop (batch 27, task 143). No React, no DOM: every number comes from
// today's core exports, so the sim's pins stay the single source.
import {
  FIELD_PRESSURE,
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  machineCost,
  machineMaxTiers,
  machineTilesPerHour,
  marketFactor,
  pivotCost,
  plotCost,
  plotTiles,
  pumpCost,
  pumpFieldCap,
  type Price,
} from '../core/balance'
import { buyPlot, fieldsOverview, fieldsPressure, pivotsOwned } from '../core/fields'
import type { GameState, Machines } from '../core/state'
import { priceText } from './Mine'
import { shortOf } from './Workshop'

/** field k's row ≈💰/h: its chip crop's planted tiles × pressured cycles per hour × (market-priced sale − seed). An
 *  estimate — it ignores an empty tank, orders and the sickle's doubles, which is why the UI marks it with ≈ */
export function estateCropIncomePerHour(state: GameState, k: number): number {
  const { run, meta } = state
  const { crop, plots } = run.fields.list[k]
  if (!crop) return 0
  const planted = plots.filter((p) => p.crop === crop).length * plotTiles()
  const cycle = Math.ceil(cropGrowTicks(crop, meta, run.upgrades.fertilizer) / FIELD_PRESSURE)
  const net = cropSellPrice(crop, meta, run.upgrades.sellPrice) * marketFactor(crop, run.market[crop]) - cropSeedCost(crop, meta)
  return Math.round((planted * 3600 * net) / cycle)
}

/** the sum of the field rows' ≈💰/h: the time-to-afford divisor */
export function estateIncomePerHour(state: GameState): number {
  return state.run.fields.list.reduce((sum, _, k) => sum + estateCropIncomePerHour(state, k), 0)
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
 * The capacity strip's ONE bottleneck chip (batch 27, task 143c; batch 28, task 148b), first match wins: pressure off
 * → a dry field → no crop picked → sowing (no seeder) → reaping (no harvester) → the pump → land. Each fix that has a
 * price also says when it is affordable: "now", a bar shortfall via shortOf ("needs 8🥉 more"), or the cash gap ÷ the
 * rows' ≈💰/h as "≈~N min" / "≈~N h".
 */
export function estateBottleneck(state: GameState): EstateChip {
  const { run, meta } = state
  const f = run.fields
  const { emptyWet, ready, growing } = fieldsOverview(run)
  const afford = (cost: Price): string => {
    const short = shortOf(cost, run)
    if (short.length === 0) return 'now'
    const bars = short.filter((token) => !token.startsWith('💰'))
    if (bars.length > 0) return `needs ${bars.join(', ')} more`
    const hours = estateIncomePerHour(state) > 0 ? (cost.cash - run.cash) / estateIncomePerHour(state) : Infinity
    return hours < 1 ? `≈~${Math.max(1, Math.round((hours * 60)))} min` : `≈~${Math.round(hours)} h`
  }
  // 1. the tank cannot pay the burn: every growing plot is at ×1
  if (growing >= 1 && !fieldsPressure(run))
    return { label: '⚠ Pressure off ×1 — tank empty', fix: (run.inventory.coal ?? 0) >= 1 ? 'Fill tank' : 'mine coal' }
  // 2. a field holding plots has no pivot (only while the pump has a pivot left to give)
  const dry = f.list.findIndex((field) => !field.pivot && field.plots.length > 0)
  if (dry >= 0 && pivotsOwned(f) < pumpFieldCap(f.pump)) {
    const cost = pivotCost(pivotsOwned(f) + 1, meta)
    return { label: `⚠ Dry — Field ${dry + 1} has no pivot`, fix: `Pivot ${priceText(cost)} · ${afford(cost)}` }
  }
  // 3. empty plots in a pivoted field with no crop picked
  const unpicked = f.list.findIndex((field) => field.pivot && field.crop === null && field.plots.some((p) => p.crop === null))
  if (unpicked >= 0) return { label: `⚠ Sowing — pick a crop for Field ${unpicked + 1}`, fix: 'pick a crop' }
  // 4. sowable plots, no seeder: nothing is being sown
  if (emptyWet >= 1 && run.fields.machines.seeder.length === 0) {
    const tier = cheapestMissingTier(run.fields.machines.seeder, machineMaxTiers('seeder'))
    const cost = machineCost('seeder', tier, meta)
    const fix = run.workers.certificates.includes('plant')
      ? `Seeder Mk${tier} ${priceText(cost)} · ${afford(cost)}`
      : `Seeder Mk${tier} needs the plant certificate`
    return { label: '⚠ Sowing', fix }
  }
  // 5. ready plots, no harvester to reap them
  if (ready >= 1 && run.fields.machines.harvester.length === 0) {
    const tier = cheapestMissingTier(run.fields.machines.harvester, machineMaxTiers('harvester'))
    const cost = machineCost('harvester', tier, meta)
    const fix = run.workers.certificates.includes('harvest')
      ? `Harvester Mk${tier} ${priceText(cost)} · ${afford(cost)}`
      : `Harvester Mk${tier} needs the harvest certificate`
    return { label: `⚠ Reaping — ${ready} ready`, fix }
  }
  // 6. the next plot needs a field the pump cannot water
  const plot = buyPlot(state)
  if (!plot.ok && plot.error === 'PUMP_FULL') {
    const cost = pumpCost(f.pump, meta)
    return { label: `⚠ Pump — Field ${f.list.length + 1} needs Pump Lv${f.pump + 1}`, fix: cost ? `${priceText(cost)} · ${afford(cost)}` : 'max pump' }
  }
  // 7. nothing blocks: the next land is the move
  const ghost = { cash: ghostRowPrice(state) }
  return { label: '✓ Land — next plot', fix: `＋ Plot 💰${ghost.cash} · ${afford(ghost)}` }
}
