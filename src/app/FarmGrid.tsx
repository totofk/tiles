import type { CSSProperties } from 'react'
import { cropRotGraceTicks } from '../core/balance'
import { CROPS, type CropId } from '../core/data/crops'
import type { GameState, Tile } from '../core/state'
import { growthProgress, isDry, isMature, ticksUntilRot } from '../core/tile'
import { Bar } from './Bar'

export const CROP_EMOJI: Record<CropId, string> = { radish: '🥕', pumpkin: '🎃' }
// display only: the rot countdown turns red in the last quarter of the grace window
const ROT_WARN_FRACTION = 0.25

function Cell({ tile, state, onTap }: { tile: Tile; state: GameState; onTap: () => void }) {
  const mature = isMature(tile, state)
  const rotIn = ticksUntilRot(tile, state)
  const grace = tile.cropId ? cropRotGraceTicks(tile.cropId, state.meta) : 1
  const growing = tile.status === 'planted' && !mature
  const dry = growing && isDry(tile)

  let emoji = '🟫'
  let label = 'Untilled'
  let mod = 'untilled'
  if (tile.status === 'tilled') [emoji, label, mod] = ['🟤', 'Tilled — plant', 'tilled']
  if (growing) {
    const name = `${CROPS[tile.cropId!].name} ${Math.floor(growthProgress(tile, state) * 100)} %`
    ;[emoji, label, mod] = [CROP_EMOJI[tile.cropId!], dry ? `${name} — dry!` : name, dry ? 'dry' : 'growing']
  }
  if (mature) {
    const warn = rotIn! <= grace * ROT_WARN_FRACTION
    ;[emoji, label, mod] = [CROP_EMOJI[tile.cropId!], 'Mature — harvest!', warn ? 'rotting' : 'mature']
  }

  return (
    <button className={`cell cell-${mod}`} onClick={onTap}>
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

export function FarmGrid({ state, onTap }: { state: GameState; onTap: (i: number) => void }) {
  // a near-square grid on wider screens (9 → 3, 16 → 4, 24 → 5 columns); mobile CSS keeps 3
  const cols = Math.ceil(Math.sqrt(state.run.tiles.length))
  return (
    <div className="grid" style={{ '--n': cols } as CSSProperties}>
      {state.run.tiles.map((tile, i) => (
        <Cell key={i} tile={tile} state={state} onTap={() => onTap(i)} />
      ))}
    </div>
  )
}
