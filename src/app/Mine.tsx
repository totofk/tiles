import { Fragment, useState } from 'react'
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
  oreBar,
  pickaxeCraftCost,
  pickaxeDurability,
  pickaxeRepairCost,
  rockHits,
  rockPickaxe,
  veinDrops,
  veinUpgradeCost,
  woodCost,
  type FurnaceUpgradeId,
  type Price,
} from '../core/balance'
import { ITEMS, ITEM_IDS, ORE_IDS, PICKAXE_NAMES, PICKAXE_TIERS, type ItemId, type OreId } from '../core/data/items'
import { STAR_EMOJI } from '../core/data/orders'
import { addFuel, buyFurnaceUpgrade, collectBars, cycleOre, furnaceUpgradeLevel, loadOre, setOreKind } from '../core/furnace'
import {
  activePickaxe,
  bagCount,
  buyMineLicense,
  buyWood,
  craftPickaxe,
  dig,
  dropText,
  expectedUses,
  minedRock,
  repairPickaxe,
  sellItem,
  upgradeVein,
} from '../core/mining'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { Info, Item } from './Info'
import { FURNACE_TIPS } from './tips'
import { ERROR_TEXT, FIRE_EMOJI, MINE_EMOJI, type Act } from './useGame'

/** pickaxe tiers above wooden map 1:1 to an ore; the vein at this level drops it */
type OreTier = 'copper' | 'iron' | 'gold'
const tierVein = (tier: OreTier, level: number) => (veinDrops(level)[`${tier}Ore`] ?? 0) > 0
/** what "sell all" sells when storage is full; wood stays for crafting and repairs, bars pay for upgrades (batch 24) */
const SELL_WHEN_FULL = ITEM_IDS.filter((id) => isSellable(id) && id !== 'wood' && !ORE_IDS.map(oreBar).includes(id))

/** furnace-button reasons short enough for a ≈ 100 px button in the desktop Mine column */
const SMELT_SHORT: Partial<Record<ActionError, string>> = {
  NO_ORE: 'no ore',
  NO_FUEL: 'no fuel',
  FULL: 'full',
  BAG_FULL: 'storage full',
  NOT_EMPTY: 'collect first',
}

/** "⛰️20 ⚫5 💰150"; no cash part when it is free; ⁠ joins each emoji to its number so a line never breaks between them */
export function priceText(price: Price): string {
  const items = ITEM_IDS.filter((id) => price[id]).map((id) => `${ITEMS[id].emoji}⁠${price[id]}`)
  return [...items, ...(price.stars ? [`${STAR_EMOJI}⁠${price.stars}`] : []), ...(price.cash ? [`💰⁠${price.cash}`] : [])].join(' ')
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
 * Open: the fire gauge (units / cap), the ore slot and cycle progress, the ore-kind picker (a switch with ore in the
 * slot asks twice — it forfeits that ore, batch 21), load / fill / collect, and the upgrades not yet at their max
 * level (each hides at max, like the vein upgrade).
 */
function Furnace({ state, act, smeltActed = false }: { state: GameState; act: Act; smeltActed?: boolean }) {
  const { run, meta } = state
  const f = run.furnace
  // batch 21: switching with ore in the slot forfeits it, so that press asks twice (the armed kind)
  const [confirmKind, setConfirmKind] = useState<OreId | null>(null)
  const collect = collectBars(state)
  const ore = loadOre(state)
  const have = (id: ItemId) => run.inventory[id] ?? 0
  const fire = Math.ceil(f.fire / fireUnitTicks())
  const cap = fireCapUnits(f.levels.fireCap)
  const bars = batchBars(f.levels.batch)
  const oreEmoji = ITEMS[f.oreKind].emoji
  const barEmoji = ITEMS[oreBar(f.oreKind)].emoji
  const ticks = barTicks(f.oreKind)
  const stock = { ore: f.oreKind, coal: 'coal', wood: 'wood' } as const
  // the kind picker appears with the first vein that drops iron (or once iron is picked), so copper players see no change
  const picker = tierVein('iron', run.vein.level) || f.oreKind !== 'copperOre'
  return (
    <details className="mine-furnace">
      <summary>
        {FIRE_EMOJI} Furnace · fire {fire}/{cap} · ore {f.ore} · {f.ready} ready
      </summary>
      {/* batch 24: four groups — Fire / Smelt / Output / Upgrades — 8 px inside, 16 px + a divider between */}
      <div className="group">
        <div className="furnace-line">
          <span>
            {FIRE_EMOJI} fire {fire} / {cap}
            {f.smart && ' · smart'}
          </span>
          <Info text={FURNACE_TIPS.fire} />
        </div>
        <Bar value={f.fire / fireCapTicks(f.levels.fireCap)} kind="fire" />
        {f.fire > 0 && !f.smart && f.ore < cycleOre(f) && <small className="furnace-hint">burning with nothing to smelt</small>}
        <div className="mine-furnace-actions">
          {FUEL_IDS.map((fuel) => {
            const r = addFuel(state, fuel)
            return (
              <button key={fuel} disabled={!r.ok} onClick={() => act((s) => addFuel(s, fuel))}>
                Fill with {ITEMS[fuel].emoji} {ITEMS[fuel].name.toLowerCase()}
                {uses(r, state, fuel)}
              </button>
            )
          })}
        </div>
      </div>
      {/* task 132: the Smelt group flashes amber when the ore/fuel loader acted, like the Mine button */}
      <div className={`group${smeltActed ? ' mine-flash' : ''}`}>
        {picker && (
          <div className="mine-furnace-actions" role="group" aria-label="Ore to smelt">
            {ORE_IDS.map((id) => {
              const r = setOreKind(state, id)
              const picked = f.oreKind === id
              const armed = confirmKind === id
              return (
                <button
                  key={id}
                  aria-pressed={picked}
                  disabled={picked || !r.ok}
                  onClick={() => {
                    if (f.ore > 0 && !armed) {
                      setConfirmKind(id)
                      return
                    }
                    setConfirmKind(null)
                    act((s) => setOreKind(s, id))
                  }}
                >
                  {ITEMS[id].emoji} {ITEMS[id].name}
                  <small>
                    {picked
                      ? f.ore < cycleOre(f)
                        ? `needs ${cycleOre(f) - f.ore} more to smelt`
                        : 'smelting'
                      : armed
                        ? `press again — forfeit ${f.ore} ${ITEMS[f.oreKind].emoji}`
                        : r.ok
                          ? `switch${f.ore > 0 ? ` — forfeits ${f.ore}` : ''}`
                          : shortReason(r)}
                  </small>
                </button>
              )
            })}
          </div>
        )}
        <span>
          {oreEmoji} ore {f.ore} / {oreSlotCap()}
          {f.progress > 0 && ` · ${f.progress}/${ticks} s`}
        </span>
        {/* batch 24.1: the recipe and the stock are two lines, every emoji+number one unbreakable token */}
        <small className="furnace-recipe">
          <span className="nowrap">
            {oreEmoji}
            {cycleOre(f)}
          </span>{' '}
          + <span className="nowrap">{ITEMS.coal.emoji}
            {smeltFuel('coal', f.oreKind)}
          </span>{' '}
          or{' '}
          <span className="nowrap">
            {ITEMS.wood.emoji}
            {smeltFuel('wood', f.oreKind)}
          </span>{' '}
          →{' '}
          <span className="nowrap">
            {barEmoji}
            {bars}
          </span>{' '}
          ·{' '}
          <span className="nowrap">{ticks} s</span>
        </small>
        <small className="furnace-stock">
          have:{' '}
          {(['ore', 'coal', 'wood'] as const).map((key, i) => (
            <Fragment key={key}>
              {i > 0 && ' · '}
              <span className="nowrap">
                {key} {have(stock[key])}
              </span>
            </Fragment>
          ))}
        </small>
        <div className="mine-furnace-actions">
          <button disabled={!ore.ok} onClick={() => act((s) => loadOre(s))}>
            Load {oreEmoji} ore
            {uses(ore, state, f.oreKind)}
          </button>
        </div>
        {f.progress > 0 && <Bar value={f.progress / ticks} kind="grow" />}
      </div>
      <div className="group">
        <div className="mine-furnace-actions">
          <button disabled={!collect.ok} onClick={() => act(collectBars)}>
            Collect {f.ready} {barEmoji}
            <small>{f.ready > 0 && !collect.ok ? shortReason(collect) : `tray ${f.ready}/${furnaceTrayCap()}`}</small>
          </button>
        </div>
      </div>
      <div className="group">
        <h3>Upgrades</h3>
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
      </div>
    </details>
  )
}

/** minerActed: a mine worker pressed Mine on this tick, so the Mine button flashes and pops ⛏️ (as a farm worker's tile does) */
export function Mine({ state, act, minerActed = false, smeltActed = false }: { state: GameState; act: Act; minerActed?: boolean; smeltActed?: boolean }) {
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
  const active = activePickaxe(run)?.tier ?? null
  const hits = mineHits(active)
  const repair = repairPickaxe(state)
  const cracked = run.vein.progress > 0
  // a rock the pickaxe in hand is too weak for is mined as stone: show it as "🔷 as ⛰️" with stone's hits
  const minedAs = minedRock(run.vein.rock, active)
  const rock = ITEMS[run.vein.rock].emoji + (minedAs === run.vein.rock ? '' : ` as ${ITEMS[minedAs].emoji}`)
  const nextVein = veinUpgradeCost(run.vein.level, meta)
  const veinCheck = upgradeVein(state)
  const veinItems = nextVein ? ITEM_IDS.reduce((n, id) => n + (nextVein[id] ?? 0), 0) : 0
  // items the next level costs beyond what storage holds can never be gathered, so say what to buy instead
  const veinReason = veinCheck.ok
    ? ''
    : veinCheck.error === 'NOT_ENOUGH_ITEMS' && veinItems > run.bagCapacity
      ? `Needs 📦 ${veinItems} storage`
      : ERROR_TEXT[veinCheck.error]
  // rocks of this level or the next that the pickaxe in hand mines as stone (iron ore below a copper pickaxe)
  const tooHard = ITEM_IDS.filter((id) => (veinDrops(run.vein.level + 1)[id] ?? 0) > 0 && minedRock(id, active) !== id)
  const fullValue = SELL_WHEN_FULL.reduce(
    (sum, id) => sum + (run.inventory[id] ?? 0) * itemSellPrice(id, meta, run.upgrades.sellPrice),
    0,
  )
  const tier = run.pickaxe?.tier
  // the tier above the one in hand (none or wooden → copper): copper once the furnace is built, iron and gold once the vein drops their ore
  const nextTier = PICKAXE_TIERS[PICKAXE_TIERS.indexOf(tier ?? 'wooden') + 1] as OreTier | undefined
  const offerTier = run.furnace.built && nextTier && (nextTier === 'copper' || tierVein(nextTier, run.vein.level)) ? nextTier : null
  const nextCraft = offerTier && craftPickaxe(state, offerTier)
  // batch 28.1: a blunt pickaxe whose repair is out of reach offers the best lower tier it can afford (else the one below)
  const lower = run.pickaxe?.durability === 0 && !repair.ok ? PICKAXE_TIERS.slice(0, PICKAXE_TIERS.indexOf(run.pickaxe.tier)) : []
  const escapeTier = lower.findLast((t) => craftPickaxe(state, t).ok) ?? lower[lower.length - 1]
  const escape = escapeTier && craftPickaxe(state, escapeTier)
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
      <button className={minerActed ? 'mine-dig mine-flash' : 'mine-dig'} disabled={!digCheck.ok} onClick={() => act(dig)}>
        ⛏️ Dig
        <small>
          {digCheck.ok
            ? `⚡1 → ${hits} hit${hits > 1 ? 's' : ''} · ${cracked ? `${rock} cracked` : rock} ${run.vein.progress}/${rockHits(minedAs)}`
            : ERROR_TEXT[digCheck.error]}
        </small>
        {minerActed && (
          <span className="cell-pop" aria-hidden="true">
            {MINE_EMOJI}
          </span>
        )}
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
              {!veinCheck.ok && <small> — {veinReason}</small>}
            </button>
          </>
        )}
        {tooHard.map((id) => (
          <span key={id} className="mine-vein-next">
            {ITEMS[id].emoji} {ITEMS[id].name} needs a {PICKAXE_NAMES[rockPickaxe(id)!].toLowerCase()} or better, else it is mined as{' '}
            {ITEMS.stone.emoji} stone
          </span>
        ))}
      </div>
      {run.furnace.built ? (
        <Furnace state={state} act={act} smeltActed={smeltActed} />
      ) : (
        run.vein.level >= furnaceVeinLevel() && <span className="mine-vein-next">{FIRE_EMOJI} Furnace — buy it in the 🛒 Shop</span>
      )}
      {/* batch 24: the pickaxe card's blocks — status + craft, then mastery — each its own group over a divider */}
      <div className="group">
        {run.pickaxe?.durability === 0 ? (
          <>
            <button disabled={!repair.ok} onClick={() => act(repairPickaxe)}>
              Blunt {PICKAXE_NAMES[run.pickaxe.tier].toLowerCase()} — repair ({priceText(pickaxeRepairCost(run.pickaxe.tier, meta))})
              {!repair.ok && <small>{ERROR_TEXT[repair.error]}</small>}
            </button>
            {escapeTier && escape && (
              <button disabled={!escape.ok} onClick={() => act((s) => craftPickaxe(s, escapeTier))}>
                Craft {PICKAXE_NAMES[escapeTier].toLowerCase()} instead ({priceText(pickaxeCraftCost(escapeTier, meta))}) — replaces the
                blunt {PICKAXE_NAMES[run.pickaxe.tier].toLowerCase()}
                {!escape.ok && <small> — {ERROR_TEXT[escape.error]}</small>}
              </button>
            )}
          </>
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
        {offerTier && nextCraft && (
          <button disabled={!nextCraft.ok} onClick={() => act((s) => craftPickaxe(s, offerTier))}>
            Craft {PICKAXE_NAMES[offerTier].toLowerCase()} ({priceText(pickaxeCraftCost(offerTier, meta))})
            {!nextCraft.ok && <small> — {ERROR_TEXT[nextCraft.error]}</small>}
          </button>
        )}
      </div>
      {tier && (
        <div className="group mine-pickaxe">
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
      {/* batch 24.1: one shared grid for repeated rows — name | count | extra | sell 1 | sell all; the columns
          live on the container, rows are subgrids; the wrap is the container the two-line mode queries */}
      <div className="item-grid-wrap">
        <div className="item-grid">
          {ITEM_IDS.filter((id) => (run.inventory[id] ?? 0) > 0).map((id) => (
            <div key={id} className="item-row">
              <span className="item-name">
                <span className="item-label">
                  {ITEMS[id].emoji} {ITEMS[id].name}
                </span>
              </span>
              <span className="item-count">×{run.inventory[id]}</span>
              <span className="item-extra">{isSellable(id) ? `💰${itemSellPrice(id, meta, run.upgrades.sellPrice)}` : ''}</span>
              {isSellable(id) ? (
                <>
                  <button onClick={() => act((s) => sellItem(s, id, 1))}>sell 1</button>
                  <button onClick={() => act((s) => sellItem(s, id, s.run.inventory[id] ?? 0))}>sell all</button>
                </>
              ) : (
                <>
                  <span />
                  <span />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
