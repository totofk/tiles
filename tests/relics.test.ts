import { describe, expect, it } from 'vitest'
import { digForSeeds } from '../src/core/actions'
import {
  DIG_ANCIENT_CHANCE,
  DIG_DUST_CHANCE,
  DIG_SHARD_CHANCE,
  RELIC_COOLDOWN_TICKS,
  RELIC_FLOOR_CAP,
  RELIC_FLOOR_LIFT,
  RELIC_ORDER_BONUS,
  RELIC_PICK_SHARDS,
  RELIC_REGEN_FACTOR,
  RELIC_RESERVE_CAP,
  energyRegenPerTick,
  fuelTicks,
  orderBonus,
  orderCooldownTicks,
} from '../src/core/balance'
import { RELIC_IDS, type RelicId } from '../src/core/data/relics'
import { addFuel } from '../src/core/furnace'
import { cropFloor } from '../src/core/market'
import { sellFarm } from '../src/core/prestige'
import { pickRelic, relicRegenFactor, relicSet, reserveCap, spendEnergy } from '../src/core/relics'
import { createInitialState, type GameState } from '../src/core/state'
import { step } from '../src/core/step'
import { deserialize } from '../src/save/serialize'
import v32 from './fixtures/save-v32.json?raw'

const init = createInitialState()
const owned = (id: RelicId): RelicId[] => [id]
const set = [...RELIC_IDS]
/** n digs with ⚡ refilled (one big bank), from the fresh state's fixed seed */
function digs(n: number, relics: RelicId[] = []): GameState {
  let s: GameState = { ...init, run: { ...init.run, energy: n, relics } }
  for (let i = 0; i < n; i++) {
    const r = digForSeeds(s)
    if (!r.ok) throw new Error(`dig ${i} failed`)
    s = r.state
  }
  return s
}
const within = (rate: number, p: number, tol: number) => rate > p * (1 - tol) && rate < p * (1 + tol)
const POTATO_CHANCE = 0.2 // digSeedDrop()'s locked roll (not exported)

describe('the dig finds (batch 36.4)', () => {
  it('PIN36l: 200,000 digs — shard / dust / ancient odds ±15 %, potato 0.2 ± 0.01, the book on dig 1, replay', () => {
    expect(init.run.finds.book).toBe(false)
    const first = digForSeeds({ ...init, run: { ...init.run, energy: 1 } })
    expect(first.ok && first.state.run.finds.book).toBe(true) // the run's first dig opens the 📖 book, nothing further pays it
    const n = 200_000
    const s = digs(n)
    const { shards, starDust, ancientSeeds } = s.run.finds
    expect(within(shards / n, DIG_SHARD_CHANCE, 0.15)).toBe(true)
    expect(within(starDust / n, DIG_DUST_CHANCE, 0.15)).toBe(true)
    expect(within(ancientSeeds / n, DIG_ANCIENT_CHANCE, 0.15)).toBe(true)
    const potatoes = (s.run.seeds.potato ?? 0) - (init.run.seeds.potato ?? 0)
    expect(within(potatoes / n, POTATO_CHANCE, 0.05)).toBe(true)
    expect(s.run.stars).toBe(init.run.stars + starDust) // 1 ✨ = ⭐1
    expect([s.run.lifetime.shardsFound, s.run.lifetime.starDustFound, s.run.lifetime.ancientSeedsFound]).toEqual([shards, starDust, ancientSeeds])
    expect(s.run.counters.digs).toBe(n)
    expect(JSON.stringify(digs(100))).toBe(JSON.stringify(digs(100))) // same seed → same state
  })

  it('PIN36l (the set owned): no shard drops, the ancient rate doubles to ≈ 0.1 % (±25 %)', () => {
    const n = 200_000
    const s = digs(n, set)
    expect(relicSet(s.run)).toBe(true)
    expect(s.run.finds.shards).toBe(0)
    expect(s.run.lifetime.shardsFound).toBe(0)
    expect(within(s.run.finds.ancientSeeds / n, 2 * DIG_ANCIENT_CHANCE, 0.25)).toBe(true)
  })
})

describe('the 6 rules (batch 36.4)', () => {
  it('PIN36m: each rule none / owned / set — bonus, cooldown, regen, floor lift with the 0.9 cap, reserve caps, stone units', () => {
    expect([orderBonus([]), orderBonus(owned('orderBonus')), orderBonus(set)]).toEqual([...RELIC_ORDER_BONUS])
    expect([orderCooldownTicks([]), orderCooldownTicks(owned('orderCooldown')), orderCooldownTicks(set)]).toEqual([...RELIC_COOLDOWN_TICKS])
    expect([relicRegenFactor([]), relicRegenFactor(owned('energyRegen')), relicRegenFactor(set)]).toEqual([...RELIC_REGEN_FACTOR])
    // 📉 the floor: a top-renown crop (floor 0.7) lifts +0.10 / +0.15, capped at 0.9
    expect(RELIC_FLOOR_CAP).toBe(0.9)
    const floorRun = (relics: RelicId[]) => ({ ...init.run, renown: { radish: 4_000 }, relics })
    expect([cropFloor(floorRun([]), 'radish'), cropFloor(floorRun(owned('marketFloor')), 'radish'), cropFloor(floorRun(set), 'radish')])
      .toEqual([0.7, 0.7 + RELIC_FLOOR_LIFT[1], 0.7 + RELIC_FLOOR_LIFT[2]])
    // 🔋 the reserve cap: 0 without the rule, 20 × / 30 × the ⚡ max 10
    expect([reserveCap({ ...init.run, upgrades: init.run.upgrades, relics: [] }, init.meta), reserveCap({ ...init.run, relics: owned('overflowReserve') }, init.meta), reserveCap({ ...init.run, relics: set }, init.meta)])
      .toEqual([...RELIC_RESERVE_CAP.map((f) => f * 10)])
    // ⛰️ stone: LOCKED without the rule (even with stone in stock), 2 units owned, 3 in a set
    expect(addFuel({ ...init, run: { ...init.run, inventory: { stone: 5 } } }, 'stone').ok).toBe(false)
    expect([fuelTicks('stone', []), fuelTicks('stone', owned('stoneFuel')), fuelTicks('stone', set)]).toEqual([0, 60, 90])
    const stoneFire = (relics: RelicId[]) => addFuel({ ...init, run: { ...init.run, furnace: { ...init.run.furnace, built: true }, inventory: { stone: 1 }, relics } }, 'stone')
    expect([stoneFire(owned('stoneFuel')), stoneFire(set)].map((r) => (r.ok ? r.state.run.furnace.fire : -1))).toEqual([60, 90])
  })

  it('PIN36m: the 🔋 reserve fills only from regen past ⚡ max and only with the rule; spendEnergy pays ⚡ first, then it', () => {
    const atMax = (relics: RelicId[]) => step({ ...init, run: { ...init.run, energy: 10, relics } }, 100) // ⚡ max 10 on a fresh run
    expect(atMax([]).run.energyReserve).toBe(0) // never fills without the rule
    expect(atMax(owned('overflowReserve')).run.energyReserve).toBeCloseTo(100 / 3, 5) // every tick's regen is overflow at ⚡ max
    expect(step({ ...init, run: { ...init.run, energy: 10, energyReserve: 299, relics: set } }, 100).run.energyReserve).toBe(300) // capped at 30 × ⚡ max
    const drained = step({ ...init, run: { ...init.run, energy: 0, relics: owned('overflowReserve') } }, 10).run
    expect(drained.energy).toBeGreaterThan(0) // below ⚡ max the regen fills ⚡ first…
    expect(drained.energyReserve).toBeLessThan(1e-9) // …and nothing banks (bar FP dust from the integer rounding of ⚡)
    expect(spendEnergy({ energy: 5, energyReserve: 0 }, 3)).toEqual({ energy: 2, energyReserve: 0 })
    expect(spendEnergy({ energy: 1, energyReserve: 5 }, 3)).toEqual({ energy: 0, energyReserve: 3 })
    expect(spendEnergy({ energy: 0, energyReserve: 2 }, 3)).toBeNull()
    expect(spendEnergy({ energy: 0, energyReserve: 0 }, 0)).toEqual({ energy: 0, energyReserve: 0 }) // cost 0 always succeeds
  })

  it('PIN36m: pickRelic — NOT_ENOUGH_ITEMS at 4, the 5-shard price, ALREADY_OWNED; sellFarm drops the run fields, keeps the book lifetime', () => {
    expect(pickRelic({ ...init, run: { ...init.run, finds: { ...init.run.finds, shards: 4 } } }, 'orderBonus').ok).toBe(false)
    const picked = pickRelic({ ...init, run: { ...init.run, finds: { ...init.run.finds, shards: 5 } } }, 'orderBonus')
    expect(picked.ok && [picked.state.run.finds.shards, picked.state.run.relics, picked.state.run.lifetime.relicsEver]).toEqual([5 - RELIC_PICK_SHARDS, ['orderBonus'], ['orderBonus']])
    expect(picked.ok ? pickRelic(picked.state, 'orderBonus').ok : true).toBe(false)
    const atGate: GameState = {
      ...init,
      run: {
        ...init.run,
        lifetime: { ...init.run.lifetime, cashEarned: 640_000, shardsFound: 3, starDustFound: 2, ancientSeedsFound: 1, relicsEver: ['orderBonus'] },
        workers: { ...init.run.workers, certificates: ['plant', 'harvest'] },
        workshop: { built: true, beds: [true, false, false, false], valve: false },
        finds: { shards: 6, starDust: 2, ancientSeeds: 1, book: true },
        relics: ['orderBonus', 'energyRegen'],
        energyReserve: 40,
      },
    }
    const sale = sellFarm(atGate)
    expect(sale.ok && [sale.state.run.relics, sale.state.run.finds, sale.state.run.energyReserve]).toEqual([[], { shards: 0, starDust: 0, ancientSeeds: 0, book: false }, 0])
    expect(sale.ok && sale.state.run.lifetime).toMatchObject({ shardsFound: 3, starDustFound: 2, ancientSeedsFound: 1, relicsEver: ['orderBonus'] })
  })
})

describe('relic ceilings and the veteran report (batch 36.4)', () => {
  it('PIN36n (closed form): 4,200 digs/h at Lv10 regen, dust ⭐/h 12.6 / 14.5 under the 19.2 ceiling, first pick 3.3 h', () => {
    const digsH = 3600 * energyRegenPerTick(10, init.meta)
    const dustH = digsH * DIG_DUST_CHANCE
    const dustSetH = dustH * RELIC_REGEN_FACTOR[2]
    const firstPickH = RELIC_PICK_SHARDS / (0.25 * 3600 * energyRegenPerTick(0, init.meta) * DIG_SHARD_CHANCE)
    console.log('PIN36n', { digsH, dustH, dustSetH, firstPickH })
    expect(Math.round(digsH)).toBe(4_200)
    expect(dustH).toBeCloseTo(12.6, 5)
    expect(dustSetH).toBeLessThanOrEqual(14.5)
    expect(Math.max(dustH, dustSetH)).toBeLessThan(19.2)
    expect(firstPickH).toBeCloseTo(3.3, 1)
  })

  it('PIN36o (report only): the migrated v32 save, 2 game-h with no relic vs all 6 granted', () => {
    const base = deserialize(v32)!.state
    const none = step(base, 7_200)
    const all = step({ ...base, run: { ...base.run, relics: [...RELIC_IDS] } }, 7_200)
    console.log('PIN36o', {
      cashGained: [none.run.cash - base.run.cash, all.run.cash - base.run.cash],
      starsGained: [none.run.stars - base.run.stars, all.run.stars - base.run.stars],
      reserve: [Math.floor(none.run.energyReserve), Math.floor(all.run.energyReserve)],
    })
    expect([none.run.tick, all.run.tick]).toEqual([base.run.tick + 7_200, base.run.tick + 7_200])
  })
})
