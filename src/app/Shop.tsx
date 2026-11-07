import { buyLicense, buyTile, buyUpgrade } from '../core/actions'
import {
  TILE_CAP,
  cropSeedCost,
  energyMax,
  energyRegenPerTick,
  growTimeFactor,
  licenseCost,
  sellPriceFactor,
  tileCost,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
} from '../core/balance'
import { CROPS, CROP_IDS, type CropId } from '../core/data/crops'
import { UPGRADES, UPGRADE_IDS, type UpgradeId } from '../core/data/upgrades'
import type { GameState, MetaState } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
import type { Act } from './useGame'

const pct = (f: number) => `${Math.round(f * 100)} %`

function effect(id: UpgradeId, level: number, meta: MetaState): string {
  switch (id) {
    case 'energyMax':
      return `max ${energyMax(level, meta)} → ${energyMax(level + 1, meta)}`
    case 'energyRegen': {
      const fmt = (l: number) => energyRegenPerTick(l, meta).toFixed(2)
      return `regen ${fmt(level)}/s → ${fmt(level + 1)}/s`
    }
    case 'sellPrice':
      return `prices ${pct(sellPriceFactor(level))} → ${pct(sellPriceFactor(level + 1))}`
    case 'fertilizer':
      return `grow time ${pct(growTimeFactor(level))} → ${pct(growTimeFactor(level + 1))}`
  }
}

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

      <h2>Upgrades</h2>
      <div className="shop-row">
        {UPGRADE_IDS.filter((id) => upgradeUnlocked(id, run.counters)).map((id) => {
          const level = run.upgrades[id]
          const max = upgradeMaxLevel(id)
          const cost = upgradeCost(id, level, meta)
          const maxed = level >= max
          return (
            <button key={id} disabled={maxed || run.cash < cost} onClick={() => act((s) => buyUpgrade(s, id))}>
              {UPGRADES[id].name} Lv {level}/{max}
              <small>{maxed ? 'max level' : `${effect(id, level, meta)} · 💰${cost}`}</small>
            </button>
          )
        })}
        <button disabled={tiles >= TILE_CAP || run.cash < nextTile} onClick={() => act(buyTile)}>
          Buy tile ({tiles}/{TILE_CAP})
          <small>{tiles >= TILE_CAP ? 'max tiles' : `💰${nextTile}`}</small>
        </button>
      </div>
    </section>
  )
}
