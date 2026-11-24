import { useState } from 'react'
import { buySeeds, digForSeeds, selectCrop, setAutoBuySeeds } from '../core/actions'
import { cropSeedCost, digSeedDrop } from '../core/balance'
import { ANCIENT_CROP, CROPS, CROP_IDS } from '../core/data/crops'
import { RELIC_IDS, RELICS } from '../core/data/relics'
import { pickRelic, relicSet, reserveCap } from '../core/relics'
import type { GameState } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
import { Fields } from './Fields'
import { price } from './fmt'
import { Bar } from './Bar'
import { Info } from './Info'
import { LegacyChip } from './Legacy'
import { HAND_EMOJI, badgeText, priceTag, renownTitle } from './marketText'
import { Orders } from './Orders'
import type { PanelProps } from './panelTabs'
import { SoilTraits } from './SoilTraits'
import { TIPS } from './tips'
import type { Act } from './useGame'
import { Workers } from './Workers'
import { Workshop } from './Workshop'

/** seed pouch rows + auto-buy: in the 🌾 Farm menu tab (batch 38: at every width; the Shop never carries it) */
export function SeedPouch({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  return (
    <>
      {/* batch 36.7: ONE ⓘ beside the heading — the rows themselves carry none */}
      <div className="h-with-info">
        <h2>Seed pouch</h2>
        <Info text={TIPS.pouch} />
      </div>
      {/* batch 24.1: one shared grid for repeated rows; batch 36.7: the pouch drops the ⓘ column (4 cells) */}
      <div className="item-grid-wrap">
        <div className="item-grid pouch-grid">
        {run.licenses.map((id) => (
          <div key={id} className="item-row">
            <span className="item-name">
              <span className="item-label">
                {CROP_EMOJI[id]} {CROPS[id].name}
                {badgeText(state, id)}
              </span>
            </span>
            <span className="item-count">×{run.seeds[id] ?? 0}</span>
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
        {/* batch 36.4: the dig-only ancient seed — no shop sells it, so no Buy buttons; shown once found or held */}
        {(run.finds.ancientSeeds > 0 || (run.seeds[ANCIENT_CROP] ?? 0) > 0) && (
          <div className="item-row">
            <span className="item-name">
              <span className="item-label">🦴 Ancient seed</span>
            </span>
            <span className="item-count">×{run.seeds[ANCIENT_CROP] ?? 0}</span>
            <span />
            <span />
          </div>
        )}
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


export function DigSeeds({ state, act }: { state: GameState; act: Act }) {
  const [lastDig, setLastDig] = useState<string | null>(null)
  const { run } = state
  return (
    <>
      <p className="dig-seeds">
        <button
          onClick={() =>
            act(digForSeeds, (prev, next) => {
              const { crop } = digSeedDrop()
              // batch 36.4: list every find of this dig, in a fixed order, by comparing prev/next
              const parts: string[] = []
              if ((next.run.seeds[crop] ?? 0) > (prev.run.seeds[crop] ?? 0)) parts.push(`a ${CROP_EMOJI[crop]} ${CROPS[crop].name} seed`)
              if (!prev.run.finds.book && next.run.finds.book) parts.push('the 📖 collection book')
              if (next.run.finds.shards > prev.run.finds.shards) parts.push('a 🏺 relic shard')
              if (next.run.finds.starDust > prev.run.finds.starDust) parts.push('✨ star dust (⭐+1)')
              const ancient = next.run.finds.ancientSeeds - prev.run.finds.ancientSeeds
              if (ancient === 1) parts.push('a 🦴 ancient seed')
              if (ancient > 1) parts.push(`${ancient} 🦴 ancient seeds`)
              setLastDig(parts.length > 0 ? `Found ${parts.join(' + ')}!` : 'Nothing this time')
              return null
            })
          }
        >
          {HAND_EMOJI} Dig for seeds <small>⚡1</small>
        </button>
        {lastDig && <span role="status">{lastDig}</span>}
      </p>
      {/* batch 36.4: the 📖 collection book opens on the run's first dig; no HUD change (the reserve lives here too) */}
      {run.finds.book && (
        <section className="relic-book" aria-label="Collection book">
          <h3>📖 Collection book</h3>
          <p className="relic-shards">{relicSet(run) ? '🏺 Set complete — every rule ×1.5' : `🏺 Shards ${run.finds.shards} · 5 buy one rule`}</p>
          <ul>
            {RELIC_IDS.map((id) => (
              <li key={id}>
                <span>
                  {RELICS[id].name} — {RELICS[id].text}
                </span>
                {run.relics.includes(id) ? (
                  <em>✓ owned</em>
                ) : (
                  <button disabled={!pickRelic(state, id).ok} onClick={() => act((s) => pickRelic(s, id))}>
                    Take 🏺5
                  </button>
                )}
              </li>
            ))}
          </ul>
          {run.relics.includes('overflowReserve') && (
            <p className="relic-reserve">
              🔋 Reserve {Math.floor(run.energyReserve)} / {reserveCap(run, state.meta)}
              <Bar value={run.energyReserve / reserveCap(run, state.meta)} kind="energy" />
            </p>
          )}
          <small>
            Ever found: 🏺 {run.lifetime.shardsFound} · ✨ {run.lifetime.starDustFound} · 🦴 {run.lifetime.ancientSeedsFound} · rules {run.lifetime.relicsEver.length} / 6 · relics are lost when the farm is sold
          </small>
        </section>
      )}
    </>
  )
}

/** the 🌾 Farm menu tab (batch 38: at every width). The planting line + the 🧰 Tools bar live on the 🌱 Farm
 *  main view instead (C3); this tab keeps the cards: chip, orders, picker, pouch, dig, workers, workshop,
 *  soil, fields. */
export function Farm({ state, act, cropId, onSelectCrop, ui, worked, openEstate, openBank }: PanelProps) {
  const { run } = state
  const clerkSlot = worked.find((w) => w.job === 'clerk' && w.slot !== undefined)?.slot ?? null
  return (
    <section className="farm-tab">
      <LegacyChip state={state} openBank={openBank} />
      <Orders state={state} act={act} flashSlot={clerkSlot} />
      <div className="h-with-info">
        <h2>Crop to plant</h2>
        <Info text={TIPS.plantPick} />
      </div>
      <div className="shop-row">
        {CROP_IDS.filter((id) => run.licenses.includes(id)).map((id) => (
          <button key={id} className={id === cropId ? 'selected' : ''} aria-pressed={id === cropId} title={renownTitle(state, id)} onClick={() => onSelectCrop(id)}>
            {CROP_EMOJI[id]} {CROPS[id].name}
            {badgeText(state, id)}
            <small>seeds {run.seeds[id] ?? 0}</small>
            <small>{priceTag(state, id, ui.priceShown[id])}</small>
          </button>
        ))}
        {/* batch 36.4: the ancient crop joins the list while a seed is held (or it is still the selected crop) */}
        {((run.seeds[ANCIENT_CROP] ?? 0) > 0 || cropId === ANCIENT_CROP) && (
          <button className={cropId === ANCIENT_CROP ? 'selected' : ''} aria-pressed={cropId === ANCIENT_CROP} onClick={() => onSelectCrop(ANCIENT_CROP)}>
            {CROP_EMOJI[ANCIENT_CROP]} {CROPS[ANCIENT_CROP].name}
            <small>seeds {run.seeds[ANCIENT_CROP] ?? 0}</small>
            <small>{priceTag(state, ANCIENT_CROP, ui.priceShown[ANCIENT_CROP])}</small>
          </button>
        )}
      </div>
      <SeedPouch state={state} act={act} />
      <DigSeeds state={state} act={act} />
      <Workers state={state} act={act} worked={worked} />
      <Workshop state={state} act={act} />
      <SoilTraits state={state} act={act} />
      <Fields state={state} onOpen={openEstate} />
    </section>
  )
}
