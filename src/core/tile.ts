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

/** harvest if mature → water if planted and dry → plant if tilled → till if untilled; null = nothing to do */
export function nextTileAction(tile: Tile, meta: MetaState): TileAction | null {
  if (isMature(tile, meta)) return 'harvest'
  if (tile.status === 'planted') return isDry(tile) ? 'water' : null
  return tile.status === 'tilled' ? 'plant' : 'till'
}

/** performs nextTileAction on tile i; null when there is nothing to do */
export function tapTile(state: GameState, i: number, cropId: CropId): ActionResult | null {
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
    case null:
      return null
  }
}
