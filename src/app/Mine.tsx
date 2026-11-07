import { Fragment } from 'react'
import type { ActionError, ActionResult } from '../core/actions'
import {
  FUEL_IDS,
  FURNACE_UPGRADE_IDS,
  barTicks,
  batchBars,
  fireCapTicks,
  fireCapUnits,
  fireUnitTicks,
  furnaceTrayCap,
  furnaceUpgradeCost,
  furnaceVeinLevel,
  oreSlotCap,
  smeltFuel,
  isSellable,
  itemSellPrice,
  masteredPreserveBonus,
  masteryLevel,
  masteryMaxLevel,
  masteryThresholds,
  mineHits,
  mineLicenseCost,
  pickaxeCraftCost,
  pickaxeDurability,
  pickaxeRepairCost,
  rockHits,
  veinMaxLevel,
  veinUpgradeCost,
  woodCost,
  type FurnaceUpgradeId,
  type Price,
} from '../core/balance'
import { ITEMS, ITEM_IDS, PICKAXE_NAMES, type ItemId } from '../core/data/items'
import { addFuel, buyFurnaceUpgrade, collectBars, cycleOre, furnaceUpgradeLevel, loadOre, smelting } from '../core/furnace'
import {
  activePickaxe,
  bagCount,
  buyMineLicense,
  buyWood,
  craftPickaxe,
  dig,
  dropText,
  expectedUses,
  repairPickaxe,
  sellItem,
  upgradeVein,
} from '../core/mining'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { Info, Item } from './Info'
import { FURNACE_TIPS } from './tips'
import { ERROR_TEXT, FIRE_EMOJI, type Act } from './useGame'

/** the next ore after the last vein level; a teaser with no numbers until the iron batch */
const LOCKED_VEIN_TEXT = `🔒 Lv${veinMaxLevel() + 1}: iron ore — coming`
/** what "sell all" sells when storage is full; wood stays for crafting and repairs */
const SELL_WHEN_FULL = ITEM_IDS.filter(isSellable).filter((id) => id !== 'wood')

/** furnace-button reasons short enough for a ≈ 100 px button in the desktop Mine column */
const SMELT_SHORT: Partial<Record<ActionError, string>> = { NO_ORE: 'no ore', NO_FUEL: 'no fuel', FULL: 'full', BAG_FULL: 'storage full' }
const STOCK_LABEL = { copperOre: 'ore', coal: 'coal', wood: 'wood' }

/** "⛰️20 ⚫5 💰150"; no cash part when it is free */
export function priceText(price: Price): string {
  const items = ITEM_IDS.filter((id) => price[id]).map((id) => `${ITEMS[id].emoji}${price[id]}`)
  return [...items, ...(price.cash ? [`💰${price.cash}`] : [])].join(' ')
}

function sellAll(s: GameState): ActionResult {
  return SELL_WHEN_FULL.reduce<ActionResult>((r, id) => {
    const n = r.ok ? (r.state.run.inventory[id] ?? 0) : 0
    return r.ok && n > 0 ? sellItem(r.state, id, n) : r
  }, { ok: true, state: s })
}

/** a disabled furnace button's short reason */
function shortReason(r: ActionResult) {
  return r.ok ? '' : (SMELT_SHORT[r.error] ?? ERROR_TEXT[r.error])
}

/** a furnace button's second line: the reason it is disabled, else how many items the press moves */
function uses(r: ActionResult, before: GameState, id: ItemId) {
  const n = r.ok ? (before.run.inventory[id] ?? 0) - (r.state.run.inventory[id] ?? 0) : 0
  return <small>{r.ok ? `uses ${n}` : shortReason(r)}</small>
}

const UPGRADE_LABEL: Record<FurnaceUpgradeId, (level: number) => string> = {
  fireCap: (l) => `Fire cap ${fireCapUnits(l)} → ${fireCapUnits(l + 1)}`,
  batch: (l) => `Batch ${batchBars(l)} → ${batchBars(l + 1)} bars`,
  smart: () => 'Smart furnace',
}

/**
 * Collapsible so the Mine panel stays short at 375 px; the summary line alone says what the furnace is doing.
 * Open: the fire gauge (units / cap), the ore slot and cycle progress, load / fill / collect, and the upgrades not yet
 * at their max level (each hides at max, like the vein upgrade).
 */
function Furnace({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  const f = run.furnace
  const collect = collectBars(state)
  const ore = loadOre(state)
  const have = (id: ItemId) => run.inventory[id] ?? 0
  const fire = Math.ceil(f.fire / fireUnitTicks())
  const cap = fireCapUnits(f.levels.fireCap)
  const bars = batchBars(f.levels.batch)
  return (
    <details className="mine-furnace">
      <summary>
        {FIRE_EMOJI} Furnace · fire {fire}/{cap} · ore {f.ore} · {f.ready} ready
      </summary>
      <div className="furnace-line">
        <span>
          {FIRE_EMOJI} fire {fire} / {cap}
          {f.smart && ' · smart'}
        </span>
        <Info text={FURNACE_TIPS.fire} />
      </div>
      <Bar value={f.fire / fireCapTicks(f.levels.fireCap)} kind="fire" />
      {f.fire > 0 && !f.smart && !smelting(f) && <small className="furnace-hint">burning with nothing to smelt</small>}
      <span>
        {ITEMS.copperOre.emoji} ore {f.ore} / {oreSlotCap()}
        {f.progress > 0 && ` · ${f.progress}/${barTicks()} s`}
      </span>
      {f.progress > 0 && <Bar value={f.progress / barTicks()} kind="grow" />}
      <small>
        {ITEMS.copperOre.emoji}
        {cycleOre(f)} + {ITEMS.coal.emoji}
        {smeltFuel('coal')} or {ITEMS.wood.emoji}
        {smeltFuel('wood')} → {ITEMS.copperBar.emoji}
        {bars} · {barTicks()} s ·{' '}
        {(['copperOre', 'coal', 'wood'] as const).map((id, i) => (
          <Fragment key={id}>
            {i > 0 && ' · '}
            <span className="nowrap">
              {STOCK_LABEL[id]} {have(id)}
            </span>
          </Fragment>
        ))}
      </small>
      <div className="mine-furnace-actions">
        <button disabled={!ore.ok} onClick={() => act((s) => loadOre(s))}>
          Load {ITEMS.copperOre.emoji} ore
          {uses(ore, state, 'copperOre')}
        </button>
        {FUEL_IDS.map((fuel) => {
          const r = addFuel(state, fuel)
          return (
            <button key={fuel} disabled={!r.ok} onClick={() => act((s) => addFuel(s, fuel))}>
              Fill with {ITEMS[fuel].emoji} {ITEMS[fuel].name.toLowerCase()}
              {uses(r, state, fuel)}
            </button>
          )
        })}
        <button disabled={!collect.ok} onClick={() => act(collectBars)}>
          Collect {f.ready} {ITEMS.copperBar.emoji}
          <small>{f.ready > 0 && !collect.ok ? shortReason(collect) : `tray ${f.ready}/${furnaceTrayCap()}`}</small>
        </button>
      </div>
      {FURNACE_UPGRADE_IDS.map((id) => {
        const level = furnaceUpgradeLevel(f, id)
        const cost = furnaceUpgradeCost(id, level, meta)
        if (!cost) return null
        const r = buyFurnaceUpgrade(state, id)
        return (
          <Item key={id} tip={FURNACE_TIPS[id]}>
            <button disabled={!r.ok} onClick={() => act((s) => buyFurnaceUpgrade(s, id))}>
              {UPGRADE_LABEL[id](level)}
              <small>
                {priceText(cost)}
                {!r.ok && ` · ${shortReason(r)}`}
              </small>
            </button>
          </Item>
        )
      })}
    </details>
  )
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
  const hits = mineHits(activePickaxe(run)?.tier ?? null)
  const repair = repairPickaxe(state)
  const cracked = run.vein.progress > 0
  const rock = ITEMS[run.vein.rock].emoji
  const nextVein = veinUpgradeCost(run.vein.level, meta)
  const veinCheck = upgradeVein(state)
  const fullValue = SELL_WHEN_FULL.reduce(
    (sum, id) => sum + (run.inventory[id] ?? 0) * itemSellPrice(id, meta, run.upgrades.sellPrice),
    0,
  )
  const tier = run.pickaxe?.tier
  const copperCraft = craftPickaxe(state, 'copper')
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
            ? `⚡1 → ${hits} hit${hits > 1 ? 's' : ''} · ${cracked ? `${rock} cracked` : rock} ${run.vein.progress}/${rockHits(run.vein.rock)}`
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
              Lv{run.vein.level + 1}: {dropText(run.vein.level + 1)} — {priceText(nextVein)}
            </span>
            <button disabled={!veinCheck.ok} onClick={() => act(upgradeVein)}>
              Upgrade vein to Lv{run.vein.level + 1}
              {!veinCheck.ok && <small> — {ERROR_TEXT[veinCheck.error]}</small>}
            </button>
          </>
        )}
        <span className="mine-vein-next">{LOCKED_VEIN_TEXT}</span>
      </div>
      {run.furnace.built ? (
        <Furnace state={state} act={act} />
      ) : (
        run.vein.level >= furnaceVeinLevel() && <span className="mine-vein-next">{FIRE_EMOJI} Furnace — buy it in the 🛒 Shop</span>
      )}
      {run.pickaxe?.durability === 0 ? (
        <button disabled={!repair.ok} onClick={() => act(repairPickaxe)}>
          Blunt {PICKAXE_NAMES[run.pickaxe.tier].toLowerCase()} — repair ({priceText(pickaxeRepairCost(run.pickaxe.tier, meta))})
          {!repair.ok && <small>{ERROR_TEXT[repair.error]}</small>}
        </button>
      ) : run.pickaxe ? (
        <div className="mine-pickaxe">
          <span>
            {PICKAXE_NAMES[run.pickaxe.tier]} {run.pickaxe.durability} / {pickaxeDurability(run.pickaxe.tier)} · ~
            {Math.round(expectedUses(run.pickaxe.tier, run, run.pickaxe.durability))} more uses
          </span>
          <Bar value={run.pickaxe.durability / pickaxeDurability(run.pickaxe.tier)} kind="tool" />
        </div>
      ) : (
        <button disabled={!craftPickaxe(state).ok} onClick={() => act(craftPickaxe)}>
          No pickaxe — craft ({priceText(pickaxeCraftCost('wooden', meta))})
        </button>
      )}
      {run.furnace.built && tier !== 'copper' && (
        <button disabled={!copperCraft.ok} onClick={() => act((s) => craftPickaxe(s, 'copper'))}>
          Craft copper pickaxe ({priceText(pickaxeCraftCost('copper', meta))})
          {!copperCraft.ok && <small> — {ERROR_TEXT[copperCraft.error]}</small>}
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
