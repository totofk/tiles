// The 📋 Noticeboard (batch 14, DECISIONS "📋 Noticeboard + ⭐"): offers rolled from what the player can make now,
// filled by harvests (crops) or a Deliver press (items), paid with a cash bonus and ⭐. Offers are rolled on
// run.rngState only when a slot opens (board bought, order completed, cooldown over), so runs replay.
import { fail, nextRandom, withRun, type ActionResult } from './actions'
import {
  barTicks,
  batchBars,
  cropGrowTicks,
  cropSellPrice,
  isSellable,
  itemSellPrice,
  orderBoardCost,
  orderBoardUnlock,
  orderBonus,
  orderCooldownTicks,
  orderItemCap,
  orderRerollStars,
  orderRocksPerMin,
  orderSlotStars,
  orderTierMinutes,
  orderTierStars,
  oreBar,
  rollOrderTier,
  smeltFuel,
  smeltOre,
  veinDrops,
} from './balance'
import { CROP_IDS, type CropId } from './data/crops'
import { ITEM_IDS, ORE_IDS, type ItemId } from './data/items'
import { cropSale } from './market'
import { minedRock, pay } from './mining'
import type { GameState, Offer, OrderGood, OrderSlot, RunState } from './state'

export const isOffer = (slot: OrderSlot): slot is Offer => 'good' in slot
export const isCropGood = (good: OrderGood): good is CropId => (CROP_IDS as readonly string[]).includes(good)

/** the ore a bar is smelted from; undefined for anything else */
const barOre = (good: OrderGood) => ORE_IDS.find((ore) => oreBar(ore) === good)

/**
 * Goods the player can make now: licensed crops; with the mine license, every item the current vein drops that the
 * owned pickaxe mines as itself (iron needs copper, by hand it is stone); with the furnace, the bar of each such ore.
 */
export function orderPool(run: RunState): OrderGood[] {
  const drops = veinDrops(run.vein.level)
  const items = run.mineLicense ? ITEM_IDS.filter((id) => (drops[id] ?? 0) > 0 && minedRock(id, run.pickaxe?.tier ?? null) === id) : []
  const bars = run.furnace.built ? ITEM_IDS.filter((id) => { const ore = barOre(id); return ore !== undefined && items.includes(ore) }) : []
  return [...run.licenses, ...items, ...bars]
}

/** how many of `good` the player makes per minute at full use (the basis of an order's count) */
export function orderPerMinute(state: GameState, good: OrderGood): number {
  const { run, meta } = state
  // batch 19: the Fields' standing tiles of the crop produce at the same per-tile pace as the home plot
  if (isCropGood(good)) {
    const standing = run.fields.cohorts.reduce((n, c) => (c.crop === good ? n + c.count : n), 0)
    return ((run.tiles.length + standing) / cropGrowTicks(good, meta, run.upgrades.fertilizer)) * 60
  }
  const ore = barOre(good)
  if (ore) return (batchBars(run.furnace.levels.batch) * 60) / barTicks(ore)
  const drops = veinDrops(run.vein.level)
  const total = ITEM_IDS.reduce((sum, id) => sum + (drops[id] ?? 0), 0)
  return (orderRocksPerMin() * (drops[good] ?? 0)) / total
}

/** tier minutes × per-minute capacity, at least 1; items at most half the storage capacity */
export function orderCount(state: GameState, good: OrderGood, tier: number): number {
  const n = Math.max(1, Math.round(orderTierMinutes(tier) * orderPerMinute(state, good)))
  return isCropGood(good) ? n : Math.max(1, Math.min(n, orderItemCap(state.run.bagCapacity)))
}

/** a fresh offer from the pool (two rolls: good, then tier) and the next rng state */
export function rollOffer(state: GameState, rngState: number): [Offer, number] {
  const pool = orderPool(state.run)
  const [a, afterGood] = nextRandom(rngState)
  const [b, next] = nextRandom(afterGood)
  const good = pool[Math.floor(a * pool.length)]
  const tier = rollOrderTier(b)
  return [{ good, count: orderCount(state, good, tier), done: 0, tier, accepted: false }, next]
}

/** cash one unit of an item order pays on delivery: its base value × the bonus; a bar is valued at its ore and coal */
export function itemOrderValue(state: GameState, good: ItemId): number {
  const level = state.run.upgrades.sellPrice
  const ore = barOre(good)
  const base = ore
    ? smeltOre() * itemSellPrice(ore, state.meta, level) + smeltFuel('coal', ore) * itemSellPrice('coal', state.meta, level)
    : isSellable(good)
      ? itemSellPrice(good, state.meta, level)
      : 0
  return base * orderBonus()
}

/** cash one ordered crop unit pays: the unglutted price × (1 + bonus) × `bonus` (hand-picked) */
export function cropOrderPrice(state: GameState, crop: CropId, bonus = 1): number {
  return Math.round(cropSellPrice(crop, state.meta, state.run.upgrades.sellPrice) * (1 + orderBonus()) * bonus)
}

/**
 * `n` more units into the offer at `slot`. At its count the order completes: ⭐ by tier, counters.orders and the
 * lifetime totals +1, and a fresh offer is rolled into the slot.
 */
function fillOrder(state: GameState, slot: number, n: number): GameState {
  const { run } = state
  const offer = run.orders.offers[slot] as Offer
  const done = offer.done + n
  const withSlot = (next: OrderSlot, extra: Partial<RunState> = {}): GameState => ({
    ...state,
    run: { ...run, ...extra, orders: { ...run.orders, offers: run.orders.offers.map((s, i) => (i === slot ? next : s)) } },
  })
  if (done < offer.count) return withSlot({ ...offer, done })
  const stars = orderTierStars(offer.tier)
  const [fresh, rngState] = rollOffer(state, run.rngState)
  return withSlot(fresh, {
    rngState,
    stars: run.stars + stars,
    counters: { ...run.counters, orders: run.counters.orders + 1 },
    lifetime: { ...run.lifetime, ordersCompleted: run.lifetime.ordersCompleted + 1, starsEarned: run.lifetime.starsEarned + stars },
  })
}

/** the first accepted open order for this crop; -1 = none */
function cropOrderSlot(run: RunState, crop: CropId): number {
  return run.orders.offers.findIndex((s) => isOffer(s) && s.accepted && s.good === crop && s.done < s.count)
}

/**
 * Sells `units` harvested `crop`: while an accepted order for it is open each unit goes to the order (cropOrderPrice,
 * no glut), the rest to the market (cropSale). `bonus` = hand-picked multiplier. Returns the cash and the run with
 * orders, ⭐, counters, lifetime, rngState and market updated (cash itself untouched).
 */
export function harvestSale(state: GameState, crop: CropId, units: number, bonus = 1): { cash: number; run: RunState } {
  let s = state
  let cash = 0
  let left = units
  for (let slot = cropOrderSlot(s.run, crop); left > 0 && slot >= 0; slot = cropOrderSlot(s.run, crop)) {
    const offer = s.run.orders.offers[slot] as Offer
    const n = Math.min(left, offer.count - offer.done)
    cash += n * cropOrderPrice(s, crop, bonus)
    s = fillOrder(s, slot, n)
    left -= n
  }
  if (left === 0) return { cash, run: s.run }
  const sale = cropSale(s, crop, left, bonus)
  return { cash: cash + sale.cash, run: { ...s.run, market: sale.market } }
}

/** the board shows (and can be bought) once its unlock counter is reached */
export function orderBoardUnlocked(run: RunState): boolean {
  const { counter, at } = orderBoardUnlock()
  return run.counters[counter] >= at
}

/** one fresh offer per slot, rolled in slot order */
function rollOffers(state: GameState, slots: number): { offers: Offer[]; rngState: number } {
  let rngState = state.run.rngState
  const offers: Offer[] = []
  for (let i = 0; i < slots; i++) {
    const [offer, next] = rollOffer(state, rngState)
    offers.push(offer)
    rngState = next
  }
  return { offers, rngState }
}

// Order: ALREADY_OWNED, LOCKED, NOT_ENOUGH_ITEMS, NO_CASH. Fills every slot with an offer.
export function buyOrderBoard(state: GameState): ActionResult {
  const { run } = state
  if (run.orders.unlocked) return fail('ALREADY_OWNED')
  if (!orderBoardUnlocked(run)) return fail('LOCKED')
  const { offers, rngState } = rollOffers(state, run.orders.slots)
  return pay(state, orderBoardCost(state.meta), { orders: { ...run.orders, unlocked: true, offers }, rngState })
}

/** the offer at `slot`, or the error: LOCKED (no board), BAD_SLOT (no such slot, or it is cooling down) */
function offerAt(run: RunState, slot: number): Offer | 'LOCKED' | 'BAD_SLOT' {
  if (!run.orders.unlocked) return 'LOCKED'
  const s = run.orders.offers[slot]
  return s && isOffer(s) ? s : 'BAD_SLOT'
}

/** a new orders object with `slot` replaced */
function setSlot(run: RunState, slot: number, next: OrderSlot): RunState['orders'] {
  return { ...run.orders, offers: run.orders.offers.map((s, i) => (i === slot ? next : s)) }
}

// Free. Order: LOCKED, BAD_SLOT, NOTHING_TO_DO (already accepted).
export function acceptOrder(state: GameState, slot: number): ActionResult {
  const offer = offerAt(state.run, slot)
  if (typeof offer === 'string') return fail(offer)
  if (offer.accepted) return fail('NOTHING_TO_DO')
  return withRun(state, { orders: setSlot(state.run, slot, { ...offer, accepted: true }) })
}

// Free; nothing paid is taken back. The slot refills after the cooldown. Order: LOCKED, BAD_SLOT.
export function discardOrder(state: GameState, slot: number): ActionResult {
  const offer = offerAt(state.run, slot)
  if (typeof offer === 'string') return fail(offer)
  return withRun(state, { orders: setSlot(state.run, slot, { cooldownTicks: orderCooldownTicks() }) })
}

/**
 * Moves the rest of an accepted item order from storage (0 energy) and pays itemOrderValue per unit, rounded once.
 * Order: LOCKED, BAD_SLOT, NOTHING_TO_DO (not accepted, or a crop order: harvests fill those), NOT_ENOUGH_ITEMS.
 */
export function deliverOrder(state: GameState, slot: number): ActionResult {
  const { run } = state
  const offer = offerAt(run, slot)
  if (typeof offer === 'string') return fail(offer)
  if (!offer.accepted || isCropGood(offer.good)) return fail('NOTHING_TO_DO')
  const good = offer.good
  const need = offer.count - offer.done
  if ((run.inventory[good] ?? 0) < need) return fail('NOT_ENOUGH_ITEMS')
  const cash = Math.round(need * itemOrderValue(state, good))
  const paid: GameState = {
    ...state,
    run: {
      ...run,
      cash: run.cash + cash,
      inventory: { ...run.inventory, [good]: run.inventory[good]! - need },
      lifetime: { ...run.lifetime, cashEarned: run.lifetime.cashEarned + cash },
    },
  }
  return withRun(state, fillOrder(paid, slot, need).run)
}

// ⭐ shop. One more slot, holding a fresh offer. Order: LOCKED, MAX_LEVEL, NO_STARS.
export function buyOrderSlot(state: GameState): ActionResult {
  const { orders } = state.run
  if (!orders.unlocked) return fail('LOCKED')
  const stars = orderSlotStars(orders.slots)
  if (stars === null) return fail('MAX_LEVEL')
  const [offer, rngState] = rollOffer(state, state.run.rngState)
  return pay(state, { cash: 0, stars }, { rngState, orders: { ...orders, slots: orders.slots + 1, offers: [...orders.offers, offer] } })
}

// ⭐ shop. Every slot without an accepted order (open offers and cooling slots) gets a fresh offer now, in slot order;
// accepted orders keep their progress. Order: LOCKED, NOTHING_TO_DO (every slot accepted), NO_STARS.
export function rerollOrders(state: GameState): ActionResult {
  const { orders } = state.run
  if (!orders.unlocked) return fail('LOCKED')
  if (orders.offers.every((s) => isOffer(s) && s.accepted)) return fail('NOTHING_TO_DO')
  let rngState = state.run.rngState
  const offers = orders.offers.map((s): OrderSlot => {
    if (isOffer(s) && s.accepted) return s
    const [offer, next] = rollOffer(state, rngState)
    rngState = next
    return offer
  })
  return pay(state, { cash: 0, stars: orderRerollStars() }, { rngState, orders: { ...orders, offers } })
}

/** goods the clerk accepts: a crop planted on a tile or set as "Crop to plant", or an item the current vein drops */
function clerkTakes(run: RunState, good: OrderGood): boolean {
  if (isCropGood(good)) return run.plantCrop === good || run.tiles.some((t) => t.cropId === good)
  return (veinDrops(run.vein.level)[good] ?? 0) > 0
}

/** the slot the clerk's next action touches (deliver first, else accept); -1 = nothing to do */
export function clerkTarget(state: GameState): number {
  const { run } = state
  if (!run.orders.unlocked) return -1
  const offers = run.orders.offers
  const deliver = offers.findIndex((s) => isOffer(s) && s.accepted && !isCropGood(s.good) && (run.inventory[s.good] ?? 0) >= s.count - s.done)
  if (deliver >= 0) return deliver
  return offers.findIndex((s) => isOffer(s) && !s.accepted && clerkTakes(run, s.good))
}

/**
 * The order clerk's action (a worker job): deliver the first accepted item order storage can fill, else accept the
 * first open offer whose good clerkTakes; never discards. null = nothing to do (the clerk idles unpaid).
 */
export function clerkAction(state: GameState): ActionResult | null {
  const slot = clerkTarget(state)
  if (slot < 0) return null
  return (state.run.orders.offers[slot] as Offer).accepted ? deliverOrder(state, slot) : acceptOrder(state, slot)
}

/** one tick inside step(): every cooling slot counts down; at 0 a fresh offer is rolled into it */
export function tickOrders(state: GameState): GameState {
  const { orders } = state.run
  if (!orders.offers.some((s) => !isOffer(s))) return state
  let rngState = state.run.rngState
  const offers = orders.offers.map((s): OrderSlot => {
    if (isOffer(s)) return s
    if (s.cooldownTicks > 1) return { cooldownTicks: s.cooldownTicks - 1 }
    const [offer, next] = rollOffer(state, rngState)
    rngState = next
    return offer
  })
  return { ...state, run: { ...state.run, rngState, orders: { ...orders, offers } } }
}
