import type { CSSProperties } from 'react'
import { cropRotGraceTicks } from '../core/balance'
import { CROPS, type CropId } from '../core/data/crops'
import { BOARD_EMOJI } from '../core/data/orders'
import { isOffer } from '../core/orders'
import type { GameState, Tile } from '../core/state'
import { growthProgress, isDry, isMature, ticksUntilRot } from '../core/tile'
import { workerTargets, type TileJob, type WorkerTarget } from '../core/workers'
import { Bar } from './Bar'
import { WORKER_JOB_EMOJI } from './Workers'

export const CROP_EMOJI: Record<CropId, string> = { radish: '🥕', chilli: '🌶️', pumpkin: '🎃', lemon: '🍋' }
/** empty tiles; Unicode ≤ 11 like ITEMS.*.emoji (the old 🟫 🟤 are Unicode 12 and show as a box on older fonts) */
const SOIL_EMOJI = { untilled: '🌿', tilled: '🕳️' }
// display only: the rot countdown turns red in the last quarter of the grace window
const ROT_WARN_FRACTION = 0.25

type CellProps = {
  tile: Tile
  state: GameState
  onTap: () => void
  /** a worker's next action will touch this tile: a dashed ring */
  ring?: TileJob
  /** a worker acted on this tile in the last tick: a short flash and the job's emoji popping */
  flash?: TileJob
  /** an accepted order takes this tile's crop: a 📋 corner badge while it is ready */
  ordered?: boolean
}

function Cell({ tile, state, onTap, ring, flash, ordered }: CellProps) {
  const mature = isMature(tile, state)
  const rotIn = ticksUntilRot(tile, state)
  const grace = tile.cropId ? cropRotGraceTicks(tile.cropId, state.meta) : 1
  const growing = tile.status === 'planted' && !mature
  const dry = growing && isDry(tile)

  let emoji = SOIL_EMOJI.untilled
  let label = 'Untilled'
  let mod = 'untilled'
  if (tile.status === 'tilled') [emoji, label, mod] = [SOIL_EMOJI.tilled, 'Tilled — plant', 'tilled']
  if (growing) {
    const name = `${CROPS[tile.cropId!].name} ${Math.floor(growthProgress(tile, state) * 100)} %`
    ;[emoji, label, mod] = [CROP_EMOJI[tile.cropId!], dry ? `${name} — dry!` : name, dry ? 'dry' : 'growing']
  }
  if (mature) {
    const warn = rotIn! <= grace * ROT_WARN_FRACTION
    ;[emoji, label, mod] = [CROP_EMOJI[tile.cropId!], 'Mature — harvest!', warn ? 'rotting' : 'mature']
  }

  const cls = ['cell', `cell-${mod}`, ring && `cell-target cell-target-${ring}`, flash && 'cell-flash'].filter(Boolean).join(' ')
  return (
    <button className={cls} onClick={onTap}>
      {flash && (
        <span className="cell-pop" aria-hidden="true">
          {WORKER_JOB_EMOJI[flash]}
        </span>
      )}
      {mature && ordered && (
        <span className="cell-order" title="Goes to an order">
          {BOARD_EMOJI}
        </span>
      )}
      <span className="cell-emoji">{emoji}</span>
      <span className="cell-label">{label}</span>
      {growing && <Bar value={growthProgress(tile, state)} kind="grow" />}
      {tile.status !== 'untilled' && <Bar value={tile.moisture} kind="water" />}
      {mature && (
        <>
          <Bar value={rotIn! / (grace + 1)} kind="rot" />
          <span className="cell-rot">rots in {rotIn}s</span>
        </>
      )}
    </button>
  )
}

/**
 * acted: the farm workers' actions in the last tick (useGame). It is [] again after the next tick (workers act at most
 * every few ticks), so the flash class and the pop are removed between two actions and each one replays its animation.
 */
export function FarmGrid({ state, onTap, acted = [] }: { state: GameState; onTap: (i: number) => void; acted?: WorkerTarget[] }) {
  // a near-square grid on wider screens (9 → 3, 16 → 4, 24 → 5 columns); mobile CSS keeps 3
  const cols = Math.ceil(Math.sqrt(state.run.tiles.length))
  const rows = Math.ceil(state.run.tiles.length / cols)
  const rings = workerTargets(state)
  const jobOn = (list: WorkerTarget[], i: number) => list.find((t) => t.tile === i)?.job
  const orderedCrops = state.run.orders.offers.flatMap((s) => (isOffer(s) && s.accepted ? [s.good] : []))
  // .farm-fit is the box the grid must fit (width and height, ≥ 768 px), so tiles size by the smaller side
  return (
    <div className="farm-fit">
      <div className="grid" style={{ '--n': cols, '--rows': rows } as CSSProperties}>
        {state.run.tiles.map((tile, i) => (
          <Cell key={i} tile={tile} state={state} onTap={() => onTap(i)} ring={jobOn(rings, i)} flash={jobOn(acted, i)} ordered={!!tile.cropId && orderedCrops.includes(tile.cropId)} />
        ))}
      </div>
    </div>
  )
}
