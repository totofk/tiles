import { describe, expect, it } from 'vitest'
import { harvest, nextRandom, type ActionResult } from '../src/core/actions'
import { fieldsHarvest, reapPlot } from '../src/core/fields'
import { cropSale } from '../src/core/market'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import {
  FIELD_PRESSURE,
  certificateCost,
  contractWetShare,
  cropGrowTicks,
  doubleHarvestChance,
  fieldPlots,
  plotTiles,
  cropSellPrice,
  orderMaxSlots,
  orderRerollCash,
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
import { buyCertificate, certificateUnlocked, workerActivity, workersAct } from '../src/core/workers'
import {
  acceptOrder,
  buyOrderBoard,
  buyOrderSlot,
  clerkTarget,
  contractCap,
  rerollOrders,
  deliverOrder,
  discardOrder,
  isCropGood,
  isOffer,
  itemOrderValue,
  orderCount,
  orderPerMinute,
  orderPool,
  rollOffer,
  tickOrders,
} from '../src/core/orders'
import { createInitialState, type GameState, type Offer, type OrderGood, type RunState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'

const fresh = createInitialState()
// batch 35: these pins were measured on a carrot-only start; carrot is now the first paid rung, so it is granted here
const init = { ...fresh, run: { ...fresh.run, licenses: ['radish' as const], plantCrop: 'radish' as const } }
const meta = init.meta

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

const withRun = (run: Partial<RunState>): GameState => ({ ...init, run: { ...init.run, ...run } })

/** a bought board holding these offers */
const board = (offers: RunState['orders']['offers'], run: Partial<RunState> = {}): GameState =>
  withRun({ orders: { unlocked: true, slots: offers.length, offers, rerolls: 0 }, ...run })

const offer = (o: Partial<Offer>): Offer => ({ good: 'radish', count: 10, done: 0, tier: 0, accepted: true, stars: 1, ...o })
const RADISH = cropGrowTicks('radish', meta, 0)
const ripe: Tile = { status: 'planted', cropId: 'radish', growth: RADISH, moisture: 0, ticksSinceMature: 0 }
/** batch 32.2: a worker's Fields reap that finishes the plot (its 10th tile on the shared counter) */
const workerReap = (s: GameState) =>
  fieldsHarvest({ ...s, run: { ...s.run, fields: { ...s.run.fields, machines: { ...s.run.fields.machines, carry: { ...s.run.fields.machines.carry, harvest: plotTiles() - 1 } } } } })!

describe('orderPool: only what the state can make now', () => {
  it('a new run: the starting crop only', () => {
    expect(orderPool(fresh.run)).toEqual(['potato'])
  })

  it('licensed crops, the vein drops with the mine license, bars only for an ore that drops once the furnace is built', () => {
    const vein1 = { ...init.run, mineLicense: true, vein: { level: 1, progress: 0, rock: 'stone' as const } }
    expect(orderPool({ ...vein1, licenses: ['radish', 'lemon'] })).toEqual(['radish', 'lemon', 'stone', 'coal'])
    // furnace at vein 1: no copper ore drops, so no copper bar either
    expect(orderPool({ ...vein1, furnace: { ...vein1.furnace, built: true } })).toEqual(['radish', 'stone', 'coal'])
    const vein2 = { ...vein1, vein: { ...vein1.vein, level: 2 }, furnace: { ...vein1.furnace, built: true } }
    expect(orderPool(vein2)).toEqual(['radish', 'stone', 'coal', 'copperOre', 'copperBar'])
    // iron rocks are stone by hand or with a wooden pickaxe; a copper pickaxe mines them, so iron ore joins — and its
    // bar once the iron mold is owned (batch 33)
    const vein3 = { ...vein2, vein: { ...vein2.vein, level: 3 } }
    expect(orderPool(vein3)).not.toContain('ironOre')
    expect(orderPool({ ...vein3, rack: { copper: 3 } })).toEqual(['radish', 'stone', 'coal', 'copperOre', 'ironOre', 'copperBar'])
    const empty = { ore: 0, progress: 0, ready: 0 }
    const allMolds = { ...vein2.furnace, molds: { copperOre: empty, ironOre: empty, goldOre: empty } }
    expect(orderPool({ ...vein3, rack: { copper: 3 }, furnace: allMolds })).toEqual(['radish', 'stone', 'coal', 'copperOre', 'ironOre', 'copperBar', 'ironBar'])
    // gold rocks need the iron pickaxe: vein Lv4 adds them (and their bars) only then
    const vein4 = { ...vein3, vein: { ...vein3.vein, level: 4 } }
    expect(orderPool({ ...vein4, rack: { copper: 3 } })).not.toContain('goldOre')
    // batch 32: the best tier on the rack counts, whichever is in hand
    expect(orderPool({ ...vein4, rack: { copper: 3, iron: 3 }, selectedPickaxe: 'copper', furnace: allMolds })).toEqual(['radish', 'stone', 'coal', 'copperOre', 'ironOre', 'goldOre', 'copperBar', 'ironBar', 'goldBar'])
    // batch 33: no gold mold, no gold bar order
    expect(orderPool({ ...vein4, rack: { copper: 3, iron: 3 }, furnace: { ...allMolds, molds: { copperOre: empty, ironOre: empty } } })).not.toContain('goldBar')
    // no mine license: no items even with a deep vein
    expect(orderPool({ ...vein3, mineLicense: false })).toEqual(['radish'])
  })

  it('batch 22: a licensed new crop joins the pool and its count comes from its grow ticks (no generator change)', () => {
    const run = { ...init.run, licenses: ['radish', 'strawberry'] as CropId[] }
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
      fields: {
        ...init.run.fields,
        unlocked: true,
        list: [
          { pivot: true, crop: 'radish', pinned: false, plots: [...Array.from({ length: 4 }, () => ({ crop: 'radish' as const, readyTick: 9999 })), { crop: null, readyTick: 0 }] },
          { pivot: true, crop: 'lemon', pinned: false, plots: Array.from({ length: 3 }, () => ({ crop: 'lemon' as const, readyTick: 8888 })) },
        ],
      },
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

  it('batch 33: bars per minute = batch bars × 60 × the speed rate ÷ the kind\'s bar ticks', () => {
    const s = withRun({ furnace: { ...init.run.furnace, built: true, levels: { ...init.run.furnace.levels, batch: 4, speed: 2 } } })
    expect(orderPerMinute(s, 'copperBar')).toBe((5 * 60 * 1.5625) / 60)
    expect(orderPerMinute(s, 'goldBar')).toBe((5 * 60 * 1.5625) / 180)
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

/** the first offer rolled from seeds 1, 2, … that `want` accepts */
function rolled(s: GameState, want: (o: Offer) => boolean): Offer {
  for (let seed = 1; seed < 2000; seed++) {
    const [o] = rollOffer(s, seed)
    if (want(o)) return o
  }
  throw new Error('no such roll')
}

describe('batch 35.3: order ⭐ fixed per tier (8 / 16 / 32)', () => {
  it('a small, a medium and a large order pay ⭐8 / 16 / 32 whatever the good', () => {
    const crops = withRun({})
    const items = withRun({ mineLicense: true, vein: { level: 2, progress: 0, rock: 'stone' } })
    for (const [tier, stars] of [[0, 8], [1, 16], [2, 32]] as const) {
      expect(orderTierStars(tier)).toBe(stars)
      expect(rolled(crops, (x) => x.tier === tier).stars).toBe(stars)
      expect(rolled(items, (x) => !isCropGood(x.good) && x.tier === tier).stars).toBe(stars)
    }
  })

  it('a storage-clamped item order still pays its tier\'s full ⭐', () => {
    const s = withRun({ mineLicense: true, vein: { level: 2, progress: 0, rock: 'stone' }, bagCapacity: 40 })
    const o = rolled(s, (x) => x.good === 'copperOre' && x.tier === 2)
    expect(o.count).toBe(20) // 36 clamped to 40 / 2
    expect(o.stars).toBe(32)
  })

  it('3 completed orders of ⭐8 / 16 / 32 add ⭐56 to the balance and lifetime', () => {
    let s = board([8, 16, 32].map((stars) => offer({ good: 'stone', count: 1, stars })), { inventory: { stone: 3 } })
    for (const slot of [0, 1, 2]) s = okState(deliverOrder(s, slot))
    expect([s.run.stars, s.run.lifetime.starsEarned]).toEqual([56, 56])
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
    const s = board([offer({ good: 'stone', count: 8, tier: 1, stars: 2 }), offer({ accepted: false })], { inventory: { stone: 9 }, energy: 0 })
    const done = okState(deliverOrder(s, 0))
    const cash = Math.round(8 * itemSellPrice('stone', meta, 0) * orderBonus())
    expect(done.run.inventory.stone).toBe(1)
    expect(done.run.cash).toBe(s.run.cash + cash)
    expect(done.run.lifetime.cashEarned).toBe(cash)
    expect(done.run.stars).toBe(2)
    expect(done.run.counters.orders).toBe(1)
    expect(done.run.lifetime).toMatchObject({ ordersCompleted: 1, starsEarned: 2 })
    // the slot holds a fresh offer; the other one is untouched
    expect(done.run.orders.offers[0]).toMatchObject({ done: 0, accepted: false })
    expect(done.run.orders.offers[1]).toEqual(s.run.orders.offers[1])
  })

  it('deliver errors: not accepted / a crop order NOTHING_TO_DO, none in storage NOT_ENOUGH_ITEMS', () => {
    const s = board([offer({ good: 'coal', count: 5, accepted: false }), offer({})], { inventory: { coal: 0 } })
    expect(deliverOrder(s, 0)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(deliverOrder(s, 1)).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(deliverOrder(okState(acceptOrder(s, 0)), 0)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })

  it('batch 35.2: delivering 5 of an ore order’s 20 pays 5 and leaves 15; the 20th completes it and pays ⭐', () => {
    const s = board([offer({ good: 'copperOre', count: 20, tier: 1, stars: 2 })], { inventory: { copperOre: 5 } })
    const part = okState(deliverOrder(s, 0))
    const unit = itemSellPrice('copperOre', meta, 0) * orderBonus()
    expect(part.run.cash - s.run.cash).toBe(Math.round(5 * unit))
    expect(part.run.orders.offers[0]).toMatchObject({ done: 5, count: 20, accepted: true })
    expect([part.run.inventory.copperOre, part.run.stars, part.run.counters.orders]).toEqual([0, 0, 0])
    const full = okState(deliverOrder({ ...part, run: { ...part.run, inventory: { copperOre: 30 } } }, 0))
    expect(full.run.inventory.copperOre).toBe(15)
    expect(full.run.cash - part.run.cash).toBe(Math.round(15 * unit))
    expect([full.run.stars, full.run.counters.orders]).toEqual([2, 1])
    expect(full.run.orders.offers[0]).toMatchObject({ done: 0, accepted: false })
  })

  it('batch 34: a bar is valued at its own sell price × (1 + bonus); ores keep base × bonus', () => {
    expect(itemOrderValue(init, 'copperBar')).toBe(itemSellPrice('copperBar', meta, 0) * (1 + orderBonus()))
    expect(itemOrderValue(init, 'copperOre')).toBe(itemSellPrice('copperOre', meta, 0) * orderBonus())
    // a delivered iron-bar order pays count × 500 × sellFactor × 1.1, rounded once (never less than selling the bars)
    const s = board([offer({ good: 'ironBar', count: 3 })], { inventory: { ironBar: 3 }, upgrades: { ...init.run.upgrades, sellPrice: 2 } })
    const done = okState(deliverOrder(s, 0))
    expect(done.run.cash - s.run.cash).toBe(Math.round(3 * itemSellPrice('ironBar', meta, 2) * 1.1))
    expect(itemSellPrice('ironBar', meta, 2)).toBe(Math.round(500 * 1.2))
    expect(done.run.cash - s.run.cash).toBeGreaterThan(3 * itemSellPrice('ironBar', meta, 2))
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

  it('the last unit completes the order: the offer\'s ⭐, a fresh offer; extra units go to the market', () => {
    const s = board([offer({ count: 2, done: 1, tier: 2, stars: 4 })], { tiles })
    const next = okState(harvest(s, 0, 0))
    expect(next.run.stars).toBe(4)
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
        market: { ...s.run.market, radish: 40, lemon: 5 },
        workers: { pool: 3, assigned: { plant: 1, water: 1, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }, certificates: ['plant', 'water', 'harvest'] },
        orders: { unlocked: true, slots: 3, offers: [offer({ count: 3 }), offer({ good: 'lemon', count: 2, tier: 1 }), { cooldownTicks: 30 }], rerolls: 0 },
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

describe('shop row: slots (⭐) and reroll (💰, batch 35.3)', () => {
  it('3rd slot ⭐80, 4th ⭐240, then MAX_LEVEL; each new slot holds a fresh offer; cash never pays', () => {
    expect(buyOrderSlot(init)).toEqual({ ok: false, error: 'LOCKED' })
    const s = board([offer({}), offer({})], { stars: 320, cash: 1e6 })
    expect([orderSlotStars(2), orderSlotStars(3), orderSlotStars(4), orderMaxSlots()]).toEqual([80, 240, null, 4])
    const three = okState(buyOrderSlot(s))
    expect([three.run.stars, three.run.cash, three.run.orders.slots, three.run.orders.offers.length]).toEqual([240, 1e6, 3, 3])
    expect(three.run.orders.offers[2]).toMatchObject({ done: 0, accepted: false })
    expect(buyOrderSlot({ ...three, run: { ...three.run, stars: 239 } })).toEqual({ ok: false, error: 'NO_STARS' })
    const four = okState(buyOrderSlot(three))
    expect([four.run.stars, four.run.cash, four.run.orders.slots]).toEqual([0, 1e6, 4])
    expect(buyOrderSlot(four)).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })

  it('reroll: refills every slot without an accepted order now (cooldowns too); accepted orders keep their progress', () => {
    const accepted = offer({ done: 4 })
    const s = board([accepted, offer({ accepted: false, good: 'radish', count: 999 }), { cooldownTicks: 500 }], { stars: 2, cash: 500 })
    const next = okState(rerollOrders(s))
    expect([next.run.stars, next.run.cash]).toEqual([2, 0])
    expect(next.run.orders.offers[0]).toBe(accepted)
    expect(next.run.orders.offers[1]).not.toEqual(s.run.orders.offers[1])
    expect(next.run.orders.offers.every(isOffer)).toBe(true)
    expect(rerollOrders(board([accepted], { cash: 1e6 }))).toEqual({ ok: false, error: 'NOTHING_TO_DO' })
    expect(rerollOrders(init)).toEqual({ ok: false, error: 'LOCKED' })
  })

  it('the first reroll costs 💰500, the next 💰1,000, then 💰2,000; without the cash it is refused; finishing any order brings it back to 💰500', () => {
    const s = board([offer({ good: 'stone', count: 1 }), offer({ accepted: false })], { cash: 3500, inventory: { stone: 1 } })
    expect([0, 1, 2].map(orderRerollCash)).toEqual([500, 1000, 2000])
    const three = [1, 2, 3].reduce((g) => okState(rerollOrders(g)), s)
    expect([three.run.cash, three.run.orders.rerolls]).toEqual([0, 3])
    expect(rerollOrders({ ...three, run: { ...three.run, cash: 3999 } })).toEqual({ ok: false, error: 'NO_CASH' })
    const done = okState(deliverOrder(three, 0))
    expect(done.run.orders.rerolls).toBe(0)
    expect(okState(rerollOrders({ ...done, run: { ...done.run, cash: 500 } })).run.cash).toBe(0)
  })
})

describe('order clerk (worker job)', () => {
  const clerkFarm = (offers: RunState['orders']['offers'], run: Partial<RunState> = {}) =>
    board(offers, {
      cash: 100,
      mineLicense: true,
      vein: { level: 1, progress: 0, rock: 'stone' },
      workers: { pool: 1, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 1, manager: 0, stoker: 0 }, certificates: ['clerk'] },
      ...run,
    })

  it('certificate: ⭐160 + 🥉6 + 💰200 after 20 orders completed', () => {
    expect(certificateCost('clerk', meta)).toEqual({ stars: 160, copperBar: 6, cash: 200 })
    const ready = board([], { stars: 160, cash: 200, inventory: { copperBar: 6 }, counters: { ...init.run.counters, orders: 20 } })
    expect(certificateUnlocked({ ...ready.run, counters: { ...ready.run.counters, orders: 19 } }, 'clerk')).toBe(false)
    const bought = okState(buyCertificate(ready, 'clerk'))
    expect([bought.run.stars, bought.run.cash, bought.run.inventory.copperBar]).toEqual([0, 0, 0])
    expect(bought.run.milestones.certClerk).toBe(bought.run.tick)
    expect(buyCertificate({ ...ready, run: { ...ready.run, stars: 159 } }, 'clerk')).toEqual({ ok: false, error: 'NO_STARS' })
  })

  it('delivers an item order storage can fill first, paying the wage; else accepts an offer the farm grows or the vein drops', () => {
    const s = clerkFarm([offer({ good: 'lemon', accepted: false }), offer({ good: 'coal', count: 3, accepted: true })], { inventory: { coal: 3 } })
    const once = workersAct(s)
    expect(once.run.inventory.coal).toBe(0)
    expect(once.run.counters.orders).toBe(1)
    expect(once.run.lifetime.wagesPaid).toBe(workerWage(meta, 'clerk'))
    // next action: batch 36.8 — "the farm grows" = licensed crops, so the lemon licence decides (plantCrop alone no longer does)
    const licensedLemon = { ...once, run: { ...once.run, licenses: [...once.run.licenses, 'lemon' as const], tick: 5 } }
    const twice = workersAct(licensedLemon)
    expect(twice.run.orders.offers[0]).toMatchObject({ good: 'lemon', accepted: true })
  })

  it('batch 35.2: the clerk delivers whatever storage holds of an accepted order', () => {
    const s = clerkFarm([offer({ good: 'coal', count: 3, accepted: true })], { inventory: { coal: 2 } })
    expect(clerkTarget(s)).toBe(0)
    const once = workersAct(s)
    expect([once.run.inventory.coal, (once.run.orders.offers[0] as Offer).done, once.run.counters.orders]).toEqual([0, 2, 0])
  })

  it('batch 36.8: takes a mold-bar offer and a forge-good offer the run can make (furnace + the default copper mold, forge built)', () => {
    // vein 2 drops copper ore → with the furnace built and its default copper mold, 🥉 and the 🔧 (its recipe's bar) are in the pool
    const works = { mineLicense: true, vein: { level: 2, progress: 0, rock: 'stone' as const }, furnace: { ...init.run.furnace, built: true } }
    expect(clerkTarget(clerkFarm([offer({ good: 'copperBar', accepted: false })], works))).toBe(0)
    const forging = { ...works, forge: { ...init.run.forge, built: true } }
    expect(clerkTarget(clerkFarm([offer({ good: 'toolbox', accepted: false })], forging))).toBe(0)
  })

  it('batch 36.8: with a contract accepted the clerk only ever delivers — it never touches fields.list crops', () => {
    const fields = { ...init.run.fields, unlocked: true, list: [{ pivot: true, crop: 'radish' as const, pinned: false, plots: [{ crop: 'radish' as const, readyTick: 50 }] }] }
    const s = clerkFarm([offer({ good: 'radish', count: 5, accepted: true })], { fields, inventory: {} })
    expect(clerkTarget(s)).toBe(-1)
    expect(workersAct(s)).toBe(s)
    expect(s.run.fields.list[0].crop).toBe('radish')
  })

  it('idles unpaid with nothing to do, never discards, and never accepts what the farm does not grow', () => {
    const s = clerkFarm([offer({ good: 'lemon', accepted: false }), offer({ good: 'coal', count: 3, accepted: true })], { inventory: { coal: 0 } })
    expect(workersAct(s)).toBe(s)
    const later = step(s, 600)
    expect(later.run.orders.offers).toEqual(s.run.orders.offers)
    expect(later.run.lifetime.wagesPaid).toBe(0)
  })

  it('clerkTarget names the slot the clerk acts on, and workerActivity reports the touch with it (task 132)', () => {
    const deliver = clerkFarm([offer({ good: 'lemon', accepted: false }), offer({ good: 'coal', count: 3, accepted: true })], { inventory: { coal: 3 } })
    expect(clerkTarget(deliver)).toBe(1)
    expect(workerActivity(deliver)).toEqual([{ job: 'clerk', slot: 1 }])
    const idle = clerkFarm([offer({ good: 'lemon', accepted: false }), offer({ good: 'coal', count: 3, accepted: true })], { inventory: {} })
    expect(clerkTarget(idle)).toBe(-1)
    expect(workerActivity(idle)).toEqual([])
    // batch 36.8 delta (c): pre-Tractor any LICENSED crop qualifies — radish planted nowhere and not "Crop to plant"
    const licensed = clerkFarm([offer({ good: 'radish', accepted: false })], { plantCrop: undefined })
    expect(clerkTarget(licensed)).toBe(0)
    expect(workerActivity(licensed)).toEqual([{ job: 'clerk', slot: 0 }])
  })

  it('step(s, n) = n × step(s, 1) with the clerk, harvest workers, accepted crop orders and the market', () => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t): Tile => ({ ...t, status: 'planted', cropId: 'radish', growth: RADISH - 2, moisture: 1 }))
    const start = clerkFarm([offer({ count: 2, accepted: false }), offer({ good: 'stone', count: 2, accepted: false }), { cooldownTicks: 7 }], {
      tick: 15,
      tiles,
      inventory: { stone: 5 },
      market: { ...init.run.market, radish: 30 },
      workers: { pool: 2, assigned: { plant: 0, water: 0, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 1, manager: 0, stoker: 0 }, certificates: ['harvest', 'clerk'] },
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

describe('batch 35.3: 🚜 contract size cap', () => {
  const field = (pinned = false) => ({ pivot: true, crop: null, pinned, plots: Array.from({ length: fieldPlots() }, () => ({ crop: null, readyTick: 0 })) })
  /** the Tractor bought, `n` pivoted full fields (the first `pinned` 📌), `slots` open offers; radish and lemon sowable */
  const farm = (n: number, slots: number, pinned = 0, run: Partial<RunState> = {}): GameState =>
    board(Array.from({ length: slots }, () => offer({ accepted: false })), {
      licenses: ['radish', 'lemon', 'strawberry'],
      lifetime: { ...init.run.lifetime, harvests: { radish: 50, lemon: 50, strawberry: 49 } },
      fields: { ...init.run.fields, unlocked: true, list: Array.from({ length: n }, (_, k) => field(k < pinned)) },
      mineLicense: true,
      vein: { level: 2, progress: 0, rock: 'stone' },
      ...run,
    })
  const uncapped = (s: GameState, good: OrderGood, tier: number) => Math.max(1, Math.round(orderTierMinutes(tier) * orderPerMinute(s, good)))

  it("a contract on 12 managed fields with 4 slots never asks for more than 3 fields' one harvest", () => {
    const s = farm(12, 4)
    const cap = 3 * fieldPlots() * plotTiles() * (1 + doubleHarvestChance(0))
    expect(contractCap(s.run)).toBe(Math.floor(cap))
    for (const crop of ['radish', 'lemon'] as const)
      for (const tier of [0, 1, 2]) expect(orderCount(s, crop, tier)).toBe(Math.min(uncapped(s, crop, tier), contractCap(s.run)))
    // the cap bites on the large contract
    expect(uncapped(s, 'radish', 2)).toBeGreaterThan(contractCap(s.run))
    expect(orderCount(s, 'radish', 2)).toBe(contractCap(s.run))
  })

  it('pinned fields do not count, at least one field, and a harvest-tool double-harvest chance raises the cap', () => {
    const tiles = fieldPlots() * plotTiles()
    expect(contractCap(farm(12, 4, 4).run)).toBe(2 * tiles)
    expect(contractCap(farm(2, 4).run)).toBe(tiles)
    const gold = farm(12, 4, 0, { toolTier: { ...init.run.toolTier, harvest: 3 } })
    expect(contractCap(gold.run)).toBe(Math.floor(3 * tiles * (1 + doubleHarvestChance(3))))
  })

  it('a home-plot crop order and an ore order keep their old size', () => {
    const s = farm(12, 4)
    // under the fields gate (strawberry) the crop order is a home-plot order: uncapped; an ore order: the storage clamp
    expect(orderCount(s, 'strawberry', 2)).toBe(uncapped(s, 'strawberry', 2))
    expect(orderCount(s, 'copperOre', 2)).toBe(Math.min(uncapped(s, 'copperOre', 2), Math.floor(s.run.bagCapacity / 2)))
    const before = { ...s, run: { ...s.run, fields: { ...s.run.fields, unlocked: false } } }
    for (const tier of [0, 1, 2]) expect(orderCount(before, 'radish', tier)).toBe(uncapped(before, 'radish', tier))
  })
})

describe('batch 29: 🚜 estate contracts', () => {
  const plots = (n: number, crop: CropId | null = null, readyTick = 0) => Array.from({ length: n }, () => ({ crop, readyTick }))
  /** the Tractor bought: 3 pivoted fields (5 + 5 + 2 plots, one ready radish plot in field 0) and a dry 2-plot field */
  const estate = (run: Partial<RunState> = {}, offers: RunState['orders']['offers'] = []): GameState =>
    board(offers, {
      energy: 100,
      licenses: ['radish', 'lemon', 'strawberry'],
      lifetime: { ...init.run.lifetime, harvests: { radish: 50, lemon: 50, strawberry: 49 } },
      fields: {
        ...init.run.fields,
        unlocked: true,
        list: [
          { pivot: true, crop: 'radish', pinned: false, plots: [{ crop: 'radish', readyTick: 0 }, ...plots(4)] },
          { pivot: true, crop: null, pinned: false, plots: plots(5) },
          { pivot: true, crop: null, pinned: false, plots: plots(2) },
          { pivot: false, crop: null, pinned: false, plots: plots(2) },
        ],
      },
      ...run,
    })
  const WET = (5 + 5 + 2) * plotTiles()

  it('after the Tractor a fields-plantable crop asks max(home, share × wet tiles ÷ pressured cycle × 60); else today\'s size', () => {
    const s = estate()
    const home = (crop: CropId, standing = 0) => ((9 + standing) / cropGrowTicks(crop, meta, 0)) * 60
    for (const crop of ['radish', 'lemon'] as const) {
      const contract = ((contractWetShare() * WET) / Math.ceil(cropGrowTicks(crop, meta, 0) / FIELD_PRESSURE)) * 60
      expect(orderPerMinute(s, crop)).toBe(Math.max(home(crop, crop === 'radish' ? plotTiles() : 0), contract))
      expect(orderPerMinute(s, crop)).toBeGreaterThan(home(crop, crop === 'radish' ? plotTiles() : 0))
    }
    // under the 50-harvest gate, and before the Tractor: unchanged
    expect(orderPerMinute(s, 'strawberry')).toBe(home('strawberry'))
    const before = { ...s, run: { ...s.run, fields: { ...s.run.fields, unlocked: false } } }
    expect(orderPerMinute(before, 'lemon')).toBe(home('lemon'))
  })

  it('batch 36.8: an estate contract (a licensed crop, after the Tractor) is the clerk target; an item offer still is; before the Tractor unchanged', () => {
    const run = { mineLicense: true, vein: { level: 1, progress: 0, rock: 'stone' as const }, plantCrop: 'radish' as const }
    const crop = offer({ good: 'radish', accepted: false })
    // re-pinned batch 36.8 (was -1 / 1): clerkTakes = orderPool(run) — licensed crops qualify with the Fields unlocked
    expect(clerkTarget(estate(run, [crop]))).toBe(0)
    expect(clerkTarget(estate(run, [offer({ good: 'coal', accepted: false })]))).toBe(0)
    const before = estate(run, [crop])
    expect(clerkTarget({ ...before, run: { ...before.run, fields: { ...before.run.fields, unlocked: false } } })).toBe(0)
  })

  it('a hand reapPlot pays round(base × 1.1 × 1.25) per order unit and ×1 per market unit; a worker reap ×1 on both', () => {
    const s = estate({}, [offer({ good: 'radish', count: 4 })])
    const market = cropSale(s, 'radish', plotTiles() - 4).cash
    const base = cropSellPrice('radish', meta, 0)
    const hand = okState(reapPlot(s, 0, 0))
    expect(hand.run.cash - s.run.cash).toBe(4 * Math.round(base * (1 + orderBonus()) * handPickedBonus()) + market)
    const worker = workerReap(s)
    expect(okState(worker).run.cash - s.run.cash).toBe(4 * Math.round(base * (1 + orderBonus())) + market)
  })

  it('contractsByHand (contracts delivered) +1 per completed contract, whoever reaped it (batch 31.1)', () => {
    const s = estate({}, [offer({ good: 'radish', count: 4 })])
    // a hand reap counts once, not twice
    expect(okState(reapPlot(s, 0, 0)).run.counters.contractsByHand).toBe(1)
    expect(okState(reapPlot(estate({}, [offer({ good: 'radish', count: 40, done: 36 })]), 0, 0)).run.counters.contractsByHand).toBe(1)
    // not completed → 0; completed by a harvester → 1
    expect(okState(reapPlot(estate({}, [offer({ good: 'radish', count: 40 })]), 0, 0)).run.counters.contractsByHand).toBe(0)
    expect(okState(workerReap(s)).run.counters.contractsByHand).toBe(1)
    // the home plot: a hand or a worker harvest completes it after the Tractor, never before
    const home = estate({ tiles: [ripe, ...init.run.tiles.slice(1)] }, [offer({ good: 'radish', count: 1 })])
    expect(okState(harvest(home, 0)).run.counters.contractsByHand).toBe(1)
    expect(okState(harvest(home, 0, 0)).run.counters.contractsByHand).toBe(1)
    const before = { ...home, run: { ...home.run, fields: { ...home.run.fields, unlocked: false } } }
    const done = okState(harvest(before, 0))
    expect([done.run.counters.orders, done.run.counters.contractsByHand]).toEqual([1, 0])
  })

  it('batch 35.3: a contract pays its tier\'s full ⭐ (a large one ⭐32)', () => {
    expect(rolled(estate(), (x) => x.good === 'lemon' && x.tier === 2).stars).toBe(32)
  })

  it('rollOffer consumes exactly two rolls before and after the Tractor', () => {
    const twoRolls = nextRandom(nextRandom(12345)[1])[1]
    const s = estate()
    expect(rollOffer(s, 12345)[1]).toBe(twoRolls)
    expect(rollOffer({ ...s, run: { ...s.run, fields: { ...s.run.fields, unlocked: false } } }, 12345)[1]).toBe(twoRolls)
  })
})

describe('batch-14 milestones', () => {
  it('board bought, first order, 10 ⭐ earned', () => {
    const ids = MILESTONES.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['orderBoard', 'firstOrder', 'stars10', 'certClerk']))
    const before = board([offer({ good: 'stone', count: 1, tier: 2, stars: 4 })], { inventory: { stone: 1 }, lifetime: { ...init.run.lifetime, starsEarned: 8 } })
    const after = okState(deliverOrder(before, 0))
    expect(after.run.milestones).toMatchObject({ firstOrder: 0, stars10: 0 })
    const bought = okState(buyOrderBoard(withRun({ cash: 500, inventory: { stone: 10 }, counters: { ...init.run.counters, sales: 50 }, tick: 77 })))
    expect(bought.run.milestones.orderBoard).toBe(77)
  })
})

describe('batch 36.2: PIN36g forge goods in the order pool', () => {
  it('an Iron Hills run with the forge built, every mold, vein 4: forge goods are ≤ 35 % of the pool', () => {
    const empty = { ore: 0, progress: 0, ready: 0 }
    const run: RunState = {
      ...init.run,
      listing: { district: 'ironHills', soil: null },
      licenses: ['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'chilli'],
      mineLicense: true,
      vein: { level: 4, progress: 0, rock: 'stone' },
      rack: { copper: 3, iron: 3 },
      furnace: { ...init.run.furnace, built: true, molds: { copperOre: empty, ironOre: empty, goldOre: empty } },
      forge: { ...init.run.forge, built: true },
    }
    const pool = orderPool(run)
    const goods = pool.filter((g) => ['toolbox', 'ploughBlade', 'anchorChain'].includes(g))
    expect(goods).toEqual(['toolbox', 'ploughBlade', 'anchorChain'])
    expect(goods.length / pool.length).toBeLessThanOrEqual(0.35)
  })
})

describe('batch 36.3: PIN36j Wetlands orders (no contract ⭐ bonus)', () => {
  const WETLANDS: CropId[] = ['potato', 'radish', 'corn', 'eggplant', 'pumpkin', 'tomato', 'lemon', 'grape', 'strawberry']

  it("a no-mine Wetlands pool is exactly the licences; every rolled offer's ⭐ is its tier's 8 / 16 / 32, as on plain", () => {
    const wet: GameState = { ...fresh, run: { ...fresh.run, listing: { district: 'wetlands', soil: null }, licenses: WETLANDS } }
    const plain: GameState = { ...wet, run: { ...wet.run, listing: { district: 'plain', soil: null } } }
    expect(orderPool(wet.run)).toEqual(WETLANDS)
    expect([0, 1, 2].map(orderTierStars)).toEqual([8, 16, 32])
    let rng = 12345
    for (let k = 0; k < 200; k++) {
      const [offer, next] = rollOffer(wet, rng)
      const [onPlain] = rollOffer(plain, rng)
      expect(WETLANDS).toContain(offer.good)
      expect(offer.stars).toBe(orderTierStars(offer.tier))
      expect([offer.tier, offer.stars]).toEqual([onPlain.tier, onPlain.stars])
      rng = next
    }
    // report: the item share of plain's pool at the PIN36g state (vein 4, every mold, no forge)
    const empty = { ore: 0, progress: 0, ready: 0 }
    const pool = orderPool({
      ...init.run,
      licenses: [...CROP_IDS],
      mineLicense: true,
      vein: { level: 4, progress: 0, rock: 'stone' },
      rack: { copper: 3, iron: 3 },
      furnace: { ...init.run.furnace, built: true, molds: { copperOre: empty, ironOre: empty, goldOre: empty } },
    })
    const itemShare = Math.round((pool.filter((g) => !isCropGood(g)).length / pool.length) * 1000) / 1000
    console.log('PIN36j', JSON.stringify({ plainPool: pool.length, plainItemShare: itemShare, wetlandsPool: WETLANDS.length, wetlandsItemShare: 0 }))
    expect(itemShare).toBeGreaterThan(0)
  })
})
