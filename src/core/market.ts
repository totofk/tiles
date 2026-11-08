// The crop market (batch 12, DECISIONS "Crop market"): every crop unit sold adds 1 glut to its crop; glut decays
// each tick and lowers that crop's sale price. Items are not in the market. Pure: no DOM, no clock, no dice.
import { FLOAT_EPSILON, MARKET_DECAY, cropGrowTicks, cropSellPrice, marketFactor } from './balance'
import { CROP_IDS, type CropId } from './data/crops'
import type { GameState, MetaState, RunState } from './state'

/** price of one unit of `cropId` sold while the glut is `glut` (before that unit is added) */
export function marketCropPrice(state: GameState, cropId: CropId, glut: number): number {
  return Math.round(cropSellPrice(cropId, state.meta, state.run.upgrades.sellPrice) * marketFactor(cropId, glut))
}

/**
 * sells `units` of `cropId`, each priced at the glut before its own sale, in sequence; glut += units. `bonus` (the
 * hand-picked multiplier) applies per unit after the market price and adds no glut.
 */
export function cropSale(state: GameState, cropId: CropId, units: number, bonus = 1): { cash: number; market: RunState['market'] } {
  const glut = state.run.market[cropId]
  let cash = 0
  for (let i = 0; i < units; i++) cash += Math.round(marketCropPrice(state, cropId, glut + i) * bonus)
  return { cash, market: { ...state.run.market, [cropId]: glut + units } }
}

/** one tick of decay for every glut; returns the same object when no crop is glutted */
export function decayMarket(market: RunState['market']): RunState['market'] {
  let next: RunState['market'] | null = null
  for (const crop of CROP_IDS) {
    const glut = market[crop]
    if (glut <= 0) continue
    const decayed = glut * MARKET_DECAY
    next ??= { ...market }
    next[crop] = decayed < FLOAT_EPSILON ? 0 : decayed
  }
  return next ?? market
}

/**
 * Glut a continuous harvest of `tiles` tiles of one crop settles at: each tile sells 1 unit every growTicks, so
 * sales add tiles / growTicks glut per tick and decay balances it. `growTicks` is the live grow time (fertilizer
 * speeds harvests and so adds glut — intended); pass cropGrowTicks(crop, meta, level).
 */
export function marketSteadyGlut(tiles: number, growTicks: number): number {
  return (tiles / growTicks) * (MARKET_DECAY / (1 - MARKET_DECAY))
}

/** the steady-state sale factor of `tiles` tiles of one crop at this grow time */
export function marketSteadyFactor(cropId: CropId, tiles: number, meta: MetaState, fertilizerLevel: number): number {
  return marketFactor(cropId, marketSteadyGlut(tiles, cropGrowTicks(cropId, meta, fertilizerLevel)))
}
