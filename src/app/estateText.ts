// Pure display helpers for the 🚜 Estate stop (batch 27, task 143). No React, no DOM: every number comes from
// today's core exports, so the sim's pins stay the single source.
import {
  FIELD_PRESSURE,
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  fieldPlots,
  fieldsCropHarvests,
  machineCost,
  machineMaxTiers,
  machineTilesPerHour,
  pivotCost,
  plotCost,
  plotTiles,
  pumpCost,
  pumpFieldCap,
  workerWage,
  type Price,
} from '../core/balance'
import { CROPS, type CropId } from '../core/data/crops'
import {
  buyPlot,
  fieldsCropIncomeCurve,
  fieldsOverview,
  fieldsPlantable,
  fieldsPressure,
  nextReapTarget,
  nextSowTarget,
  pivotsOwned,
  plotState,
  pressuredCycle,
} from '../core/fields'
import { isOffer } from '../core/orders'
import { cropFactor } from './marketText'
import { managerPlan } from '../core/manager'
import { workerUnpaid } from '../core/workers'
import type { GameState, Machines } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
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
  const net = cropSellPrice(crop, meta, run.upgrades.sellPrice) * cropFactor(state, crop) - cropSeedCost(crop, meta)
  return Math.round((planted * 3600 * net) / cycle)
}

/**
 * Field k's crop picker option: the current chip short (its numbers are the row's small line); another plantable
 * crop with its marginal ≈💰/h on THIS field and today's market factor; a licensed crop under the 🏡 gate its progress
 */
export function cropOptionText(state: GameState, k: number, crop: CropId): string {
  const { run } = state
  const name = `${CROP_EMOJI[crop]} ${CROPS[crop].name}`
  if (!fieldsPlantable(run, crop)) return `${name} · 🏡 ${run.lifetime.harvests[crop] ?? 0}/${fieldsCropHarvests()}`
  const list = run.fields.list
  if (list[k].crop === crop) return name
  const others = list.reduce((n, f, i) => (i !== k && f.pivot && f.crop === crop ? n + f.plots.length * plotTiles() : n), 0)
  const income = fieldsCropIncomeCurve(state, crop)
  const m = Math.round(income(others + list[k].plots.length * plotTiles()) - income(others))
  return `${name} · ≈💰${m}/h · ×${cropFactor(state, crop).toFixed(2)}`
}

/** the 💼 Manager row's plan line: "🍓 ×3 fields → order 2 · 🍋 rest" */
export function managerPlanText(state: GameState): string {
  const { contracts, rest } = managerPlan(state)
  const parts = [
    ...contracts.map(({ crop, fields, slot }) => `${CROP_EMOJI[crop]} ×${fields.length} field${fields.length === 1 ? '' : 's'} → order ${slot + 1}`),
    ...(rest.length === 1 ? [`${CROP_EMOJI[rest[0].crop]} rest`] : rest.map(({ crop, fields }) => `${CROP_EMOJI[crop]} ×${fields.length}`)),
  ]
  return parts.length > 0 ? parts.join(' · ') : 'no wet fields to manage'
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

/** a short cash figure for a 52 px cell: 9999 · 386k · 1.2M */
export function compactCash(n: number): string {
  if (n < 10_000) return `${n}`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1e6).toFixed(1)}M`
}

export type PlotCellKind = 'empty' | 'dry' | 'growing' | 'ready' | 'ghost' | 'none'
export type PlotCellView = { kind: PlotCellKind; emoji: string; pct: number; label: string; marker: boolean; ordered: boolean }

const same = (at: [number, number] | null, k: number, j: number) => at !== null && at[0] === k && at[1] === j

/**
 * The Estate map's cell j of field k (batch 30, task 152c): an owned plot (empty / dry / growing / ready), the ghost
 * slot buyPlot fills next, or a blank slot after it. `marker` = the machine fleet works this plot next.
 */
export function plotCellView(state: GameState, k: number, j: number): PlotCellView {
  const { run } = state
  const field = run.fields.list[k]
  const plot = field.plots[j]
  const at = `Field ${k + 1} plot ${j + 1}`
  if (!plot) {
    const ghostField = run.fields.list.findIndex((f) => f.plots.length < fieldPlots())
    if (ghostField !== k || j !== field.plots.length) return { kind: 'none', emoji: '', pct: 0, label: '', marker: false, ordered: false }
    return { kind: 'ghost', emoji: '', pct: 0, label: `Buy plot ${j + 1} of Field ${k + 1} · 💰${ghostRowPrice(state)} · ${plotTiles()} tiles`, marker: false, ordered: false }
  }
  const m = run.fields.machines
  const sowNextHere = m.seeder.length > 0 && same(nextSowTarget(run.fields), k, j)
  const reapNextHere = m.harvester.length > 0 && same(nextReapTarget(run), k, j)
  const marker = sowNextHere || reapNextHere
  const tail = marker ? ' · 🚜 next' : ''
  if (plot.crop === null) {
    if (!field.pivot) return { kind: 'dry', emoji: '', pct: 0, label: `${at} · no pivot${tail}`, marker, ordered: false }
    return { kind: 'empty', emoji: '', pct: 0, label: `${at} · empty — sow${tail}`, marker, ordered: false }
  }
  const crop = plot.crop
  const name = CROPS[crop].name
  const emoji = CROP_EMOJI[crop]
  if (plotState(plot, run.tick) === 'ready') {
    const ordered = run.orders.offers.some((s) => isOffer(s) && s.accepted && s.done < s.count && s.good === crop)
    return { kind: 'ready', emoji, pct: 1, label: `${at} · ${name} ready — reap ⚡10${tail}`, marker, ordered }
  }
  const left = plot.readyTick - run.tick
  const pct = Math.min(1, Math.max(0, 1 - left / pressuredCycle(state, crop)))
  return { kind: 'growing', emoji, pct, label: `${at} · ${name} ${Math.round(pct * 100)} % · ripe in ${nextReadyText(left)}${tail}`, marker, ordered: false }
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
 * → a dry field → no crop picked (batch 29: none the 💼 Manager will pick) → the Manager unpaid → sowing (no seeder) → reaping (no harvester) → the pump → land. Each fix that has a
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
  // 3. empty plots in a pivoted field with no crop picked, that no working 💼 Manager will pick (batch 29)
  const managed = run.workers.assigned.manager > 0
  const waits = (field: (typeof f.list)[number]) => field.pivot && field.crop === null && field.plots.some((p) => p.crop === null)
  const unpicked = f.list.findIndex((field) => waits(field) && (field.pinned || !managed))
  if (unpicked >= 0)
    return {
      label: `⚠ Sowing — Field ${unpicked + 1} waits for a crop`,
      fix: run.workers.certificates.includes('manager') ? 'pick a crop or assign the 💼 Manager' : 'pick a crop',
    }
  const unpaid = managed && workerUnpaid(state, 'manager') ? f.list.findIndex((field) => waits(field) && !field.pinned) : -1
  if (unpaid >= 0) return { label: `⚠ Manager unpaid — Field ${unpaid + 1} waits`, fix: `needs 💰${workerWage(meta, 'manager')} per change` }
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
