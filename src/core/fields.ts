// The 🚜 Fields (batch 18; plots, pivots and pumps since batch 28, DECISIONS "Batch 28 refined"): the earned late game
// beside the home plot. Land is bought a plot (ten tiles) at a time into fields of five; a field is sown only once its
// pivot is built, and only with its chip's crop — seeders and planters never pick one. Every piece of work is a whole
// plot: sow, reap (by hand, worker or machine). A plot ripens on its absolute readyTick; nothing ever stalls or dies.
// Harvests sell through harvestSale exactly like home-plot harvests (accepted orders first, then the market).
import { fail, nextRandom, withRun, type ActionResult } from './actions'
import {
  FIELD_PRESSURE,
  TANK_UNITS_PER_COAL,
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  doubleHarvestChance,
  fieldPlots,
  fieldsCost,
  fieldsCropHarvests,
  handPickedBonus,
  machineCost,
  machineMaintPerHour,
  machineTilesPerHour,
  marketFactor,
  pivotCost,
  plotCost,
  plotTiles,
  pumpCost,
  pumpFieldCap,
  reapPlotEnergy,
  seedKeepChance,
  tankCapCoal,
  type MachineKind,
} from './balance'
import { CROP_IDS, type CropId } from './data/crops'
import { harvestSale } from './orders'
import { pay } from './mining'
import { marketSteadyGlut } from './market'
import type { Field, Fields, GameState, Machines, Plot, RunState } from './state'

export type PlotState = 'empty' | 'growing' | 'ready'

export function plotState(plot: Plot, tick: number): PlotState {
  return plot.crop === null ? 'empty' : plot.readyTick <= tick ? 'ready' : 'growing'
}

const emptyPlot = (): Plot => ({ crop: null, readyTick: 0 })

function plotsOwned(f: Fields): number {
  return f.list.reduce((n, field) => n + field.plots.length, 0)
}

export function pivotsOwned(f: Fields): number {
  return f.list.reduce((n, field) => (field.pivot ? n + 1 : n), 0)
}

/** tiles of `crop` standing in the Fields (growing or ready): 10 × its plots */
export function plantedTiles(f: Fields, crop: CropId): number {
  let n = 0
  for (const field of f.list) for (const p of field.plots) if (p.crop === crop) n++
  return n * plotTiles()
}

/** Σ over pivoted fields of their bought tiles (planted or not) */
export function wetTiles(f: Fields): number {
  return f.list.reduce((n, field) => (field.pivot ? n + field.plots.length * plotTiles() : n), 0)
}

/** a field plot's grow ticks under pressure: ceil(grow / FIELD_PRESSURE) */
export function pressuredCycle(state: GameState, crop: CropId): number {
  return Math.ceil(cropGrowTicks(crop, state.meta, state.run.upgrades.fertilizer) / FIELD_PRESSURE)
}

/** counts of plots for the UI and sim; emptyWet = empty plots in a field with a pivot and a chip (sowable now) */
export function fieldsOverview(run: RunState): {
  plots: number
  tiles: number
  fields: number
  wetFields: number
  empty: number
  emptyWet: number
  growing: number
  ready: number
} {
  let plots = 0
  let wetFields = 0
  let empty = 0
  let emptyWet = 0
  let growing = 0
  let ready = 0
  for (const field of run.fields.list) {
    if (field.pivot) wetFields++
    for (const p of field.plots) {
      plots++
      const st = plotState(p, run.tick)
      if (st === 'empty') {
        empty++
        if (field.pivot && field.crop !== null) emptyWet++
      } else if (st === 'growing') growing++
      else ready++
    }
  }
  return { plots, tiles: plots * plotTiles(), fields: run.fields.list.length, wetFields, empty, emptyWet, growing, ready }
}

function withPlot(f: Fields, field: number, plot: number, next: Plot): Fields {
  return { ...f, list: f.list.map((x, i) => (i === field ? { ...x, plots: x.plots.map((p, j) => (j === plot ? next : p)) } : x)) }
}

const isIndex = (i: number, length: number) => Number.isInteger(i) && i >= 0 && i < length

/** the unlock's gates: planter and harvester certificates owned, watering covered by ≥ 1 bed sprinkler */
export function fieldsGates(run: RunState): { plant: boolean; harvest: boolean; water: boolean } {
  return {
    plant: run.workers.certificates.includes('plant'),
    harvest: run.workers.certificates.includes('harvest'),
    water: run.workshop.built && run.workshop.beds.some(Boolean),
  }
}

/** every farm job covered by worker or machine */
export const fieldsUnlockable = (run: RunState): boolean => {
  const g = fieldsGates(run)
  return g.plant && g.harvest && g.water
}

/** a crop is fields-plantable with its license and FIELDS_CROP_HARVESTS home-plot harvests of it */
export function fieldsPlantable(run: RunState, crop: CropId): boolean {
  return run.licenses.includes(crop) && (run.lifetime.harvests[crop] ?? 0) >= fieldsCropHarvests()
}

// Order: LOCKED, ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH. Field 1, its pivot and plot 1 come with the Tractor.
export function unlockFields(state: GameState): ActionResult {
  const { run } = state
  if (!fieldsUnlockable(run)) return fail('LOCKED')
  if (run.fields.unlocked) return fail('ALREADY_OWNED')
  const first: Field = { pivot: true, crop: null, pinned: false, plots: [emptyPlot()] }
  return pay(state, fieldsCost(state.meta), { fields: { ...run.fields, unlocked: true, list: [first] } })
}

// Order: LOCKED, PUMP_FULL, NO_CASH. The plot goes into the first field with room; with none it opens a new field,
// allowed only below the pump's field cap.
export function buyPlot(state: GameState): ActionResult {
  const { run } = state
  const f = run.fields
  if (!f.unlocked) return fail('LOCKED')
  const at = f.list.findIndex((x) => x.plots.length < fieldPlots())
  if (at < 0 && f.list.length >= pumpFieldCap(f.pump)) return fail('PUMP_FULL')
  const cost = plotCost(plotsOwned(f), state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  const list =
    at >= 0
      ? f.list.map((x, i) => (i === at ? { ...x, plots: [...x.plots, emptyPlot()] } : x))
      : [...f.list, { pivot: false, crop: null, pinned: false, plots: [emptyPlot()] }]
  return withRun(state, { cash: run.cash - cost, fields: { ...f, list } })
}

// Order: LOCKED, BAD_TILE (no such field), ALREADY_OWNED, PUMP_FULL (pivots at the pump's cap), NOT_ENOUGH_ITEMS,
// NO_CASH. Permanent.
export function buildPivot(state: GameState, field: number): ActionResult {
  const { run } = state
  const f = run.fields
  if (!f.unlocked) return fail('LOCKED')
  if (!isIndex(field, f.list.length)) return fail('BAD_TILE')
  if (f.list[field].pivot) return fail('ALREADY_OWNED')
  const owned = pivotsOwned(f)
  if (owned >= pumpFieldCap(f.pump)) return fail('PUMP_FULL')
  return pay(state, pivotCost(owned + 1, state.meta), {
    fields: { ...f, list: f.list.map((x, i) => (i === field ? { ...x, pivot: true } : x)) },
  })
}

// Order: LOCKED, NO_WORKSHOP, MAX_LEVEL, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyPump(state: GameState): ActionResult {
  const { run } = state
  if (!run.fields.unlocked) return fail('LOCKED')
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  const cost = pumpCost(run.fields.pump, state.meta)
  if (!cost) return fail('MAX_LEVEL')
  return pay(state, cost, { fields: { ...run.fields, pump: run.fields.pump + 1 } })
}

// The field's chip: what gets sown there next (null = nothing). Free; standing plots finish as they are.
// Order: LOCKED, BAD_TILE, NOTHING_TO_DO (same as the chip), NO_LICENSE, LOCKED (not fields-plantable).
export function setFieldCrop(state: GameState, field: number, crop: CropId | null): ActionResult {
  const { run } = state
  const f = run.fields
  if (!f.unlocked) return fail('LOCKED')
  if (!isIndex(field, f.list.length)) return fail('BAD_TILE')
  if (f.list[field].crop === crop) return fail('NOTHING_TO_DO')
  if (crop !== null && !run.licenses.includes(crop)) return fail('NO_LICENSE')
  if (crop !== null && !fieldsPlantable(run, crop)) return fail('LOCKED')
  return withRun(state, { fields: { ...f, list: f.list.map((x, i) => (i === field ? { ...x, crop } : x)) } })
}

// 📌 toggles the field's pin (the 💼 Manager never writes a pinned field). Free. Order: LOCKED, BAD_TILE.
export function pinField(state: GameState, field: number): ActionResult {
  const f = state.run.fields
  if (!f.unlocked) return fail('LOCKED')
  if (!isIndex(field, f.list.length)) return fail('BAD_TILE')
  return withRun(state, { fields: { ...f, list: f.list.map((x, i) => (i === field ? { ...x, pinned: !x.pinned } : x)) } })
}

/**
 * Steady net 💰/h that `tiles` field tiles of `crop` add on the pressured cycle (batch 29, the Manager's plan and the
 * crop picker): the home lot's tiles of that crop share the market, and the home-only income is subtracted. No live
 * glut, so the plan never chases its own sales. Unrounded.
 */
export function fieldsCropIncomePerHour(state: GameState, crop: CropId, tiles: number): number {
  return fieldsCropIncomeCurve(state, crop)(tiles)
}

/** fieldsCropIncomePerHour for one crop as a function of `tiles`, its constants computed once (the Manager's DP) */
export function fieldsCropIncomeCurve(state: GameState, crop: CropId): (tiles: number) => number {
  const { run, meta } = state
  const fc = pressuredCycle(state, crop)
  const hc = cropGrowTicks(crop, meta, run.upgrades.fertilizer)
  const home = run.tiles.filter((t) => t.cropId === crop).length
  const sell = cropSellPrice(crop, meta, run.upgrades.sellPrice)
  const seed = cropSeedCost(crop, meta)
  const homeGlut = marketSteadyGlut(home, hc)
  const income = (T: number) => (T / fc + home / hc) * 3600 * (sell * marketFactor(crop, marketSteadyGlut(T, fc) + homeGlut) - seed)
  const base = income(0)
  return (tiles) => income(tiles) - base
}

/**
 * Sows one whole plot with its field's chip crop. All-or-nothing: ten seeds in the pouch, or auto-buy on and the cash
 * for the missing ones; then the dibber's seed-keep rolls per tile (only above the basic tier). No energy. The plot
 * ripens in ceil(grow / FIELD_PRESSURE) ticks — the tank's pressure keeps that pace (task 147).
 * Order: LOCKED, BAD_TILE, NO_PIVOT, NO_CROP, NOTHING_TO_DO (plot not empty), NO_SEEDS, NO_CASH.
 */
export function sowPlot(state: GameState, field: number, plot: number): ActionResult {
  const { run, meta } = state
  const f = run.fields
  if (!f.unlocked) return fail('LOCKED')
  if (!isIndex(field, f.list.length) || !isIndex(plot, f.list[field].plots.length)) return fail('BAD_TILE')
  const { pivot, crop } = f.list[field]
  if (!pivot) return fail('NO_PIVOT')
  if (crop === null) return fail('NO_CROP')
  if (f.list[field].plots[plot].crop !== null) return fail('NOTHING_TO_DO')
  const tiles = plotTiles()
  const price = cropSeedCost(crop, meta)
  const stock = run.seeds[crop] ?? 0
  if (stock < tiles && !run.autoBuySeeds) return fail('NO_SEEDS')
  if (stock < tiles && run.cash < (tiles - stock) * price) return fail('NO_CASH')
  let { cash, rngState } = run
  let left = stock
  for (let k = 0; k < tiles; k++) {
    // the dibber's seed-keep, per tile, rolled only above the basic tier (tier-0 runs keep their exact sequence)
    const [r, next] = run.toolTier.plant > 0 ? nextRandom(rngState) : [1, rngState]
    rngState = next
    if (r < seedKeepChance(run.toolTier.plant)) continue
    if (left > 0) left--
    else cash -= price
  }
  const readyTick = run.tick + pressuredCycle(state, crop)
  return withRun(state, { cash, rngState, seeds: { ...run.seeds, [crop]: left }, fields: withPlot(f, field, plot, { crop, readyTick }) })
}

/** the first empty plot in a field with a pivot and a chip (fields in order, plots in order); null = nothing to sow */
export function nextSowTarget(f: Fields): [number, number] | null {
  for (let i = 0; i < f.list.length; i++) {
    const field = f.list[i]
    if (!field.pivot || field.crop === null) continue
    const j = field.plots.findIndex((p) => p.crop === null)
    if (j >= 0) return [i, j]
  }
  return null
}

// Order: LOCKED, NOTHING_TO_DO (no sowable plot), then sowPlot's errors for the first one.
export function sowNext(state: GameState): ActionResult {
  if (!state.run.fields.unlocked) return fail('LOCKED')
  const at = nextSowTarget(state.run.fields)
  return at ? sowPlot(state, at[0], at[1]) : fail('NOTHING_TO_DO')
}

/** the oldest ready plot: smallest readyTick, ties → field order, plot order; null = nothing ready */
export function nextReapTarget(run: RunState): [number, number] | null {
  let best: [number, number] | null = null
  let date = Infinity
  const { list } = run.fields
  for (let i = 0; i < list.length; i++)
    for (let j = 0; j < list[i].plots.length; j++) {
      const p = list[i].plots[j]
      if (p.crop !== null && p.readyTick <= run.tick && p.readyTick < date) {
        date = p.readyTick
        best = [i, j]
      }
    }
  return best
}

/**
 * Reaps one whole plot (the caller checked it is ready): the best sickle's double harvest rolls per tile, the crop
 * sells through harvestSale (accepted orders first, then the market). Home counters and lifetime.harvests stay
 * untouched (the 50-harvest gate keeps its meaning); `energy` is the hand reap's cost (0 for workers and machines).
 */
function reapAt(state: GameState, field: number, plot: number, energy: number): RunState {
  const { run } = state
  const crop = run.fields.list[field].plots[plot].crop!
  let { rngState } = run
  let units = 0
  for (let k = 0; k < plotTiles(); k++) {
    const [r, next] = run.toolTier.harvest > 0 ? nextRandom(rngState) : [0, rngState]
    units += r < doubleHarvestChance(run.toolTier.harvest) ? 2 : 1
    rngState = next
  }
  // batch 29: the player's own reap pays ×1.25 into accepted orders only; its market units sell at ×1
  const rolled = { ...state, run: { ...run, rngState } }
  const sale = energy > 0 ? harvestSale(rolled, crop, units, handPickedBonus(), 1, true) : harvestSale(rolled, crop, units)
  return {
    ...sale.run,
    cash: sale.run.cash + sale.cash,
    energy: run.energy - energy,
    lifetime: { ...sale.run.lifetime, cashEarned: sale.run.lifetime.cashEarned + sale.cash, energySpent: sale.run.lifetime.energySpent + energy },
    fields: withPlot(run.fields, field, plot, emptyPlot()),
  }
}

// Reap by hand. Order: LOCKED, BAD_TILE, NOT_MATURE (empty or growing), NO_ENERGY (reapPlotEnergy ⚡).
export function reapPlot(state: GameState, field: number, plot: number): ActionResult {
  const { run } = state
  const f = run.fields
  if (!f.unlocked) return fail('LOCKED')
  if (!isIndex(field, f.list.length) || !isIndex(plot, f.list[field].plots.length)) return fail('BAD_TILE')
  if (plotState(f.list[field].plots[plot], run.tick) !== 'ready') return fail('NOT_MATURE')
  if (run.energy < reapPlotEnergy()) return fail('NO_ENERGY')
  return withRun(state, reapAt(state, field, plot, reapPlotEnergy()))
}

// Reap the oldest ready plot by hand. Order: LOCKED, NOTHING_TO_DO (nothing ready), NO_ENERGY.
export function reapNext(state: GameState): ActionResult {
  if (!state.run.fields.unlocked) return fail('LOCKED')
  const at = nextReapTarget(state.run)
  return at ? reapPlot(state, at[0], at[1]) : fail('NOTHING_TO_DO')
}

// Machines (batch 19, a Workshop recipe that works the Fields): max 1 of each tier, tiers stack. The recipe needs
// the Fields and the kind's job worked by a worker first (manual → worker → machine).
// Order: LOCKED, ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyMachine(state: GameState, kind: MachineKind, tier: number): ActionResult {
  const { run } = state
  if (!run.fields.unlocked || !run.workers.certificates.includes(kind === 'harvester' ? 'harvest' : 'plant')) return fail('LOCKED')
  if (run.fields.machines[kind].includes(tier)) return fail('ALREADY_OWNED')
  return pay(state, machineCost(kind, tier, state.meta), {
    fields: { ...run.fields, machines: { ...run.fields.machines, [kind]: [...run.fields.machines[kind], tier] } },
  })
}

/**
 * The harvester worker's Fields action (its home plot has nothing ripe): reaps the oldest ready plot, no energy, never
 * hand-picked. null = nothing ready (a plain idle).
 */
export function fieldsHarvest(state: GameState): ActionResult | null {
  if (!state.run.fields.unlocked) return null
  const at = nextReapTarget(state.run)
  return at && withRun(state, reapAt(state, at[0], at[1], 0))
}

/**
 * The planter worker's Fields action (its home plot fully planted): sows the next sowable plot (sowNext). null =
 * nothing to sow; NO_SEEDS / NO_CASH pass through to the worker loop (idle unpaid).
 */
export function fieldsPlantAction(state: GameState): ActionResult | null {
  if (!state.run.fields.unlocked || !nextSowTarget(state.run.fields)) return null
  return sowNext(state)
}

/** plots the pivots burn this tick: every plot in a pivoted field, or with the smart valve only the growing ones */
function burningPlots(run: RunState): number {
  let n = 0
  for (const field of run.fields.list)
    if (field.pivot) for (const p of field.plots) if (!run.workshop.valve || plotState(p, run.tick) === 'growing') n++
  return n
}

/** the tank pays this tick's burn: pivoted fields grow ×FIELD_PRESSURE (the UI's "×2"), else every field ×1 */
export function fieldsPressure(run: RunState): boolean {
  return run.fields.tank >= burningPlots(run)
}

/**
 * One tick of the Fields (inside step, after the workers). Plots ripen on their absolute readyTick, sown at the
 * pressured pace; the tank pays the pivots' burn (one unit per burning plot) whole or not at all. Unpaid — or in a
 * field with no pivot — a growing plot's readyTick moves 1 later on every odd tick, which nets ×1. Fields never stall
 * and never die. Returns the same state when nothing burns and nothing slows.
 */
export function fieldsAct(state: GameState): GameState {
  const { run } = state
  const f = run.fields
  if (!f.unlocked) return state
  const burning = burningPlots(run)
  const pressure = f.tank >= burning
  const tank = pressure ? f.tank - burning : f.tank
  let slowed = false
  const list =
    run.tick % 2 === 1
      ? f.list.map((field) => {
          if (field.pivot && pressure) return field
          if (!field.plots.some((p) => plotState(p, run.tick) === 'growing')) return field
          slowed = true
          return { ...field, plots: field.plots.map((p) => (plotState(p, run.tick) === 'growing' ? { ...p, readyTick: p.readyTick + 1 } : p)) }
        })
      : f.list
  if (tank === f.tank && !slowed) return state
  return { ...state, run: { ...run, fields: { ...f, tank, list } } }
}

/**
 * Moves whole coal from storage into the tank, up to its room and `max` (the fuel loader moves one). No energy.
 * Order: LOCKED, NOTHING_TO_DO (room for less than one coal), NOT_ENOUGH_ITEMS (no coal in storage).
 */
export function fillTank(state: GameState, max = Infinity): ActionResult {
  const { run } = state
  const f = run.fields
  if (!f.unlocked) return fail('LOCKED')
  const room = Math.floor((tankCapCoal(f.pump) * TANK_UNITS_PER_COAL - f.tank) / TANK_UNITS_PER_COAL)
  if (room < 1) return fail('NOTHING_TO_DO')
  const coal = run.inventory.coal ?? 0
  if (coal < 1) return fail('NOT_ENOUGH_ITEMS')
  const moved = Math.min(room, coal, max)
  return withRun(state, { inventory: { ...run.inventory, coal: coal - moved }, fields: { ...f, tank: f.tank + moved * TANK_UNITS_PER_COAL } })
}

// ─── Machines (batch 19) ───────────────────────────────────────────────────────────────────────────────────────

/** the fleet's whole tiles per tick (3600 ticks per hour), summed over the owned tiers */
function fleetTilesPerTick(machines: Machines, kind: MachineKind): number {
  return machines[kind].reduce((rate, tier) => rate + machineTilesPerHour(kind, tier) / 3600, 0)
}

/** flat maintenance cash per tick for the owned tiers of this kind */
function fleetMaintPerTick(machines: Machines, kind: MachineKind): number {
  return machines[kind].reduce((rate, tier) => rate + machineMaintPerHour(tier) / 3600, 0)
}

/**
 * One tick of the machines (batch 19, whole plots since batch 28), run in step BEFORE the workers: a harvester takes
 * the ready plots first and the harvester workers fill the gap; the seeder sows through sowNext (the field chips, the
 * planter's own seed rules). Maintenance is flat cash per live hour worked — a harvester works while a plot is ready, a
 * seeder while sowNext has a target; an hour the cash cannot pay pauses the fleet (the debt caps at that hour, never
 * grows). The harvester reaps one plot per plot's worth of tiles accrued (as many as are ready) and keeps at most one
 * plot banked; the seeder sows one plot per plot accrued and on NO_SEEDS / NO_CASH holds one plot, retrying when it
 * clears. Accrual only happens while a machine works, so idle time banks nothing. Returns the same state when idle.
 */
export function machinesAct(state: GameState): GameState {
  const { run } = state
  const f = run.fields
  const m = f.machines
  if (!f.unlocked || (m.harvester.length === 0 && m.seeder.length === 0)) return state
  const carry = { ...m.carry }
  const size = plotTiles()
  let s = state
  const ready = m.harvester.length > 0 ? fieldsOverview(run).ready : 0
  const sowing = m.seeder.length > 0 && nextSowTarget(f) !== null
  // maintenance first: the working machines accrue, whole cash is paid as it comes due
  const maint = (ready > 0 ? fleetMaintPerTick(m, 'harvester') : 0) + (sowing ? fleetMaintPerTick(m, 'seeder') : 0)
  let working = true
  if (maint > 0) {
    carry.maint += maint
    if (carry.maint >= 1) {
      const paid = Math.min(Math.floor(carry.maint), s.run.cash)
      if (paid > 0) {
        carry.maint -= paid
        s = { ...s, run: { ...s.run, cash: s.run.cash - paid } }
      }
      if (carry.maint >= 1) working = false
      carry.maint = Math.min(carry.maint, 1)
    }
  }
  if (working && ready > 0) {
    carry.harvest += fleetTilesPerTick(m, 'harvester')
    for (let n = Math.min(Math.floor(carry.harvest / size), ready); n > 0; n--) {
      const at = nextReapTarget(s.run)!
      s = { ...s, run: reapAt(s, at[0], at[1], 0) }
      carry.harvest -= size
    }
    carry.harvest = Math.min(carry.harvest, size)
  }
  if (working && sowing) {
    carry.plant += fleetTilesPerTick(m, 'seeder')
    if (carry.plant >= size) {
      const sown = sowNext(s)
      if (sown.ok) {
        carry.plant -= size
        s = sown.state
      } else carry.plant = size // NO_SEEDS / NO_CASH: hold one plot, retry when it clears
    }
  }
  if (s === state && carry.harvest === m.carry.harvest && carry.plant === m.carry.plant && carry.maint === m.carry.maint) return state
  return { ...s, run: { ...s.run, fields: { ...s.run.fields, machines: { ...s.run.fields.machines, carry } } } }
}

/**
 * The payback label's number, shared with the sim's 8 h pin: marginal net cash/h of ONE more field tile sown with the
 * best fields-plantable crop on the pressured cycle (ceil(grow / FIELD_PRESSURE)), at the glut the market settles at
 * with that tile selling (the live glut plus one tile's steady glut).
 */
export function fieldsMarginalIncomePerHour(state: GameState): number {
  const { run, meta } = state
  let best = 0
  for (const crop of CROP_IDS) {
    if (!fieldsPlantable(run, crop)) continue
    const cycle = Math.ceil(cropGrowTicks(crop, meta, run.upgrades.fertilizer) / FIELD_PRESSURE)
    const glut = run.market[crop] + marketSteadyGlut(1, cycle)
    const price = Math.round(cropSellPrice(crop, meta, run.upgrades.sellPrice) * marketFactor(crop, glut))
    best = Math.max(best, ((price - cropSeedCost(crop, meta)) * 3600) / cycle)
  }
  return best
}

/** the "~X h" payback label: the next plot's price ÷ its ten tiles' marginal income (0 when nothing is plantable yet) */
export function fieldsPaybackHours(state: GameState): number {
  const income = fieldsMarginalIncomePerHour(state)
  return income > 0 ? Math.round(plotCost(plotsOwned(state.run.fields), state.meta) / (plotTiles() * income)) : 0
}
