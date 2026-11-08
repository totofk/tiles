import { describe, expect, it } from 'vitest'
import { harvest, type ActionResult } from '../src/core/actions'
import {
  certificateCost,
  cropGrowTicks,
  cropSellPrice,
  orderMaxSlots,
  orderSlotStars,
  workerWage,
  handPickedBonus,
  itemSellPrice,
  orderBoardCost,
  orderBonus,
  orderCooldownTicks,
  orderRocksPerMin,
  orderStartSlots,
  orderTierMinutes,
  orderTierStars,
  rollOrderTier,
} from '../src/core/balance'
import { MILESTONES } from '../src/core/data/milestones'
import { buyCertificate, certificateUnlocked, workersAct } from '../src/core/workers'
import {
  acceptOrder,
  buyOrderBoard,
  buyOrderSlot,
  rerollOrders,
  deliverOrder,
  discardOrder,
  isOffer,
  itemOrderValue,
  orderCount,
  orderPool,
  rollOffer,
  tickOrders,
} from '../src/core/orders'
import { createInitialState, type GameState, type Offer, type RunState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'

const init = createInitialState()
const meta = init.meta

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

const withRun = (run: Partial<RunState>): GameState => ({ ...init, run: { ...init.run, ...run } })

/** a bought board holding these offers */
const board = (offers: RunState['orders']['offers'], run: Partial<RunState> = {}): GameState =>
  withRun({ orders: { unlocked: true, slots: offers.length, offers }, ...run })

const offer = (o: Partial<Offer>): Offer => ({ good: 'radish', count: 10, done: 0, tier: 0, accepted: true, ...o })
const RADISH = cropGrowTicks('radish', meta, 0)
const ripe: Tile = { status: 'planted', cropId: 'radish', growth: RADISH, moisture: 0, ticksSinceMature: 0 }

describe('orderPool: only what the state can make now', () => {
  it('a new run: the starting crop only', () => {
    expect(orderPool(init.run)).toEqual(['radish'])
  })

  it('licensed crops, the vein drops with the mine license, bars only for an ore that drops once the furnace is built', () => {
    const vein1 = { ...init.run, mineLicense: true, vein: { level: 1, progress: 0, rock: 'stone' as const } }
    expect(orderPool({ ...vein1, licenses: ['radish', 'lemon'] })).toEqual(['radish', 'lemon', 'stone', 'coal'])
    // furnace at vein 1: no copper ore drops, so no copper bar either
    expect(orderPool({ ...vein1, furnace: { ...vein1.furnace, built: true } })).toEqual(['radish', 'stone', 'coal'])
    const vein2 = { ...vein1, vein: { ...vein1.vein, level: 2 }, furnace: { ...vein1.furnace, built: true } }
    expect(orderPool(vein2)).toEqual(['radish', 'stone', 'coal', 'copperOre', 'copperBar'])
    // iron rocks are stone by hand or with a wooden pickaxe; a copper pickaxe mines them, so iron ore and bars join
    const vein3 = { ...vein2, vein: { ...vein2.vein, level: 3 } }
    expect(orderPool(vein3)).not.toContain('ironOre')
    expect(orderPool({ ...vein3, pickaxe: { tier: 'copper', durability: 3 } })).toEqual(['radish', 'stone', 'coal', 'copperOre', 'ironOre', 'copperBar', 'ironBar'])
    // gold rocks need the iron pickaxe: vein Lv4 adds them (and their bars) only then
    const vein4 = { ...vein3, vein: { ...vein3.vein, level: 4 } }
    expect(orderPool({ ...vein4, pickaxe: { tier: 'copper', durability: 3 } })).not.toContain('goldOre')
    expect(orderPool({ ...vein4, pickaxe: { tier: 'iron', durability: 3 } })).toEqual(['radish', 'stone', 'coal', 'copperOre', 'ironOre', 'goldOre', 'copperBar', 'ironBar', 'goldBar'])
    // no mine license: no items even with a deep vein
    expect(orderPool({ ...vein3, mineLicense: false })).toEqual(['radish'])
  })

  it('batch 22: a licensed new crop joins the pool and its count comes from its grow ticks (no generator change)', () => {
    const run = { ...init.run, licenses: ['radish', 'strawberry'] }
    expect(orderPool(run)).toEqual(['radish', 'strawberry'])
    expect(orderCount({ ...init, run }, 'strawberry', 0)).toBe(Math.round(orderTierMinutes(0) * (9 / cropGrowTicks('strawberry', meta, 0)) * 60))
  })
})

describe('orderCount: tier minutes × what the player makes per minute', () => {
  it('crops: tiles ÷ grow ticks × 60 per minute, so a bigger farm gets a bigger order of the same minutes', () => {
    const nine = withRun({})
    expect(orderCount(nine, 'radish', 0)).toBe(Math.round(orderTierMinutes(0) * (9 / RADISH) * 60))
    const lemon24 = withRun({ tiles: Array.from({ length: 24 }, () => init.run.tiles[0]) })
    expect(orderCount(lemon24, 'lemon', 2)).toBe(Math.round(orderTierMinutes(2) * (24 / cropGrowTicks('lemon', meta, 0)) * 60))
  })

  it('batch 19: the Fields standing tiles of the crop count at the same per-tile pace, per crop only (no generator change)', () => {
    const s = withRun({
      fields: { ...init.run.fields, unlocked: true, count: 130, cohorts: [{ crop: 'radish', count: 40, readyTick: 9999 }, { crop: 'lemon', count: 30, readyTick: 8888 }] },
    })
    expect(orderCount(s, 'radish', 0)).toBe(Math.round(orderTierMinutes(0) * ((9 + 40) / RADISH) * 60))
    expect(orderCount(s, 'lemon', 0)).toBe(Math.round(orderTierMinutes(0) * ((9 + 30) / cropGrowTicks('lemon', meta, 0)) * 60))
    // another crop's standing tiles do not count for radish
    expect(orderCount(s, 'chilli', 0)).toBe(Math.round(orderTierMinutes(0) * (9 / cropGrowTicks('chilli', meta, 0)) * 60))
  })

  it('items: rocks per minute × drop share, clamped to half the storage; bars: furnace bars per minute; never below 1', () => {
    const s = withRun({ mineLicense: true, vein: { level: 2, progress: 0, rock: 'stone' }, bagCapacity: 40 })
    expect(orderCount(s, 'coal', 0)).toBe(Math.round(orderTierMinutes(0) * orderRocksPerMin() * 0.2))
    // a 20-min copper ore order is 36 > 40 / 2
    expect(orderCount(s, 'copperOre', 2)).toBe(20)
    expect(orderCount({ ...s, run: { ...s.run, bagCapacity: 20 } }, 'stone', 2)).toBe(10)
    expect(orderCount(s, 'copperBar', 0)).toBe(orderTierMinutes(0))
    expect(orderCount(s, 'ironBar', 0)).toBe(Math.max(1, Math.round(orderTierMinutes(0) / 2)))
  })
})

describe('rollOffer', () => {
  it('two rolls on the run PRNG: the same state and seed give the same offer, unaccepted and empty', () => {
    const s = withRun({ licenses: ['radish', 'chilli', 'pumpkin', 'lemon'] })
    const [a, next] = rollOffer(s, 12345)
    expect(rollOffer(s, 12345)).toEqual([a, next])
    expect(a).toMatchObject({ done: 0, accepted: false })
    expect(orderPool(s.run)).toContain(a.good)
    expect(a.count).toBe(orderCount(s, a.good, a.tier))
  })

  it('tiers by weight 50 / 35 / 15 %', () => {
    expect([rollOrderTier(0), rollOrderTier(0.49), rollOrderTier(0.5), rollOrderTier(0.84), rollOrderTier(0.85), rollOrderTier(0.999)]).toEqual([0, 0, 1, 1, 2, 2])
  })
})

describe('buyOrderBoard', () => {
  const ready = withRun({ cash: 500, inventory: { stone: 15 }, counters: { ...init.run.counters, sales: 50 } })

  it('needs 50 sales, then pays stone + cash and fills every starting slot with an offer', () => {
    expect(buyOrderBoard(withRun({ ...ready.run, counters: init.run.counters }))).toEqual({ ok: false, error: 'LOCKED' })
    const s = okState(buyOrderBoard(ready))
    const cost = orderBoardCost(meta)
    expect(s.run.cash).toBe(500 - cost.cash)
    expect(s.run.inventory.stone).toBe(15 - cost.stone!)
    expect(s.run.orders.unlocked).toBe(true)
    expect(s.run.orders.offers).toHaveLength(orderStartSlots())
    expect(s.run.orders.offers.every(isOffer)).toBe(true)
    expect(s.run.rngState).not.toBe(ready.run.rngState)
    expect(buyOrderBoard(s)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('NOT_ENOUGH_ITEMS before NO_CASH', () => {
    expect(buyOrderBoard({ ...ready, run: { ...ready.run, inventory: {} } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyOrderBoard({ ...ready, run: { ...ready.run, cash: 0 } })).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('accept / discard / deliver', () => {
  it('accept and discard are free; a discarded slot counts down in step() and refills with a fresh offer', () => {
    expect(acceptOrder(init, 0)).toEqual({ ok: false, error: 'LOCKED' })
    let s = board([offer({ accepted: false }), offer({ accepted: false })])
    expect(acceptOrder(s, 5)).toEqual({ ok: false, error: 'BAD_SLOT' })
    s = okState(acceptOrder(s, 0))
    expect(acceptOrder(s, 0)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    s = okState(discardOrder(s, 1))
    expect(s.run.orders.offers[1]).toEqual({ cooldownTicks: orderCooldownTicks() })
    expect(acceptOrder(s, 1)).toEqual({ ok: false, error: 'BAD_SLOT' })
    expect(s.run.cash).toBe(init.run.cash)
    const almost = step(s, orderCooldownTicks() - 1)
    expect(almost.run.orders.offers[1]).toEqual({ cooldownTicks: 1 })
    const refilled = step(almost, 1)
    expect(isOffer(refilled.run.orders.offers[1])).toBe(true)
    expect(refilled.run.rngState).not.toBe(almost.run.rngState)
  })

  it('deliver moves the rest of an accepted item order from storage at 0 energy, pays base × bonus, completes it', () => {
    const s = board([offer({ good: 'stone', count: 8, tier: 1 }), offer({ accepted: false })], { inventory: { stone: 9 }, energy: 0 })
    const done = okState(deliverOrder(s, 0))
    const cash = Math.round(8 * itemSellPrice('stone', meta, 0) * orderBonus())
    expect(done.run.inventory.stone).toBe(1)
    expect(done.run.cash).toBe(s.run.cash + cash)
    expect(done.run.lifetime.cashEarned).toBe(cash)
    expect(done.run.stars).toBe(orderTierStars(1))
    expect(done.run.counters.orders).toBe(1)
    expect(done.run.lifetime).toMatchObject({ ordersCompleted: 1, starsEarned: orderTierStars(1) })
    // the slot holds a fresh offer; the other one is untouched
    expect(done.run.orders.offers[0]).toMatchObject({ done: 0, accepted: false })
    expect(done.run.orders.offers[1]).toEqual(s.run.orders.offers[1])
  })

  it('deliver errors: not accepted / a crop order NOTHING_TO_DO, short storage NOT_ENOUGH_ITEMS', () => {
    const s = board([offer({ good: 'coal', count: 5, accepted: false }), offer({})], { inventory: { coal: 4 } })
    expect(deliverOrder(s, 0)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(deliverOrder(s, 1)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(deliverOrder(okState(acceptOrder(s, 0)), 0)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })

  it('a bar is valued at its inputs: 2 ore + its coal', () => {
    expect(itemOrderValue(init, 'copperBar')).toBe((2 * itemSellPrice('copperOre', meta, 0) + 1 * itemSellPrice('coal', meta, 0)) * orderBonus())
    expect(itemOrderValue(init, 'ironBar')).toBe((2 * itemSellPrice('ironOre', meta, 0) + 2 * itemSellPrice('coal', meta, 0)) * orderBonus())
  })
})

describe('crop orders fill from harvests', () => {
  const tiles = init.run.tiles.map(() => ripe)

  it('an accepted order takes the harvest: base × (1 + bonus) × hand-picked, no glut, done +1', () => {
    const s = board([offer({ count: 3 })], { tiles, energy: 10 })
    const next = okState(harvest(s, 0))
    const base = cropSellPrice('radish', meta, 0)
    expect(next.run.cash).toBe(s.run.cash + Math.round(base * (1 + orderBonus()) * handPickedBonus()))
    expect(next.run.market.radish).toBe(0)
    expect(next.run.orders.offers[0]).toMatchObject({ done: 1 })
    expect(next.run.counters).toMatchObject({ harvests: 1, sales: 1 })
    expect(next.run.lifetime.cashEarned).toBe(next.run.cash - s.run.cash)
  })

  it('a worker harvest (energy 0) fills it at ×1 hand bonus; an unaccepted or other-crop order is ignored (market sale)', () => {
    const s = board([offer({ count: 3 })], { tiles })
    const next = okState(harvest(s, 0, 0))
    expect(next.run.cash).toBe(s.run.cash + Math.round(cropSellPrice('radish', meta, 0) * (1 + orderBonus())))
    for (const o of [offer({ accepted: false }), offer({ good: 'lemon' })]) {
      const t = okState(harvest(board([o], { tiles }), 0, 0))
      expect(t.run.market.radish).toBe(1)
      expect(t.run.orders.offers[0]).toEqual(o)
    }
  })

  it('the last unit completes the order: ⭐ by tier, a fresh offer; extra units go to the market', () => {
    const s = board([offer({ count: 2, done: 1, tier: 2 })], { tiles })
    const next = okState(harvest(s, 0, 0))
    expect(next.run.stars).toBe(orderTierStars(2))
    expect(next.run.counters.orders).toBe(1)
    expect(next.run.orders.offers[0]).toMatchObject({ done: 0, accepted: false })
    expect(next.run.market.radish).toBe(0)
    // the next harvest has no accepted order: market
    expect(okState(harvest(next, 1, 0)).run.market.radish).toBe(1)
  })

  it('step(s, n) = n × step(s, 1) with workers harvesting into an accepted crop order, the market and a cooling slot', () => {
    const lemonGrow = cropGrowTicks('lemon', meta, 0)
    const s = createInitialState()
    const mixed = s.run.tiles.map((t, i): Tile => ({ ...t, status: 'planted', cropId: i % 2 ? 'lemon' : 'radish', growth: i % 2 ? lemonGrow - 3 : RADISH, moisture: 1 }))
    const start: GameState = {
      ...s,
      run: {
        ...s.run,
        tick: 15,
        cash: 500,
        tiles: mixed,
        licenses: ['radish', 'lemon'],
        market: { radish: 40, chilli: 0, pumpkin: 0, lemon: 5 },
        workers: { pool: 3, assigned: { plant: 1, water: 1, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['plant', 'water', 'harvest'] },
        orders: { unlocked: true, slots: 3, offers: [offer({ count: 3 }), offer({ good: 'lemon', count: 2, tier: 1 }), { cooldownTicks: 30 }] },
      },
    }
    let single = start
    for (let n = 1; n <= 60; n++) {
      single = step(single, 1)
      expect(single).toEqual(step(start, n))
    }
    // orders really filled and completed, and the cooling slot refilled
    expect(single.run.counters.orders).toBeGreaterThan(0)
    expect(single.run.stars).toBeGreaterThan(0)
    expect(single.run.orders.offers.every(isOffer)).toBe(true)
  })

  it('tickOrders returns the same state when no slot is cooling', () => {
    const s = board([offer({})])
    expect(tickOrders(s)).toBe(s)
  })
})

describe('⭐ shop: slots and reroll (⭐ only)', () => {
  it('3rd slot ⭐10, 4th ⭐30, then MAX_LEVEL; each new slot holds a fresh offer; cash never pays', () => {
    expect(buyOrderSlot(init)).toEqual({ ok: false, error: 'LOCKED' })
    const s = board([offer({}), offer({})], { stars: 40, cash: 1e6 })
    expect([orderSlotStars(2), orderSlotStars(3), orderSlotStars(4), orderMaxSlots()]).toEqual([10, 30, null, 4])
    const three = okState(buyOrderSlot(s))
    expect([three.run.stars, three.run.cash, three.run.orders.slots, three.run.orders.offers.length]).toEqual([30, 1e6, 3, 3])
    expect(three.run.orders.offers[2]).toMatchObject({ done: 0, accepted: false })
    expect(buyOrderSlot({ ...three, run: { ...three.run, stars: 29 } })).toEqual({ ok: false, error: 'NO_STARS' })
    const four = okState(buyOrderSlot(three))
    expect([four.run.stars, four.run.cash, four.run.orders.slots]).toEqual([0, 1e6, 4])
    expect(buyOrderSlot(four)).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('reroll: ⭐2 refills every slot without an accepted order now (cooldowns too); accepted orders keep their progress', () => {
    const accepted = offer({ done: 4 })
    const s = board([accepted, offer({ accepted: false, good: 'radish', count: 999 }), { cooldownTicks: 500 }], { stars: 2 })
    const next = okState(rerollOrders(s))
    expect(next.run.stars).toBe(0)
    expect(next.run.orders.offers[0]).toBe(accepted)
    expect(next.run.orders.offers[1]).not.toEqual(s.run.orders.offers[1])
    expect(next.run.orders.offers.every(isOffer)).toBe(true)
    expect(rerollOrders(next)).toEqual({ ok: false, error: 'NO_STARS' })
    expect(rerollOrders(board([accepted], { stars: 9 }))).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
  })
})

describe('order clerk (worker job)', () => {
  const clerkFarm = (offers: RunState['orders']['offers'], run: Partial<RunState> = {}) =>
    board(offers, {
      cash: 100,
      mineLicense: true,
      vein: { level: 1, progress: 0, rock: 'stone' },
      workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 1 }, certificates: ['clerk'] },
      ...run,
    })

  it('certificate: ⭐20 + 🥉6 + 💰200 after 20 orders completed', () => {
    expect(certificateCost('clerk', meta)).toEqual({ stars: 20, copperBar: 6, cash: 200 })
    const ready = board([], { stars: 20, cash: 200, inventory: { copperBar: 6 }, counters: { ...init.run.counters, orders: 20 } })
    expect(certificateUnlocked({ ...ready.run, counters: { ...ready.run.counters, orders: 19 } }, 'clerk')).toBe(false)
    const bought = okState(buyCertificate(ready, 'clerk'))
    expect([bought.run.stars, bought.run.cash, bought.run.inventory.copperBar]).toEqual([0, 0, 0])
    expect(bought.run.milestones.certClerk).toBe(bought.run.tick)
    expect(buyCertificate({ ...ready, run: { ...ready.run, stars: 19 } }, 'clerk')).toEqual({ ok: false, error: 'NO_STARS' })
  })

  it('delivers an item order storage can fill first, paying the wage; else accepts an offer the farm grows or the vein drops', () => {
    const s = clerkFarm([offer({ good: 'lemon', accepted: false }), offer({ good: 'coal', count: 3, accepted: true })], { inventory: { coal: 3 } })
    const once = workersAct(s)
    expect(once.run.inventory.coal).toBe(0)
    expect(once.run.counters.orders).toBe(1)
    expect(once.run.lifetime.wagesPaid).toBe(workerWage(meta))
    // next action: lemon is neither planted nor "Crop to plant" → skipped; the fresh slot-1 offer is checked next
    const plantedLemon = { ...once, run: { ...once.run, plantCrop: 'lemon' as const, tick: 5 } }
    const twice = workersAct(plantedLemon)
    expect(twice.run.orders.offers[0]).toMatchObject({ good: 'lemon', accepted: true })
  })

  it('idles unpaid with nothing to do, never discards, and never accepts what the farm does not grow', () => {
    const s = clerkFarm([offer({ good: 'lemon', accepted: false }), offer({ good: 'coal', count: 3, accepted: true })], { inventory: { coal: 2 } })
    expect(workersAct(s)).toBe(s)
    const later = step(s, 600)
    expect(later.run.orders.offers).toEqual(s.run.orders.offers)
    expect(later.run.lifetime.wagesPaid).toBe(0)
  })

  it('step(s, n) = n × step(s, 1) with the clerk, harvest workers, accepted crop orders and the market', () => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t): Tile => ({ ...t, status: 'planted', cropId: 'radish', growth: RADISH - 2, moisture: 1 }))
    const start = clerkFarm([offer({ count: 2, accepted: false }), offer({ good: 'stone', count: 2, accepted: false }), { cooldownTicks: 7 }], {
      tick: 15,
      tiles,
      inventory: { stone: 5 },
      market: { radish: 30, chilli: 0, pumpkin: 0, lemon: 0 },
      workers: { pool: 2, assigned: { plant: 0, water: 0, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 1 }, certificates: ['harvest', 'clerk'] },
    })
    let single = start
    for (let n = 1; n <= 40; n++) {
      single = step(single, 1)
      expect(single).toEqual(step(start, n))
    }
    expect(single.run.counters.orders).toBeGreaterThanOrEqual(2)
    expect(single.run.milestones.firstOrder).toBeDefined()
  })
})

describe('batch-14 milestones', () => {
  it('board bought, first order, 10 ⭐ earned', () => {
    const ids = MILESTONES.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['orderBoard', 'firstOrder', 'stars10', 'certClerk']))
    const before = board([offer({ good: 'stone', count: 1, tier: 2 })], { inventory: { stone: 1 }, lifetime: { ...init.run.lifetime, starsEarned: 8 } })
    const after = okState(deliverOrder(before, 0))
    expect(after.run.milestones).toMatchObject({ firstOrder: 0, stars10: 0 })
    const bought = okState(buyOrderBoard(withRun({ cash: 500, inventory: { stone: 10 }, counters: { ...init.run.counters, sales: 50 }, tick: 77 })))
    expect(bought.run.milestones.orderBoard).toBe(77)
  })
})
