import { buyLicense, buyTile } from '../core/actions'
import { TILE_CAP, cropSeedCost, licenseCost, mineLicenseCost, tileCost, woodCost } from '../core/balance'
import { CROPS, CROP_IDS, type CropId } from '../core/data/crops'
import { buyMineLicense, buyWood } from '../core/mining'
import type { GameState } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
import type { Act } from './useGame'

type Props = { state: GameState; cropId: CropId; onSelectCrop: (id: CropId) => void; act: Act }

export function Shop({ state, cropId, onSelectCrop, act }: Props) {
  const { run, meta } = state
  const tiles = run.tiles.length
  const nextTile = tileCost(tiles, meta)

  return (
    <section className="shop">
      <h2>Seeds</h2>
      <div className="shop-row">
        {CROP_IDS.map((id) => {
          if (run.licenses.includes(id))
            return (
              <button key={id} className={id === cropId ? 'selected' : ''} aria-pressed={id === cropId} onClick={() => onSelectCrop(id)}>
                {CROP_EMOJI[id]} {CROPS[id].name}
                <small>seed 💰{cropSeedCost(id, meta)}</small>
              </button>
            )
          const cost = licenseCost(id, meta)
          return (
            <button key={id} className="locked" disabled={run.cash < cost} onClick={() => act((s) => buyLicense(s, id))}>
              🔒 {CROPS[id].name}
              <small>license 💰{cost}</small>
            </button>
          )
        })}
      </div>

      <h2>Supplies</h2>
      <div className="shop-row">
        {run.mineLicense ? (
          <button disabled={!buyWood(state, 1).ok} onClick={() => act((s) => buyWood(s, 1))}>
            🪵 Wood
            <small>💰{woodCost(meta)}</small>
          </button>
        ) : (
          <button disabled={run.cash < mineLicenseCost(meta)} onClick={() => act(buyMineLicense)}>
            ⛏️ Mine license
            <small>💰{mineLicenseCost(meta)}</small>
          </button>
        )}
        <button disabled={tiles >= TILE_CAP || run.cash < nextTile} onClick={() => act(buyTile)}>
          Buy tile ({tiles}/{TILE_CAP})
          <small>{tiles >= TILE_CAP ? 'max tiles' : `💰${nextTile}`}</small>
        </button>
      </div>
    </section>
  )
}
