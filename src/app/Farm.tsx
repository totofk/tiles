import { useState } from 'react'
import { buySeeds, digForSeeds, selectCrop, setAutoBuySeeds } from '../core/actions'
import { cropSeedCost, digSeedDrop } from '../core/balance'
import { CROPS, CROP_IDS } from '../core/data/crops'
import type { GameState } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
import { Fields } from './Fields'
import { price } from './fmt'
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
      {/* batch 24.1: one shared grid for repeated rows — name | count | ⓘ | Buy ×1 | Buy ×10; the columns live
          on the container, rows are subgrids; the wrap is the container the two-line mode queries */}
      <div className="item-grid-wrap">
        <div className="item-grid">
        {run.licenses.map((id) => (
          <div key={id} className="item-row">
            <span className="item-name">
              <span className="item-label">
                {CROP_EMOJI[id]} {CROPS[id].name}
              </span>
            </span>
            <span className="item-count">×{run.seeds[id] ?? 0}</span>
            <span className="item-extra">
              <Info text={TIPS.pouch} />
            </span>
            {[1, 10].map((n) => (
              // batch 31.1 (task 166d): a manual buy of another crop's seeds also makes it the crop to plant
              <button
                key={n}
                disabled={!buySeeds(state, id, n).ok}
                onClick={() =>
                  act(
                    (s) => {
                      const r = buySeeds(s, id, n)
                      return r.ok && s.run.plantCrop !== id ? selectCrop(r.state, id) : r
                    },
                    (prev) => (prev.run.plantCrop !== id ? `Now planting ${CROP_EMOJI[id]} ${CROPS[id].name}` : null),
                  )
                }
              >
                Buy ×{n} <small>💰{price(n * cropSeedCost(id, meta))}</small>
              </button>
            ))}
          </div>
        ))}
        </div>
      </div>
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
export function Farm({ state, act, cropId, onSelectCrop, ui, toggleTools, worked, openEstate }: PanelProps) {
  const { run } = state
  const clerkSlot = worked.find((w) => w.job === 'clerk' && w.slot !== undefined)?.slot ?? null
  return (
    <section className="farm-tab">
      <Orders state={state} act={act} flashSlot={clerkSlot} />
      <Tools state={state} act={act} cropId={cropId} stacked open={ui.toolsOpen} onToggle={toggleTools} />
      <h2>Crop to plant</h2>
      <div className="shop-row">
        {CROP_IDS.filter((id) => run.licenses.includes(id)).map((id) => (
          <button key={id} className={id === cropId ? 'selected' : ''} aria-pressed={id === cropId} onClick={() => onSelectCrop(id)}>
            {CROP_EMOJI[id]} {CROPS[id].name}
            <small>seeds {run.seeds[id] ?? 0}</small>
            <small>{priceTag(state, id, ui.priceShown[id])}</small>
          </button>
        ))}
      </div>
      <SeedPouch state={state} act={act} />
      <DigSeeds act={act} />
      <Workers state={state} act={act} worked={worked} />
      <Workshop state={state} act={act} />
      <Fields state={state} onOpen={openEstate} />
    </section>
  )
}
