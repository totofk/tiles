import { cropSellPrice, orderBonus, orderRerollStars, orderSlotStars, orderTierCount, orderTierStars } from '../core/balance'
import { CROPS } from '../core/data/crops'
import { ITEMS } from '../core/data/items'
import { BOARD_EMOJI, REROLL_EMOJI, STAR_EMOJI, WAIT_EMOJI } from '../core/data/orders'
import { acceptOrder, buyOrderSlot, deliverOrder, discardOrder, isCropGood, isOffer, itemOrderValue, rerollOrders } from '../core/orders'
import type { GameState, Offer, OrderGood } from '../core/state'
import { CROP_EMOJI } from './FarmGrid'
import type { Act } from './useGame'

export const goodEmoji = (good: OrderGood) => (isCropGood(good) ? CROP_EMOJI[good] : ITEMS[good].emoji)

/** "7:12" */
const clock = (ticks: number) => `${Math.floor(ticks / 60)}:${String(ticks % 60).padStart(2, '0')}`

/** the cash an order pays above selling its goods at base price (crops) / for delivering them (items) */
function orderCash(state: GameState, o: Offer): number {
  return Math.round(isCropGood(o.good) ? o.count * cropSellPrice(o.good, state.meta, state.run.upgrades.sellPrice) * orderBonus() : o.count * itemOrderValue(state, o.good))
}

/** one slot: the good and progress, tier dots, ⭐ and cash; Accept, Deliver (accepted item orders) and Discard */
function OrderRow({ state, act, slot }: { state: GameState; act: Act; slot: number }) {
  const s = state.run.orders.offers[slot]
  if (!isOffer(s))
    return (
      <div className="order-row order-wait">
        {WAIT_EMOJI} next order in {clock(s.cooldownTicks)}
      </div>
    )
  const name = isCropGood(s.good) ? CROPS[s.good].name : ITEMS[s.good].name
  const dots = '●'.repeat(s.tier + 1) + '○'.repeat(orderTierCount() - s.tier - 1)
  return (
    <div className="order-row">
      <span>
        {goodEmoji(s.good)} {s.done} / {s.count}
        <small>
          <span aria-label={`size ${s.tier + 1} of ${orderTierCount()}`}>{dots}</span> · {STAR_EMOJI}
          {orderTierStars(s.tier)} · +💰{orderCash(state, s)}
        </small>
      </span>
      {!s.accepted && (
        <button onClick={() => act((g) => acceptOrder(g, slot))} aria-label={`Accept ${name} order`}>
          Accept
        </button>
      )}
      {s.accepted && !isCropGood(s.good) && (
        <button disabled={!deliverOrder(state, slot).ok} onClick={() => act((g) => deliverOrder(g, slot))} aria-label={`Deliver ${name} order`}>
          Deliver
        </button>
      )}
      <button onClick={() => act((g) => discardOrder(g, slot))} aria-label={`Discard ${name} order`}>
        Discard
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
  const rows = (
    <>
      {orders.offers.map((_, i) => (
        <OrderRow key={i} state={state} act={act} slot={i} />
      ))}
      {/* the ⭐ shop: only ⭐ buys these, and nothing here sells */}
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
    </>
  )
  if (card)
    return (
      <details className="orders">
        <summary>
          {BOARD_EMOJI} Orders · {STAR_EMOJI} {stars}
        </summary>
        {note}
        {rows}
      </details>
    )
  return (
    <section className="orders">
      <h2>
        {BOARD_EMOJI} Orders · {STAR_EMOJI} {stars}
      </h2>
      {note}
      {rows}
    </section>
  )
}
