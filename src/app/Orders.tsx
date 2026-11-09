import { useEffect, useState } from 'react'
import { cropSellPrice, orderBonus, orderRerollStars, orderSlotStars, orderTierCount, orderTierStars } from '../core/balance'
import { CROPS } from '../core/data/crops'
import { ITEMS } from '../core/data/items'
import { BOARD_EMOJI, REROLL_EMOJI, STAR_EMOJI, WAIT_EMOJI } from '../core/data/orders'
import { acceptOrder, buyOrderSlot, deliverOrder, discardOrder, isCropGood, isOffer, itemOrderValue, rerollOrders } from '../core/orders'
import type { GameState, Offer, OrderGood } from '../core/state'
import { Bar } from './Bar'
import { CROP_EMOJI } from './FarmGrid'
import type { Act } from './useGame'

export const goodEmoji = (good: OrderGood) => (isCropGood(good) ? CROP_EMOJI[good] : ITEMS[good].emoji)

/** "7:12" */
const clock = (ticks: number) => `${Math.floor(ticks / 60)}:${String(ticks % 60).padStart(2, '0')}`

/** the cash an order pays above selling its goods at base price (crops) / for delivering them (items) */
function orderCash(state: GameState, o: Offer): number {
  return Math.round(isCropGood(o.good) ? o.count * cropSellPrice(o.good, state.meta, state.run.upgrades.sellPrice) * orderBonus() : o.count * itemOrderValue(state, o.good))
}

/** one slot: the good and progress, tier dots, ⭐ and cash; Accept, Deliver (accepted item orders) and Discard.
 * batch 24.1: the row frame states the order's state — dashed offer / solid accepted / green ready with badges, a
 * progress bar on accepted rows, and the ✕ needs a second press within 3 s once an accepted order has progress */
function OrderRow({ state, act, slot }: { state: GameState; act: Act; slot: number }) {
  const s = state.run.orders.offers[slot]
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  if (!isOffer(s))
    return (
      <div className="order-row order-wait">
        {WAIT_EMOJI} next order in {clock(s.cooldownTicks)}
      </div>
    )
  const name = isCropGood(s.good) ? CROPS[s.good].name : ITEMS[s.good].name
  const dots = '●'.repeat(s.tier + 1) + '○'.repeat(orderTierCount() - s.tier - 1)
  const ready = s.accepted && deliverOrder(state, slot).ok
  const remaining = s.count - s.done
  const stored = isCropGood(s.good) ? 0 : Math.min(state.run.inventory[s.good] ?? 0, remaining)
  const progress = isCropGood(s.good) ? s.done : stored
  const twoPress = s.accepted && progress > 0
  const stateClass = ready ? 'order-ready' : s.accepted ? 'order-accepted' : 'order-offer'
  return (
    <div className={`order-row ${stateClass}`}>
      <span>
        {goodEmoji(s.good)} {s.accepted && !isCropGood(s.good) ? `${stored} / ${remaining} in storage` : `${s.done} / ${s.count}`}
        {!s.accepted && <span className="order-badge order-badge-new">New</span>}
        {ready && <span className="order-badge order-badge-ready">✓ Ready</span>}
        <small>
          <span aria-label={`size ${s.tier + 1} of ${orderTierCount()}`}>{dots}</span> · {STAR_EMOJI}
          {orderTierStars(s.tier)} · +💰{orderCash(state, s)}
        </small>
        {s.accepted && isCropGood(s.good) && <small>filling from harvests</small>}
      </span>
      {s.accepted && <Bar value={remaining > 0 ? progress / remaining : 1} kind="grow" />}
      {!s.accepted && (
        <button className="order-primary" onClick={() => act((g) => acceptOrder(g, slot))} aria-label={`Accept ${name} order`}>
          Accept
        </button>
      )}
      {s.accepted && !isCropGood(s.good) && (
        <button className={ready ? 'order-deliver' : undefined} disabled={!deliverOrder(state, slot).ok} onClick={() => act((g) => deliverOrder(g, slot))} aria-label={`Deliver ${name} order`}>
          Deliver
        </button>
      )}
      <button className="order-x" onClick={() => (twoPress && !armed ? setArmed(true) : act((g) => discardOrder(g, slot)))} aria-label={`Discard ${name} order`}>
        {twoPress && armed ? 'Discard?' : '✕'}
      </button>
    </div>
  )
}

/**
 * The 📋 Noticeboard once bought: a section at the top of the desktop 🌾 Farm tab; a closed card beside 👷 Workers in
 * the farm column wherever there is no Farm tab, so the grid keeps its height.
 */
export function Orders({ state, act, card = false }: { state: GameState; act: Act; card?: boolean }) {
  const { orders, stars } = state.run
  if (!orders.unlocked) return null
  const note = (
    <small className="order-note">
      Accepted crop orders take every harvest of that crop at +{Math.round(orderBonus() * 100)} %, with no market glut.
    </small>
  )
  const slotStars = orderSlotStars(orders.slots)
  const readyN = orders.offers.filter((o, i) => isOffer(o) && o.accepted && deliverOrder(state, i).ok).length
  const readySuffix = readyN > 0 ? ` · ${readyN} ready` : ''
  const rows = (
    <>
      {/* batch 24: the order rows are one group, the ⭐ shop another over a divider */}
      <div className="group">
        {orders.offers.map((_, i) => (
          <OrderRow key={i} state={state} act={act} slot={i} />
        ))}
      </div>
      {/* the ⭐ shop: only ⭐ buys these, and nothing here sells */}
      <div className="group">
        <div className="order-row order-shop">
          {slotStars !== null && (
            <button disabled={!buyOrderSlot(state).ok} onClick={() => act(buyOrderSlot)}>
              + Slot {orders.slots + 1} <small>{STAR_EMOJI}{slotStars}</small>
            </button>
          )}
          <button disabled={!rerollOrders(state).ok} onClick={() => act(rerollOrders)}>
            {REROLL_EMOJI} Reroll <small>{STAR_EMOJI}{orderRerollStars()}</small>
          </button>
        </div>
      </div>
    </>
  )
  if (card)
    return (
      <details className="orders">
        <summary>
          {BOARD_EMOJI} Orders · {STAR_EMOJI} {stars}
          {readySuffix}
        </summary>
        {note}
        {rows}
      </details>
    )
  return (
    <section className="orders">
      <h2>
        {BOARD_EMOJI} Orders · {STAR_EMOJI} {stars}
        {readySuffix}
      </h2>
      {note}
      {rows}
    </section>
  )
}
