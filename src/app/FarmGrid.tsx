import { useState, type CSSProperties } from 'react'
import { BANK_BEDS, cropRotGraceTicks, sprinklerCost, treeCadenceTicks, treePlantCost, waterMoisture } from '../core/balance'
import { CROP_GROUPS, CROPS, type CropId } from '../core/data/crops'
import { plantTreeBed } from '../core/tree'
import { price } from './fmt'
import { BOARD_EMOJI } from '../core/data/orders'
import { isOffer } from '../core/orders'
import type { GameState, Tile } from '../core/state'
import { growthProgress, isDry, isMature, ticksUntilRot } from '../core/tile'
import { buildSprinkler, SPRINKLER_EMOJI } from '../core/workshop'
import { workerTargets, type TileJob, type WorkerTarget } from '../core/workers'
import { Bar } from './Bar'
import { Modal } from './Modal'
import { priceText } from './Mine'
import { shortOf } from './Workshop'
import { ERROR_TEXT, WORKER_JOB_EMOJI, type Act } from './useGame'

const TREE_EMOJI = '🌳'

export const CROP_EMOJI: Record<CropId, string> = {
  potato: '🥔',
  radish: '🥕',
  corn: '🌽',
  eggplant: '🍆',
  pumpkin: '🎃',
  tomato: '🍅',
  lemon: '🍋',
  grape: '🍇',
  strawberry: '🍓',
  chilli: '🌶️',
  ancientFruit: '🌰',
}
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
  /** this tile's bed has a sprinkler: no water bar, no dry label — its moisture is the sprinkler's, not the player's */
  irrigated?: boolean
  /** a 🌳 tree tile: the fruit waiting on it (no bars, no crop states) */
  fruit?: number
}

function Cell({ tile, state, onTap, ring, flash, ordered, irrigated, fruit }: CellProps) {
  if (fruit !== undefined) {
    const crop = state.run.tree!.crop
    return (
      <button className={['cell', 'cell-tree', ring && `cell-target cell-target-${ring}`, flash && 'cell-flash'].filter(Boolean).join(' ')} onClick={onTap}>
        <span className="cell-emoji">{TREE_EMOJI}</span>
        {fruit > 0 && <span className="cell-label">{`${CROP_EMOJI[crop]}${fruit}`}</span>}
      </button>
    )
  }
  const mature = isMature(tile, state)
  const rotIn = ticksUntilRot(tile, state)
  const grace = tile.cropId ? cropRotGraceTicks(tile.cropId, state.meta, state.run.listing.soil) : 1
  const growing = tile.status === 'planted' && !mature
  const dry = growing && !irrigated && isDry(tile)

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
      {tile.status !== 'untilled' && !irrigated && <Bar value={tile.moisture / waterMoisture(state.run.toolTier.water)} kind="water" />}
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
 * act: without it (jsdom layout tests) the socket stub renders but never opens its sheet.
 */
export function FarmGrid({ state, onTap, acted = [], act }: { state: GameState; onTap: (i: number) => void; acted?: WorkerTarget[]; act?: Act }) {
  // beds of 3×2 (DECISIONS "Home lot = 4 beds of 3×2"): bed k = tiles 6k…6k+5, so a bed's shape never shifts when a
  // tile is bought — the last started bed pads its unowned slots with .cell-slot
  const beds = Math.ceil(state.run.tiles.length / 6)
  const rings = workerTargets(state)
  const jobOn = (list: WorkerTarget[], i: number) => list.find((t) => t.tile === i)?.job
  const orderedCrops = state.run.orders.offers.flatMap((s) => (isOffer(s) && s.accepted ? [s.good] : []))
  // rows of tiles for the ≥ 768 px size formula: stacked = one bed per row, paired = two beds per row
  const style = { '--rows-paired': 2 * Math.ceil(beds / 2), '--rows-stacked': 2 * beds } as CSSProperties
  // the bed whose socket sheet is open (batch 26); closing the sheet is the cancel — no placement mode
  const [sheet, setSheet] = useState<number | null>(null)
  const { run } = state
  // batch 36.3: Wetlands' bank beds — the river waters them, so they have no sprinkler socket
  const bank = (k: number) => run.listing.district === 'wetlands' && k < BANK_BEDS
  const sprinklerOpen = (k: number) => run.workshop.built && run.workshop.beds[k] !== true && !bank(k)
  // batch 36.2: an Orchard Valley run with no tree yet can plant one from any bed's socket
  const treeOpen = run.listing.district === 'orchardValley' && run.tree === null
  const treeCrops = CROP_GROUPS.berry.filter((c) => run.licenses.includes(c))
  const sheetCost = sheet !== null && sprinklerOpen(sheet) ? sprinklerCost(state.meta) : null
  return (
    <div className="farm-fit">
      <div className="beds-wrap">
        <div className="beds" style={style}>
          {Array.from({ length: beds }, (_, k) => {
            const irrigated = state.run.workshop.beds[k] === true || bank(k)
            return (
              <div className={bank(k) ? 'bed bed-irrigated bed-bank' : irrigated ? 'bed bed-irrigated' : 'bed'} role="group" aria-label={`Bed ${k + 1}`} key={k}>
                {bank(k) ? (
                  <span className="bed-fountain" title="The river waters this bed forever">
                    🌊
                  </span>
                ) : (
                  irrigated && (
                    <span className="bed-fountain" title="A sprinkler waters this bed forever">
                      {SPRINKLER_EMOJI}
                    </span>
                  )
                )}
                {(sprinklerOpen(k) || (treeOpen && (k + 1) * 6 <= run.tiles.length)) && (
                  <button
                    className={buildSprinkler(state, k).ok || treeCrops.some((c) => plantTreeBed(state, k, c).ok) ? 'bed-socket bed-socket-ready' : 'bed-socket'}
                    aria-label={`Bed ${k + 1} ${sprinklerOpen(k) ? 'sprinkler' : 'tree'} socket`}
                    onClick={() => setSheet(k)}
                  >
                    {sprinklerOpen(k) ? SPRINKLER_EMOJI : TREE_EMOJI}
                  </button>
                )}
                {state.run.tiles.slice(k * 6, k * 6 + 6).map((tile, j) => (
                  <Cell key={k * 6 + j} tile={tile} state={state} onTap={() => onTap(k * 6 + j)} ring={jobOn(rings, k * 6 + j)} flash={jobOn(acted, k * 6 + j)} ordered={!!tile.cropId && orderedCrops.includes(tile.cropId)} irrigated={irrigated} fruit={run.tree?.bed === k ? run.tree.stock[j] : undefined} />
                ))}
                {Array.from({ length: (k + 1) * 6 - state.run.tiles.length }, (_, j) => (
                  <span className="cell-slot" aria-hidden="true" key={`slot${j}`} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      {sheet !== null && (sheetCost || treeOpen) && (
        <Modal title={sheetCost ? `Bed ${sheet + 1} sprinkler` : `Bed ${sheet + 1}`} close={() => setSheet(null)}>
          {sheetCost && (
            <>
              <p className="sheet-line">Waters these 6 tiles forever</p>
              <p className="sheet-line">Permanent — cannot be moved or sold</p>
              <p className="sheet-price">{priceText(sheetCost)}</p>
              {shortOf(sheetCost, state.run).length > 0 && <p className="sheet-short">needs {shortOf(sheetCost, state.run).join(', ')} more</p>}
              <button
                className="sheet-build"
                disabled={shortOf(sheetCost, state.run).length > 0}
                onClick={() => {
                  act?.((s) => buildSprinkler(s, sheet))
                  setSheet(null)
                }}
              >
                Build
              </button>
            </>
          )}
          {treeOpen && (
            <>
              <h3>{TREE_EMOJI} Fruit tree</h3>
              {treeCrops.map((c) => {
                const r = plantTreeBed(state, sheet, c)
                return (
                  <button
                    key={c}
                    className="sheet-build"
                    disabled={!r.ok}
                    onClick={() => {
                      act?.((s) => plantTreeBed(s, sheet, c))
                      setSheet(null)
                    }}
                  >
                    {CROP_EMOJI[c]} {CROPS[c].name} · 💰{price(treePlantCost(c, state.meta))}
                    {!r.ok && <small>{ERROR_TEXT[r.error]}</small>}
                  </button>
                )
              })}
              {treeCrops.length > 0 && (
                <p className="sheet-line">Fruits every {treeCrops.map((c) => Math.round(treeCadenceTicks(c) / 60)).join(' / ')} min, no water, never rots</p>
              )}
              <p className="sheet-line">Permanent for this farm — cannot be moved</p>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
