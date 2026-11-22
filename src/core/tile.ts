import { harvest, plant, till, water, type ActionResult } from './actions'
import { SOIL_LOOSE_ROT, cropGrowTicks, cropRotGraceTicks } from './balance'
import type { CropId } from './data/crops'
import { cropRenownGrow } from './market'
import { bedTrait, soilPair } from './survey'
import type { GameState, Tile } from './state'
import { BED_TILES, isTreeTile } from './tree'

export type TileAction = 'harvest' | 'water' | 'plant' | 'till'

function growTicks(cropId: CropId, s: GameState): number {
  return cropGrowTicks(cropId, s.meta, s.run.upgrades.fertilizer, s.run.listing.soil, cropRenownGrow(s.run, cropId))
}

export function isMature(tile: Tile, s: GameState): boolean {
  return tile.status === 'planted' && !!tile.cropId && tile.growth >= growTicks(tile.cropId, s)
}

/** same definition as the sim bot: growth is paused only at exactly 0 */
export function isDry(tile: Tile): boolean {
  return tile.moisture === 0
}

/** growth 0..1; 0 when nothing is planted */
export function growthProgress(tile: Tile, s: GameState): number {
  if (tile.status !== 'planted' || !tile.cropId) return 0
  return Math.min(1, tile.growth / growTicks(tile.cropId, s))
}

/** ticks left before a mature crop rots (it rots on the step that makes this 0); null if not mature. With the
 * tile index (batch 36.5) an 🍂 loose bed's grace is ×2 (×2.5 at Lv3), floored; without it today's value */
export function ticksUntilRot(tile: Tile, s: GameState, i?: number): number | null {
  if (!isMature(tile, s)) return null
  const grace = cropRotGraceTicks(tile.cropId!, s.meta, s.run.listing.soil)
  if (i === undefined) return grace - tile.ticksSinceMature + 1
  const rot = bedTrait(s.run, Math.floor(i / BED_TILES)) === 'loose' ? soilPair(s.run, SOIL_LOOSE_ROT) : 1
  return Math.floor(grace * rot) - tile.ticksSinceMature + 1
}

/** harvest if mature (or a 🌳 tree tile, index i) → water (top up) if growing → plant if tilled → till if untilled */
export function nextTileAction(tile: Tile, s: GameState, i?: number): TileAction {
  if (isMature(tile, s) || (i !== undefined && isTreeTile(s.run, i))) return 'harvest'
  if (tile.status === 'planted') return 'water'
  return tile.status === 'tilled' ? 'plant' : 'till'
}

/** performs nextTileAction on tile i */
export function tapTile(state: GameState, i: number, cropId: CropId): ActionResult {
  const tile = state.run.tiles[i]
  if (!tile) return { ok: false, error: 'BAD_TILE' }
  switch (nextTileAction(tile, state, i)) {
    case 'harvest':
      return harvest(state, i)
    case 'water':
      return water(state, i)
    case 'plant':
      return plant(state, i, cropId)
    case 'till':
      return till(state, i)
  }
}
