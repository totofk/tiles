import { harvest, plant, till, water, type ActionResult } from './actions'
import { cropGrowTicks, cropRotGraceTicks } from './balance'
import type { CropId } from './data/crops'
import type { GameState, MetaState, Tile } from './state'

export type TileAction = 'harvest' | 'water' | 'plant' | 'till'

export function isMature(tile: Tile, meta: MetaState): boolean {
  return tile.status === 'planted' && !!tile.cropId && tile.growth >= cropGrowTicks(tile.cropId, meta)
}

/** same definition as the sim bot: growth is paused only at exactly 0 */
export function isDry(tile: Tile): boolean {
  return tile.moisture === 0
}

/** growth 0..1; 0 when nothing is planted */
export function growthProgress(tile: Tile, meta: MetaState): number {
  if (tile.status !== 'planted' || !tile.cropId) return 0
  return Math.min(1, tile.growth / cropGrowTicks(tile.cropId, meta))
}

/** ticks left before a mature crop rots (it rots on the step that makes this 0); null if not mature */
export function ticksUntilRot(tile: Tile, meta: MetaState): number | null {
  if (!isMature(tile, meta)) return null
  return cropRotGraceTicks(tile.cropId!, meta) - tile.ticksSinceMature + 1
}

/** harvest if mature → water (top up) if growing → plant if tilled → till if untilled */
export function nextTileAction(tile: Tile, meta: MetaState): TileAction {
  if (isMature(tile, meta)) return 'harvest'
  if (tile.status === 'planted') return 'water'
  return tile.status === 'tilled' ? 'plant' : 'till'
}

/** performs nextTileAction on tile i */
export function tapTile(state: GameState, i: number, cropId: CropId): ActionResult {
  const tile = state.run.tiles[i]
  if (!tile) return { ok: false, error: 'BAD_TILE' }
  switch (nextTileAction(tile, state.meta)) {
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
