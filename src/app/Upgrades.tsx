import { buyUpgrade } from '../core/actions'
import {
  energyMax,
  energyRegenPerTick,
  growTimeFactor,
  sellPriceFactor,
  storageCost,
  storageMaxLevel,
  storageSlotsPerLevel,
  toolCost,
  toolNMax,
  toolUnlock,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
  veinMaxLevel,
  veinUpgradeCost,
} from '../core/balance'
import { TOOLS, TOOL_JOBS } from '../core/data/tools'
import { UPGRADES, UPGRADE_IDS, type UpgradeId } from '../core/data/upgrades'
import { buyStorage, upgradeVein } from '../core/mining'
import type { GameState, MetaState } from '../core/state'
import { buyTool } from '../core/tools'
import type { Act } from './useGame'

const pct = (f: number) => `${Math.round(f * 100)} %`
/** per press, by level (index 0 = level 1) */
const TOOL_EFFECT = [() => '1 tile', (tiles: number) => `up to ${toolNMax(tiles)} tiles`, () => 'all tiles']

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

const price = (cost: { stone: number; cash: number }) => `🪨${cost.stone} 💰${cost.cash}`

/** storage and vein: paid in stone + cash, shown once the mine license is owned */
function MineUpgrades({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  const storageMaxed = run.storageLevel >= storageMaxLevel()
  const veinCost = veinUpgradeCost(run.vein.level, meta)
  return (
    <>
      <h2>Mine</h2>
      <div className="shop-row">
        <button disabled={!buyStorage(state).ok} onClick={() => act(buyStorage)}>
          📦 Storage Lv {run.storageLevel}/{storageMaxLevel()}
          <small>
            {storageMaxed ? 'max level' : `+${storageSlotsPerLevel()} slots · ${price(storageCost(run.storageLevel, meta))}`}
          </small>
        </button>
        <button disabled={!upgradeVein(state).ok} onClick={() => act(upgradeVein)}>
          ⛏️ Vein Lv {run.vein.level}/{veinMaxLevel()}
          <small>{veinCost ? `new drops · ${price(veinCost)}` : 'max level'}</small>
        </button>
      </div>
    </>
  )
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
      {run.mineLicense && <MineUpgrades state={state} act={act} />}
      <h2>Tools</h2>
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
                    : `${TOOL_EFFECT[level - 1](run.tiles.length)} · 💰${toolCost(job, level, meta)}`
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
