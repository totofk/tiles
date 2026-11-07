import type { ActionResult } from '../core/actions'
import {
  isSellable,
  itemSellPrice,
  masteredPreserveBonus,
  masteryLevel,
  masteryMaxLevel,
  masteryThresholds,
  mineHits,
  mineLicenseCost,
  pickaxeRecipe,
  stoneHits,
  veinDrops,
  veinUpgradeCost,
  woodCost,
  type Price,
} from '../core/balance'
import { ITEMS, ITEM_IDS } from '../core/data/items'
import {
  activePickaxe,
  bagCount,
  buyMineLicense,
  buyWood,
  craftPickaxe,
  dig,
  expectedUses,
  repairPickaxe,
  sellItem,
  upgradeVein,
} from '../core/mining'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { ERROR_TEXT, type Act } from './useGame'

/** the next ore after the last vein level; a teaser with no numbers until the furnace batch */
const LOCKED_VEIN_TEXT = '🔒 Lv2: iron ore — needs Furnace (coming)'
/** what "sell all" sells when storage is full; wood stays for crafting and repairs */
const SELL_WHEN_FULL = ITEM_IDS.filter(isSellable).filter((id) => id !== 'wood')

export function dropText(level: number): string {
  const drops = veinDrops(level)
  const total = ITEM_IDS.reduce((sum, id) => sum + (drops[id] ?? 0), 0)
  return ITEM_IDS.filter((id) => (drops[id] ?? 0) > 0)
    .map((id) => `${ITEMS[id].emoji} ${ITEMS[id].name} ${Math.round(((drops[id] ?? 0) / total) * 100)} %`)
    .join(' · ')
}

/** "🪨20 ⚫5 💰150" */
export function priceText(price: Price): string {
  return [...ITEM_IDS.filter((id) => price[id]).map((id) => `${ITEMS[id].emoji}${price[id]}`), `💰${price.cash}`].join(' ')
}

function sellAll(s: GameState): ActionResult {
  return SELL_WHEN_FULL.reduce<ActionResult>((r, id) => {
    const n = r.ok ? (r.state.run.inventory[id] ?? 0) : 0
    return r.ok && n > 0 ? sellItem(r.state, id, n) : r
  }, { ok: true, state: s })
}

export function Mine({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  if (!run.mineLicense) {
    const cost = mineLicenseCost(meta)
    return (
      <section className="mine mine-locked">
        <h2>🔒 Mine</h2>
        <p>Spend idle energy digging stone to sell.</p>
        <button disabled={run.cash < cost} onClick={() => act(buyMineLicense)}>
          ⛏️ Mine license 💰{cost}
        </button>
      </section>
    )
  }
  // the core actions double as "can I?" checks, so the disabled reason is the action's own error
  const digCheck = dig(state)
  const recipe = pickaxeRecipe('wooden')
  const hits = mineHits(activePickaxe(run)?.tier ?? null)
  const repair = repairPickaxe(state)
  const cracked = run.vein.progress > 0
  const nextVein = veinUpgradeCost(run.vein.level, meta)
  const veinCheck = upgradeVein(state)
  const fullValue = SELL_WHEN_FULL.reduce(
    (sum, id) => sum + (run.inventory[id] ?? 0) * itemSellPrice(id, meta, run.upgrades.sellPrice),
    0,
  )
  const tier = run.pickaxe?.tier
  const xp = tier ? (run.mastery[tier] ?? 0) : 0
  const thresholds = tier ? masteryThresholds(tier) : []
  const level = tier ? masteryLevel(tier, xp) : 0
  const max = masteryMaxLevel()
  const from = level > 0 ? thresholds[level - 1] : 0
  const toNext = level >= max ? 1 : (xp - from) / (thresholds[level] - from)

  return (
    <section className="mine">
      <h2>
        ⛏️ Mine{' '}
        <small>
          📦 Storage {bagCount(run)} / {run.bagCapacity}
        </small>
      </h2>
      <button className="mine-dig" disabled={!digCheck.ok} onClick={() => act(dig)}>
        ⛏️ Dig
        <small>
          {digCheck.ok
            ? `⚡1 → ${hits} hit${hits > 1 ? 's' : ''} · ${cracked ? '🪨 cracked' : '🪨'} ${run.vein.progress}/${stoneHits()}`
            : ERROR_TEXT[digCheck.error]}
        </small>
      </button>
      {!digCheck.ok && digCheck.error === 'BAG_FULL' && fullValue > 0 && (
        <button onClick={() => act(sellAll)}>
          Sell all {SELL_WHEN_FULL.filter((id) => (run.inventory[id] ?? 0) > 0).map((id) => ITEMS[id].emoji).join(' ')} 💰
          {fullValue}
        </button>
      )}
      <div className="mine-vein">
        <span>
          Vein Lv{run.vein.level}: {dropText(run.vein.level)}
        </span>
        {nextVein && (
          <>
            <span className="mine-vein-next">
              Lv{run.vein.level + 1}: {dropText(run.vein.level + 1)} — {nextVein.stone} 🪨 + 💰{nextVein.cash}
            </span>
            <button disabled={!veinCheck.ok} onClick={() => act(upgradeVein)}>
              Upgrade vein to Lv{run.vein.level + 1}
              {!veinCheck.ok && <small> — {ERROR_TEXT[veinCheck.error]}</small>}
            </button>
          </>
        )}
        <span className="mine-vein-next">{LOCKED_VEIN_TEXT}</span>
      </div>
      {run.pickaxe?.durability === 0 ? (
        <button disabled={!repair.ok} onClick={() => act(repairPickaxe)}>
          Blunt pickaxe — repair ({recipe.repairWood} 🪵)
          {!repair.ok && <small>{ERROR_TEXT[repair.error]}</small>}
        </button>
      ) : run.pickaxe ? (
        <div className="mine-pickaxe">
          <span>
            Wooden pickaxe {run.pickaxe.durability} / {recipe.durability} · lasts ~
            {Math.round(expectedUses(run.pickaxe.tier, run))} uses
          </span>
          <Bar value={run.pickaxe.durability / recipe.durability} kind="tool" />
        </div>
      ) : (
        <button disabled={!craftPickaxe(state).ok} onClick={() => act(craftPickaxe)}>
          No pickaxe — craft ({recipe.wood} 🪵)
        </button>
      )}
      {tier && (
        <div className="mine-pickaxe">
          <span>
            Mastery Lv {level}/{max} · {level >= max ? xp : `${xp}/${thresholds[level]}`} xp
          </span>
          <Bar value={toNext} kind="grow" />
          {run.masteredTiers.includes(tier) && (
            <span className="mine-badge">Mastered ✓ +{Math.round(masteredPreserveBonus() * 100)} % all pickaxes</span>
          )}
        </div>
      )}
      <button disabled={!buyWood(state, 1).ok} onClick={() => act((s) => buyWood(s, 1))}>
        Buy wood 💰{woodCost(meta)}
      </button>
      {ITEM_IDS.filter((id) => (run.inventory[id] ?? 0) > 0).map((id) => (
        <div key={id} className="mine-item">
          <span>
            {ITEMS[id].emoji} {ITEMS[id].name} ×{run.inventory[id]}
          </span>
          {isSellable(id) && (
            <>
              <button onClick={() => act((s) => sellItem(s, id, 1))}>sell 1</button>
              <button onClick={() => act((s) => sellItem(s, id, s.run.inventory[id] ?? 0))}>sell all</button>
              <small>💰{itemSellPrice(id, meta, run.upgrades.sellPrice)} each</small>
            </>
          )}
        </div>
      ))}
    </section>
  )
}
