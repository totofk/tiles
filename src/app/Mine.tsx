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
  masteredOreBonus,
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
  MINE_DROP_IDS,
  oreSortUnlockCost,
  oreSortVeinLevel,
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
  heldPickaxe,
  minedRock,
  repairPickaxe,
  selectPickaxe,
  sellItem,
  setOreSort,
  unlockOreSort,
  upgradeVein,
} from '../core/mining'
import type { GameState } from '../core/state'
import { Bar } from './Bar'
import { count, gain, price } from './fmt'
import { Info, Item } from './Info'
import { FURNACE_TIPS } from './tips'
import { ERROR_TEXT, FIRE_EMOJI, MINE_EMOJI, type Act } from './useGame'

/** pickaxe tiers above wooden map 1:1 to an ore; the vein at this level drops it */
type OreTier = 'copper' | 'iron' | 'gold'
const tierVein = (tier: OreTier, level: number) => (veinDrops(level)[`${tier}Ore`] ?? 0) > 0
/** what "sell all" sells when storage is full; wood stays for crafting and repairs, bars pay for upgrades (batch 24) */
const SELL_WHEN_FULL = ITEM_IDS.filter(
  // coal fuels the Fields tank (batch 28)
  (id) => isSellable(id) && id !== 'wood' && id !== 'coal' && !ORE_IDS.map(oreBar).includes(id),
)

/** furnace-button reasons short enough for a ≈ 100 px button in the desktop Mine column */
const SMELT_SHORT: Partial<Record<ActionError, string>> = {
  NO_ORE: 'no ore',
  NO_FUEL: 'no fuel',
  FULL: 'full',
  BAG_FULL: 'storage full',
  NOT_EMPTY: 'collect first',
}

/** "⛰️20 ⚫5 💰150"; no cash part when it is free; ⁠ joins each emoji to its number so a line never breaks between them */
export function priceText(p: Price): string {
  const items = ITEM_IDS.filter((id) => p[id]).map((id) => `${ITEMS[id].emoji}⁠${p[id]}`)
  return [...items, ...(p.stars ? [`${STAR_EMOJI}⁠${count(p.stars)}`] : []), ...(p.cash ? [`💰⁠${price(p.cash)}`] : [])].join(' ')
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
          ⛏️ Mine license 💰{price(cost)}
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
  const held = heldPickaxe(run)
  const tier = held?.tier
  const owned = PICKAXE_TIERS.filter((t) => run.rack[t] !== undefined)
  // unowned tiers on offer: wooden always, copper once the furnace is built, iron and gold once the vein drops their ore
  const crafts = PICKAXE_TIERS.filter(
    (t) => run.rack[t] === undefined && (t === 'wooden' || (run.furnace.built && (t === 'copper' || tierVein(t, run.vein.level)))),
  )
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
          {gain(fullValue)}
        </button>
      )}
      {/* batch 32: the pickaxe group sits under Dig — rack (select), the held one's status or repair, craft, mastery */}
      <div className="group mine-pickaxe-group">
        {owned.length > 0 && (
          <div className="mine-furnace-actions" role="group" aria-label="Pickaxe rack">
            {owned.map((t) => (
              <button key={t} aria-pressed={t === tier} onClick={() => act((s) => selectPickaxe(s, t))}>
                {PICKAXE_NAMES[t]}
                <small>
                  {run.rack[t] ? `${run.rack[t]}/${pickaxeDurability(t)}` : 'blunt'}
                  {run.masteredTiers.includes(t) && ' ✓'}
                </small>
              </button>
            ))}
          </div>
        )}
        {held?.durability === 0 ? (
          <button disabled={!repair.ok} onClick={() => act((s) => repairPickaxe(s))}>
            Blunt {PICKAXE_NAMES[held.tier].toLowerCase()} — repair ({priceText(pickaxeRepairCost(held.tier, meta))})
            {!repair.ok && <small>{ERROR_TEXT[repair.error]}</small>}
          </button>
        ) : (
          held && (
            <div className="mine-pickaxe">
              <span>
                {PICKAXE_NAMES[held.tier]} {held.durability} / {pickaxeDurability(held.tier)} · ~
                {Math.round(expectedUses(held.tier, run, held.durability))} more uses
              </span>
              <Bar value={held.durability / pickaxeDurability(held.tier)} kind="tool" />
            </div>
          )
        )}
        {crafts.map((t) => {
          const r = craftPickaxe(state, t)
          return (
            <button key={t} disabled={!r.ok} onClick={() => act((s) => craftPickaxe(s, t))}>
              Craft {PICKAXE_NAMES[t].toLowerCase()} ({priceText(pickaxeCraftCost(t, meta))})
              {!r.ok && <small> — {ERROR_TEXT[r.error]}</small>}
            </button>
          )
        })}
        {tier && (
          <div className="mine-pickaxe">
            <span>
              Mastery Lv {level}/{max} · {level >= max ? xp : `${xp}/${thresholds[level]}`} xp
            </span>
            <Bar value={toNext} kind="grow" />
            {run.masteredTiers.includes(tier) && (
              <span className="mine-badge">
                Mastered ✓ +{Math.round(masteredPreserveBonus() * 100)} % durability · +{Math.round(masteredOreBonus() * 100)} % ore · all pickaxes
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mine-vein">
        <span>
          Vein Lv{run.vein.level}: {dropText(run.vein.level, run.masteredTiers.length)}
        </span>
        {nextVein && (
          <>
            <span className="mine-vein-next">
              Lv{run.vein.level + 1}: {dropText(run.vein.level + 1, run.masteredTiers.length)} — {priceText(nextVein)}
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
      <button disabled={!buyWood(state, 1).ok} onClick={() => act((s) => buyWood(s, 1))}>
        Buy wood 💰{price(woodCost(meta))}
      </button>
      {/* batch 24.1: one shared grid for repeated rows — name | count | extra | sell 1 | sell all; the columns live on
          the container, rows are subgrids; the wrap is the container the two-line mode queries */}
      <div className="item-grid-wrap">
        <div className="item-grid">
          {ITEM_IDS.filter((id) => (run.inventory[id] ?? 0) > 0).map((id) => {
            const n = run.inventory[id] ?? 0
            return (
              <div key={id} className="item-row">
                <span className="item-name">
                  <span className="item-label">
                    {ITEMS[id].emoji} {ITEMS[id].name}
                  </span>
                </span>
                <span className="item-count">×{n}</span>
                <span className="item-extra">{isSellable(id) ? `💰${gain(itemSellPrice(id, meta, run.upgrades.sellPrice))}` : ''}</span>
                {isSellable(id) ? (
                  <>
                    <button disabled={n === 0} onClick={() => act((s) => sellItem(s, id, 1))}>sell 1</button>
                    <button disabled={n === 0} onClick={() => act((s) => sellItem(s, id, s.run.inventory[id] ?? 0))}>sell all</button>
                  </>
                ) : (
                  <>
                    <span />
                    <span />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {/* batch 32: one table — kind (+ unlock price) | Unlock or the Sell on dig checkbox | keep up to (Keep N) */}
      {run.vein.level >= oreSortVeinLevel() && (
        <div className="group">
          <h3>🧺 Ore sorting</h3>
          <div className="sort-table">
            {MINE_DROP_IDS.map((kind) => {
              const mode = run.oreSort[kind]
              const unlock = mode ? null : unlockOreSort(state, kind)
              return (
                <div key={kind} className="sort-row">
                  <span>
                    {ITEMS[kind].emoji} {ITEMS[kind].name}
                    {unlock && <small> {priceText(oreSortUnlockCost(kind, meta))}</small>}
                  </span>
                  {unlock ? (
                    <button disabled={!unlock.ok} onClick={() => act((s) => unlockOreSort(s, kind))}>
                      Unlock
                      {!unlock.ok && <small>{ERROR_TEXT[unlock.error]}</small>}
                    </button>
                  ) : (
                    <label className="sort-check">
                      <input
                        type="checkbox"
                        aria-label={`Sell ${ITEMS[kind].name} on dig`}
                        checked={mode === 'sell'}
                        onChange={() => act((s) => setOreSort(s, kind, mode === 'sell' ? 'keep' : 'sell'))}
                      />
                      Sell on dig
                    </label>
                  )}
                </div>
              )
            })}
          </div>
          <p className="hint">Checked kinds sell the moment you dig them past the amount you keep, so the miner never stops on a full storage.</p>
        </div>
      )}
    </section>
  )
}
