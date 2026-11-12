import { describe, expect, it } from 'vitest'
import { buyLicense } from '../src/core/actions'
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
import v16 from './fixtures/save-v16.json?raw'
import v17 from './fixtures/save-v17.json?raw'
import v18 from './fixtures/save-v18.json?raw'
import v19 from './fixtures/save-v19.json?raw'
import v20 from './fixtures/save-v20.json?raw'
import v21 from './fixtures/save-v21.json?raw'
import v22 from './fixtures/save-v22.json?raw'
import v23 from './fixtures/save-v23.json?raw'
import v24 from './fixtures/save-v24.json?raw'
import v25 from './fixtures/save-v25.json?raw'
import { BAG_CAPACITY_START, INITIAL_RNG_SEED, OFFLINE_CAP_TICKS, START_TILES, TANK_UNITS_PER_COAL, deedsFor, energyMax, itemSellPrice, loanDebtPerTick, multiplier, renownFloor } from '../src/core/balance'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import { takeLoan } from '../src/core/bank'
import { earlierMilestones } from '../src/core/data/milestones'
import { sellFarm, sellFarmUnlocked } from '../src/core/prestige'
import type { OreId } from '../src/core/data/items'
import type { GameState } from '../src/core/state'
import { certificateUnlocked, freeWorkers } from '../src/core/workers'
import { bagCount, dig } from '../src/core/mining'
import { createFurnace, createInitialMeta, createInitialState, createMachines, createTile, createWorkshop } from '../src/core/state'
import { step } from '../src/core/step'
import { buildWorkshop } from '../src/core/workshop'
import { buyMachine, unlockFields } from '../src/core/fields'
import { SAVE_VERSION, awayText, catchUp, deserialize, offlineTicks, serialize, type Save } from '../src/save/serialize'
import {
  BAD_SAVE_KEY,
  IMPORT_BACKUP_KEY,
  SAVE_KEY,
  backupKey,
  commitImport,
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
const noFurnace = {
  // the v9–v24 furnace before molds (frozen: createFurnace has the v25 shape); compared through asV12
  furnace: { built: false, oreKind: 'copperOre', fire: 0, ore: 0, progress: 0, ready: 0, smart: false, levels: { fireCap: 0, batch: 0 } },
  lifetime: expect.any(Object),
}
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
/** v17 → v18: the batch-20 meta — the 5 multiplier rows carry over, the deed rows and the ledger start fresh */
const v18Meta = (meta: { prestigeCount: number; upgrades: Record<string, number> }) => ({
  ...createInitialMeta(),
  ...meta,
  upgrades: { ...createInitialMeta().upgrades, ...meta.upgrades },
})
/** v18 → v19: the four batch-22 crops land with no glut and nothing planted; their licenses stay absent */
const v19Zeros = { tomato: 0, corn: 0, grape: 0, strawberry: 0 }
const v19Run = (run: { market: Record<string, number>; fields: { planted: Record<string, number> } }) => ({
  ...run,
  market: { ...run.market, ...v19Zeros },
  fields: { ...run.fields, planted: { ...run.fields.planted, ...v19Zeros } },
})
const v12Run = (run: { tick: number }) => ({ market: createInitialState().run.market, milestones: { trackingStarted: run.tick } })
/** a pre-v20 run: its workshop is the old hoppers shape */
type HopperRun = {
  cash: number
  bagCapacity: number
  inventory: Record<string, number | undefined>
  upgrades: { sellPrice: number }
  workshop: { built: boolean; hoppers: number[]; valve: boolean }
}
/** v19 → v20 expected run: the workshop's hoppers become beds (any machine already kept all 24 tiles wet); the
 * hopper coal moves into storage up to the bag's room (clamped at 0 — a bag can sit above its cap) and the
 * overflow is sold at coal's sell price into cash */
function v20Run<T extends HopperRun>(run: T, meta: GameState['meta']) {
  const { hoppers, ...workshop } = run.workshop
  const coal = hoppers.reduce((a, b) => a + b, 0)
  const bag = Object.values(run.inventory).reduce<number>((a, b) => a + (b ?? 0), 0)
  const moved = Math.max(0, Math.min(coal, run.bagCapacity - bag))
  const refund = (coal - moved) * itemSellPrice('coal', meta, run.upgrades.sellPrice)
  return {
    ...run,
    cash: run.cash + refund,
    inventory: moved > 0 || run.inventory.coal !== undefined ? { ...run.inventory, coal: (run.inventory.coal ?? 0) + moved } : run.inventory,
    workshop: { ...workshop, beds: hoppers.length >= 1 ? [true, true, true, true] : [false, false, false, false] },
  }
}
/** a v20-era expectation carried through the real v20 → v21 step (that step is pinned in 'v20 → v21: plots') */
const viaV20 = (save: { version: 20; savedAtMs: number; state: object }) => deserialize(JSON.stringify(save))
/** the v16–v20 Fields before the unlock (the v20 shape: count, cohorts, pipes) */
const v20Fields = () => ({ unlocked: false, count: 0, planted: Object.fromEntries(CROP_IDS.map((c) => [c, 0])), cohorts: [], pipes: 0, plantCrop: null, coalCarry: 0, machines: createMachines() })
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
/** a v24 run back in the v23 shape: the selected rack tier is the one pickaxe (no gold in these fixtures, no rescale) */
function asV23Run({ rack, selectedPickaxe, keepN, oreKeep, ...run }: Save['state']['run']) {
  void [keepN, oreKeep]
  return { ...run, pickaxe: selectedPickaxe ? { tier: selectedPickaxe, durability: rack[selectedPickaxe]! } : null }
}
const V24_FURNACE = noFurnace.furnace
/** a v25 furnace back in the v24 shape: the one mold holding ore, progress or bars is the old slot (copper when none);
 *  every other mold is empty, and the batch-33 levels and Collect all are at their start */
function asV24Furnace({ molds, levels: { speed, tray, slot, ...levels }, collectAll, stoked, ...f }: Save['state']['run']['furnace']) {
  expect([speed, tray, slot, collectAll, stoked]).toEqual([0, 0, 0, false, 0])
  const kinds = Object.keys(molds) as OreId[]
  const kind = kinds.find((k) => molds[k]!.ore + molds[k]!.progress + molds[k]!.ready > 0) ?? 'copperOre'
  for (const k of kinds) if (k !== kind) expect(molds[k]).toEqual({ ore: 0, progress: 0, ready: 0 })
  return { ...f, oreKind: kind, ...molds[kind]!, levels }
}
function asV12(save: Save) {
  const { orders, stars, starsFrac, favours, counters, lifetime, workers, workshop, fields, oreSort, renown, ...run } = { ...asV23Run(save.state.run), furnace: asV24Furnace(save.state.run.furnace) }
  const { orders: completed, contractsByHand, ...v12Counters } = counters
  const { ordersCompleted, starsEarned, goldBars, goldBarsSmelted, ...v12Lifetime } = lifetime
  const { clerk, manager, stoker, ...v12Assigned } = workers.assigned
  const { deeds, deedsClaimed, runs, ...meta } = save.state.meta
  void [orders, stars, starsFrac, favours, completed, contractsByHand, ordersCompleted, starsEarned, goldBars, goldBarsSmelted, clerk, manager, stoker, workshop, fields, oreSort, renown, deeds, deedsClaimed, runs]
  const v12Workers = { ...workers, assigned: v12Assigned }
  return { version: 12, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, counters: v12Counters, lifetime: v12Lifetime, workers: v12Workers } } }
}
/** v9 lifetime totals a migrated save starts with: no fire burnt, bars smelted 0 (no furnace before v6); v10 plants by workers 0 */
const noFire = { fireBurnt: 0, fireWasted: 0, barsSmelted: 0, workerPlants: 0, ...v11Lifetime, ...v14Lifetime }
type OldFurnace = { built: boolean; queue: number; progress: number; ready: number }
/** v8 → v9: every paid queued job is a ready bar; no fire, empty ore slot, plain furnace at base levels */
const v9Furnace = (f: OldFurnace) => ({ ...V24_FURNACE, built: f.built, ready: f.ready + f.queue })
/** v11 furnace field every migrated save starts with: it smelts copper, all it could before */
const v11Furnace = { oreKind: 'copperOre' }
/** v8 → v9 lifetime: bars smelted = collected + tray + queue (and v10 plants by workers 0) */
const v9Lifetime = (l: { bars: number }, f: OldFurnace) => ({ ...l, fireBurnt: 0, fireWasted: 0, barsSmelted: l.bars + f.ready + f.queue, workerPlants: 0, ...v11Lifetime })

describe('serialize / deserialize', () => {
  it('round-trips state and savedAtMs', () => {
    const state = step(createInitialState(), 42)
    const save = deserialize(serialize(state, 1234))
    expect(save).toEqual({ version: 26, savedAtMs: 1234, state })
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
    expect(save.state.run.furnace).toEqual({ ...createFurnace(), built: true, molds: { copperOre: { ore: 0, progress: 0, ready: 5 } } })
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
    const s = { ...save.state, run: { ...save.state.run, furnace: { ...save.state.run.furnace, fire: 120, molds: { copperOre: { ready: 7, ore: 4, progress: 0 } } } } }
    expect(step(s, 60).run.furnace.molds.copperOre).toEqual({ ready: 7, ore: 4, progress: 0 })
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
    expect(save.state.run.furnace.molds.copperOre!.ready).toBe(2)
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
  })

  it('round-trips workers and wages paid', () => {
    const s = createInitialState()
    const state = {
      ...s,
      run: {
        ...s.run,
        workers: { pool: 6, assigned: { plant: 1, water: 2, harvest: 1, ore: 1, fuel: 0, mine: 1, clerk: 0, manager: 0, stoker: 0 }, certificates: ['water' as const, 'harvest' as const, 'ore' as const, 'plant' as const, 'mine' as const] },
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
        furnace: {
          built: true,
          fire: 137.375,
          smart: true,
          levels: { fireCap: 1, batch: 2, speed: 1, tray: 1, slot: 2 },
          molds: { copperOre: { ore: 2, progress: 0, ready: 0 }, ironOre: { ore: 7, progress: 17.25, ready: 2 } },
          collectAll: true,
          stoked: 3,
        },
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
    expect(save.state.run.furnace.molds.copperOre!.ready).toBe(2)
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
        rack: { wooden: 0, copper: 120 },
        selectedPickaxe: 'wooden' as const,
        keepN: true,
        oreKeep: { stone: 20 },
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

  it('migration switch accepts v21 … v26 and rejects unknown, missing or future versions', () => {
    const fresh = JSON.parse(serialize(createInitialState(), 0))
    expect(deserialize(JSON.stringify(fresh))?.version).toBe(26)
    expect(deserialize(JSON.stringify({ ...fresh, version: 27 }))).toBeNull()
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
    expect(mined.ok && mined.state.run.rack).toEqual({ wooden: 10 })
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
    expect(save.version).toBe(SAVE_VERSION)
    expect(save.savedAtMs).toBe(1_700_000_000_000)
    const { run, meta } = save.state
    expect(meta).toEqual(v18Meta(v12Meta(old.meta)))
    expect(run.tiles).toHaveLength(START_TILES)
    expect(run.tiles.slice(0, 6)).toEqual(old.run.tiles)
    expect(run.tiles.slice(6)).toEqual([createTile(), createTile(), createTile()])
    expect(run.upgrades).toEqual({ ...old.run.upgrades, sellPrice: 0, fertilizer: 0 })
    expect(run.counters).toEqual({ harvests: 0, sales: 0, mines: 0, digs: 0, waters: 0, plants: 0, bars: 0, orders: 0, contractsByHand: 0 })
    expect(run).toMatchObject({
      inventory: {},
      rack: {},
      selectedPickaxe: null,
      mineLicense: false,
      bagCapacity: BAG_CAPACITY_START,
      rngState: INITIAL_RNG_SEED,
      loan: null,
      seeds: {},
      autoBuySeeds: true,
      ...noTools,
      ...noMiningProgress,
      ...noFurnace, furnace: createFurnace(), ...noCopper, ...noWorkers,
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
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: { meta: v18Meta(old.state.meta), run: v19Run({ ...old.state.run, ...v13Run(old.state.run), workshop: createWorkshop(), fields: v20Fields() }) },
    }))
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
        starsFrac: 0.4,
        orders: { unlocked: true, slots: 2, offers: [{ good: 'radish' as const, count: 27, done: 4, tier: 0, accepted: true, stars: 0.6 }, { cooldownTicks: 312 }] },
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
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: {
        meta: v18Meta(old.state.meta),
        run: v19Run({
          ...old.state.run,
          lifetime: { ...old.state.run.lifetime, goldBars: 0, goldBarsSmelted: 0 },
          workshop: createWorkshop(),
          fields: v20Fields(),
        }),
      },
    }))
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
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: { meta: v18Meta(old.state.meta), run: v19Run({ ...old.state.run, workshop: createWorkshop(), fields: v20Fields() }) },
    }))
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
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: { meta: v18Meta(old.state.meta), run: v19Run({ ...v20Run(old.state.run, old.state.meta), fields: v20Fields() }) },
    }))
    // the migrated run plays on, and the fields gate is open (both certificates + a sprinkler): it fails only on
    // materials, never LOCKED
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
    expect(unlockFields(save.state)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
})

describe('save v17: the machines', () => {
  it('migrates the real v16 fixture (fields unlocked, 320 tiles, pipes 2, 200 standing) to v17: everything kept, machines fresh', () => {
    const old = JSON.parse(v16)
    expect(old.version).toBe(16)
    expect(old.state.run).toMatchObject({ fields: { unlocked: true, count: 320, pipes: 2 } })
    const save = deserialize(v16)!
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: { meta: v18Meta(old.state.meta), run: v19Run({ ...v20Run(old.state.run, old.state.meta), fields: { ...old.state.run.fields, machines: createMachines() } }) },
    }))
    // the migrated run plays on, and the harvester's gate is open (the certificate is held): it fails only on materials
    expect(step(save.state, 120).run.tick).toBe(old.state.run.tick + 120)
    expect(buyMachine(save.state, 'harvester', 1)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
  })
})

describe('save v18: the deed ledger', () => {
  it('migrates the real v17 fixture (machines harvester 1+2 / seeder 1, 400 fields, ⭐37, lifetime 💰780k) to v18: everything kept, ledger fresh', () => {
    const old = JSON.parse(v17)
    expect(old.version).toBe(17)
    expect(old.state.run).toMatchObject({ fields: { unlocked: true, count: 400, machines: { harvester: [1, 2], seeder: [1] } }, stars: 37 })
    expect(old.state.run.lifetime.cashEarned).toBe(780_000)
    const save = deserialize(v17)!
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: { meta: v18Meta(old.state.meta), run: v19Run(v20Run(old.state.run, old.state.meta)) },
    }))
    // the migrated run sits at the sale gate (8 lifetime deeds, farm jobs covered) and sells 8 + ⭐1
    expect(deedsFor(save.state.run.lifetime.cashEarned)).toBe(8)
    expect(sellFarmUnlocked(save.state)).toBe(true)
    const sale = sellFarm(save.state) as { ok: true; state: GameState }
    expect(sale.state.meta).toMatchObject({ prestigeCount: 1, deeds: 9, deedsClaimed: 8, runs: [{ endedAtTick: 31_000, deeds: 9 }] })
  })
})

describe('save v19: the four new crops', () => {
  it('migrates the real v18 fixture to v19: everything kept, the four glut and planted keys at 0, licenses untouched', () => {
    const old = JSON.parse(v18)
    expect(old.version).toBe(18)
    expect(old.state.run.licenses).toEqual(['radish', 'chilli', 'pumpkin', 'lemon'])
    const save = deserialize(v18)!
    expect(save).toEqual(viaV20({
      version: 20,
      savedAtMs: old.savedAtMs,
      state: { meta: old.state.meta, run: v19Run(v20Run(old.state.run, old.state.meta)) },
    }))
    // the run plays on, and the tomato license is buyable (never granted)
    expect(step(save.state, 60).run.tick).toBe(old.state.run.tick + 60)
    expect(buyLicense(save.state, 'tomato').ok).toBe(true)
  })
})

describe('save v20: bed sprinklers', () => {
  it('every fixture v1 … v19 migrates on to the latest', () => {
    for (const raw of [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17, v18, v19]) {
      expect(deserialize(raw)!.version).toBe(SAVE_VERSION)
    }
  })

  it('migrates the real v19 fixture (2 sprinklers, valve, 24 tiles): all four beds, hopper coal sold, nothing earned lost', () => {
    const old = JSON.parse(v19)
    expect(old.version).toBe(19)
    expect(old.state.run.workshop).toEqual({ built: true, hoppers: [18, 14], valve: true })
    const save = deserialize(v19)!
    expect(save).toEqual(viaV20({ version: 20, savedAtMs: old.savedAtMs, state: { meta: old.state.meta, run: v20Run(old.state.run, old.state.meta) } }))
    const run = save.state.run
    // one machine already kept all 24 tiles wet, so any sprinkler owner gets all four beds; the valve is kept
    expect(run.workshop).toEqual({ built: true, beds: [true, true, true, true], valve: true })
    // 32 hopper coal, room for 2: the rest is sold at coal's sell price into cash (a refund, not earnings)
    const room = old.state.run.bagCapacity - bagCount(old.state.run)
    // (v21 then fills the Tractor's tank from that storage: storage + tank holds it all)
    expect([room, (run.inventory.coal ?? 0) + run.fields.tank / TANK_UNITS_PER_COAL]).toEqual([2, old.state.run.inventory.coal + 2])
    expect(run.cash).toBe(old.state.run.cash + 30 * itemSellPrice('coal', old.state.meta, old.state.run.upgrades.sellPrice))
    expect(run.cash).toBeGreaterThanOrEqual(old.state.run.cash)
    expect([run.tiles.length, run.licenses, run.workers.certificates, run.counters.sales, run.lifetime.cashEarned]).toEqual([
      old.state.run.tiles.length,
      old.state.run.licenses,
      old.state.run.workers.certificates,
      old.state.run.counters.sales,
      old.state.run.lifetime.cashEarned,
    ])
    // batch 26 pin (a): a migrated sprinkler owner with every tile planted and no water worker has no dry tile 8 h on
    const planted = { ...save.state, run: { ...run, workers: { ...run.workers, assigned: { ...run.workers.assigned, water: 0 } }, tiles: run.tiles.map((t) => ({ ...t, status: 'planted' as const, cropId: 'lemon' as const, moisture: 0, growth: 0, ticksSinceMature: 0 })) } }
    const after = step(planted, 8 * 3600)
    expect(after.run.tiles.every((t) => t.status !== 'planted' || t.moisture > 0)).toBe(true)
    expect(after.run.tiles.some((t) => t.growth > 0)).toBe(true)
  }, 60_000) // 8 h of steps: over the 5 s default under a full parallel suite (batch 28: the migrated Fields work too)

  it('a forged v19 with hoppers [5, 24] and an empty bag gets all four beds and all 29 coal into storage', () => {
    const fresh = JSON.parse(serialize(createInitialState(), 0))
    fresh.version = 19
    fresh.state.run.workshop = { built: true, hoppers: [5, 24], valve: false }
    fresh.state.run.inventory = {}
    fresh.state.run.bagCapacity = 60
    fresh.state.run.upgrades = { ...fresh.state.run.upgrades, sellPrice: 3 }
    const save = deserialize(JSON.stringify(fresh))!
    expect(save.state.run.workshop.beds).toEqual([true, true, true, true])
    expect(save.state.run.inventory.coal).toBe(29)
    expect(save.state.run.cash).toBe(fresh.state.run.cash)
  })

  it('a bag one slot short of full caps the coal moved and sells the overflow into cash', () => {
    const fresh = JSON.parse(serialize(createInitialState(), 0))
    fresh.version = 19
    fresh.state.run.workshop = { built: true, hoppers: [10, 10], valve: false }
    fresh.state.run.inventory = { stone: 59 }
    fresh.state.run.bagCapacity = 60
    fresh.state.run.upgrades = { ...fresh.state.run.upgrades, sellPrice: 3 }
    const save = deserialize(JSON.stringify(fresh))!
    expect(save.state.run.inventory).toEqual({ stone: 59, coal: 1 })
    expect(save.state.run.cash).toBe(fresh.state.run.cash + 19 * itemSellPrice('coal', fresh.state.meta, 3))
  })

  it('a v19 workshop with no machines gets no beds', () => {
    const fresh = JSON.parse(serialize(createInitialState(), 0))
    fresh.version = 19
    fresh.state.run.workshop = { built: true, hoppers: [], valve: true }
    const save = deserialize(JSON.stringify(fresh))!
    expect(save.state.run.workshop).toEqual({ built: true, beds: [false, false, false, false], valve: true })
    expect(save.state.run.inventory).toEqual({})
    expect(save.state.run.cash).toBe(fresh.state.run.cash)
  })
})

/** a v20-era run's Fields as the v20 code saw them (count, cohorts, pipes) */
type FieldsV20 = { unlocked: boolean; count: number; cohorts: { crop: CropId; count: number; readyTick: number }[]; pipes: number }
type RunV20 = { tick: number; seeds: Partial<Record<CropId, number>>; inventory: { coal?: number }; fields: FieldsV20 }
/** the v20 run of a fixture: v16–v19 pass through the v19 → v20 step (hopper coal into storage) first */
const asV20Run = (raw: string): RunV20 => {
  const old = JSON.parse(raw)
  return old.version === 20 ? old.state.run : v20Run(old.state.run, old.state.meta)
}
/** the v20 code's numbers (fieldsStats' prefix rule at the save's tick): covered + ready tiles and stalled per crop */
function v20Stats(run: RunV20) {
  const cover = [0, 60, 150, 300][Math.min(run.fields.pipes, 3)]
  let covered = 0
  let ready = 0
  let stalled = false
  const back: Partial<Record<CropId, number>> = {}
  const kept: FieldsV20['cohorts'] = []
  for (const c of run.fields.cohorts) {
    if (c.readyTick <= run.tick) {
      ready += c.count
      kept.push(c)
    } else if (!stalled && covered + c.count <= cover) {
      covered += c.count
      kept.push(c)
    } else {
      stalled = true
      back[c.crop] = (back[c.crop] ?? 0) + c.count
    }
  }
  return { covered, ready, back, kept }
}
const ALL_FIXTURES = [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17, v18, v19, v20]

describe('v20 → v21: plots', () => {
  it('every fixture v1 … v20 deserializes to the latest version with no throw', () => {
    for (const raw of ALL_FIXTURES) expect(deserialize(raw)!.version).toBe(SAVE_VERSION)
  })

  it('every fixture with the Fields unlocked keeps its land, its watered tiles, its seeds, its coal and half its wait', () => {
    const unlocked = ALL_FIXTURES.filter((raw) => JSON.parse(raw).version >= 16 && asV20Run(raw).fields.unlocked)
    expect(unlocked.length).toBeGreaterThanOrEqual(5) // v16 … v20
    for (const raw of unlocked) {
      const old = asV20Run(raw)
      const { run } = deserialize(raw)!.state
      const { covered, ready, back, kept } = v20Stats(old)
      const plots = run.fields.list.flatMap((f) => f.plots)
      // owned tiles never shrink
      expect(10 * plots.length).toBeGreaterThanOrEqual(old.fields.count)
      // wet tiles (fields with a pivot) cover what the old pipes watered plus what stood ready
      const wet = run.fields.list.filter((f) => f.pivot).reduce((n, f) => n + 10 * f.plots.length, 0)
      expect(wet).toBeGreaterThanOrEqual(covered + ready)
      // stalled cohorts went back to the pouch, per crop
      for (const crop of CROP_IDS) expect((run.seeds[crop] ?? 0) - (old.seeds[crop] ?? 0)).toBe(back[crop] ?? 0)
      // the tank drew its coal from storage, none lost
      expect((run.inventory.coal ?? 0) + run.fields.tank / TANK_UNITS_PER_COAL).toBe(old.inventory.coal ?? 0)
      // fields are chunks of five plots, P = max(ceil(count / 10), planted plots, 1)
      const planted = CROP_IDS.reduce((n, crop) => n + Math.ceil(kept.filter((c) => c.crop === crop).reduce((a, c) => a + c.count, 0) / 10), 0)
      const P = Math.max(Math.ceil(old.fields.count / 10), planted, 1)
      expect(plots).toHaveLength(P)
      expect(run.fields.list.length).toBeLessThanOrEqual(Math.ceil(P / 5))
      // every growing plot keeps half its remaining ticks (rounded up) of a kept growing cohort of its crop
      for (const p of plots.filter((q) => q.crop !== null && q.readyTick > run.tick)) {
        const left = p.readyTick - run.tick
        expect(kept.some((c) => c.crop === p.crop && c.readyTick > run.tick && Math.ceil((c.readyTick - run.tick) / 2) === left)).toBe(true)
      }
      // Field 1 always has its pivot; the pump is the old pipes tier
      expect(run.fields.list[0].pivot).toBe(true)
      expect(run.fields.pump).toBe(old.fields.pipes)
      expect([run.counters.contractsByHand, run.workers.assigned.manager]).toEqual([0, 0])
    }
  })

  it('migrates the real v20 fixture (400 tiles, pipes 2, valve) to 40 plots in 8 fields, machines and valve kept', () => {
    const old = JSON.parse(v20)
    expect(old.version).toBe(20)
    expect(old.state.run.fields).toMatchObject({ unlocked: true, count: 400, pipes: 2 })
    const { run } = deserialize(v20)!.state
    expect(run.fields.list.flatMap((f) => f.plots)).toHaveLength(40)
    expect(run.fields.list).toHaveLength(8)
    expect(run.fields.machines).toEqual(old.state.run.fields.machines)
    expect(run.workshop.valve).toBe(true)
    expect(run.fields).not.toHaveProperty('coalCarry')
  })

  /** a v20 save forged from a fresh run with these Fields */
  const forgedV20 = (fields: Partial<FieldsV20> & { plantCrop?: CropId | null }, run: object = {}) => {
    const fresh = JSON.parse(serialize(createInitialState(), 0))
    fresh.version = 20
    delete fresh.state.run.counters.contractsByHand
    delete fresh.state.run.workers.assigned.manager
    fresh.state.run.fields = { ...v20Fields(), unlocked: true, ...fields }
    Object.assign(fresh.state.run, run)
    return deserialize(JSON.stringify(fresh))!.state.run
  }

  it('a hand-built v20 save unlocked with count 0 gets Field 1 with its pivot and one empty plot', () => {
    const run = forgedV20({ count: 0, plantCrop: 'radish' })
    expect(run.fields.list).toEqual([{ pivot: true, crop: 'radish', pinned: false, plots: [{ crop: null, readyTick: 0 }] }])
    expect([run.fields.pump, run.fields.tank]).toEqual([0, 0])
  })

  it('a hand-built v20 save with pipes 0 and 3 growing cohorts: all stalled, seeds back, plots empty', () => {
    const cohorts = [
      { crop: 'radish' as const, count: 10, readyTick: 500 },
      { crop: 'lemon' as const, count: 10, readyTick: 600 },
      { crop: 'radish' as const, count: 10, readyTick: 700 },
    ]
    const run = forgedV20({ count: 30, pipes: 0, cohorts }, { tick: 100, seeds: { radish: 3 }, inventory: { coal: 50 } })
    expect(run.seeds).toEqual({ radish: 23, lemon: 10 })
    expect(run.fields.list).toHaveLength(1)
    expect(run.fields.list[0].plots).toEqual([0, 1, 2].map(() => ({ crop: null, readyTick: 0 })))
    // pipes 0 = pump 0: a 40-coal tank filled from the 50 in storage
    expect([run.fields.tank, run.inventory.coal]).toEqual([40 * TANK_UNITS_PER_COAL, 10])
  })

  it.each([
    [16, 458_346, v16],
    [17, 446_798, v17],
    [18, 442_797, v18],
    [19, 441_238, v19],
    [20, 439_579, v20],
  ])('the v%i fixture earns at least what the v20 code earned in 8 h (💰%i, measured on 72ec00a)', (_, earned, raw) => {
    const s = deserialize(raw as string)!.state
    const delta = step(s, OFFLINE_CAP_TICKS).run.cash - s.run.cash
    console.log('PIN145e', { earned, delta })
    expect(delta).toBeGreaterThanOrEqual(earned as number)
  }, 60_000)
})

describe('batch 6 crops: chilli and lemon widen CropId only', () => {
  it('needs no SAVE_VERSION bump of its own: every past fixture lands on the latest with its crops untouched', () => {
    expect(SAVE_VERSION).toBe(26)
    for (const raw of [v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17]) {
      const old = JSON.parse(raw).state.run
      const run = deserialize(raw)!.state.run
      expect(run.licenses).toEqual(old.licenses)
      // batch 28: v21 returns the stalled Fields cohorts to the pouch (pinned in 'v20 → v21: plots')
      const back = JSON.parse(raw).version >= 16 && asV20Run(raw).fields.unlocked ? v20Stats(asV20Run(raw)).back : {}
      for (const crop of CROP_IDS) expect(run.seeds[crop] ?? 0).toBe((old.seeds?.[crop] ?? 0) + (back[crop] ?? 0))
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
    const workers = { pool: 1, assigned: { plant: 0, water: 1, harvest: 0, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }, certificates: ['water' as const] }
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
    [18, v18],
    [19, v19],
    [20, v20],
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

describe('commitImport (the 💾 Data write, decode lives in the codec)', () => {
  it('backs the current save up to tiles.save.backup.import and writes the migrated one; boot loads it with the cap', () => {
    const store = memoryStore()
    const s = createInitialState()
    saveGame(store, { ...s, run: { ...s.run, cash: 5 } }, () => 0)
    const incoming = JSON.parse(serialize({ ...s, run: { ...s.run, cash: 4321 } }, 0)) as Save
    expect(commitImport(store, incoming)).toEqual({ ok: true })
    expect(deserialize(store.getItem(IMPORT_BACKUP_KEY)!)!.state.run.cash).toBe(5)
    // boot applies the offline catch-up with its cap, exactly as a reload after import does
    expect(loadGame(store, () => 100 * 24 * 3600 * 1000).state.run.cash).toBe(4321)
  })

  it('a storage that refuses the write is STORAGE, not a throw', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(commitImport(store, JSON.parse(serialize(createInitialState(), 0)) as Save)).toEqual({ ok: false, error: 'STORAGE' })
  })
})

describe('save v22: 🧺 ore sorting', () => {
  it('every fixture v1 … v21 migrates to the latest with every kind locked', () => {
    for (const raw of [...ALL_FIXTURES, v21]) {
      const save = deserialize(raw)!
      expect(save.version).toBe(SAVE_VERSION)
      expect(save.state.run.oreSort).toEqual({})
    }
  })

  it('migrates the real v21 fixture (written by the live v21 build): only oreSort {} is added (and v23 renown)', () => {
    const old = JSON.parse(v21)
    expect(old.version).toBe(21)
    const meta = { ...old.state.meta, upgrades: { ...old.state.meta.upgrades, keepRenown: 0 } }
    const run = { ...v24Run(old.state.run), oreSort: {}, renown: old.state.run.lifetime.harvests }
    expect(deserialize(v21)).toEqual({ version: 26, savedAtMs: old.savedAtMs, state: { meta, run } })
  })
})

type FurnaceV24 = { oreKind: string; ore: number; progress: number; ready: number; levels: object }
/** v24 → v25 on the real vein-Lv4 fixtures: the gold slot becomes the gold mold, iron and copper get empty molds */
function v25Furnace({ oreKind, ore, progress, ready, levels, ...f }: FurnaceV24) {
  expect(oreKind).toBe('goldOre')
  const empty = { ore: 0, progress: 0, ready: 0 }
  return { ...f, levels: { ...levels, speed: 0, tray: 0, slot: 0 }, molds: { copperOre: empty, ironOre: empty, goldOre: { ore, progress, ready } }, collectAll: false, stoked: 0 }
}
type RunV25Like = { workers: { assigned: object }; orders: { offers: ({ tier: number } | { cooldownTicks: number })[] } }
/** v25 → v26: offers keep their tier ⭐ 1 / 2 / 4, no fractional ⭐, no Favours, no Stoker (the furnace's stoked: 0 is
 *  in v25Furnace / the v25 test) */
function v26Fields(run: RunV25Like) {
  return {
    starsFrac: 0,
    favours: { bunkhouse: 0, seam: false, aim: null },
    workers: { ...run.workers, assigned: { ...run.workers.assigned, stoker: 0 } },
    orders: { ...run.orders, offers: run.orders.offers.map((o) => ('tier' in o ? { ...o, stars: [1, 2, 4][o.tier] } : o)) },
  }
}
/** v23 → v24 on the real fixtures: their gold pickaxe 3800 / 6500 lands on the rack as 351 / 600, selected; then v25 molds */
function v24Run({ pickaxe, furnace, ...run }: { pickaxe: { tier: string; durability: number }; furnace: FurnaceV24 } & RunV25Like) {
  expect(pickaxe).toEqual({ tier: 'gold', durability: 3800 })
  return { ...run, furnace: v25Furnace(furnace), rack: { gold: 351 }, selectedPickaxe: 'gold', keepN: false, oreKeep: {}, ...v26Fields(run) }
}

describe('save v23: renown', () => {
  it('migrates the real v22 fixture (written by the live v22 build): renown = lifetime harvests, nothing else changes', () => {
    const old = JSON.parse(v22)
    expect(old.version).toBe(22)
    const save = deserialize(v22)!
    expect(save.version).toBe(SAVE_VERSION)
    const { run, meta } = save.state
    expect(run.renown).toEqual({ radish: 150, chilli: 95, pumpkin: 300, lemon: 2413 })
    expect([renownFloor(run.renown.lemon!), renownFloor(run.renown.pumpkin!)]).toEqual([0.6, 0.55])
    expect(meta).toEqual({ ...old.state.meta, upgrades: { ...old.state.meta.upgrades, keepRenown: 0 } })
    expect(run).toEqual({ ...v24Run(old.state.run), renown: run.renown })
  })

  it('every fixture v1 … v23 migrates to the latest with renown = its lifetime harvests', () => {
    for (const raw of [...ALL_FIXTURES, v21, v22, v23]) {
      const save = deserialize(raw)!
      expect(save.version).toBe(SAVE_VERSION)
      expect(save.state.meta.upgrades.keepRenown).toBe(0)
      const harvested = Object.fromEntries(Object.entries(save.state.run.lifetime.harvests).filter(([, n]) => (n ?? 0) > 0))
      expect(save.state.run.renown).toEqual(harvested)
    }
  })
})

describe('save v24: the pickaxe rack and Keep N (batch 32)', () => {
  it('migrates the real v23 fixture (written by the live v23 build): gold 3800 / 6500 → 351 / 600 selected, nothing earned changes', () => {
    const old = JSON.parse(v23)
    expect(old.version).toBe(23)
    const save = deserialize(v23)!
    expect(save.version).toBe(SAVE_VERSION)
    const { run, meta } = save.state
    expect([run.rack, run.selectedPickaxe, run.keepN, run.oreKeep]).toEqual([{ gold: 351 }, 'gold', false, {}])
    expect([run.cash, run.tiles, run.licenses, run.mastery, run.masteredTiers]).toEqual([
      old.state.run.cash,
      old.state.run.tiles,
      old.state.run.licenses,
      { wooden: 400, copper: 700, iron: 1300, gold: 310 },
      ['wooden'],
    ])
    expect(meta).toEqual(old.state.meta)
    expect(run).toEqual(v24Run(old.state.run))
    expect('pickaxe' in run).toBe(false)
  })

  it('a blunt gold pickaxe stays blunt, a sharp one stays sharp (at least 1), other tiers keep their durability', () => {
    const old = JSON.parse(v23)
    const at = (pickaxe: object | null) => deserialize(JSON.stringify({ ...old, state: { ...old.state, run: { ...old.state.run, pickaxe } } }))!.state.run
    expect(at({ tier: 'gold', durability: 0 }).rack).toEqual({ gold: 0 })
    expect(at({ tier: 'gold', durability: 1 }).rack).toEqual({ gold: 1 })
    expect(at({ tier: 'gold', durability: 3250 }).rack).toEqual({ gold: 300 })
    expect(at({ tier: 'iron', durability: 77 }).rack).toEqual({ iron: 77 })
    expect([at(null).rack, at(null).selectedPickaxe]).toEqual([{}, null])
  })
})

describe('save v25: furnace molds (batch 33)', () => {
  const EMPTY = { ore: 0, progress: 0, ready: 0 }

  it('migrates the real v24 fixture (written by the live v24 build): the gold slot is the gold mold, nothing earned changes', () => {
    const old = JSON.parse(v24)
    expect(old.version).toBe(24)
    const save = deserialize(v24)!
    expect(save.version).toBe(SAVE_VERSION)
    const { run, meta } = save.state
    expect(run.furnace).toEqual({
      built: true,
      fire: 576,
      smart: true,
      levels: { fireCap: 2, batch: 2, speed: 0, tray: 0, slot: 0 },
      molds: { copperOre: EMPTY, ironOre: EMPTY, goldOre: { ore: 4, progress: 12, ready: 0 } },
      collectAll: false,
      stoked: 0,
    })
    const { furnace, ...rest } = old.state.run
    void furnace
    expect(meta).toEqual(old.state.meta)
    expect({ ...run, furnace: undefined }).toEqual({ ...rest, ...v26Fields(rest), furnace: undefined })
    expect([run.cash, run.inventory]).toEqual([old.state.run.cash, old.state.run.inventory])
  })

  it('every fixture v1 … v24 migrates to v25; a built furnace gets a mold per kind its vein drops, the old slot keeps its ore, progress and tray', () => {
    for (const raw of [...ALL_FIXTURES, v21, v22, v23, v24]) {
      const old = JSON.parse(raw)
      const save = deserialize(raw)!
      expect(save.version).toBe(SAVE_VERSION)
      const { furnace, vein } = save.state.run
      const kinds = Object.keys(furnace.molds).sort()
      const want = ['copperOre', ...(furnace.built && vein.level >= 3 ? ['ironOre'] : []), ...(furnace.built && vein.level >= 4 ? ['goldOre'] : [])].sort()
      expect(kinds).toEqual(want)
      expect([furnace.levels.speed, furnace.levels.tray, furnace.levels.slot, furnace.collectAll]).toEqual([0, 0, 0, false])
      // v9+ fixtures: the slot moved whole into its kind's mold (v6–v8 are pinned by their own tests)
      const f = old.state.run.furnace
      if (old.version >= 9) expect(furnace.molds[(f.oreKind ?? 'copperOre') as OreId]).toEqual({ ore: f.ore, progress: f.progress, ready: f.ready })
    }
  })

  it('an unbuilt furnace, or one on a shallow vein, gets only the copper mold; an iron slot on vein Lv3 keeps its ore', () => {
    const old = JSON.parse(v24)
    const at = (furnace: object, level: number) =>
      deserialize(JSON.stringify({ ...old, state: { ...old.state, run: { ...old.state.run, vein: { ...old.state.run.vein, level }, furnace } } }))!.state.run.furnace.molds
    const v24Furnace = { built: false, oreKind: 'copperOre', fire: 0, ore: 0, progress: 0, ready: 0, smart: false, levels: { fireCap: 0, batch: 0 } }
    expect(at(v24Furnace, 4)).toEqual({ copperOre: EMPTY })
    expect(at({ ...v24Furnace, built: true }, 2)).toEqual({ copperOre: EMPTY })
    expect(at({ ...v24Furnace, built: true, oreKind: 'ironOre', ore: 5, progress: 30, ready: 1 }, 3)).toEqual({ copperOre: EMPTY, ironOre: { ore: 5, progress: 30, ready: 1 } })
  })
})

describe('save v26: ⭐ Favours, order ⭐ by production-minutes (batch 34)', () => {
  it('migrates the real v25 fixture (written by the live v25 build): its offers keep ⭐4 / ⭐1 / ⭐1, nothing earned changes', () => {
    const old = JSON.parse(v25)
    expect(old.version).toBe(25)
    const save = deserialize(v25)!
    expect(save.version).toBe(26)
    const { run, meta } = save.state
    expect(run.orders.offers.map((o) => ('good' in o ? [o.tier, o.stars] : null))).toEqual([
      [2, 4],
      [0, 1],
      [0, 1],
    ])
    expect([run.stars, run.cash, run.starsFrac, run.favours, run.workers.assigned.stoker, run.furnace.stoked]).toEqual([39, 452_892, 0, { bunkhouse: 0, seam: false, aim: null }, 0, 0])
    expect(meta).toEqual(old.state.meta)
    const strip = (r: typeof run | typeof old.state.run) => ({ ...r, orders: undefined, starsFrac: undefined, favours: undefined, workers: undefined, furnace: undefined })
    expect(strip(run)).toEqual(strip(old.state.run))
    expect(run.furnace).toEqual({ ...old.state.run.furnace, stoked: 0 })
    expect(run.workers).toEqual({ ...old.state.run.workers, assigned: { ...old.state.run.workers.assigned, stoker: 0 } })
    expect([run.inventory, run.upgrades]).toEqual([old.state.run.inventory, old.state.run.upgrades])
  })

  it('every fixture v1 … v25 migrates to v26 with the new fields at their defaults; every offer keeps its tier ⭐ 1 / 2 / 4', () => {
    for (const raw of [...ALL_FIXTURES, v21, v22, v23, v24, v25]) {
      const save = deserialize(raw)!
      expect(save.version).toBe(26)
      const { run } = save.state
      expect([run.starsFrac, run.favours, run.workers.assigned.stoker, run.furnace.stoked]).toEqual([0, { bunkhouse: 0, seam: false, aim: null }, 0, 0])
      for (const o of run.orders.offers) if ('good' in o) expect(o.stars).toBe([1, 2, 4][o.tier])
    }
  })
})
