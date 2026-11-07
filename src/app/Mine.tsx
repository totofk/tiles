import { itemSellPrice, mineHits, mineLicenseCost, pickaxeRecipe, stoneHits, woodCost } from '../core/balance'
import { ITEMS, ITEM_IDS } from '../core/data/items'
import { activePickaxe, bagCount, buyMineLicense, buyWood, craftPickaxe, dig, repairPickaxe, sellItem } from '../core/mining'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { ERROR_TEXT, type Act } from './useGame'

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

  return (
    <section className="mine">
      <h2>
        ⛏️ Mine{' '}
        <small>
          bag {bagCount(run)} / {run.bagCapacity}
        </small>
      </h2>
      <button className="mine-dig" disabled={!digCheck.ok} onClick={() => act(dig)}>
        ⛏️ Dig
        <small>
          {digCheck.ok ? `⚡1 → ${hits} hit${hits > 1 ? 's' : ''} · stone ${run.vein.progress}/${stoneHits()}` : ERROR_TEXT[digCheck.error]}
        </small>
      </button>
      {run.pickaxe?.durability === 0 ? (
        <button disabled={!repair.ok} onClick={() => act(repairPickaxe)}>
          Blunt pickaxe — repair ({recipe.repairWood} 🪵)
          {!repair.ok && <small>{ERROR_TEXT[repair.error]}</small>}
        </button>
      ) : run.pickaxe ? (
        <div className="mine-pickaxe">
          <span>
            Wooden pickaxe {run.pickaxe.durability} / {recipe.durability}
          </span>
          <Bar value={run.pickaxe.durability / recipe.durability} kind="tool" />
        </div>
      ) : (
        <button disabled={!craftPickaxe(state).ok} onClick={() => act(craftPickaxe)}>
          No pickaxe — craft ({recipe.wood} 🪵)
        </button>
      )}
      <button disabled={!buyWood(state, 1).ok} onClick={() => act((s) => buyWood(s, 1))}>
        Buy wood 💰{woodCost(meta)}
      </button>
      {ITEM_IDS.filter((id) => (run.inventory[id] ?? 0) > 0).map((id) => (
        <div key={id} className="mine-item">
          <span>
            {ITEMS[id].emoji} {ITEMS[id].name} ×{run.inventory[id]}
          </span>
          <button onClick={() => act((s) => sellItem(s, id, 1))}>sell 1</button>
          <button onClick={() => act((s) => sellItem(s, id, s.run.inventory[id] ?? 0))}>sell all</button>
          <small>💰{itemSellPrice(id, meta, run.upgrades.sellPrice)} each</small>
        </div>
      ))}
    </section>
  )
}
