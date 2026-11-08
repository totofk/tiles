import {
  FLOAT_EPSILON,
  cropGrowTicks,
  cropRotGraceTicks,
  energyMax,
  energyRegenPerTick,
  loanDebtCap,
  loanDebtPerTick,
  moistureDrainPerTick,
} from './balance'
import { recordMilestones } from './data/milestones'
import { fieldsAct } from './fields'
import { tickFurnace } from './furnace'
import { decayMarket } from './market'
import { tickOrders } from './orders'
import type { GameState, Loan, MetaState, RunState, Tile } from './state'
import { workersAct } from './workers'
import { sprinklersAct } from './workshop'

/** a tile with its crop removed (harvest or rot); keeps the soil moisture */
export function clearedTile(tile: Tile): Tile {
  return { status: 'tilled', growth: 0, moisture: tile.moisture, ticksSinceMature: 0 }
}

// Growth checks moisture BEFORE this tick's drain: a full bar (1) buys exactly
// 1 / moistureDrainPerTick growth ticks. `held` (the smart valve holding a stalled sprinkler's tiles) skips the
// drain, so the tile keeps growing at the moisture it froze at.
function stepTile(tile: Tile, meta: MetaState, fertilizerLevel: number, held = false): Tile {
  let next = tile
  if (tile.status === 'planted' && tile.cropId) {
    if (tile.growth < cropGrowTicks(tile.cropId, meta, fertilizerLevel)) {
      if (tile.moisture > 0) next = { ...tile, growth: tile.growth + 1 }
    } else {
      const ticksSinceMature = tile.ticksSinceMature + 1
      next =
        ticksSinceMature > cropRotGraceTicks(tile.cropId, meta)
          ? clearedTile(tile)
          : { ...tile, ticksSinceMature }
    }
  }
  if (held) return next
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
  // sprinklers run first (batch 17): their watering lands before the water worker picks targets, and `held`
  // (valve) is index-aligned with the tiles the drain step below runs on
  const machines = sprinklersAct(state)
  // the Fields cohorts grow after the workers (a batch planted this tick starts growing this tick, like a home tile)
  const { run, meta } = fieldsAct(workersAct({ ...state, run: machines.run }))
  const max = energyMax(run.upgrades.energyMax, meta)
  let energy = Math.min(max, run.energy + energyRegenPerTick(run.upgrades.energyRegen, meta))
  const rounded = Math.round(energy)
  if (Math.abs(energy - rounded) < FLOAT_EPSILON) energy = rounded
  const nextRun: RunState = {
    ...run,
    energy,
    tiles: run.tiles.map((t, i) => stepTile(t, meta, run.upgrades.fertilizer, machines.held[i])),
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
