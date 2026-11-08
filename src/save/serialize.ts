// Pure: no DOM, no wall clock. The caller passes savedAtMs and elapsedMs in.
import { OFFLINE_CAP_TICKS, START_TILES, energyMax } from '../core/balance'
import type { CropId } from '../core/data/crops'
import type { ItemId, PickaxeTier } from '../core/data/items'
import type { ToolJob } from '../core/data/tools'
import type { UpgradeId } from '../core/data/upgrades'
import {
  createInitialMeta,
  createInitialState,
  createTile,
  createWorkshop,
  type Counters,
  type GameState,
  type Lifetime,
  type Loan,
  type MultiplierKey,
  type Tile,
} from '../core/state'
import { step } from '../core/step'

export const SAVE_VERSION = 15

// Past shapes are frozen here, never derived from the live RunState, so a later field cannot leak into them.
type JobV10 = JobV9 | 'plant'
type RunV10 = Omit<RunV9, 'workers' | 'lifetime'> & {
  plantCrop: CropId
  workers: { pool: number; assigned: Record<JobV10, number>; certificates: JobV10[] }
  lifetime: RunV9['lifetime'] & { workerPlants: number }
}
type JobV9 = 'water' | 'harvest' | 'ore' | 'fuel'
type RunV9 = Omit<RunV8, 'autoSmelt' | 'counters' | 'workers' | 'furnace' | 'lifetime'> & {
  counters: CountersV4 & { bars: number }
  workers: { pool: number; assigned: Record<JobV9, number>; certificates: JobV9[] }
  furnace: { built: boolean; fire: number; ore: number; progress: number; ready: number; smart: boolean; levels: { fireCap: number; batch: number } }
  lifetime: RunV8['lifetime'] & { fireBurnt: number; fireWasted: number; barsSmelted: number }
}
type RunV8 = Omit<RunV7, 'lifetime'> & {
  lifetime: RunV7['lifetime'] & { wagesPaid: number }
  workers: { pool: number; assigned: { water: number; harvest: number }; certificates: ('water' | 'harvest')[] }
  autoSmelt: boolean
}
type RunV7 = RunV6 & { toolTier: Record<ToolJob, number> }
type RunV6 = Omit<RunV5, 'vein' | 'mastery' | 'masteredTiers'> & {
  vein: { level: number; progress: number; rock: ItemId }
  furnace: { built: boolean; queue: number; progress: number; ready: number }
  lifetime: { cashEarned: number; energySpent: number; bars: number; harvests: Partial<Record<CropId, number>> }
  mastery: Partial<Record<PickaxeTier, number>>
  masteredTiers: PickaxeTier[]
}
type RunV5 = Omit<RunV4, 'vein'> & {
  storageLevel: number
  vein: { level: number; progress: number }
  mastery: { wooden?: number }
  masteredTiers: 'wooden'[]
}
type CountersV4 = { harvests: number; sales: number; mines: number; digs: number; waters: number; plants: number }
type RunV4 = {
  cash: number
  energy: number
  tiles: Tile[]
  licenses: CropId[]
  upgrades: Record<UpgradeId, number>
  counters: CountersV4
  tick: number
  mineLicense: boolean
  /** never 0: a v4 pickaxe vanished at 0 durability */
  pickaxe: { tier: 'wooden'; durability: number } | null
  inventory: Partial<Record<ItemId, number>>
  bagCapacity: number
  vein: { level: number }
  rngState: number
  loan: Loan | null
  seeds: Partial<Record<CropId, number>>
  autoBuySeeds: boolean
  tools: Record<ToolJob, number>
  toolN: Record<ToolJob, number>
}
type RunV1 = Pick<RunV4, 'cash' | 'energy' | 'tiles' | 'licenses' | 'tick'> & {
  upgrades: { energyMax: number; energyRegen: number }
}
type RunV3 = Omit<RunV4, 'counters' | 'seeds' | 'autoBuySeeds' | 'tools' | 'toolN'> & {
  /** digs = mine actions (renamed `mines` in v4) */
  counters: { harvests: number; sales: number; digs: number }
}
type RunV2 = Omit<RunV3, 'loan'>
/** meta up to v11: stored multipliers (all 1 in every released build) */
type MetaV11 = { prestigeCount: number; multipliers: Record<MultiplierKey, number> }
type SaveV1 = { version: 1; savedAtMs: number; state: { meta: MetaV11; run: RunV1 } }
type SaveV2 = { version: 2; savedAtMs: number; state: { meta: MetaV11; run: RunV2 } }
type SaveV3 = { version: 3; savedAtMs: number; state: { meta: MetaV11; run: RunV3 } }
type SaveV4 = { version: 4; savedAtMs: number; state: { meta: MetaV11; run: RunV4 } }
type SaveV5 = { version: 5; savedAtMs: number; state: { meta: MetaV11; run: RunV5 } }
type SaveV6 = { version: 6; savedAtMs: number; state: { meta: MetaV11; run: RunV6 } }
type SaveV7 = { version: 7; savedAtMs: number; state: { meta: MetaV11; run: RunV7 } }
type SaveV8 = { version: 8; savedAtMs: number; state: { meta: MetaV11; run: RunV8 } }
type SaveV9 = { version: 9; savedAtMs: number; state: { meta: MetaV11; run: RunV9 } }
type SaveV10 = { version: 10; savedAtMs: number; state: { meta: MetaV11; run: RunV10 } }
type JobV11 = JobV10 | 'mine'
type RunV12 = Omit<GameState['run'], 'orders' | 'stars' | 'counters' | 'lifetime' | 'workers' | 'workshop'> & {
  counters: Omit<Counters, 'orders'>
  lifetime: Omit<Lifetime, 'ordersCompleted' | 'starsEarned' | 'goldBars' | 'goldBarsSmelted'>
  workers: { pool: number; assigned: Record<JobV11, number>; certificates: JobV11[] }
}
type RunV11 = Omit<RunV12, 'market' | 'milestones'>
type SaveV11 = { version: 11; savedAtMs: number; state: { meta: MetaV11; run: RunV11 } }
type SaveV12 = { version: 12; savedAtMs: number; state: { meta: GameState['meta']; run: RunV12 } }
type RunV13 = Omit<GameState['run'], 'lifetime' | 'workshop'> & { lifetime: Omit<Lifetime, 'goldBars' | 'goldBarsSmelted'> }
type SaveV13 = { version: 13; savedAtMs: number; state: { meta: GameState['meta']; run: RunV13 } }
type RunV14 = Omit<GameState['run'], 'workshop'>
type SaveV14 = { version: 14; savedAtMs: number; state: { meta: GameState['meta']; run: RunV14 } }
type SaveV15 = { version: 15; savedAtMs: number; state: GameState }
export type Save = SaveV15

export function serialize(state: GameState, savedAtMs: number): string {
  const save: Save = { version: SAVE_VERSION, savedAtMs, state }
  return JSON.stringify(save)
}

// v1 → v2: fields v1 lacks take a new run's defaults (new upgrades 0, counters 0, empty bag, no pickaxe,
// no mine license, vein 0, INITIAL_RNG_SEED). Start grew to START_TILES tiles (pad with untilled) and
// energy max dropped, so current energy is clamped to the new max.
function migrateV1(save: SaveV1): SaveV2 {
  const { meta, run } = save.state
  // later fields in `fresh` (loan, seeds, …) are overwritten by the later migrations
  const fresh = createInitialState().run
  const upgrades = { ...fresh.upgrades, ...run.upgrades }
  const tiles = [...run.tiles, ...Array.from({ length: Math.max(0, START_TILES - run.tiles.length) }, createTile)]
  return {
    version: 2,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...fresh,
        ...run,
        // a v1 meta's multipliers are all 1 (prestige never shipped), so the fresh meta computes the same cap
        energy: Math.min(run.energy, energyMax(upgrades.energyMax, createInitialMeta())),
        pickaxe: null,
        tiles,
        upgrades,
        // the v2 counter shape, not a new run's v4 one
        counters: { harvests: 0, sales: 0, digs: 0 },
      },
    },
  }
}

// v2 → v3: the bank arrived; a v2 run never had a loan.
function migrateV2(save: SaveV2): SaveV3 {
  const { meta, run } = save.state
  return { version: 3, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, loan: null } } }
}

// v3 → v4: old `digs` counted mine actions, so it moves to `mines`; soil `digs` (new), `waters` and `plants`
// start at 0. Empty seed pouch, auto-buy on, so planting costs what it did before. No farm tools yet.
function migrateV3(save: SaveV3): SaveV4 {
  const { meta, run } = save.state
  const { harvests, sales, digs } = run.counters
  const { tools, toolN } = createInitialState().run
  return {
    version: 4,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        counters: { harvests, sales, mines: digs, digs: 0, waters: 0, plants: 0 },
        seeds: {},
        autoBuySeeds: true,
        tools,
        toolN,
      },
    },
  }
}

// v4 → v5: mining progress. Nothing earned changes: the pickaxe keeps its durability, the bag keeps its items.
// No half-mined stone, no mastery xp, storage level 0 (bagCapacity is kept as is).
function migrateV4(save: SaveV4): SaveV5 {
  const { meta, run } = save.state
  return {
    version: 5,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: { ...run, storageLevel: 0, vein: { level: run.vein.level, progress: 0 }, mastery: {}, masteredTiers: [] },
    },
  }
}

// v5 → v6: furnace (not built), copper items, the current rock (a half-mined rock stays stone), lifetime totals.
// Totals start from the counters that map, so they never read lower than what the player did: each harvest,
// water, plant, soil dig and mine cost 1 energy (tills were never counted), and with one license every harvest
// was that crop. Cash earned was never tracked: 0.
function migrateV5(save: SaveV5): SaveV6 {
  const { meta, run } = save.state
  const { harvests, waters, plants, digs, mines } = run.counters
  return {
    version: 6,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        vein: { ...run.vein, rock: 'stone' },
        furnace: { built: false, queue: 0, progress: 0, ready: 0 },
        lifetime: {
          cashEarned: 0,
          energySpent: harvests + waters + plants + digs + mines,
          bars: 0,
          harvests: run.licenses.length === 1 && harvests > 0 ? { [run.licenses[0]]: harvests } : {},
        },
      },
    },
  }
}

// v6 → v7: copper farm tools; every job starts at the basic tier. Nothing else changes.
function migrateV6(save: SaveV6): SaveV7 {
  const { meta, run } = save.state
  return { version: 7, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, toolTier: { water: 0, harvest: 0, plant: 0 } } } }
}

// v7 → v8: workers (none hired, no certificates), wages paid 0, auto-smelt off. Nothing else changes.
function migrateV7(save: SaveV7): SaveV8 {
  const { meta, run } = save.state
  return {
    version: 8,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        lifetime: { ...run.lifetime, wagesPaid: 0 },
        workers: { pool: 0, assigned: { water: 0, harvest: 0 }, certificates: [] },
        autoSmelt: false,
      },
    },
  }
}

// v8 → v9: fuelled furnace. Every paid queued job becomes a ready bar (its ore and fuel were already paid; the tray may
// exceed its cap once, it only blocks smelting until collected), so bars smelted = collected + tray + queue. No fire,
// empty ore slot, plain furnace at base levels; the free auto-smelt toggle is dropped (no earned value). The furnace
// loaders start with no workers; their gate counter `bars` (bars collected) starts from lifetime.bars.
function migrateV8(save: SaveV8): SaveV9 {
  const { meta, run } = save.state
  const { autoSmelt, furnace, lifetime, counters, workers, ...rest } = run
  void autoSmelt
  const ready = furnace.ready + furnace.queue
  return {
    version: 9,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...rest,
        counters: { ...counters, bars: lifetime.bars },
        workers: { ...workers, assigned: { ...workers.assigned, ore: 0, fuel: 0 } },
        furnace: { built: furnace.built, fire: 0, ore: 0, progress: 0, ready, smart: false, levels: { fireCap: 0, batch: 0 } },
        lifetime: { ...lifetime, fireBurnt: 0, fireWasted: 0, barsSmelted: lifetime.bars + ready },
      },
    },
  }
}

// v9 → v10: the plant worker (no worker on it; its certificate is bought, never granted), plants by workers 0, and
// "Crop to plant" joins the save at the starting crop (it was UI state that reset to it on every load). Nothing else.
function migrateV9(save: SaveV9): SaveV10 {
  const { meta, run } = save.state
  const { workers, lifetime } = run
  return {
    version: 10,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        plantCrop: 'radish',
        workers: { ...workers, assigned: { ...workers.assigned, plant: 0 } },
        lifetime: { ...lifetime, workerPlants: 0 },
      },
    },
  }
}

// v10 → v11: the iron tier. The furnace's ore kind starts at copper (all it smelted before); iron items start at 0
// (absent from the bag), iron bars collected / smelted 0. The mine worker: none on it (its certificate is bought, never
// granted), mines by workers 0. Nothing else changes.
function migrateV10(save: SaveV10): SaveV11 {
  const { meta, run } = save.state
  const { workers, furnace, lifetime } = run
  return {
    version: 11,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        furnace: { ...furnace, oreKind: 'copperOre' },
        workers: { ...workers, assigned: { ...workers.assigned, mine: 0 } },
        lifetime: { ...lifetime, workerMines: 0, ironBars: 0, ironBarsSmelted: 0 },
      },
    },
  }
}

// v11 → v12: the crop market and the milestone timeline. Sales start with no glut. Milestone tracking starts at the
// save's current tick: a milestone already reached stays absent (the timeline shows "before tracking", never
// back-dated) and trackingStarted pins when tracking began. meta stores upgrade levels now: the all-1 multiplier
// table is dropped, and any multiplier ≠ 1 is kept as legacyMultipliers and still applies (no earned value lost).
function migrateV11(save: SaveV11): SaveV12 {
  const { meta, run } = save.state
  const fresh = createInitialState()
  const legacy = Object.values(meta.multipliers).some((m) => m !== 1) ? { legacyMultipliers: meta.multipliers } : {}
  return {
    version: 12,
    savedAtMs: save.savedAtMs,
    state: {
      meta: { prestigeCount: meta.prestigeCount, upgrades: fresh.meta.upgrades, ...legacy },
      run: { ...run, market: fresh.run.market, milestones: { trackingStarted: run.tick } },
    },
  }
}

// v12 → v13: the 📋 Noticeboard. Not bought (it is a Shop purchase, never granted), the starting slots, no ⭐, no
// orders completed; the order clerk has no worker (its certificate is bought, never granted). Nothing else changes.
function migrateV12(save: SaveV12): SaveV13 {
  const { meta, run } = save.state
  const fresh = createInitialState().run
  return {
    version: 13,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        workers: { ...run.workers, assigned: { ...run.workers.assigned, clerk: 0 } },
        orders: fresh.orders,
        stars: 0,
        counters: { ...run.counters, orders: 0 },
        lifetime: { ...run.lifetime, ordersCompleted: 0, starsEarned: 0 },
      },
    },
  }
}

// v13 → v14: the gold tier. A v13 run cannot hold gold (vein Lv4 and the gold pickaxe did not exist), so gold bars
// collected / smelted start at 0. Nothing else changes.
function migrateV13(save: SaveV13): SaveV14 {
  const { meta, run } = save.state
  return {
    version: 14,
    savedAtMs: save.savedAtMs,
    state: { meta, run: { ...run, lifetime: { ...run.lifetime, goldBars: 0, goldBarsSmelted: 0 } } },
  }
}

// v14 → v15: the workshop (batch 17). Not built, no machines, no valve — every workshop purchase is a new buy.
function migrateV14(save: SaveV14): SaveV15 {
  const { meta, run } = save.state
  return { version: 15, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, workshop: createWorkshop() } } }
}

type RawSave = { version?: unknown; savedAtMs?: unknown; state?: { meta?: unknown; run?: { tiles?: unknown } } }

/** brings any known version up to the current Save; null for unknown or future versions */
function migrate(data: RawSave): Save | null {
  // shape every version shares, checked before migrating so a migration never reads a missing field
  if (typeof data.savedAtMs !== 'number' || !data.state?.meta || !Array.isArray(data.state.run?.tiles)) return null
  if (data.version === 15) return data as SaveV15
  if (data.version === 14) return migrateV14(data as SaveV14)
  if (data.version === 13) return migrateV14(migrateV13(data as SaveV13))
  const v12 = toV12(data)
  return v12 && migrateV14(migrateV13(migrateV12(v12)))
}

/** v1 … v12 up to v12; null for anything else */
function toV12(data: RawSave): SaveV12 | null {
  switch (data.version) {
    case 1:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(migrateV2(migrateV1(data as SaveV1)))))))))))
    case 2:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(migrateV2(data as SaveV2))))))))))
    case 3:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(data as SaveV3)))))))))
    case 4:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(data as SaveV4))))))))
    case 5:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(data as SaveV5)))))))
    case 6:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(data as SaveV6))))))
    case 7:
      return migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(data as SaveV7)))))
    case 8:
      return migrateV11(migrateV10(migrateV9(migrateV8(data as SaveV8))))
    case 9:
      return migrateV11(migrateV10(migrateV9(data as SaveV9)))
    case 10:
      return migrateV11(migrateV10(data as SaveV10))
    case 11:
      return migrateV11(data as SaveV11)
    case 12:
      return data as SaveV12
    default:
      return null
  }
}

/** null when the text is not a save this build can read */
export function deserialize(json: string): Save | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  return migrate(data)
}

/** whole seconds away, never negative, capped at OFFLINE_CAP_TICKS */
export function offlineTicks(elapsedMs: number): number {
  return Math.min(Math.max(0, Math.floor(elapsedMs / 1000)), OFFLINE_CAP_TICKS)
}

// Loan debt grows on live ticks only (DECISIONS.md round-2 outcome). Only step() runs during catch-up (workers and
// the furnace included, and they never borrow or repay), so its debt growth is the only change to the loan, and
// putting the old loan back undoes exactly that.
export function catchUp(state: GameState, elapsedMs: number): GameState {
  const after = step(state, offlineTicks(elapsedMs))
  return after === state ? state : { ...after, run: { ...after.run, loan: state.run.loan } }
}

/** "Away for 12m — 720 ticks simulated" */
export function awayText(elapsedMs: number): string {
  const ticks = offlineTicks(elapsedMs)
  const min = Math.floor(elapsedMs / 60_000)
  const away = min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : min >= 1 ? `${min}m` : `${Math.floor(elapsedMs / 1000)}s`
  const capped = ticks === OFFLINE_CAP_TICKS && elapsedMs >= (OFFLINE_CAP_TICKS + 1) * 1000 ? ' (capped at 8h)' : ''
  return `Away for ${away} — ${ticks} tick${ticks === 1 ? '' : 's'} simulated${capped}`
}
