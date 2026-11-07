import { buyLicense, buySeeds, buyTile, setAutoBuySeeds } from '../core/actions'
import { TILE_CAP, cropSeedCost, licenseCost, mineLicenseCost, tileCost, toolCost, toolNMax, toolUnlock, woodCost } from '../core/balance'
import { CROPS, CROP_IDS, type CropId } from '../core/data/crops'
import { TOOLS, TOOL_JOBS } from '../core/data/tools'
import { buyMineLicense, buyWood } from '../core/mining'
import type { GameState } from '../core/state'
import { buyTool } from '../core/tools'
import { CROP_EMOJI } from './FarmGrid'
import type { Act } from './useGame'

/** per press, by level (index 0 = level 1) */
const TOOL_EFFECT = [() => '1 tile', (tiles: number) => `up to ${toolNMax(tiles)} tiles`, () => 'all tiles']

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

      <h2>Seed pouch</h2>
      {run.licenses.map((id) => (
        <div key={id} className="pouch-row">
          <span>
            {CROP_EMOJI[id]} {CROPS[id].name} × {run.seeds[id] ?? 0}
          </span>
          {[1, 10].map((n) => (
            <button key={n} disabled={!buySeeds(state, id, n).ok} onClick={() => act((s) => buySeeds(s, id, n))}>
              Buy ×{n} <small>💰{n * cropSeedCost(id, meta)}</small>
            </button>
          ))}
        </div>
      ))}
      <label className="pouch-auto">
        <input type="checkbox" checked={run.autoBuySeeds} onChange={(e) => act((s) => setAutoBuySeeds(s, e.target.checked))} />
        Auto-buy a seed when the pouch is empty
      </label>

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

      <h2>Farm tools</h2>
      <div className="shop-row">
        {TOOL_JOBS.flatMap((job) =>
          [1, 2, 3].map((level) => {
            const owned = run.tools[job]
            const { counter, at } = toolUnlock(job, level)
            const progress = `${job} ${Math.min(run.counters[counter], at)}/${at}`
            const status =
              owned >= level
                ? 'owned'
                : run.counters[counter] < at
                  ? progress
                  : owned < level - 1
                    ? `needs ${TOOLS[job].names[level - 2]}`
                    : `${TOOL_EFFECT[level - 1](tiles)} · 💰${toolCost(job, level, meta)}`
            const next = owned === level - 1
            return (
              <button key={`${job}${level}`} disabled={!next || !buyTool(state, job).ok} onClick={() => act((s) => buyTool(s, job))}>
                {TOOLS[job].names[level - 1]}
                <small>{status}</small>
              </button>
            )
          }),
        )}
      </div>
    </section>
  )
}
