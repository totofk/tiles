// Pure display helpers for the 🚜 Estate stop (batch 27, task 143). No React, no DOM: every number comes from
// today's core exports, so the sim's pins stay the single source.
import {
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  fieldTileCost,
  harvestBatch,
  machineCost,
  machineMaxTiers,
  machineTilesPerHour,
  marketFactor,
  pipeCost,
  plantBatch,
  type Price,
} from '../core/balance'
import { CROP_IDS, type CropId } from '../core/data/crops'
import { fieldsStats } from '../core/fields'
import type { GameState, Machines } from '../core/state'
import { priceText } from './Mine'
import { shortOf } from './Workshop'

/** the row's ≈💰/h estimate: planted tiles × cycles per hour × (market-priced sale − seed). An estimate — it
 *  ignores stalls, orders and the sickle's doubles, which is why the UI marks it with ≈ */
export function estateCropIncomePerHour(state: GameState, crop: CropId): number {
  const { run, meta } = state
  const planted = run.fields.planted[crop] ?? 0
  const grow = cropGrowTicks(crop, meta, run.upgrades.fertilizer)
  const net = cropSellPrice(crop, meta, run.upgrades.sellPrice) * marketFactor(crop, run.market[crop]) - cropSeedCost(crop, meta)
  return Math.round((planted * 3600 * net) / grow)
}

/** the sum of the rows' ≈💰/h (licensed crops only — an unlicensed crop has no row): the time-to-afford divisor */
export function estateIncomePerHour(state: GameState): number {
  return state.run.licenses.reduce((sum, c) => sum + estateCropIncomePerHour(state, c), 0)
}

/** the ghost row's price: the next ten field tiles together */
export function ghostRowPrice(state: GameState): number {
  const { run, meta } = state
  return Array.from({ length: 10 }, (_, i) => fieldTileCost(run.fields.count + i, meta)).reduce((a, b) => a + b, 0)
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
 * The capacity strip's ONE bottleneck chip (batch 27, task 143c), first match wins:
 * dry pump → stalled pipes → sowing (no seeder) → reaping (no harvester) → land. Each fix that has a price also
 * says when it is affordable: "now", a bar shortfall via shortOf ("needs 8🥉 more"), or the cash gap ÷ the rows'
 * ≈💰/h as "≈~N min" / "≈~N h".
 */
export function estateBottleneck(state: GameState): EstateChip {
  const { run, meta } = state
  const { free, growing, stalled, ready } = fieldsStats(run)
  const afford = (cost: Price): string => {
    const short = shortOf(cost, run)
    if (short.length === 0) return 'now'
    const bars = short.filter((token) => !token.startsWith('💰'))
    if (bars.length > 0) return `needs ${bars.join(', ')} more`
    const hours = estateIncomePerHour(state) > 0 ? (cost.cash - run.cash) / estateIncomePerHour(state) : Infinity
    return hours < 1 ? `≈~${Math.max(1, Math.round((hours * 60)))} min` : `≈~${Math.round(hours)} h`
  }
  // 1. a dry pump pauses all growth
  if (growing > 0 && (run.inventory.coal ?? 0) < 1) return { label: '⚠ Coal — the pump is dry, growth paused', fix: 'mine or buy coal' }
  // 2. tiles beyond the pipes' coverage wait
  if (stalled > 0) {
    const price = pipeCost(run.fields.pipes, meta)
    return { label: `⚠ Pipes — ${stalled} tiles wait`, fix: price ? `Pipes Lv${run.fields.pipes + 1} ${priceText(price)} · ${afford(price)}` : 'max pipes' }
  }
  // 3. free land, no seeder: nothing is being sown
  if (free >= plantBatch() && run.fields.machines.seeder.length === 0) {
    if (run.fields.plantCrop === null) return { label: `⚠ Sowing — ${free} tiles empty`, fix: 'pick a crop to Plant' }
    const tier = cheapestMissingTier(run.fields.machines.seeder, machineMaxTiers('seeder'))
    const cost = machineCost('seeder', tier, meta)
    const fix = run.workers.certificates.includes('plant')
      ? `Seeder Mk${tier} ${priceText(cost)} · ${afford(cost)}`
      : `Seeder Mk${tier} needs the plant certificate`
    return { label: '⚠ Sowing', fix }
  }
  // 4. ready tiles, no harvester to reap them
  if (ready >= harvestBatch() && run.fields.machines.harvester.length === 0) {
    const tier = cheapestMissingTier(run.fields.machines.harvester, machineMaxTiers('harvester'))
    const cost = machineCost('harvester', tier, meta)
    const fix = run.workers.certificates.includes('harvest')
      ? `Harvester Mk${tier} ${priceText(cost)} · ${afford(cost)}`
      : `Harvester Mk${tier} needs the harvest certificate`
    return { label: `⚠ Reaping — ${ready} ready`, fix }
  }
  // 5. nothing blocks: the next land is the move
  const ghost = { cash: ghostRowPrice(state) }
  return { label: '✓ Land — next 10 tiles', fix: `＋10 tiles 💰${ghost.cash} · ${afford(ghost)}` }
}

/** every licensed crop with an Estate row, in CROP_IDS order (task 143a) */
export function estateRowCrops(state: GameState): CropId[] {
  return CROP_IDS.filter((c) => state.run.licenses.includes(c))
}
