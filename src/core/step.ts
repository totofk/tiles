import {
  FLOAT_EPSILON,
  cropGrowTicks,
  cropRotGraceTicks,
  energyMax,
  energyRegenPerTick,
  moistureDrainPerTick,
} from './balance'
import type { GameState, MetaState, RunState, Tile } from './state'

/** a tile with its crop removed (harvest or rot); keeps the soil moisture */
export function clearedTile(tile: Tile): Tile {
  return { status: 'tilled', growth: 0, moisture: tile.moisture, ticksSinceMature: 0 }
}

// Growth checks moisture BEFORE this tick's drain: a full bar (1) buys exactly
// 1 / moistureDrainPerTick growth ticks.
function stepTile(tile: Tile, meta: MetaState): Tile {
  let next = tile
  if (tile.status === 'planted' && tile.cropId) {
    if (tile.growth < cropGrowTicks(tile.cropId, meta)) {
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

function stepOnce(state: GameState): GameState {
  const { run, meta } = state
  const max = energyMax(run.upgrades.energyMax, meta)
  let energy = Math.min(max, run.energy + energyRegenPerTick(run.upgrades.energyRegen, meta))
  const rounded = Math.round(energy)
  if (Math.abs(energy - rounded) < FLOAT_EPSILON) energy = rounded
  const nextRun: RunState = {
    ...run,
    energy,
    tiles: run.tiles.map((t) => stepTile(t, meta)),
    tick: run.tick + 1,
  }
  return { meta, run: nextRun }
}

/** advance `ticks` whole seconds; pure, never mutates `state` */
export function step(state: GameState, ticks: number): GameState {
  let s = state
  for (let i = 0; i < ticks; i++) s = stepOnce(s)
  return s
}
