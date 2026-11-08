import { useState } from 'react'
import { buySeeds, digForSeeds, setAutoBuySeeds } from '../core/actions'
import { cropSeedCost, digSeedDrop } from '../core/balance'
import { CROPS, CROP_IDS } from '../core/data/crops'
import type { GameState } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
import { Info } from './Info'
import { HAND_EMOJI, priceTag } from './marketText'
import { Orders } from './Orders'
import type { PanelProps } from './panelTabs'
import { TIPS } from './tips'
import { Tools } from './Tools'
import type { Act } from './useGame'
import { Workers } from './Workers'
import { Workshop } from './Workshop'

/** seed pouch rows + auto-buy: in 🌾 Farm on desktop, in 🛒 Shop where there is no Farm tab */
export function SeedPouch({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  return (
    <>
      <h2>Seed pouch</h2>
      {run.licenses.map((id) => (
        <div key={id} className="pouch-row">
          <span>
            {CROP_EMOJI[id]} {CROPS[id].name} × {run.seeds[id] ?? 0}
          </span>
          <Info text={TIPS.pouch} />
          {[1, 10].map((n) => (
            <button key={n} disabled={!buySeeds(state, id, n).ok} onClick={() => act((s) => buySeeds(s, id, n))}>
              Buy ×{n} <small>💰{n * cropSeedCost(id, meta)}</small>
            </button>
          ))}
        </div>
      ))}
      <div className="pouch-auto">
        <label>
          <input type="checkbox" checked={run.autoBuySeeds} onChange={(e) => act((s) => setAutoBuySeeds(s, e.target.checked))} />
          Auto-buy a seed when the pouch is empty
        </label>
        <Info text={TIPS.autoBuy} />
      </div>
    </>
  )
}


export function DigSeeds({ act }: { act: Act }) {
  const [lastDig, setLastDig] = useState<string | null>(null)
  return (
    <p className="dig-seeds">
      <button
        onClick={() =>
          act(digForSeeds, (prev, next) => {
            const { crop } = digSeedDrop()
            const found = (next.run.seeds[crop] ?? 0) > (prev.run.seeds[crop] ?? 0)
            setLastDig(found ? `Found a ${CROP_EMOJI[crop]} ${CROPS[crop].name} seed!` : 'Nothing this time')
            return null
          })
        }
      >
        {HAND_EMOJI} Dig for seeds <small>⚡1</small>
      </button>
      {lastDig && <span role="status">{lastDig}</span>}
    </p>
  )
}

/** desktop side-panel tab: everything pressed while farming; the farm column then shows only the grid */
export function Farm({ state, act, cropId, onSelectCrop }: PanelProps) {
  const { run } = state
  return (
    <section className="farm-tab">
      <Orders state={state} act={act} />
      <Tools state={state} act={act} cropId={cropId} stacked />
      <h2>Crop to plant</h2>
      <div className="shop-row">
        {CROP_IDS.filter((id) => run.licenses.includes(id)).map((id) => (
          <button key={id} className={id === cropId ? 'selected' : ''} aria-pressed={id === cropId} onClick={() => onSelectCrop(id)}>
            {CROP_EMOJI[id]} {CROPS[id].name}
            <small>seeds {run.seeds[id] ?? 0}</small>
            <small>{priceTag(state, id)}</small>
          </button>
        ))}
      </div>
      <SeedPouch state={state} act={act} />
      <DigSeeds act={act} />
      <Workers state={state} act={act} />
      <Workshop state={state} act={act} />
    </section>
  )
}
