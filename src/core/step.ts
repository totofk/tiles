import {
  FLOAT_EPSILON,
  cropGrowTicks,
  cropRotGraceTicks,
  energyMax,
  energyRegenPerTick,
  loanDebtCap,
  loanDebtPerTick,
  moistureDrainPerTick,
  waterMoisture,
} from './balance'
import { recordMilestones } from './data/milestones'
import { fieldsAct, machinesAct } from './fields'
import { tickFurnace } from './furnace'
import { decayMarket } from './market'
import { tickOrders } from './orders'
import type { GameState, Loan, MetaState, RunState, Tile } from './state'
import { workersAct } from './workers'
import { isIrrigated } from './workshop'

/** a tile with its crop removed (harvest or rot); keeps the soil moisture */
export function clearedTile(tile: Tile): Tile {
  return { status: 'tilled', growth: 0, moisture: tile.moisture, ticksSinceMature: 0 }
}

// Growth checks moisture BEFORE this tick's drain: a full bar (1) buys exactly
// 1 / moistureDrainPerTick growth ticks. An `irrigated` tile (its bed has a sprinkler) is set to the iron-can
// fill before growth and is never drained, so it always grows.
function stepTile(tile: Tile, meta: MetaState, fertilizerLevel: number, irrigated = false): Tile {
  const wet = irrigated ? { ...tile, moisture: waterMoisture(2) } : tile
  let next = wet
  if (wet.status === 'planted' && wet.cropId) {
    if (wet.growth < cropGrowTicks(wet.cropId, meta, fertilizerLevel)) {
      if (wet.moisture > 0) next = { ...wet, growth: wet.growth + 1 }
    } else {
      const ticksSinceMature = wet.ticksSinceMature + 1
      next =
        ticksSinceMature > cropRotGraceTicks(wet.cropId, meta)
          ? clearedTile(wet)
          : { ...wet, ticksSinceMature }
    }
  }
  if (irrigated) return next
  const drained = next.moisture - moistureDrainPerTick(meta)
  const moisture = drained < FLOAT_EPSILON ? 0 : drained
  return moisture === next.moisture ? next : { ...next, moisture }
}

/** debt grows linearly while unpaid, never past the cap */
function stepLoan(loan: Loan | null): Loan | null {
  if (!loan) return null
  const debt = Math.min(loanDebtCap(loan.principal), loan.debt + loanDebtPerTick(loan.principal))
  return debt === loan.debt ? loan : { ...loan, debt }
}

function stepOnce(state: GameState): GameState {
  const before = state.run
  // batch 19: the Fields machines work before the workers — a harvester takes the ready cohorts first, the harvester
  // workers fill the gap; the seeder plants before the planter
  const worked = machinesAct(state)
  // the Fields cohorts grow after the workers (a batch planted this tick starts growing this tick, like a home tile)
  const { run, meta } = fieldsAct(workersAct(worked))
  const max = energyMax(run.upgrades.energyMax, meta)
  let energy = Math.min(max, run.energy + energyRegenPerTick(run.upgrades.energyRegen, meta))
  const rounded = Math.round(energy)
  if (Math.abs(energy - rounded) < FLOAT_EPSILON) energy = rounded
  const nextRun: RunState = {
    ...run,
    energy,
    tiles: run.tiles.map((t, i) => stepTile(t, meta, run.upgrades.fertilizer, isIrrigated(run, i))),
    tick: run.tick + 1,
    loan: stepLoan(run.loan),
    market: decayMarket(run.market),
  }
  // milestones record per tick (worker actions already recorded through withRun), so step(s, n) = n × step(s, 1)
  const after = tickOrders({ meta, run: tickFurnace(nextRun) })
  return { meta, run: recordMilestones(before, after.run) }
}

/** advance `ticks` whole seconds; pure, never mutates `state` */
export function step(state: GameState, ticks: number): GameState {
  let s = state
  for (let i = 0; i < ticks; i++) s = stepOnce(s)
  return s
}
