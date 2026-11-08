// The 🚜 Fields (batch 18, DECISIONS "Fields part 1"): the earned late game beside the home plot — unbounded tile
// COUNT as an aggregate, simulated as cohorts, never per-tile loops. Each plant action (the player's button or the
// planter's batch) adds one cohort {crop, count, readyTick}; the per-tick walk moves covered growing cohorts one tick
// toward harvest — tiles beyond the pipes' coverage stall (growth paused, nothing ever dies), and with no coal for the
// shared pump everything stalls one tick at a time. The harvester reaps the oldest ready tiles and sells through
// harvestSale exactly like home-plot harvests (accepted orders first, then the market, never hand-picked).
import { fail, nextRandom, withRun, type ActionError, type ActionResult } from './actions'
import {
  cropGrowTicks,
  cropSeedCost,
  cropSellPrice,
  doubleHarvestChance,
  fieldTileCost,
  fieldsCost,
  fieldsCropHarvests,
  harvestBatch,
  machineCost,
  machineMaintPerHour,
  machineTilesPerHour,
  marketFactor,
  plantBatch,
  pipeCoalPerTick,
  pipeCost,
  pipeCover,
  seedKeepChance,
  type MachineKind,
} from './balance'
import { CROP_IDS, type CropId } from './data/crops'
import { harvestSale, isOffer } from './orders'
import { pay } from './mining'
import { marketSteadyGlut } from './market'
import type { Cohort, Fields, GameState, Machines, Offer, RunState } from './state'

/** tiles standing in the Fields (planted, growing or ready) */
export const fieldsStanding = (f: Fields): number => f.cohorts.reduce((n, c) => n + c.count, 0)

/** field tiles bought but empty */
export const fieldsFree = (run: RunState): number => run.fields.count - fieldsStanding(run.fields)

/** fields object with `cohorts` and the per-crop `planted` derived from them (never tracked twice) */
function withCohorts(f: Fields, cohorts: Cohort[]): Fields {
  return {
    ...f,
    cohorts,
    planted: Object.fromEntries(CROP_IDS.map((crop) => [crop, cohorts.reduce((n, c) => (c.crop === crop ? n + c.count : n), 0)])) as Fields['planted'],
  }
}

/** the unlock's gates: planter and harvester certificates owned, watering covered by ≥ 1 sprinkler */
export function fieldsGates(run: RunState): { plant: boolean; harvest: boolean; water: boolean } {
  return {
    plant: run.workers.certificates.includes('plant'),
    harvest: run.workers.certificates.includes('harvest'),
    water: run.workshop.built && run.workshop.hoppers.length >= 1,
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

// Order: LOCKED, ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH.
export function unlockFields(state: GameState): ActionResult {
  const { run } = state
  if (!fieldsUnlockable(run)) return fail('LOCKED')
  if (run.fields.unlocked) return fail('ALREADY_OWNED')
  return pay(state, fieldsCost(state.meta), { fields: { ...run.fields, unlocked: true } })
}

// Order: LOCKED, NO_CASH. Field price = FIELDS_TILE_BASE × (count + 1); planted stays (empty land).
export function buyField(state: GameState): ActionResult {
  const { run } = state
  if (!run.fields.unlocked) return fail('LOCKED')
  const cost = fieldTileCost(run.fields.count, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, fields: { ...run.fields, count: run.fields.count + 1 } })
}

// Pipes (task 94, a Workshop recipe): each tier widens the coverage; coal is drawn by fieldsAct below.
// Order: LOCKED, NO_WORKSHOP, MAX_LEVEL, NOT_ENOUGH_ITEMS, NO_CASH.
export function buyPipes(state: GameState): ActionResult {
  const { run } = state
  if (!run.fields.unlocked) return fail('LOCKED')
  if (!run.workshop.built) return fail('NO_WORKSHOP')
  const cost = pipeCost(run.fields.pipes, state.meta)
  if (!cost) return fail('MAX_LEVEL')
  return pay(state, cost, { fields: { ...run.fields, pipes: run.fields.pipes + 1 } })
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

/** the 3-bar breakdown for the UI, by the same prefix rule fieldsAct grows by: free, growing (covered vs stalled), ready */
export function fieldsStats(run: RunState): { free: number; growing: number; covered: number; stalled: number; ready: number } {
  const f = run.fields
  const budget = pipeCover(f.pipes)
  let covered = 0
  let stalled = false
  let growing = 0
  let ready = 0
  for (const c of f.cohorts) {
    if (c.readyTick <= run.tick) ready += c.count
    else {
      growing += c.count
      if (!stalled && covered + c.count <= budget) covered += c.count
      else stalled = true
    }
  }
  return { free: f.count - growing - ready, growing, covered, stalled: growing - covered, ready }
}

/**
 * Plants up to PLANT_BATCH tiles of `crop` as one cohort (readyTick = tick + growTicks, fertilizer applies like the
 * home plot). Seeds use the pouch and auto-buy rules per tile, the dibber's seed-keep rolls per tile; the batch stops
 * early on no seed / no cash and reports the partial plant. Sets fields.plantCrop — the crop the planter works here.
 * No energy: Fields income is cash/h, not cash/energy.
 * Order: LOCKED, NO_LICENSE, LOCKED (under the harvest gate), NOTHING_TO_DO (no free tiles), NO_SEEDS, NO_CASH.
 */
export function plantFields(state: GameState, crop: CropId): ActionResult {
  const { run, meta } = state
  if (!run.fields.unlocked) return fail('LOCKED')
  if (!run.licenses.includes(crop)) return fail('NO_LICENSE')
  if (!fieldsPlantable(run, crop)) return fail('LOCKED')
  const free = fieldsFree(run)
  if (free < 1) return fail('NOTHING_TO_DO')
  const wanted = Math.min(plantBatch(), free)
  let { cash, rngState } = run
  const seeds = { ...run.seeds }
  let planted = 0
  let stoppedBy: ActionError | null = null
  while (planted < wanted) {
    const stock = seeds[crop] ?? 0
    const price = stock > 0 ? 0 : cropSeedCost(crop, meta)
    if (stock === 0 && !run.autoBuySeeds) {
      stoppedBy = 'NO_SEEDS'
      break
    }
    if (cash < price) {
      stoppedBy = 'NO_CASH'
      break
    }
    // the dibber's seed-keep, per tile, rolled only above the basic tier (tier-0 runs keep their exact sequence)
    const [r, next] = run.toolTier.plant > 0 ? nextRandom(rngState) : [1, rngState]
    const kept = r < seedKeepChance(run.toolTier.plant)
    if (stock > 0 && !kept) seeds[crop] = stock - 1
    if (stock === 0 && !kept) cash -= price
    rngState = next
    planted++
  }
  if (planted === 0) return fail(stoppedBy ?? 'NOTHING_TO_DO')
  const readyTick = run.tick + cropGrowTicks(crop, meta, run.upgrades.fertilizer)
  return withRun(state, {
    cash,
    rngState,
    seeds,
    fields: { ...withCohorts(run.fields, [...run.fields.cohorts, { crop, count: planted, readyTick }]), plantCrop: crop },
  })
}

/** "stop": clears the crop the planter works in the Fields. Free. Order: LOCKED, NOTHING_TO_DO. */
export function stopFieldsPlant(state: GameState): ActionResult {
  const { run } = state
  if (!run.fields.unlocked) return fail('LOCKED')
  if (run.fields.plantCrop === null) return fail('NOTHING_TO_DO')
  return withRun(state, { fields: { ...run.fields, plantCrop: null } })
}

/**
 * The harvester worker's Fields action: reaps up to HARVEST_BATCH tiles of the oldest ready cohort, the sickle's
 * double-harvest rolling per tile, selling through harvestSale (accepted orders first, then the market; a worker is
 * never hand-picked). The player has no button — Fields harvest is the harvester's job, or it waits. null = nothing
 * ready. Counters stay home-plot (the 50-harvest gate keeps its meaning); only cash and the order book move.
 */
export function fieldsHarvest(state: GameState): ActionResult | null {
  const { run } = state
  if (!run.fields.unlocked) return null
  const i = run.fields.cohorts.findIndex((c) => c.readyTick <= run.tick)
  if (i < 0) return null
  const { crop, count } = run.fields.cohorts[i]
  const reaped = Math.min(harvestBatch(), count)
  let { rngState } = run
  let units = 0
  for (let k = 0; k < reaped; k++) {
    // the sickle's double harvest, per tile, rolled only above the basic tier
    const [r, next] = run.toolTier.harvest > 0 ? nextRandom(rngState) : [0, rngState]
    units += r < doubleHarvestChance(run.toolTier.harvest) ? 2 : 1
    rngState = next
  }
  const sale = harvestSale({ ...state, run: { ...run, rngState } }, crop, units)
  const cohorts = [...run.fields.cohorts]
  cohorts[i] = { crop, count: count - reaped, readyTick: run.fields.cohorts[i].readyTick }
  if (cohorts[i].count === 0) cohorts.splice(i, 1)
  return withRun(state, {
    cash: run.cash + sale.cash,
    rngState: sale.run.rngState,
    orders: sale.run.orders,
    stars: sale.run.stars,
    counters: sale.run.counters,
    market: sale.run.market,
    lifetime: { ...sale.run.lifetime, cashEarned: sale.run.lifetime.cashEarned + sale.cash },
    fields: withCohorts(run.fields, cohorts),
  })
}

/**
 * The planter worker's Fields action (its home plot fully planted): plant one batch of fields.plantCrop. null = no
 * crop picked or nothing plantable. Errors pass through to the worker loop (idle unpaid).
 */
export function fieldsPlantAction(state: GameState): ActionResult | null {
  const { run } = state
  const crop = run.fields.plantCrop
  if (!run.fields.unlocked || crop === null) return null
  return plantFields(state, crop)
}

/**
 * One tick of the Fields (inside step, after the workers): growing cohorts within the pipes' coverage advance one
 * tick (readyTick − 1), cohorts beyond it stall — growth paused, nothing dies. The shared pump accrues coal for the
 * covered growing tiles (0.5 / h per 10 tiles) and burns 1 whole coal from storage per coal accrued; with no coal in
 * storage nothing grows this tick and nothing accrues (a dry pump is a stalled pump, never a debt). Returns the same
 * state only when nothing is growing (ready cohorts never take coverage or coal).
 */
export function fieldsAct(state: GameState): GameState {
  const { run } = state
  const f = run.fields
  if (!f.unlocked || f.cohorts.length === 0) return state
  const budget = pipeCover(f.pipes)
  // the tiles that would grow this tick, in cohort order (the prefix coverage rule); ready cohorts take no coverage
  let covered = 0
  let growing = false
  for (const c of f.cohorts) {
    if (c.readyTick <= run.tick) continue
    growing = true
    if (covered + c.count <= budget) covered += c.count
    else break
  }
  if (!growing) return state
  // a coal already due never accrues more (the debt is capped at the one coal); while it stays unpaid the pump is
  // dry and nothing grows — coal back in storage pays it off and growth resumes the same tick
  let coalCarry = f.coalCarry
  let watering = true
  if (coalCarry < 1) coalCarry += pipeCoalPerTick(covered)
  let coal = run.inventory.coal ?? 0
  if (coalCarry >= 1) {
    if (coal >= 1) {
      coal -= 1
      coalCarry -= 1
    } else watering = false
  }
  const limit = watering ? budget : 0
  let used = 0
  let stalled = false
  const cohorts = f.cohorts.map((c) => {
    if (c.readyTick <= run.tick) return c
    // the prefix coverage rule: once a growing cohort does not fit whole, it and every later one stalls
    if (stalled || used + c.count > limit) {
      stalled = true
      // a stalled cohort's harvest date recedes with the calendar — growth truly paused, never a free ripen
      return { ...c, readyTick: c.readyTick + 1 }
    }
    used += c.count
    return { ...c, readyTick: c.readyTick - 1 }
  })
  const inventory = coal === (run.inventory.coal ?? 0) ? run.inventory : { ...run.inventory, coal }
  return { ...state, run: { ...run, inventory, fields: { ...f, coalCarry, cohorts } } }
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

/** tiles standing ready in the Fields (ready cohorts take no pipe coverage and no coal) */
const readyTiles = (f: Fields, tick: number): number => f.cohorts.reduce((n, c) => (c.readyTick <= tick ? n + c.count : n), 0)

/**
 * The seeder's crop, state-driven with no per-crop special cases: the fields-plantable crop with an accepted open
 * order planted furthest below the order's remaining units (the biggest shortfall); with no under-planted crop order,
 * the plantable crop with the best market factor (the least glutted price). null = nothing worth planting.
 */
export function seederCrop(state: GameState): CropId | null {
  const { run } = state
  let order: { crop: CropId; shortfall: number } | null = null
  let factor: { crop: CropId; factor: number } | null = null
  for (const crop of CROP_IDS) {
    if (!fieldsPlantable(run, crop)) continue
    const slot = run.orders.offers.find((s): s is Offer => isOffer(s) && s.accepted && s.good === crop && s.done < s.count)
    if (slot) {
      const shortfall = slot.count - slot.done - (run.fields.planted[crop] ?? 0)
      if (shortfall > 0 && (!order || shortfall > order.shortfall)) order = { crop, shortfall }
    }
    const f = marketFactor(crop, run.market[crop])
    if (!factor || f > factor.factor) factor = { crop, factor: f }
  }
  return order ? order.crop : factor?.crop ?? null
}

/** reap `tiles` ready tiles oldest-first, the best sickle's double harvest rolling per tile (batch 20.1), selling
 * through harvestSale — a machine is never hand-picked */
function reapFields(state: GameState, tiles: number): GameState {
  let s = state
  let left = tiles
  while (left > 0) {
    const i = s.run.fields.cohorts.findIndex((c) => c.readyTick <= s.run.tick)
    if (i < 0) break
    const { crop, count } = s.run.fields.cohorts[i]
    const reaped = Math.min(left, count)
    // the sickle's double harvest, per tile, rolled only above the basic tier (same roll as the harvester worker)
    let { rngState } = s.run
    let units = 0
    for (let k = 0; k < reaped; k++) {
      const [r, next] = s.run.toolTier.harvest > 0 ? nextRandom(rngState) : [0, rngState]
      units += r < doubleHarvestChance(s.run.toolTier.harvest) ? 2 : 1
      rngState = next
    }
    const sale = harvestSale({ ...s, run: { ...s.run, rngState } }, crop, units)
    const cohorts = [...s.run.fields.cohorts]
    cohorts[i] = { crop, count: count - reaped, readyTick: cohorts[i].readyTick }
    if (cohorts[i].count === 0) cohorts.splice(i, 1)
    s = {
      ...s,
      run: {
        ...sale.run,
        cash: sale.run.cash + sale.cash,
        lifetime: { ...sale.run.lifetime, cashEarned: sale.run.lifetime.cashEarned + sale.cash },
        fields: withCohorts(s.run.fields, cohorts),
      },
    }
    left -= reaped
  }
  return s
}

/**
 * One tick of the machines (batch 19), run in step BEFORE the workers: a harvester takes the ready cohorts first and
 * the harvester workers fill the gap; the seeder plants whole PLANT_BATCH cohorts through the planter's own seed
 * rules (pouch, auto-buy, the dibber's seed-keep) at the machine's tile rate. Maintenance is flat cash per live hour
 * worked — a harvester works while any cohort is ready, a seeder while it has free land and a target crop; an hour
 * the cash cannot pay pauses the fleet (the debt caps at that hour, never grows — like the dry pump, never a loan).
 * Accrual only happens while a machine works, so idle time banks nothing. Returns the same state when idle.
 */
export function machinesAct(state: GameState): GameState {
  const { run } = state
  const f = run.fields
  const m = f.machines
  if (!f.unlocked || (m.harvester.length === 0 && m.seeder.length === 0)) return state
  const carry = { ...m.carry }
  let s = state
  const ready = readyTiles(f, run.tick)
  const crop = m.seeder.length > 0 && fieldsFree(run) > 0 ? seederCrop(s) : null
  // maintenance first: the working machines accrue, whole cash is paid as it comes due
  const maint = (ready > 0 ? fleetMaintPerTick(m, 'harvester') : 0) + (crop !== null ? fleetMaintPerTick(m, 'seeder') : 0)
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
  if (working && ready > 0 && m.harvester.length > 0) {
    carry.harvest += fleetTilesPerTick(m, 'harvester')
    const reaped = Math.min(Math.floor(carry.harvest), ready)
    if (reaped >= 1) {
      carry.harvest -= reaped
      s = reapFields(s, reaped)
    }
  }
  if (working && crop !== null) {
    carry.plant += fleetTilesPerTick(m, 'seeder')
    if (carry.plant >= plantBatch()) {
      const planted = plantFields(s, crop)
      if (planted.ok) {
        carry.plant -= fieldsStanding(planted.state.run.fields) - fieldsStanding(s.run.fields)
        s = planted.state
      } else carry.plant = plantBatch() // NO_SEEDS / NO_CASH: hold one batch, retry when it clears
    }
  }
  if (s === state && carry.harvest === m.carry.harvest && carry.plant === m.carry.plant && carry.maint === m.carry.maint) return state
  return { ...s, run: { ...s.run, fields: { ...s.run.fields, machines: { ...s.run.fields.machines, carry } } } }
}

/**
 * The payback label's number, shared with the sim's 8 h pin: marginal net cash/h of ONE more field tile planted with
 * the best fields-plantable crop, at the glut the market settles at with that tile selling (the live glut plus one
 * tile's steady glut — the research's steady-state arithmetic recomputed from state).
 */
export function fieldsMarginalIncomePerHour(state: GameState): number {
  const { run, meta } = state
  let best = 0
  for (const crop of CROP_IDS) {
    if (!fieldsPlantable(run, crop)) continue
    const grow = cropGrowTicks(crop, meta, run.upgrades.fertilizer)
    const glut = run.market[crop] + marketSteadyGlut(1, grow)
    const price = Math.round(cropSellPrice(crop, meta, run.upgrades.sellPrice) * marketFactor(crop, glut))
    best = Math.max(best, ((price - cropSeedCost(crop, meta)) * 3600) / grow)
  }
  return best
}

/** the "~X h" payback label: the next field's price ÷ its marginal income (0 when nothing is plantable yet) */
export function fieldsPaybackHours(state: GameState): number {
  const income = fieldsMarginalIncomePerHour(state)
  return income > 0 ? Math.round(fieldTileCost(state.run.fields.count, state.meta) / income) : 0
}
