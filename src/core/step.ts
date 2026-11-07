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
import { advanceFurnace, autoSmelt } from './furnace'
import type { GameState, Loan, MetaState, RunState, Tile } from './state'
import { workersAct } from './workers'

/** a tile with its crop removed (harvest or rot); keeps the soil moisture */
export function clearedTile(tile: Tile): Tile {
  return { status: 'tilled', growth: 0, moisture: tile.moisture, ticksSinceMature: 0 }
}

// Growth checks moisture BEFORE this tick's drain: a full bar (1) buys exactly
// 1 / moistureDrainPerTick growth ticks.
function stepTile(tile: Tile, meta: MetaState, fertilizerLevel: number): Tile {
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
  const { run, meta } = workersAct(state)
  const max = energyMax(run.upgrades.energyMax, meta)
  let energy = Math.min(max, run.energy + energyRegenPerTick(run.upgrades.energyRegen, meta))
  const rounded = Math.round(energy)
  if (Math.abs(energy - rounded) < FLOAT_EPSILON) energy = rounded
  const nextRun: RunState = {
    ...run,
    energy,
    tiles: run.tiles.map((t) => stepTile(t, meta, run.upgrades.fertilizer)),
    tick: run.tick + 1,
    loan: stepLoan(run.loan),
    furnace: advanceFurnace(run.furnace, 1),
  }
  return autoSmelt({ meta, run: nextRun })
}

/** advance `ticks` whole seconds; pure, never mutates `state` */
export function step(state: GameState, ticks: number): GameState {
  let s = state
  for (let i = 0; i < ticks; i++) s = stepOnce(s)
  return s
}
