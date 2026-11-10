import type { GameState } from '../core/state'
import { isDry, isMature } from '../core/tile'
import { CROP_EMOJI } from './FarmGrid'

/** the home lot shrunk to one glance (batch 25, mounted in batch 27). 40 px tiles are under the 44 px tap
 *  minimum, so the whole lot is a single button and a tile never acts alone. */
export function MiniLot({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const tiles = state.run.tiles
  const ripe = tiles.filter((t) => isMature(t, state)).length
  return (
    <button className="mini-lot" aria-label={`Home lot — ${ripe} ripe, open`} onClick={onOpen}>
      {Array.from({ length: Math.ceil(tiles.length / 6) }, (_, k) => (
        <div className="bed" role="group" aria-label={`Bed ${k + 1}`} key={k}>
          {tiles.slice(k * 6, k * 6 + 6).map((tile, i) => {
            const mature = isMature(tile, state)
            const growing = tile.status === 'planted' && !mature
            const mod = mature ? 'mini-ready' : growing ? (isDry(tile) ? 'mini-dry' : 'mini-growing') : 'mini-empty'
            return (
              <span className={`mini-tile ${mod}`} key={i}>
                {growing || mature ? CROP_EMOJI[tile.cropId!] : null}
              </span>
            )
          })}
        </div>
      ))}
      {ripe > 0 && <span className="mini-badge">🧺 {ripe}</span>}
    </button>
  )
}
