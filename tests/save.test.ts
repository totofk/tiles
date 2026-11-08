import { describe, expect, it } from 'vitest'
import v1 from './fixtures/save-v1.json?raw'
import v2 from './fixtures/save-v2.json?raw'
import v3 from './fixtures/save-v3.json?raw'
import v4 from './fixtures/save-v4.json?raw'
import v5 from './fixtures/save-v5.json?raw'
import v6 from './fixtures/save-v6.json?raw'
import v7 from './fixtures/save-v7.json?raw'
import v8 from './fixtures/save-v8.json?raw'
import v9 from './fixtures/save-v9.json?raw'
import v10 from './fixtures/save-v10.json?raw'
import v11 from './fixtures/save-v11.json?raw'
import v12 from './fixtures/save-v12.json?raw'
import v13 from './fixtures/save-v13.json?raw'
import v14 from './fixtures/save-v14.json?raw'
import v15 from './fixtures/save-v15.json?raw'
import { BAG_CAPACITY_START, INITIAL_RNG_SEED, OFFLINE_CAP_TICKS, START_TILES, energyMax, loanDebtPerTick, multiplier } from '../src/core/balance'
import { takeLoan } from '../src/core/bank'
import { earlierMilestones } from '../src/core/data/milestones'
import { certificateUnlocked, freeWorkers } from '../src/core/workers'
import { dig } from '../src/core/mining'
import { createFields, createFurnace, createInitialMeta, createInitialState, createTile, createWorkshop } from '../src/core/state'
import { step } from '../src/core/step'
import { buildWorkshop } from '../src/core/workshop'
import { unlockFields } from '../src/core/fields'
import { SAVE_VERSION, awayText, catchUp, deserialize, offlineTicks, serialize, type Save } from '../src/save/serialize'
import {
  BAD_SAVE_KEY,
  IMPORT_BACKUP_KEY,
  SAVE_KEY,
  backupKey,
  exportSave,
  importSave,
  loadGame,
  saveGame,
  type KeyValueStore,
} from '../src/save/storage'

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
const noFurnace = { furnace: createFurnace(), lifetime: expect.any(Object) }
/** the only v7 field: every job at the basic tier */
const noCopper = { toolTier: { water: 0, harvest: 0, plant: 0 } }
/** v10 field every migrated save starts with: "Crop to plant" at the starting crop (it was UI state before) */
const v10Crop = { plantCrop: 'radish' }
/** v8 fields every migrated save starts with (plus lifetime.wagesPaid 0); v9 dropped autoSmelt; v10 adds plant */
const noWorkers = { workers: { pool: 0, assigned: { plant: 0, water: 0, harvest: 0, ore: 0, fuel: 0, mine: 0 }, certificates: [] }, ...v10Crop }
/** v9 counters: + bars (collected), migrated from lifetime.bars (0 before the v6 furnace) */
const v9Counters = (c: object, bars = 0) => ({ counters: { ...c, bars } })
/** v11 lifetime totals every migrated save starts with: no mines by workers, no iron bars collected or smelted */
const v11Lifetime = { workerMines: 0, ironBars: 0, ironBarsSmelted: 0 }
/** v11 → v12: meta stores upgrade levels (multipliers dropped, all-1 in every released build), no glut, tracking from the save's tick
 *  — a milestone already true at migration is never back-dated, it stays absent */
const v12Meta = (meta: { prestigeCount: number }) => ({ prestigeCount: meta.prestigeCount, upgrades: createInitialMeta().upgrades })
const v12Run = (run: { tick: number }) => ({ market: createInitialState().run.market, milestones: { trackingStarted: run.tick } })
/** v12 → v13: the 📋 Noticeboard not bought, no ⭐, no orders completed; v13 → v14: no gold yet */
const v13Lifetime = { ordersCompleted: 0, starsEarned: 0 }
const v14Lifetime = { ...v13Lifetime, goldBars: 0, goldBarsSmelted: 0 }
const v13Run = (run: { counters: object; lifetime: object; workers: { assigned: object } }) => ({
  workers: { ...run.workers, assigned: { ...run.workers.assigned, clerk: 0 } },
  orders: createInitialState().run.orders,
  stars: 0,
  counters: { ...run.counters, orders: 0 },
  lifetime: { ...run.lifetime, ...v14Lifetime },
})
/** a v13 save seen as v12 (the v13 additions stripped), so the v1 … v12 migration expectations stay as written */
function asV12(save: Save) {
  const { orders, stars, counters, lifetime, workers, workshop, fields, ...run } = save.state.run
  const { orders: completed, ...v12Counters } = counters
  const { ordersCompleted, starsEarned, goldBars, goldBarsSmelted, ...v12Lifetime } = lifetime
  const { clerk, ...v12Assigned } = workers.assigned
  void [orders, stars, completed, ordersCompleted, starsEarned, goldBars, goldBarsSmelted, clerk, workshop, fields]
  const v12Workers = { ...workers, assigned: v12Assigned }
  return { version: 12, savedAtMs: save.savedAtMs, state: { meta: save.state.meta, run: { ...run, counters: v12Counters, lifetime: v12Lifetime, workers: v12Workers } } }
}
/** v9 lifetime totals a migrated save starts with: no fire burnt, bars smelted 0 (no furnace before v6); v10 plants by workers 0 */
const noFire = { fireBurnt: 0, fireWasted: 0, barsSmelted: 0, workerPlants: 0, ...v11Lifetime, ...v14Lifetime }
type OldFurnace = { built: boolean; queue: number; progress: number; ready: number }
/** v8 → v9: every paid queued job is a ready bar; no fire, empty ore slot, plain furnace at base levels */
const v9Furnace = (f: OldFurnace) => ({ ...createFurnace(), built: f.built, ready: f.ready + f.queue })
/** v11 furnace field every migrated save starts with: it smelts copper, all it could before */
const v11Furnace = { oreKind: 'copperOre' }
/** v8 → v9 lifetime: bars smelted = collected + tray + queue (and v10 plants by workers 0) */
const v9Lifetime = (l: { bars: number }, f: OldFurnace) => ({ ...l, fireBurnt: 0, fireWasted: 0, barsSmelted: l.bars + f.ready + f.queue, workerPlants: 0, ...v11Lifetime })

describe('serialize / deserialize', () => {
  it('round-trips state and savedAtMs', () => {
    const state = step(createInitialState(), 42)
    const save = deserialize(serialize(state, 1234))
    expect(save).toEqual({ version: 16, savedAtMs: 1234, state })
  })

  it('migrates a real v10 save (built by the batch-10 code) to v12: everything kept, the furnace smelts copper, no miner', () => {
    const old = JSON.parse(v10)
    expect(old.version).toBe(10)
    const { furnace, workers, lifetime, plantCrop } = old.state.run
    expect(furnace).not.toHaveProperty('oreKind')
    expect(furnace).toMatchObject({ fire: 569, ore: 10, progress: 3 })
    expect([workers.assigned.plant, workers.certificates, lifetime.workerPlants, plantCrop]).toEqual([1, ['water', 'harvest', 'ore', 'plant'], 7, 'pumpkin'])
    const save = deserialize(v10)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...old.state.run,
          ...v12Run(old.state.run),
          furnace: { ...furnace, ...v11Furnace },
          workers: { ...workers, assigned: { ...workers.assigned, mine: 0 } },
          lifetime: { ...lifetime, ...v11Lifetime },
        },
      },
    })
    // 682 mines but vein Lv2: the mine certificate stays hidden; the copper smelt in progress finishes after the load
    expect(certificateUnlocked(save.state.run, 'mine')).toBe(false)
    const later = step(save.state, 60)
    expect(later.run.lifetime.barsSmelted).toBe(lifetime.barsSmelted + 1)
    expect([later.run.inventory.ironOre ?? 0, later.run.lifetime.workerMines]).toEqual([0, 0])
  })

  it('migrates a real v9 save (built by the batch-9 code) to v12: everything kept, no plant worker, Crop to plant at carrot', () => {
    const old = JSON.parse(v9)
    expect(old.version).toBe(9)
    const { workers, lifetime } = old.state.run
    expect(old.state.run).not.toHaveProperty('plantCrop')
    expect(workers).toEqual({ pool: 4, assigned: { water: 2, harvest: 1, ore: 1, fuel: 0 }, certificates: ['water', 'harvest', 'ore'] })
    expect(old.state.run.furnace).toMatchObject({ fire: 554, ore: 2, progress: 43, levels: { fireCap: 1, batch: 0 } })
    const save = deserialize(v9)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...old.state.run,
          ...v10Crop,
          ...v12Run(old.state.run),
          workers: { ...workers, assigned: { ...workers.assigned, plant: 0, mine: 0 } },
          furnace: { ...old.state.run.furnace, ...v11Furnace },
          lifetime: { ...lifetime, workerPlants: 0, ...v11Lifetime },
        },
      },
    })
    // 100 plants already, but the plant tool is Lv2: since batch 13 the plant certificate waits for the Seed Spreader
    // (and is not owned); the smelt in progress carries on
    expect(certificateUnlocked(save.state.run, 'plant')).toBe(false)
    expect(certificateUnlocked({ ...save.state.run, tools: { ...save.state.run.tools, plant: 3 } }, 'plant')).toBe(true)
    expect(save.state.run.workers.certificates).not.toContain('plant')
    const later = step(save.state, 17)
    expect(later.run.lifetime.barsSmelted).toBe(lifetime.barsSmelted + 1)
    expect(later.run.lifetime.workerPlants).toBe(0)
  })

  it('migrates a real v8 save (built by the batch-8.1 code) to v12: queued jobs become ready bars, auto-smelt dropped', () => {
    const old = JSON.parse(v8)
    expect(old.version).toBe(8)
    const { autoSmelt, furnace, lifetime, counters, workers, ...kept } = old.state.run
    expect(autoSmelt).toBe(true)
    expect(furnace).toEqual({ built: true, queue: 2, progress: 30, ready: 3 })
    expect(workers).toEqual({ pool: 3, assigned: { water: 2, harvest: 1 }, certificates: ['water', 'harvest'] })
    const save = deserialize(v8)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...kept,
          ...v10Crop,
          ...v12Run(old.state.run),
          ...v9Counters(counters, lifetime.bars),
          workers: { ...workers, assigned: { ...workers.assigned, plant: 0, ore: 0, fuel: 0, mine: 0 } },
          furnace: v9Furnace(furnace),
          lifetime: v9Lifetime(lifetime, furnace),
        },
      },
    })
    // the bars gate starts from the bars already collected, so the ore loader certificate (10 bars) is open
    expect(save.state.run.counters.bars).toBe(13)
    expect(certificateUnlocked(save.state.run, 'ore')).toBe(true)
    expect(freeWorkers(save.state.run)).toBe(0)
    // nothing paid is lost: 3 in the tray + 2 queued = 5 ready bars, bars smelted 13 collected + 5
    expect(save.state.run.furnace).toEqual({ ...createFurnace(), built: true, ready: 5 })
    expect(save.state.run.lifetime.barsSmelted).toBe(18)
    expect(save.state.run).not.toHaveProperty('autoSmelt')
    // the workers keep working and the run plays on; the tray is collected into storage
    const later = step(save.state, 60)
    expect(later.run.tick).toBe(old.state.run.tick + 60)
    expect(later.run.lifetime.wagesPaid).toBeGreaterThanOrEqual(lifetime.wagesPaid)
    expect(later.run.furnace.fire).toBe(0)
  })

  it('a tray above its cap after migration blocks smelting only until collected', () => {
    const save = deserialize(v8)!
    const s = { ...save.state, run: { ...save.state.run, furnace: { ...save.state.run.furnace, ready: 7, fire: 120, ore: 4 } } }
    expect(step(s, 60).run.furnace).toMatchObject({ ready: 7, ore: 4, progress: 0 })
  })

  it('migrates a real v7 save (built by the batch-7.2 code) to v12: everything kept, no workers, queue → ready bars', () => {
    const old = JSON.parse(v7)
    expect(old.version).toBe(7)
    expect(old.state.run).toMatchObject({
      furnace: { built: true, queue: 2 },
      pickaxe: { tier: 'copper' },
      toolTier: { water: 1 },
      tools: { water: 2, harvest: 2, plant: 2 },
    })
    expect(old.state.run.counters.waters).toBeGreaterThanOrEqual(40)
    expect(old.state.run.counters.harvests).toBeGreaterThanOrEqual(40)
    const save = deserialize(v7)!
    const { furnace, lifetime } = old.state.run
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...old.state.run,
          ...noWorkers,
          ...v12Run(old.state.run),
          ...v9Counters(old.state.run.counters, lifetime.bars),
          furnace: v9Furnace(furnace),
          lifetime: { ...v9Lifetime(lifetime, furnace), wagesPaid: 0 },
        },
      },
    })
    // the 2 paid jobs are ready bars and the run plays on
    expect(save.state.run.furnace.ready).toBe(2)
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
  })

  it('round-trips workers and wages paid', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        workers: { pool: 6, assigned: { plant: 1, water: 2, harvest: 1, ore: 1, fuel: 0, mine: 1, clerk: 0 }, certificates: ['water' as const, 'harvest' as const, 'ore' as const, 'plant' as const, 'mine' as const] },
        plantCrop: 'pumpkin' as const,
        lifetime: { ...s.run.lifetime, wagesPaid: 57, workerPlants: 12 },
      },
    }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('round-trips the fuelled furnace, copper items, the current rock and lifetime totals', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        vein: { level: 2, progress: 2, rock: 'copperOre' as const },
        furnace: { built: true, oreKind: 'ironOre' as const, fire: 137, ore: 7, progress: 17, ready: 2, smart: true, levels: { fireCap: 1, batch: 2 } },
        inventory: { copperOre: 4, copperBar: 1, ironOre: 3, ironBar: 2, goldOre: 2, goldBar: 1 },
        lifetime: { cashEarned: 900, energySpent: 412, bars: 6, harvests: { radish: 40, lemon: 2 }, wagesPaid: 0, fireBurnt: 500, fireWasted: 80, barsSmelted: 8, workerPlants: 0, workerMines: 9, ironBars: 2, ironBarsSmelted: 3, ordersCompleted: 0, starsEarned: 0, goldBars: 1, goldBarsSmelted: 2 },
      },
    }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('migrates a real v6 save (built by the batch-7 code) to v12: everything kept, every job at the basic tier', () => {
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
    const { furnace, lifetime } = old.state.run
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...old.state.run,
          ...noCopper,
          ...noWorkers,
          ...v12Run(old.state.run),
          ...v9Counters(old.state.run.counters, lifetime.bars),
          furnace: v9Furnace(furnace),
          lifetime: { ...v9Lifetime(lifetime, furnace), wagesPaid: 0 },
        },
      },
    })
    // the queued job is a ready bar beside the one in the tray, and the run plays on
    expect(save.state.run.furnace.ready).toBe(2)
    expect(step(save.state, 60).run.tick).toBe(old.state.run.tick + 60)
  })

  it('migrates a real v5 save (built by the batch-6.2 code) to v12: everything kept, furnace not built', () => {
    const old = JSON.parse(v5)
    expect(old.version).toBe(5)
    expect(old.state.run).toMatchObject({ vein: { level: 1, progress: 0 }, storageLevel: 1, inventory: { stone: 5, coal: 2 }, mastery: { wooden: 46 } })
    const save = deserialize(v5)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: { ...old.state.run, vein: { level: 1, progress: 0, rock: 'stone' }, ...noFurnace, ...noCopper, ...noWorkers, ...v12Run(old.state.run), ...v9Counters(old.state.run.counters) },
      },
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
    expect(deserialize(raw)!.state.run.lifetime).toEqual({ cashEarned: 0, energySpent, bars: 0, harvests, wagesPaid: 0, ...noFire })
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

  it('migration switch accepts v15 and v16 and rejects unknown, missing or future versions', () => {
    const fresh = JSON.parse(serialize(createInitialState(), 0))
    expect(deserialize(JSON.stringify(fresh))?.version).toBe(16)
    expect(deserialize(JSON.stringify({ ...fresh, version: 17 }))).toBeNull()
    expect(deserialize(JSON.stringify({ ...fresh, version: undefined }))).toBeNull()
  })

  it('round-trips copper tool tiers and a tile watered above 1', () => {
    const s = createInitialState()
    const tiles = s.run.tiles.map((t, i) => (i === 0 ? { ...t, status: 'planted' as const, cropId: 'radish' as const, moisture: 2 } : t))
    const state = { ...s, run: { ...s.run, tiles, toolTier: { water: 1, harvest: 1, plant: 0 } } }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })

  it('migrates a real v4 save (built by the batch-5 code) to v12: pickaxe, stone and counters kept', () => {
    const old = JSON.parse(v4)
    expect(old.version).toBe(4)
    expect(old.state.run).toMatchObject({ mineLicense: true, pickaxe: { tier: 'wooden', durability: 11 }, inventory: { stone: 7 } })
    const save = deserialize(v4)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: { ...old.state.run, ...noMiningProgress, ...noFurnace, ...noCopper, ...noWorkers, ...v12Run(old.state.run), ...v9Counters(old.state.run.counters) },
      },
    })
    expect(save.state.run.bagCapacity).toBe(old.state.run.bagCapacity)
    // the migrated pickaxe keeps working and loses durability as before
    const mined = dig(save.state)
    expect(mined.ok && mined.state.run.pickaxe).toEqual({ tier: 'wooden', durability: 10 })
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it('migrates a real v3 save (built by the batch-4.5 code) to v12: digs → mines, new fields start empty', () => {
    const old = JSON.parse(v3)
    expect(old.version).toBe(3)
    expect(old.state.run.counters).toEqual({ harvests: 17, sales: 20, digs: 7 })
    const save = deserialize(v3)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...old.state.run,
          counters: { harvests: 17, sales: 20, mines: 7, digs: 0, waters: 0, plants: 0, bars: 0 },
          seeds: {},
          autoBuySeeds: true,
          ...noTools,
          ...noMiningProgress,
          ...noFurnace, ...noCopper, ...noWorkers,
          ...v12Run(old.state.run),
        },
      },
    })
    // nothing earned is lost: loan, pickaxe, bag, crops in the ground all survive, and the run plays on
    expect(save.state.run.loan).toEqual(old.state.run.loan)
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
  })

  it('migrates a real v2 save (built by the batch-4 code) to v12 with no loan', () => {
    const old = JSON.parse(v2)
    expect(old.version).toBe(2)
    expect(old.state.run).not.toHaveProperty('loan')
    const save = deserialize(v2)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v12Meta(old.state.meta),
        run: {
          ...old.state.run,
          loan: null,
          counters: { harvests: 2, sales: 2, mines: 2, digs: 0, waters: 0, plants: 0, bars: 0 },
          seeds: {},
          autoBuySeeds: true,
          ...noTools,
          ...noMiningProgress,
          ...noFurnace, ...noCopper, ...noWorkers,
          ...v12Run(old.state.run),
        },
      },
    })
    // the migrated state plays on, and a loan can be taken
    expect(step(save.state, 5).run.tick).toBe(old.state.run.tick + 5)
    expect(takeLoan(save.state).ok).toBe(true)
  })

  it('migrates a real v1 save (6 tiles, energy above the new max) to v12', () => {
    const old = JSON.parse(v1).state
    const save = deserialize(v1)!
    expect(save.version).toBe(16)
    expect(save.savedAtMs).toBe(1_700_000_000_000)
    const { run, meta } = save.state
    expect(meta).toEqual(v12Meta(old.meta))
    expect(run.tiles).toHaveLength(START_TILES)
    expect(run.tiles.slice(0, 6)).toEqual(old.run.tiles)
    expect(run.tiles.slice(6)).toEqual([createTile(), createTile(), createTile()])
    expect(run.upgrades).toEqual({ ...old.run.upgrades, sellPrice: 0, fertilizer: 0 })
    expect(run.counters).toEqual({ harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0, bars: 0, orders: 0 })
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
      ...noFurnace, ...noCopper, ...noWorkers,
      ...v12Run(old.run),
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

  it('migrates a real v11 save (built by the batch-11 code, iron tier) to v12: everything kept, no glut, tracking from tick 7210', () => {
    const old = JSON.parse(v11)
    expect(old.version).toBe(11)
    expect(old.state.run).toMatchObject({ vein: { level: 3 }, pickaxe: { tier: 'iron' }, furnace: { built: true, oreKind: 'ironOre', fire: 250 } })
    const save = deserialize(v11)!
    expect(asV12(save)).toEqual({
      version: 12,
      savedAtMs: old.savedAtMs,
      state: { meta: v12Meta(old.state.meta), run: { ...old.state.run, ...v12Run(old.state.run) } },
    })
    // the all-1 multiplier table is dropped, nothing legacy kept
    expect(save.state.meta).not.toHaveProperty('legacyMultipliers')
    // tracking starts at the save's tick; milestones already true (lemon license, iron pickaxe) are never back-dated
    expect(save.state.run.milestones).toEqual({ trackingStarted: 7210 })
    expect(earlierMilestones(save.state.run)).toBeGreaterThanOrEqual(2)
    // sales start at full price (no glut) and the run plays on: the mid-cycle iron smelt finishes
    expect(save.state.run.market.lemon).toBe(0)
    const later = step(save.state, 70)
    expect(later.run.lifetime.ironBarsSmelted).toBeGreaterThan(old.state.run.lifetime.ironBarsSmelted)
    expect(later.run.tick).toBe(7210 + 70)
  })

  it('v11 → v12 keeps any non-1 multiplier as legacyMultipliers and it still applies', () => {
    const old = JSON.parse(v11)
    old.state.meta.multipliers = { ...old.state.meta.multipliers, sellPrice: 2 }
    const save = deserialize(JSON.stringify(old))!
    expect(save.state.meta.legacyMultipliers).toEqual(old.state.meta.multipliers)
    expect(multiplier(save.state.meta, 'sellPrice')).toBe(2)
    // the all-1 rest of the table contributes nothing
    expect(multiplier(save.state.meta, 'growTime')).toBe(1)
  })

  it('batch 13: certificates bought before their Lv3 tool are kept and their workers keep working (v9, v10, v11, v12)', () => {
    for (const raw of [v9, v10, v11, v12]) {
      const { state } = deserialize(raw)!
      const early = (['water', 'harvest', 'plant'] as const).filter((job) => state.run.workers.certificates.includes(job) && state.run.tools[job] < 3)
      expect(early.length).toBeGreaterThan(0)
      expect(early.every((job) => !certificateUnlocked(state.run, job))).toBe(true)
      const later = step(state, 600)
      expect(later.run.workers.certificates).toEqual(state.run.workers.certificates)
      expect(later.run.lifetime.wagesPaid).toBeGreaterThan(state.run.lifetime.wagesPaid)
    }
  })
})

describe('save v13: the 📋 Noticeboard', () => {
  it('migrates the real v12 save (built by the batch-13 code) to v14: everything kept, glut and milestones too, no board, no gold', () => {
    const old = JSON.parse(v12)
    expect(old.version).toBe(12)
    expect(old.state.run.market.lemon).toBeGreaterThan(0)
    expect(old.state.run.milestones).toMatchObject({ trackingStarted: 7210, tiles12: 7210 })
    const save = deserialize(v12)!
    expect(save).toEqual({
      version: 16,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: { ...old.state.run, ...v13Run(old.state.run), workshop: createWorkshop(), fields: createFields() } },
    })
    // the run plays on: workers harvest, the glut decays, and the board can be bought (sales ≥ 50) with stone + cash
    const later = step(save.state, 60)
    expect(later.run.market.lemon).toBeLessThan(old.state.run.market.lemon + 30)
    expect(later.run.tick).toBe(old.state.run.tick + 60)
  })

  it('every pre-board fixture lands on the latest with the board not bought, no ⭐ and no orders', () => {
    for (const raw of [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12]) {
      const { run } = deserialize(raw)!.state
      expect(run.orders).toEqual(createInitialState().run.orders)
      expect([run.stars, run.counters.orders, run.lifetime.ordersCompleted, run.lifetime.starsEarned, run.workers.assigned.clerk]).toEqual([0, 0, 0, 0, 0])
    }
  })

  it('round-trips a bought board with an accepted offer, a cooling slot and ⭐', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        stars: 7,
        orders: { unlocked: true, slots: 2, offers: [{ good: 'radish' as const, count: 27, done: 4, tier: 0, accepted: true }, { cooldownTicks: 312 }] },
        counters: { ...s.run.counters, orders: 3 },
        lifetime: { ...s.run.lifetime, ordersCompleted: 3, starsEarned: 9 },
      },
    }
    expect(deserialize(serialize(state, 0))?.state).toEqual(state)
  })
})

describe('save v14: the gold tier', () => {
  it('migrates the real v13 fixture (orders unlocked, ⭐, iron tools) to v15: everything kept, gold at 0, no workshop', () => {
    const old = JSON.parse(v13)
    expect(old.version).toBe(13)
    expect(old.state.run).toMatchObject({ vein: { level: 3 }, pickaxe: { tier: 'iron' }, orders: { unlocked: true }, stars: 5 })
    const save = deserialize(v13)!
    expect(save).toEqual({
      version: 16,
      savedAtMs: old.savedAtMs,
      state: {
        meta: old.state.meta,
        run: {
          ...old.state.run,
          lifetime: { ...old.state.run.lifetime, goldBars: 0, goldBarsSmelted: 0 },
          workshop: createWorkshop(),
          fields: createFields(),
        },
      },
    })
    // the migrated run plays on
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
  })
})

describe('save v15: the workshop', () => {
  it('migrates the real v14 fixture (vein Lv4, gold tools, orders unlocked) to v16: everything kept, workshop unbuilt, no fields', () => {
    const old = JSON.parse(v14)
    expect(old.version).toBe(14)
    expect(old.state.run).toMatchObject({ vein: { level: 4 }, pickaxe: { tier: 'gold' }, orders: { unlocked: true } })
    const save = deserialize(v14)!
    expect(save).toEqual({
      version: 16,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: { ...old.state.run, workshop: createWorkshop(), fields: createFields() } },
    })
    // the migrated run plays on, and the workshop gate is open (vein 4): it fails only on materials, never LOCKED
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
    expect(buildWorkshop(save.state)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
})

describe('save v16: the fields', () => {
  it('migrates the real v15 fixture (workshop built, 2 sprinklers, valve, orders unlocked) to v16: everything kept, fields fresh', () => {
    const old = JSON.parse(v15)
    expect(old.version).toBe(15)
    expect(old.state.run).toMatchObject({ workshop: { built: true, hoppers: [23, 11], valve: true }, orders: { unlocked: true } })
    const save = deserialize(v15)!
    expect(save).toEqual({
      version: 16,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: { ...old.state.run, fields: createFields() } },
    })
    // the migrated run plays on, and the fields gate is open (both certificates + a sprinkler): it fails only on
    // materials, never LOCKED
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
    expect(unlockFields(save.state)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
})

describe('batch 6 crops: chilli and lemon widen CropId only', () => {
  it('needs no SAVE_VERSION bump of its own: every past fixture lands on the latest with its crops untouched', () => {
    expect(SAVE_VERSION).toBe(16)
    for (const raw of [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15]) {
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
    expect(loaded.before).toEqual(state)
  })

  it('returns the saved state before the catch-up, so the banner can diff the wages workers were paid', () => {
    const store = memoryStore()
    const s = createInitialState()
    const dry = { status: 'planted' as const, cropId: 'radish' as const, growth: 1, moisture: 0, ticksSinceMature: 0 }
    const workers = { pool: 1, assigned: { plant: 0, water: 1, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0 }, certificates: ['water' as const] }
    const saved = { ...s, run: { ...s.run, cash: 50, tiles: [dry, ...s.run.tiles.slice(1)], workers, lifetime: { ...s.run.lifetime, wagesPaid: 7 } } }
    saveGame(store, saved, () => 0)
    const loaded = loadGame(store, () => 60_000)
    const wages = loaded.state.run.lifetime.wagesPaid - loaded.before.run.lifetime.wagesPaid
    expect(loaded.before.run.lifetime.wagesPaid).toBe(7)
    expect(wages).toBeGreaterThan(0)
    expect(loaded.state.run.cash).toBe(50 - wages)
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
    expect(loaded).toEqual({ state: createInitialState(), awayMs: 0, ticks: 0, before: createInitialState() })
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
    [6, v6],
    [7, v7],
    [8, v8],
    [9, v9],
    [10, v10],
    [11, v11],
    [12, v12],
    [13, v13],
    [14, v14],
    [15, v15],
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

describe('exportSave / importSave', () => {
  it('round-trips the stored save as base64; the old save goes to tiles.save.backup.import', () => {
    const from = memoryStore()
    const s = createInitialState()
    saveGame(from, { ...s, run: { ...s.run, cash: 4321 } }, () => 0)
    const code = exportSave(from)!
    expect(code).toMatch(/^[A-Za-z0-9+/=]+$/)
    const to = memoryStore()
    saveGame(to, { ...s, run: { ...s.run, cash: 5 } }, () => 0)
    // a paste may carry line breaks and spaces
    expect(importSave(to, `  ${code.slice(0, 20)}\n${code.slice(20)} `)).toEqual({ ok: true })
    expect(deserialize(to.getItem(IMPORT_BACKUP_KEY)!)!.state.run.cash).toBe(5)
    expect(loadGame(to, () => 0).state.run.cash).toBe(4321)
  })

  it('an older export goes through the normal load: raw backup by version, migration to the latest', () => {
    const store = memoryStore()
    expect(importSave(store, btoa(String.fromCharCode(...new TextEncoder().encode(v11))))).toEqual({ ok: true })
    expect(store.getItem(IMPORT_BACKUP_KEY)).toBeNull()
    const saved = JSON.parse(v11) as { savedAtMs: number; state: { run: { tick: number } } }
    const loaded = loadGame(store, () => saved.savedAtMs)
    expect(store.getItem(backupKey(11))).toBe(v11)
    expect(loaded.state.run.milestones.trackingStarted).toBe(saved.state.run.tick)
  })

  it('anything that is not a save is BAD_SAVE and changes nothing', () => {
    const store = memoryStore()
    saveGame(store, createInitialState(), () => 0)
    const before = [...store.data.entries()]
    const future = btoa(JSON.stringify({ version: SAVE_VERSION + 1, savedAtMs: 0, state: {} }))
    for (const text of ['', 'not base64 !!', btoa('{"hello":1}'), btoa('\xff\xfe'), future])
      expect(importSave(store, text)).toEqual({ ok: false, error: 'BAD_SAVE' })
    expect([...store.data.entries()]).toEqual(before)
  })

  it('a storage that refuses the write is STORAGE, not a throw', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(importSave(store, btoa(serialize(createInitialState(), 0)))).toEqual({ ok: false, error: 'STORAGE' })
    expect(exportSave(store)).toBeNull()
  })
})
