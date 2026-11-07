import { describe, expect, it } from 'vitest'
import v1 from './fixtures/save-v1.json?raw'
import v2 from './fixtures/save-v2.json?raw'
import v3 from './fixtures/save-v3.json?raw'
import v4 from './fixtures/save-v4.json?raw'
import { BAG_CAPACITY_START, INITIAL_RNG_SEED, OFFLINE_CAP_TICKS, START_TILES, energyMax, loanDebtPerTick } from '../src/core/balance'
import { takeLoan } from '../src/core/bank'
import { dig } from '../src/core/mining'
import { createInitialState, createTile } from '../src/core/state'
import { step } from '../src/core/step'
import { awayText, catchUp, deserialize, offlineTicks, serialize } from '../src/save/serialize'
import { BAD_SAVE_KEY, SAVE_KEY, backupKey, loadGame, saveGame, type KeyValueStore } from '../src/save/storage'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const HOUR = 3600 * 1000
/** v4 fields every migrated save starts with: no farm tools, 1 tile per level-2 press */
const noTools = { tools: { water: 0, harvest: 0, plant: 0 }, toolN: { water: 1, harvest: 1, plant: 1 } }
/** v5 fields every migrated save starts with: no half-mined stone, no mastery, storage level 0 */
const noMiningProgress = { vein: { level: 0, progress: 0 }, mastery: {}, masteredTiers: [], storageLevel: 0 }

describe('serialize / deserialize', () => {
  it('round-trips state and savedAtMs', () => {
    const state = step(createInitialState(), 42)
    const save = deserialize(serialize(state, 1234))
    expect(save).toEqual({ version: 5, savedAtMs: 1234, state })
  })

  it('round-trips mining progress: half-mined stone, mastery, a blunt pickaxe, storage level', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        vein: { level: 0, progress: 1 },
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

  it('migration switch accepts v5 and rejects unknown, missing or future versions', () => {
    const v5 = JSON.parse(serialize(createInitialState(), 0))
    expect(deserialize(JSON.stringify(v5))?.version).toBe(5)
    expect(deserialize(JSON.stringify({ ...v5, version: 6 }))).toBeNull()
    expect(deserialize(JSON.stringify({ ...v5, version: undefined }))).toBeNull()
  })

  it('migrates a real v4 save (built by the batch-5 code) to v5: pickaxe, stone and counters kept', () => {
    const old = JSON.parse(v4)
    expect(old.version).toBe(4)
    expect(old.state.run).toMatchObject({ mineLicense: true, pickaxe: { tier: 'wooden', durability: 11 }, inventory: { stone: 7 } })
    const save = deserialize(v4)!
    expect(save).toEqual({
      version: 5,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: { ...old.state.run, ...noMiningProgress } },
    })
    expect(save.state.run.bagCapacity).toBe(old.state.run.bagCapacity)
    // the migrated pickaxe keeps working and loses durability as before
    const mined = dig(save.state)
    expect(mined.ok && mined.state.run.pickaxe).toEqual({ tier: 'wooden', durability: 10 })
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it('migrates a real v3 save (built by the batch-4.5 code) to v5: digs → mines, new fields start empty', () => {
    const old = JSON.parse(v3)
    expect(old.version).toBe(3)
    expect(old.state.run.counters).toEqual({ harvests: 17, sales: 20, digs: 7 })
    const save = deserialize(v3)!
    expect(save).toEqual({
      version: 5,
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
        },
      },
    })
    // nothing earned is lost: loan, pickaxe, bag, crops in the ground all survive, and the run plays on
    expect(save.state.run.loan).toEqual(old.state.run.loan)
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it('migrates a real v2 save (built by the batch-4 code) to v5 with no loan', () => {
    const old = JSON.parse(v2)
    expect(old.version).toBe(2)
    expect(old.state.run).not.toHaveProperty('loan')
    const save = deserialize(v2)!
    expect(save).toEqual({
      version: 5,
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
        },
      },
    })
    // the migrated state plays on, and a loan can be taken
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
    expect(takeLoan(save.state).ok).toBe(true)
  })

  it('migrates a real v1 save (6 tiles, energy above the new max) to v5', () => {
    const old = JSON.parse(v1).state
    const save = deserialize(v1)!
    expect(save.version).toBe(5)
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

describe('catch-up', () => {
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
