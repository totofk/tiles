import { buyUpgrade } from '../core/actions'
import {
  energyMax,
  energyRegenPerTick,
  growTimeFactor,
  sellPriceFactor,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
} from '../core/balance'
import { UPGRADES, UPGRADE_IDS, type UpgradeId } from '../core/data/upgrades'
import type { GameState, MetaState } from '../core/state'
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

export function Upgrades({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  return (
    <section className="shop">
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
      </div>
    </section>
  )
}
