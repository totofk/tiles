import { buyUpgrade } from '../core/actions'
import {
  energyMax,
  energyRegenPerTick,
  growTimeFactor,
  sellPriceFactor,
  storageCost,
  storageMaxLevel,
  storageSlotsPerLevel,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
  veinMaxLevel,
  veinUpgradeCost,
} from '../core/balance'
import { UPGRADES, type UpgradeId } from '../core/data/upgrades'
import { buyStorage, upgradeVein } from '../core/mining'
import type { GameState, MetaState } from '../core/state'
import { dropText } from './Mine'
import type { Act } from './useGame'

const pct = (f: number) => `${Math.round(f * 100)} %`

/** "Energy max 15 → 20"; at the max level only the current value */
function effect(id: UpgradeId, level: number, meta: MetaState, maxed: boolean): string {
  const show = (label: string, value: (l: number) => string) =>
    maxed ? `${label} ${value(level)}` : `${label} ${value(level)} → ${value(level + 1)}`
  switch (id) {
    case 'energyMax':
      return show('Energy max', (l) => `${energyMax(l, meta)}`)
    case 'energyRegen':
      return show('Regen', (l) => `${energyRegenPerTick(l, meta).toFixed(2)}/s`)
    case 'sellPrice':
      return show('Sell price', (l) => `+${pct(sellPriceFactor(l) - 1)}`)
    case 'fertilizer':
      return show('Grow time', (l) => `−${pct(1 - growTimeFactor(l))}`)
  }
}

const price = (cost: { stone: number; cash: number }) => `🪨${cost.stone} 💰${cost.cash}`

const GROUPS: { title: string; ids: UpgradeId[] }[] = [
  { title: '⚡ Energy', ids: ['energyMax', 'energyRegen'] },
  { title: '🌱 Farm', ids: ['sellPrice', 'fertilizer'] },
]

/** storage and vein: paid in stone + cash, shown once the mine license is owned */
function MineUpgrades({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  const storageMaxed = run.storageLevel >= storageMaxLevel()
  const cap = run.bagCapacity
  const veinCost = veinUpgradeCost(run.vein.level, meta)
  const vein = run.vein.level
  return (
    <>
      <h2>⛏ Mine</h2>
      <div className="shop-row one-col">
        <button disabled={!buyStorage(state).ok} onClick={() => act(buyStorage)}>
          📦 Storage Lv {run.storageLevel}/{storageMaxLevel()}
          <small>
            {storageMaxed
              ? `Storage ${cap} slots · max`
              : `Storage ${cap} → ${cap + storageSlotsPerLevel()} slots · ${price(storageCost(run.storageLevel, meta))}`}
          </small>
        </button>
        <button disabled={!upgradeVein(state).ok} onClick={() => act(upgradeVein)}>
          ⛏️ Vein Lv {vein}/{veinMaxLevel()}
          <small>{veinCost ? `${dropText(vein)} → ${dropText(vein + 1)} · ${price(veinCost)}` : `${dropText(vein)} · max`}</small>
        </button>
      </div>
    </>
  )
}

export function Upgrades({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  return (
    <section className="shop">
      {GROUPS.map(({ title, ids }) => {
        const shown = ids.filter((id) => upgradeUnlocked(id, run.counters))
        if (shown.length === 0) return null
        return (
          <div key={title}>
            <h2>{title}</h2>
            <div className="shop-row one-col">
              {shown.map((id) => {
                const level = run.upgrades[id]
                const max = upgradeMaxLevel(id)
                const cost = upgradeCost(id, level, meta)
                const maxed = level >= max
                return (
                  <button key={id} disabled={maxed || run.cash < cost} onClick={() => act((s) => buyUpgrade(s, id))}>
                    {UPGRADES[id].name} Lv {level}/{max}
                    <small>{`${effect(id, level, meta, maxed)} · ${maxed ? 'max' : `💰${cost}`}`}</small>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {run.mineLicense && <MineUpgrades state={state} act={act} />}
    </section>
  )
}
