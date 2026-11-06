import { cropRotGraceTicks } from '../core/balance'
import type { CropId } from '../core/data/crops'
import type { GameState, MetaState, Tile } from '../core/state'
import { growthProgress, isDry, isMature, ticksUntilRot } from '../core/tile'
import { Bar } from './Bar'

export const CROP_EMOJI: Record<CropId, string> = { radish: '🥕', pumpkin: '🎃' }
// display only: the rot countdown turns red in the last quarter of the grace window
const ROT_WARN_FRACTION = 0.25

function Cell({ tile, meta, onTap }: { tile: Tile; meta: MetaState; onTap: () => void }) {
  const mature = isMature(tile, meta)
  const rotIn = ticksUntilRot(tile, meta)
  const grace = tile.cropId ? cropRotGraceTicks(tile.cropId, meta) : 1
  const growing = tile.status === 'planted' && !mature
  const dry = growing && isDry(tile)

  let emoji = '🟫'
  let label = 'Untilled'
  let mod = 'untilled'
  if (tile.status === 'tilled') [emoji, label, mod] = ['🟤', 'Tilled — plant', 'tilled']
  if (growing) [emoji, label, mod] = ['🌱', dry ? 'Dry — water!' : 'Growing', dry ? 'dry' : 'growing']
  if (mature) {
    const warn = rotIn! <= grace * ROT_WARN_FRACTION
    ;[emoji, label, mod] = [CROP_EMOJI[tile.cropId!], 'Mature — harvest!', warn ? 'rotting' : 'mature']
  }

  return (
    <button className={`cell cell-${mod}`} onClick={onTap}>
      <span className="cell-emoji">{emoji}</span>
      <span className="cell-label">{label}</span>
      {growing && <Bar value={growthProgress(tile, meta)} kind="grow" />}
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
  return (
    <section className="grid">
      {state.run.tiles.map((tile, i) => (
        <Cell key={i} tile={tile} meta={state.meta} onTap={() => onTap(i)} />
      ))}
    </section>
  )
}
