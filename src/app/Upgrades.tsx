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
import { buyStorage, dropText, upgradeVein } from '../core/mining'
import type { GameState, MetaState } from '../core/state'
import { Item } from './Info'
import { price } from './fmt'
import { priceText } from './Mine'
import { TIPS, UPGRADE_TIPS } from './tips'
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
  const mastered = run.masteredTiers.length
  return (
    <>
      <h2>⛏ Mine</h2>
      <div className="shop-row one-col">
        <Item tip={TIPS.storage}>
          <button disabled={!buyStorage(state).ok} onClick={() => act(buyStorage)}>
            📦 Storage Lv {run.storageLevel}/{storageMaxLevel()}
            <small>
              {storageMaxed
                ? `Storage ${cap} slots · max`
                : `Storage ${cap} → ${cap + storageSlotsPerLevel()} slots · ${priceText(storageCost(run.storageLevel, meta))}`}
            </small>
          </button>
        </Item>
        <Item tip={TIPS.vein}>
          <button disabled={!upgradeVein(state).ok} onClick={() => act(upgradeVein)}>
            ⛏️ Vein Lv {vein}/{veinMaxLevel()}
            <small>
              {veinCost ? `${dropText(vein, mastered)} → ${dropText(vein + 1, mastered)} · ${priceText(veinCost)}` : `${dropText(vein, mastered)} · max`}
            </small>
          </button>
        </Item>
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
                  <Item key={id} tip={UPGRADE_TIPS[id]}>
                    <button disabled={maxed || run.cash < cost} onClick={() => act((s) => buyUpgrade(s, id))}>
                      {UPGRADES[id].name} Lv {level}/{max}
                      <small>{`${effect(id, level, meta, maxed)} · ${maxed ? 'max' : `💰${price(cost)}`}`}</small>
                    </button>
                  </Item>
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
