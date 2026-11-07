import { describe, expect, it } from 'vitest'
import v1 from './fixtures/save-v1.json?raw'
import v2 from './fixtures/save-v2.json?raw'
import v3 from './fixtures/save-v3.json?raw'
import v4 from './fixtures/save-v4.json?raw'
import v5 from './fixtures/save-v5.json?raw'
import v6 from './fixtures/save-v6.json?raw'
import { BAG_CAPACITY_START, INITIAL_RNG_SEED, OFFLINE_CAP_TICKS, START_TILES, energyMax, loanDebtPerTick } from '../src/core/balance'
import { takeLoan } from '../src/core/bank'
import { dig } from '../src/core/mining'
import { createInitialState, createTile } from '../src/core/state'
import { step } from '../src/core/step'
import { SAVE_VERSION, awayText, catchUp, deserialize, offlineTicks, serialize } from '../src/save/serialize'
import { BAD_SAVE_KEY, SAVE_KEY, backupKey, loadGame, saveGame, type KeyValueStore } from '../src/save/storage'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const HOUR = 3600 * 1000
/** v4 fields every migrated save starts with: no farm tools, 1 tile per level-2 press */
const noTools = { tools: { water: 0, harvest: 0, plant: 0 }, toolN: { water: 1, harvest: 1, plant: 1 } }
/** v5 fields every migrated save starts with: no half-mined stone, no mastery, storage level 0 */
const noMiningProgress = { vein: { level: 0, progress: 0, rock: 'stone' }, mastery: {}, masteredTiers: [], storageLevel: 0 }
/** v6 fields every migrated save starts with (lifetime is checked per fixture below) */
const noFurnace = { furnace: { built: false, queue: 0, progress: 0, ready: 0 }, lifetime: expect.any(Object) }
/** the only v7 field: every job at the basic tier */
const noCopper = { toolTier: { water: 0, harvest: 0, plant: 0 } }

describe('serialize / deserialize', () => {
  it('round-trips state and savedAtMs', () => {
    const state = step(createInitialState(), 42)
    const save = deserialize(serialize(state, 1234))
    expect(save).toEqual({ version: 7, savedAtMs: 1234, state })
  })

  it('round-trips the furnace, copper items, the current rock and lifetime totals', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        vein: { level: 2, progress: 2, rock: 'copperOre' as const },
        furnace: { built: true, queue: 3, progress: 17, ready: 2 },
        inventory: { copperOre: 4, copperBar: 1 },
        lifetime: { cashEarned: 900, energySpent: 412, bars: 6, harvests: { radish: 40, lemon: 2 } },
      },
    }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('migrates a real v6 save (built by the batch-7 code) to v7: everything kept, every job at the basic tier', () => {
    const old = JSON.parse(v6)
    expect(old.version).toBe(6)
    expect(old.state.run).toMatchObject({
      furnace: { built: true, queue: 1, ready: 1 },
      vein: { level: 2 },
      pickaxe: { tier: 'copper' },
      mastery: { copper: 15 },
      tools: { water: 2, harvest: 2, plant: 2 },
    })
    const save = deserialize(v6)!
    expect(save).toEqual({ version: 7, savedAtMs: old.savedAtMs, state: { meta: old.state.meta, run: { ...old.state.run, ...noCopper } } })
    // the queued smelt finishes and the run plays on
    const later = step(save.state, 60)
    expect(later.run.furnace).toMatchObject({ queue: 0, ready: 2 })
    expect(later.run.tick).toBe(old.state.run.tick + 60)
  })

  it('migrates a real v5 save (built by the batch-6.2 code) to v7:everything kept, furnace not built', () => {
    const old = JSON.parse(v5)
    expect(old.version).toBe(5)
    expect(old.state.run).toMatchObject({ vein: { level: 1, progress: 0 }, storageLevel: 1, inventory: { stone: 5, coal: 2 }, mastery: { wooden: 46 } })
    const save = deserialize(v5)!
    expect(save).toEqual({
      version: 7,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: { ...old.state.run, vein: { level: 1, progress: 0, rock: 'stone' }, ...noFurnace, ...noCopper } },
    })
    // the migrated run (saved at 0 energy) mines again after regen and plays on
    expect(dig(step(save.state, 3)).ok).toBe(true)
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it.each([
    // version, energy spent = harvests + waters + plants + soil digs + mines, harvests per crop (one license only)
    [1, v1, 0, {}],
    [2, v2, 4, { radish: 2 }],
    [3, v3, 24, { radish: 17 }],
    [4, v4, 140, { radish: 27 }],
    [5, v5, 246, {}],
  ])('v%i lifetime totals start from the counters that map, cash earned at 0', (_, raw, energySpent, harvests) => {
    expect(deserialize(raw)!.state.run.lifetime).toEqual({ cashEarned: 0, energySpent, bars: 0, harvests })
  })

  it('round-trips mining progress: half-mined stone, mastery, a blunt pickaxe, storage level', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        vein: { level: 0, progress: 1, rock: 'stone' as const },
        mastery: { wooden: 37 },
        masteredTiers: ['wooden' as const],
        pickaxe: { tier: 'wooden' as const, durability: 0 },
        storageLevel: 2,
        bagCapacity: 40,
      },
    }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('round-trips the seed pouch and auto-buy flag', () => {
    const s = createInitialState()
    const state = { ...s, run: { ...s.run, seeds: { radish: 3 }, autoBuySeeds: false } }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('round-trips an active loan', () => {
    const s = createInitialState()
    const state = { ...s, run: { ...s.run, loan: { principal: 30, debt: 41.12 } } }
    expect(deserialize(serialize(state, 0))?.state.run.loan).toEqual({ principal: 30, debt: 41.12 })
  })

  it('migration switch accepts v7 and rejects unknown, missing or future versions', () => {
    const v7 = JSON.parse(serialize(createInitialState(), 0))
    expect(deserialize(JSON.stringify(v7))?.version).toBe(7)
    expect(deserialize(JSON.stringify({ ...v7, version: 8 }))).toBeNull()
    expect(deserialize(JSON.stringify({ ...v7, version: undefined }))).toBeNull()
  })

  it('round-trips copper tool tiers and a tile watered above 1', () => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t, i) => (i === 0 ? { ...t, status: 'planted' as const, cropId: 'radish' as const, moisture: 2 } : t))
    const state = { ...s, run: { ...s.run, tiles, toolTier: { water: 1, harvest: 1, plant: 0 } } }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('migrates a real v4 save (built by the batch-5 code) to v7:pickaxe, stone and counters kept', () => {
    const old = JSON.parse(v4)
    expect(old.version).toBe(4)
    expect(old.state.run).toMatchObject({ mineLicense: true, pickaxe: { tier: 'wooden', durability: 11 }, inventory: { stone: 7 } })
    const save = deserialize(v4)!
    expect(save).toEqual({
      version: 7,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: { ...old.state.run, ...noMiningProgress, ...noFurnace, ...noCopper } },
    })
    expect(save.state.run.bagCapacity).toBe(old.state.run.bagCapacity)
    // the migrated pickaxe keeps working and loses durability as before
    const mined = dig(save.state)
    expect(mined.ok && mined.state.run.pickaxe).toEqual({ tier: 'wooden', durability: 10 })
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it('migrates a real v3 save (built by the batch-4.5 code) to v7:digs → mines, new fields start empty', () => {
    const old = JSON.parse(v3)
    expect(old.version).toBe(3)
    expect(old.state.run.counters).toEqual({ harvests: 17, sales: 20, digs: 7 })
    const save = deserialize(v3)!
    expect(save).toEqual({
      version: 7,
      savedAtMs: old.savedAtMs,
      state: {
        meta: old.state.meta,
        run: {
          ...old.state.run,
          counters: { harvests: 17, sales: 20, mines: 7, digs: 0, waters: 0, plants: 0 },
          seeds: {},
          autoBuySeeds: true,
          ...noTools,
          ...noMiningProgress,
          ...noFurnace, ...noCopper,
        },
      },
    })
    // nothing earned is lost: loan, pickaxe, bag, crops in the ground all survive, and the run plays on
    expect(save.state.run.loan).toEqual(old.state.run.loan)
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it('migrates a real v2 save (built by the batch-4 code) to v7 with no loan', () => {
    const old = JSON.parse(v2)
    expect(old.version).toBe(2)
    expect(old.state.run).not.toHaveProperty('loan')
    const save = deserialize(v2)!
    expect(save).toEqual({
      version: 7,
      savedAtMs: old.savedAtMs,
      state: {
        meta: old.state.meta,
        run: {
          ...old.state.run,
          loan: null,
          counters: { harvests: 2, sales: 2, mines: 2, digs: 0, waters: 0, plants: 0 },
          seeds: {},
          autoBuySeeds: true,
          ...noTools,
          ...noMiningProgress,
          ...noFurnace, ...noCopper,
        },
      },
    })
    // the migrated state plays on, and a loan can be taken
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
    expect(takeLoan(save.state).ok).toBe(true)
  })

  it('migrates a real v1 save (6 tiles, energy above the new max) to v7', () => {
    const old = JSON.parse(v1).state
    const save = deserialize(v1)!
    expect(save.version).toBe(7)
    expect(save.savedAtMs).toBe(1_700_000_000_000)
    const { run, meta } = save.state
    expect(meta).toEqual(old.meta)
    expect(run.tiles).toHaveLength(START_TILES)
    expect(run.tiles.slice(0, 6)).toEqual(old.run.tiles)
    expect(run.tiles.slice(6)).toEqual([createTile(), createTile(), createTile()])
    expect(run.upgrades).toEqual({ ...old.run.upgrades, sellPrice: 0, fertilizer: 0 })
    expect(run.counters).toEqual({ harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0 })
    expect(run).toMatchObject({
      inventory: {},
      pickaxe: null,
      mineLicense: false,
      bagCapacity: BAG_CAPACITY_START,
      rngState: INITIAL_RNG_SEED,
      loan: null,
      seeds: {},
      autoBuySeeds: true,
      ...noTools,
      ...noMiningProgress,
      ...noFurnace, ...noCopper,
    })
    expect(run.energy).toBe(energyMax(old.run.upgrades.energyMax, meta))
    expect([run.cash, run.licenses, run.tick]).toEqual([old.run.cash, old.run.licenses, old.run.tick])
    // the migrated state plays on
    expect(step(save.state, 5).run.tick).toBe(old.run.tick + 5)
  })

  it('rejects corrupt text and wrong shapes', () => {
    expect(deserialize('{not json')).toBeNull()
    expect(deserialize('null')).toBeNull()
    expect(deserialize(JSON.stringify({ version: 1, savedAtMs: 0, state: {} }))).toBeNull()
  })
})

describe('batch 6 crops: chilli and lemon widen CropId only', () => {
  it('needs no SAVE_VERSION bump of its own: every past fixture lands on the latest with its crops untouched', () => {
    expect(SAVE_VERSION).toBe(7)
    for (const raw of [v1, v2, v3, v4, v5, v6]) {
      const old = JSON.parse(raw).state.run
      const run = deserialize(raw)!.state.run
      expect(run.licenses).toEqual(old.licenses)
      expect(run.seeds).toEqual(old.seeds ?? {})
      expect(run.tiles.slice(0, old.tiles.length).map((t) => t.cropId)).toEqual(old.tiles.map((t: { cropId?: string }) => t.cropId))
    }
  })

  it('a current save written before the new crops loads unchanged', () => {
    const before = JSON.parse(serialize(step(createInitialState(), 42), 7))
    expect(before.state.run.licenses).toEqual(['radish'])
    expect(deserialize(JSON.stringify(before))).toEqual(before)
  })

  it('a current save with chilli and lemon licenses, pouch seeds and planted tiles round-trips', () => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t, i) =>
      i === 0 ? { ...t, status: 'planted' as const, cropId: 'chilli' as const } : i === 1 ? { ...t, status: 'planted' as const, cropId: 'lemon' as const } : t,
    )
    const state = { ...s, run: { ...s.run, licenses: ['radish' as const, 'chilli' as const, 'lemon' as const], seeds: { chilli: 2, lemon: 1 }, tiles } }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })
})

describe('catch-up', () => {
  it('a tile copper-watered to 2 grows 120 ticks across an 8 h catch-up, then waits dry', () => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t, i) => (i === 0 ? { ...t, status: 'planted' as const, cropId: 'lemon' as const, moisture: 2 } : t))
    const state = { ...s, run: { ...s.run, tiles, toolTier: { water: 1, harvest: 0, plant: 0 } } }
    const after = catchUp(state, 8 * HOUR)
    expect(after.run.tiles[0]).toMatchObject({ status: 'planted', growth: 120, moisture: 0 })
    expect(after).toEqual(step(state, OFFLINE_CAP_TICKS))
  })

  it('simulates 0 ticks when away less than 1 s, or when the clock went backwards', () => {
    const s = createInitialState()
    expect(offlineTicks(999)).toBe(0)
    expect(offlineTicks(-5000)).toBe(0)
    expect(catchUp(s, 999)).toBe(s)
  })

  it('simulates whole seconds only', () => {
    expect(catchUp(createInitialState(), 2500).run.tick).toBe(2)
  })

  it('caps at 8 hours', () => {
    expect(OFFLINE_CAP_TICKS).toBe(8 * 3600)
    expect(offlineTicks(9 * HOUR)).toBe(8 * 3600)
    expect(catchUp(createInitialState(), 9 * HOUR).run.tick).toBe(8 * 3600)
  })

  it('banner text', () => {
    expect(awayText(12 * 60_000)).toBe('Away for 12m — 720 ticks simulated')
    expect(awayText(5_400)).toBe('Away for 5s — 5 ticks simulated')
    expect(awayText(1_500)).toBe('Away for 1s — 1 tick simulated')
    expect(awayText(9 * HOUR)).toBe('Away for 9h 0m — 28800 ticks simulated (capped at 8h)')
  })
})

describe('loadGame / saveGame with an injected clock', () => {
  it('saves with the clock time and catches up on load', () => {
    const store = memoryStore()
    const state = step(createInitialState(), 10)
    saveGame(store, state, () => 1_000_000)
    const loaded = loadGame(store, () => 1_000_000 + 65_400)
    expect(loaded.ticks).toBe(65)
    expect(loaded.awayMs).toBe(65_400)
    expect(loaded.state.run.tick).toBe(75)
  })

  it('loan debt does not grow while offline, and grows again on live ticks', () => {
    const store = memoryStore()
    const r = takeLoan(createInitialState())
    if (!r.ok) throw new Error(r.error)
    const live = step(r.state, 10)
    const debt = live.run.loan!.debt
    expect(debt).toBeCloseTo(r.state.run.loan!.debt + 10 * loanDebtPerTick(r.state.run.loan!.principal))
    saveGame(store, live, () => 1_000_000)

    const loaded = loadGame(store, () => 1_000_000 + HOUR)
    expect(loaded.ticks).toBe(3600)
    expect(loaded.state.run.tick).toBe(live.run.tick + 3600)
    expect(loaded.state.run.loan).toEqual(live.run.loan)
    // the rest of the run still caught up (energy regen is not frozen)
    expect(loaded.state).toEqual({ ...step(live, 3600), run: { ...step(live, 3600).run, loan: live.run.loan } })

    const after = step(loaded.state, 5).run.loan!.debt
    expect(after).toBeCloseTo(debt + 5 * loanDebtPerTick(live.run.loan!.principal))
  })

  it('starts fresh with no save', () => {
    const loaded = loadGame(memoryStore(), () => 0)
    expect(loaded).toEqual({ state: createInitialState(), awayMs: 0, ticks: 0 })
  })

  it('keeps an unreadable save aside instead of losing it', () => {
    const store = memoryStore()
    store.setItem(SAVE_KEY, '{"version":99}')
    expect(loadGame(store, () => 0).ticks).toBe(0)
    expect(store.data.get(BAD_SAVE_KEY)).toBe('{"version":99}')
  })

  it.each([
    [1, v1],
    [2, v2],
    [3, v3],
    [4, v4],
    [5, v5],
  ])('keeps the raw v%i save under tiles.save.backup.v%i before migrating it', (version, raw) => {
    const store = memoryStore()
    store.setItem(SAVE_KEY, raw)
    const loaded = loadGame(store, () => JSON.parse(raw).savedAtMs)
    expect(backupKey(version)).toBe(`tiles.save.backup.v${version}`)
    expect(store.data.get(backupKey(version))).toBe(raw)
    expect(loaded.state).toEqual(deserialize(raw)!.state)
  })

  it('a current-version save makes no backup', () => {
    const store = memoryStore()
    saveGame(store, createInitialState(), () => 0)
    loadGame(store, () => 0)
    expect([...store.data.keys()]).toEqual([SAVE_KEY])
  })

  it('a throwing storage does not crash saveGame', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => saveGame(store, createInitialState(), () => 0)).not.toThrow()
  })
})
