import {
  FLOAT_EPSILON,
  SOIL_CLAY_DRAIN,
  SOIL_FERTILE_EXTRA,
  SOIL_LOOSE_ROT,
  cropGrowTicks,
  cropRotGraceTicks,
  energyMax,
  energyRegenPerTick,
  loanDebtCap,
  loanDebtPerTick,
  moistureDrainPerTick,
  waterMoisture,
} from './balance'
import type { ListingSoil } from './data/crops'
import type { HomeTraitId } from './data/soil'
import { recordMilestones } from './data/milestones'
import { fieldsAct, machinesAct } from './fields'
import { tickForge } from './forge'
import { tickFurnace } from './furnace'
import { cropRenownGrow, decayMarket } from './market'
import { tickOrders } from './orders'
import { relicRegenFactor, reserveCap } from './relics'
import { bedTrait, everyNth, soilStrong } from './survey'
import type { GameState, Loan, MetaState, RunState, Tile } from './state'
import { BED_TILES, isTreeTile, tickTree } from './tree'
import { workersAct } from './workers'
import { isIrrigated } from './workshop'

/** a tile with its crop removed (harvest or rot); keeps the soil moisture */
export function clearedTile(tile: Tile): Tile {
  return { status: 'tilled', growth: 0, moisture: tile.moisture, ticksSinceMature: 0 }
}

// Growth checks moisture BEFORE this tick's drain: a full bar (1) buys exactly
// 1 / moistureDrainPerTick growth ticks. An `irrigated` tile (its bed has a sprinkler) is set to the iron-can
// fill before growth and is never drained, so it always grows. `trait` (batch 36.5) is the tile's home-bed soil
// trait — 🌻 fertile adds one extra growth on everyNth ticks, 🍂 loose stretches the rot grace ×2, 🧱 clay thins
// the drain ×0.6; every other trait (and level 0) is exactly today's arithmetic.
function stepTile(
  tile: Tile,
  meta: MetaState,
  fertilizerLevel: number,
  irrigated: boolean,
  soil: ListingSoil | null,
  trait: HomeTraitId | null,
  strong: boolean,
  tick: number,
  renown: number,
): Tile {
  const wet = irrigated ? { ...tile, moisture: waterMoisture(2) } : tile
  let next = wet
  if (wet.status === 'planted' && wet.cropId) {
    if (wet.growth < cropGrowTicks(wet.cropId, meta, fertilizerLevel, soil, renown)) {
      if (wet.moisture > 0) {
        const extra = trait === 'fertile' && everyNth(tick, strong ? SOIL_FERTILE_EXTRA[1] : SOIL_FERTILE_EXTRA[0]) ? 1 : 0
        next = { ...wet, growth: wet.growth + 1 + extra }
      }
    } else {
      const grace = cropRotGraceTicks(wet.cropId, meta, soil) * (trait === 'loose' ? (strong ? SOIL_LOOSE_ROT[1] : SOIL_LOOSE_ROT[0]) : 1)
      const ticksSinceMature = wet.ticksSinceMature + 1
      next =
        ticksSinceMature > grace
          ? clearedTile(wet)
          : { ...wet, ticksSinceMature }
    }
  }
  if (irrigated) return next
  const drain = trait === 'clay' ? (strong ? SOIL_CLAY_DRAIN[1] : SOIL_CLAY_DRAIN[0]) : 1
  const drained = next.moisture - moistureDrainPerTick(meta) * drain
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
  // batch 36.4: ⚡ Second wind speeds regen; regen past ⚡ max banks into the 🔋 Reserve, up to its cap (never fills
  // without the relic), so ⚡0 + banked overflow still regenerates
  const raw = run.energy + energyRegenPerTick(run.upgrades.energyRegen, meta) * relicRegenFactor(run.relics)
  let energy = Math.min(max, raw)
  const rounded = Math.round(energy)
  if (Math.abs(energy - rounded) < FLOAT_EPSILON) energy = rounded
  const cap = reserveCap(run, meta)
  const overflow = Math.max(0, raw - energy)
  const nextRun: RunState = {
    ...run,
    energy,
    energyReserve: cap > 0 ? Math.min(cap, run.energyReserve + overflow) : run.energyReserve,
    // tree tiles grow fruit in tickTree instead: no moisture, no growth, no rot
    tiles: run.tiles.map((t, i) =>
      isTreeTile(run, i)
        ? t
        : stepTile(t, meta, run.upgrades.fertilizer, isIrrigated(run, i), run.listing.soil, bedTrait(run, Math.floor(i / BED_TILES)), soilStrong(run), run.tick, t.cropId ? cropRenownGrow(run, t.cropId) : 1),
    ),
    tree: tickTree(run.tree),
    tick: run.tick + 1,
    loan: stepLoan(run.loan),
    market: decayMarket(run.market),
  }
  // milestones record per tick (worker actions already recorded through withRun), so step(s, n) = n × step(s, 1)
  const after = tickOrders({ meta, run: tickForge(tickFurnace(nextRun)) })
  return { meta, run: recordMilestones(before, after.run) }
}

/** advance `ticks` whole seconds; pure, never mutates `state` */
export function step(state: GameState, ticks: number): GameState {
  let s = state
  for (let i = 0; i < ticks; i++) s = stepOnce(s)
  return s
}
