// Pure: no DOM, no wall clock. The caller passes savedAtMs and elapsedMs in.
import { OFFLINE_CAP_TICKS, START_TILES, TANK_UNITS_PER_COAL, cropSeedCost, cropSellPrice, energyMax, fieldPlots, itemSellPrice, multiplier, pickaxeDurability, plotTiles, pumpFieldCap, sellPrice, tankCapCoal, type MineDropId } from '../core/balance'
import { CROP_IDS, type CropId } from '../core/data/crops'
import type { ItemId, OreId, PickaxeTier } from '../core/data/items'
import type { MilestoneId } from '../core/data/milestones'
import type { ToolJob } from '../core/data/tools'
import type { UpgradeId } from '../core/data/upgrades'
import type { WorkerJob } from '../core/data/workers'
import {
  createInitialMeta,
  createInitialState,
  createMachines,
  createTile,
  type Counters,
  type Field,
  type Fields,
  type GameState,
  type Lifetime,
  type Loan,
  type Machines,
  type Mold,
  type MultiplierKey,
  type Offer,
  type OrderGood,
  type Pickaxe,
  type Plot,
  type Tile,
  type Workshop,
  type Favours,
} from '../core/state'
import { step } from '../core/step'

export const SAVE_VERSION = 27

// Past shapes are frozen here, never derived from the live RunState, so a later field cannot leak into them.
/** v18–v26's eight crops in their licence order (frozen here: batch 35 re-laddered the live CROP_IDS) */
type CropIdV26 = 'radish' | 'chilli' | 'pumpkin' | 'lemon' | 'tomato' | 'corn' | 'grape' | 'strawberry'
const CROP_IDS_V26: readonly CropIdV26[] = ['radish', 'chilli', 'pumpkin', 'lemon', 'tomato', 'corn', 'grape', 'strawberry']
/** up to v26: no fields grants */
type LifetimeV26 = Omit<Lifetime, 'fieldsGranted'>
/** a v12–v26 market / v16–v20 planted table: every v26 crop at 0 */
const zerosV26 = () => Object.fromEntries(CROP_IDS_V26.map((crop) => [crop, 0])) as Record<CropIdV26, number>
/** batch 35: old rung k → new paid rung k (the eight rows keep their rank) */
const RANK_MAP_V26: Record<CropIdV26, CropId> = {
  radish: 'radish',
  chilli: 'corn',
  pumpkin: 'eggplant',
  lemon: 'pumpkin',
  tomato: 'tomato',
  corn: 'lemon',
  grape: 'grape',
  strawberry: 'strawberry',
}
/** the v26 base seed / sell prices (balance.ts at 1a961fff) */
const CROP_SEED_V26: Record<CropIdV26, number> = { radish: 2, chilli: 5, pumpkin: 10, lemon: 20, tomato: 40, corn: 75, grape: 140, strawberry: 260 }
const CROP_SELL_V26: Record<CropIdV26, number> = { radish: 10, chilli: 25, pumpkin: 60, lemon: 110, tomato: 200, corn: 360, grape: 640, strawberry: 1_150 }
/** the v26 FIELDS_CROP_HARVESTS */
const FIELDS_CROP_HARVESTS_V26 = 50
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
/** the v16–v20 Fields: an aggregate tile count, planted cohorts, pipe tiers and the shared pump's fractional coal */
type CohortV20 = { crop: CropId; count: number; readyTick: number }
type FieldsV20 = {
  unlocked: boolean
  count: number
  planted: Record<CropIdV26, number>
  cohorts: CohortV20[]
  pipes: number
  plantCrop: CropId | null
  coalCarry: number
  machines: Machines
}
/** v21–v25 jobs (the Stoker joined in v26) */
type JobV25 = Exclude<WorkerJob, 'stoker'>
/** v13–v20 jobs (the Manager joined in v21) */
type JobV20 = Exclude<JobV25, 'manager'>
/** v14–v25: an offer without its own ⭐ (paid by tier: TIER_STARS_V25) */
type OfferV25 = { good: OrderGood; count: number; done: number; tier: number; accepted: boolean }
/** v25: molds, no stoking */
type FurnaceV25 = {
  built: boolean
  fire: number
  smart: boolean
  levels: { fireCap: number; batch: number; speed: number; tray: number; slot: number }
  molds: Partial<Record<OreId, Mold>>
  collectAll: boolean
}
/** v25: the run before ⭐ Favours (no starsFrac / favours, no Stoker, offers without ⭐, furnace without stoking) */
type RunV25 = {
  cash: number
  energy: number
  tiles: Tile[]
  licenses: CropId[]
  upgrades: Record<UpgradeId, number>
  counters: Counters
  tick: number
  mineLicense: boolean
  rack: Partial<Record<PickaxeTier, number>>
  selectedPickaxe: PickaxeTier | null
  inventory: Partial<Record<ItemId, number>>
  bagCapacity: number
  storageLevel: number
  vein: { level: number; progress: number; rock: ItemId }
  oreSort: Partial<Record<MineDropId, 'keep' | 'sell'>>
  keepN: boolean
  oreKeep: Partial<Record<MineDropId, number>>
  furnace: FurnaceV25
  workshop: Workshop
  fields: Fields
  lifetime: LifetimeV26
  mastery: Partial<Record<PickaxeTier, number>>
  masteredTiers: PickaxeTier[]
  rngState: number
  loan: Loan | null
  seeds: Partial<Record<CropId, number>>
  autoBuySeeds: boolean
  plantCrop: CropId
  tools: Record<ToolJob, number>
  toolN: Record<ToolJob, number>
  toolTier: Record<ToolJob, number>
  workers: { pool: number; assigned: Record<JobV25, number>; certificates: JobV25[] }
  market: Record<CropIdV26, number>
  milestones: Partial<Record<MilestoneId, number>>
  orders: { unlocked: boolean; slots: number; offers: (OfferV25 | { cooldownTicks: number })[] }
  stars: number
  renown: Partial<Record<CropId, number>>
}
/** the ⭐ a v25 offer's tier paid (frozen here: batch 34 pays ⭐ per production-minute) */
const TIER_STARS_V25 = [1, 2, 4]
/** v10–v24: one ore slot and one tray of one kind, two furnace upgrades */
type FurnaceV24 = {
  built: boolean
  oreKind: OreId
  fire: number
  ore: number
  progress: number
  ready: number
  smart: boolean
  levels: { fireCap: number; batch: number }
}
/** v24: the furnace before molds */
type RunV24 = Omit<RunV25, 'furnace'> & { furnace: FurnaceV24 }
/** v23: one pickaxe in hand, no rack, no Keep N */
type RunV23 = Omit<RunV24, 'rack' | 'selectedPickaxe' | 'keepN' | 'oreKeep'> & { pickaxe: Pickaxe | null }
/** v22: no renown yet */
type RunV22 = Omit<RunV23, 'renown'>
/** v18–v22 meta: the deed rows before Kept renown */
type MetaV22 = Omit<GameState['meta'], 'upgrades'> & { upgrades: Omit<GameState['meta']['upgrades'], 'keepRenown'> }
/** v21: no 🧺 Ore sorting yet */
type RunV21 = Omit<RunV22, 'oreSort'>
type RunV20 = Omit<RunV21, 'fields' | 'counters' | 'workers'> & {
  fields: FieldsV20
  counters: Omit<Counters, 'contractsByHand'>
  workers: { pool: number; assigned: Record<JobV20, number>; certificates: JobV20[] }
}
type RunV12 = Omit<RunV20, 'orders' | 'stars' | 'counters' | 'lifetime' | 'workers' | 'workshop' | 'fields'> & {
  counters: Omit<RunV20['counters'], 'orders'>
  lifetime: Omit<LifetimeV26, 'ordersCompleted' | 'starsEarned' | 'goldBars' | 'goldBarsSmelted'>
  workers: { pool: number; assigned: Record<JobV11, number>; certificates: JobV11[] }
}
type RunV11 = Omit<RunV12, 'market' | 'milestones'>
type SaveV11 = { version: 11; savedAtMs: number; state: { meta: MetaV11; run: RunV11 } }
/** meta from v12 to v17: the five multiplier rows only (batch 20 added the deed rows and the ledger) */
type MetaV12 = { prestigeCount: number; upgrades: Record<MultiplierKey, number>; legacyMultipliers?: Record<MultiplierKey, number> }
type SaveV12 = { version: 12; savedAtMs: number; state: { meta: MetaV12; run: RunV12 } }
type RunV13 = Omit<RunV20, 'lifetime' | 'workshop' | 'fields'> & { lifetime: Omit<LifetimeV26, 'goldBars' | 'goldBarsSmelted'> }
type SaveV13 = { version: 13; savedAtMs: number; state: { meta: MetaV12; run: RunV13 } }
type RunV14 = Omit<RunV20, 'workshop' | 'fields'>
type SaveV14 = { version: 14; savedAtMs: number; state: { meta: MetaV12; run: RunV14 } }
/** the pre-v20 workshop: sprinklers as coal-burning machines, one hopper each */
type WorkshopV19 = { built: boolean; hoppers: number[]; valve: boolean }
type RunV19 = Omit<RunV20, 'workshop'> & { workshop: WorkshopV19 }
type RunV15 = Omit<RunV20, 'fields' | 'workshop'> & { workshop: WorkshopV19 }
type SaveV15 = { version: 15; savedAtMs: number; state: { meta: MetaV12; run: RunV15 } }
type RunV16 = Omit<RunV20, 'fields' | 'workshop'> & {
  fields: Omit<FieldsV20, 'machines'>
  workshop: WorkshopV19
}
type SaveV16 = { version: 16; savedAtMs: number; state: { meta: MetaV12; run: RunV16 } }
type RunV17 = Omit<RunV20, 'workshop'> & { workshop: WorkshopV19 }
type SaveV17 = { version: 17; savedAtMs: number; state: { meta: MetaV12; run: RunV17 } }
/** v18's four crops; a v19 run's market / planted tables hold all eight keys */
type V18CropId = 'radish' | 'chilli' | 'pumpkin' | 'lemon'
type RunV18 = Omit<RunV20, 'market' | 'fields' | 'workshop'> & {
  market: Record<V18CropId, number>
  fields: Omit<FieldsV20, 'planted'> & { planted: Record<V18CropId, number> }
  workshop: WorkshopV19
}
type SaveV18 = { version: 18; savedAtMs: number; state: { meta: MetaV22; run: RunV18 } }
type SaveV19 = { version: 19; savedAtMs: number; state: { meta: MetaV22; run: RunV19 } }
type SaveV20 = { version: 20; savedAtMs: number; state: { meta: MetaV22; run: RunV20 } }
type SaveV21 = { version: 21; savedAtMs: number; state: { meta: MetaV22; run: RunV21 } }
type SaveV22 = { version: 22; savedAtMs: number; state: { meta: MetaV22; run: RunV22 } }
type SaveV23 = { version: 23; savedAtMs: number; state: { meta: GameState['meta']; run: RunV23 } }
type SaveV24 = { version: 24; savedAtMs: number; state: { meta: GameState['meta']; run: RunV24 } }
type SaveV25 = { version: 25; savedAtMs: number; state: { meta: GameState['meta']; run: RunV25 } }
/** v26: ⭐ Favours on the eight-crop ladder (no potato / eggplant, no fields grants) */
type RunV26 = Omit<RunV25, 'orders' | 'workers' | 'furnace'> & {
  orders: { unlocked: boolean; slots: number; offers: ((OfferV25 & { stars: number }) | { cooldownTicks: number })[] }
  starsFrac: number
  favours: Favours
  workers: { pool: number; assigned: Record<WorkerJob, number>; certificates: WorkerJob[] }
  furnace: FurnaceV25 & { stoked: number }
}
type SaveV26 = { version: 26; savedAtMs: number; state: { meta: GameState['meta']; run: RunV26 } }
type SaveV27 = { version: 27; savedAtMs: number; state: GameState }
export type Save = SaveV27
/** the v16–v23 gold pickaxe's max durability (frozen here: batch 32 made it 600) */
const GOLD_DURABILITY_V23 = 6500
/** the v16–v20 pipe coverage per tier (frozen here: the live balance has pumps since v21) */
const PIPE_COVER_V20 = [0, 60, 150, 300]

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
      run: { ...run, market: zerosV26(), milestones: { trackingStarted: run.tick } },
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
  // the v15-era shape: sprinklers as coal-burning machines, one hopper each (bed sockets only from v20)
  return { version: 15, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, workshop: { built: false, hoppers: [], valve: false } } } }
}

// v15 → v16: the 🚜 Fields (batch 18). Not unlocked, no tiles, no pipes — every fields purchase is a new buy; the
// planter's fields crop is unset (planting sets it) and the shared pump's fractional coal starts at 0.
function migrateV15(save: SaveV15): SaveV16 {
  const { meta, run } = save.state
  const fields = { unlocked: false, count: 0, planted: zerosV26(), cohorts: [], pipes: 0, plantCrop: null, coalCarry: 0 }
  return { version: 16, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, fields } } }
}

// v16 → v17: the throughput machines (batch 19). None bought — every machine purchase is a new buy; the fleet's
// accumulators (whole tiles to reap / plant, maintenance cash past the last whole paid) start at 0.
function migrateV16(save: SaveV16): SaveV17 {
  const { meta, run } = save.state
  return { version: 17, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, fields: { ...run.fields, machines: createMachines() } } } }
}

// v17 → v18: "Sell the farm" (batch 20). The sale itself resets values only, but meta gains the deed ledger: the
// batch-20 upgrade rows (all level 0), deeds / deedsClaimed 0 and an empty run history — nothing earned yet. A v17
// meta's upgrades carry over unchanged (missing rows fill with 0).
function migrateV17(save: SaveV17): SaveV18 {
  const { meta, run } = save.state
  const fresh = createInitialMeta()
  return {
    version: 18,
    savedAtMs: save.savedAtMs,
    state: { meta: { ...fresh, ...meta, upgrades: { ...fresh.upgrades, ...meta.upgrades } }, run },
  }
}

// v18 → v19: tomato / corn / grape / strawberry join the crop table. Their glut and planted counts start at 0 and
// their licenses stay absent (a license is bought, never granted) — no earned value changes.
function migrateV18(save: SaveV18): SaveV19 {
  const { meta, run } = save.state
  const zeros = { tomato: 0, corn: 0, grape: 0, strawberry: 0 }
  return {
    version: 19,
    savedAtMs: save.savedAtMs,
    state: { meta, run: { ...run, market: { ...run.market, ...zeros }, fields: { ...run.fields, planted: { ...run.fields.planted, ...zeros } } } },
  }
}

// v19 → v20: sprinklers become permanent bed sockets (batch 26). One machine already kept all 24 tiles wet
// (72 waterings/min against a need of 6/min), so any sprinkler owner gets all four beds. The hopper coal moves
// into storage up to the bag's capacity and the overflow is sold at coal's sell price into cash — a refund of a
// purchase the new sprinklers no longer need, not earnings: counters.sales and lifetime.cashEarned stay. The
// valve is kept as is (it gets its job when Fields get pressure, batch 28).
function migrateV19(save: SaveV19): SaveV20 {
  const { meta, run } = save.state
  const { hoppers, ...workshop } = run.workshop
  void hoppers
  const beds = hoppers.length >= 1 ? [true, true, true, true] : [false, false, false, false]
  const coal = hoppers.reduce((a, b) => a + b, 0)
  // the bag can sit above its cap (the v17 fixture: 61 of 60), so the room is clamped at 0
  const bag = Object.values(run.inventory).reduce((a, b) => a + (b ?? 0), 0)
  const moved = Math.max(0, Math.min(coal, run.bagCapacity - bag))
  const refund = (coal - moved) * itemSellPrice('coal', { ...meta, upgrades: { ...meta.upgrades, keepRenown: 0 } }, run.upgrades.sellPrice)
  const inventory = moved > 0 || run.inventory.coal !== undefined ? { ...run.inventory, coal: (run.inventory.coal ?? 0) + moved } : run.inventory
  return {
    version: 20,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        cash: refund > 0 ? run.cash + refund : run.cash,
        inventory,
        workshop: { ...workshop, beds },
      },
    },
  }
}

// v20 → v21: plots, pivots, pumps and the tank (batch 28, PLAN.md task 145c). Growing cohorts the old pipes did not
// cover (the prefix rule at the save's tick) were stalled: their tiles go back to the seed pouch. The rest become
// plots of ten per crop (the last one rounded up, its date the chunk's earliest) and a growing plot keeps half its
// remaining ticks (the old rule closed 2 per covered tick). Owned land never shrinks; Field 1 and every planted field
// get a pivot within the pump cap, then more up to the old coverage; the pump draws its tank from storage coal.
function migrateV20(save: SaveV20): SaveV21 {
  const { meta, run } = save.state
  const { fields: old, counters, workers } = run
  let { seeds, inventory } = run
  let fields: GameState['run']['fields'] = { unlocked: false, list: [], pump: 0, tank: 0, machines: old.machines }
  if (old.unlocked) {
    const { tick } = run
    seeds = { ...seeds }
    const budget = PIPE_COVER_V20[Math.min(old.pipes, PIPE_COVER_V20.length - 1)]
    let covered = 0
    let stalled = false
    const kept: CohortV20[] = []
    for (const c of old.cohorts) {
      if (c.readyTick <= tick) kept.push(c)
      else if (!stalled && covered + c.count <= budget) {
        covered += c.count
        kept.push(c)
      } else {
        stalled = true
        seeds[c.crop] = (seeds[c.crop] ?? 0) + c.count
      }
    }
    const size = plotTiles()
    const planted: Plot[] = []
    for (const crop of CROP_IDS_V26) {
      const dates = kept
        .filter((c) => c.crop === crop)
        .sort((a, b) => a.readyTick - b.readyTick)
        .flatMap((c) => Array<number>(c.count).fill(c.readyTick))
      for (let i = 0; i < dates.length; i += size) {
        const r = dates[i]
        planted.push({ crop, readyTick: r > tick ? tick + Math.ceil((r - tick) / 2) : r })
      }
    }
    const count = Math.max(Math.ceil(old.count / size), planted.length, 1)
    const plots = [...planted, ...Array.from({ length: count - planted.length }, (): Plot => ({ crop: null, readyTick: 0 }))]
    const list: Field[] = []
    for (let i = 0; i < plots.length; i += fieldPlots()) {
      const chunk = plots.slice(i, i + fieldPlots())
      const most = CROP_IDS_V26.reduce<{ crop: CropId | null; n: number }>((best, crop) => {
        const n = chunk.filter((p) => p.crop === crop).length
        return n > best.n ? { crop, n } : best
      }, { crop: null, n: 0 })
      list.push({ pivot: false, crop: most.n > 0 ? most.crop : old.plantCrop, pinned: false, plots: chunk })
    }
    const pump = old.pipes
    const cap = pumpFieldCap(pump)
    list[0].pivot = true
    let pivots = 1
    for (const f of list.slice(1)) {
      if (pivots >= cap) break
      if (f.plots.some((p) => p.crop !== null)) {
        f.pivot = true
        pivots++
      }
    }
    const target = Math.min(list.length, cap, Math.ceil(budget / 50))
    for (const f of list) {
      if (pivots >= target) break
      if (!f.pivot) {
        f.pivot = true
        pivots++
      }
    }
    const coal = inventory.coal ?? 0
    const moved = Math.min(tankCapCoal(pump), coal)
    if (moved > 0) inventory = { ...inventory, coal: coal - moved }
    fields = { unlocked: true, list, pump, tank: moved * TANK_UNITS_PER_COAL, machines: old.machines }
  }
  return {
    version: 21,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        seeds,
        inventory,
        fields,
        counters: { ...counters, contractsByHand: 0 },
        workers: { ...workers, assigned: { ...workers.assigned, manager: 0 } },
      },
    },
  }
}

// v21 → v22: 🧺 Ore sorting (batch 28.2), every kind locked: the same play as before.
function migrateV21(save: SaveV21): SaveV22 {
  const { meta, run } = save.state
  return { version: 22, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, oreSort: {} } } }
}

// v22 → v23: renown (batch 31) seeded from lifetime harvests, which carry across sales — nothing is taken away.
function migrateV22(save: SaveV22): SaveV23 {
  const { meta, run } = save.state
  const renown = Object.fromEntries(Object.entries(run.lifetime.harvests).filter(([, n]) => (n ?? 0) > 0))
  return { version: 23, savedAtMs: save.savedAtMs, state: { meta: { ...meta, upgrades: { ...meta.upgrades, keepRenown: 0 } }, run: { ...run, renown } } }
}

// v23 → v24 (batch 32): the one pickaxe in hand becomes the only tier on the rack, selected. Gold was rebalanced to
// 600 durability (strong but fragile), so its durability keeps its share of the new max: 50 % stays 50 %, and a sharp
// one stays sharp (at least 1). Keep N not bought, nothing kept.
function migrateV23(save: SaveV23): SaveV24 {
  const { meta, run } = save.state
  const { pickaxe, ...rest } = run
  const old = pickaxe?.durability ?? 0
  const durability = pickaxe?.tier === 'gold' && old > 0 ? Math.max(1, Math.round((old * pickaxeDurability('gold')) / GOLD_DURABILITY_V23)) : old
  return {
    version: 24,
    savedAtMs: save.savedAtMs,
    state: { meta, run: { ...rest, rack: pickaxe ? { [pickaxe.tier]: durability } : {}, selectedPickaxe: pickaxe?.tier ?? null, keepN: false, oreKeep: {} } },
  }
}

/** the vein levels whose drops include iron / gold ore (frozen here: the live table is VEIN_DROPS) */
const IRON_VEIN_V24 = 3
const GOLD_VEIN_V24 = 4

// v24 → v25 (batch 33): molds. The old slot (ore, progress, tray) becomes its kind's mold; the copper mold always
// exists, and a built furnace gets an empty mold for every kind its vein drops (it could smelt them all before), so
// nothing earned is taken away. New levels start at 0, Collect all not bought; fire and smart unchanged.
function migrateV24(save: SaveV24): SaveV25 {
  const { meta, run } = save.state
  const { oreKind, ore, progress, ready, levels, ...furnace } = run.furnace
  const empty = { ore: 0, progress: 0, ready: 0 }
  const molds: FurnaceV25['molds'] = { copperOre: { ...empty } }
  if (furnace.built && run.vein.level >= IRON_VEIN_V24) molds.ironOre = { ...empty }
  if (furnace.built && run.vein.level >= GOLD_VEIN_V24) molds.goldOre = { ...empty }
  molds[oreKind] = { ore, progress, ready }
  return {
    version: 25,
    savedAtMs: save.savedAtMs,
    state: { meta, run: { ...run, furnace: { ...furnace, levels: { ...levels, speed: 0, tray: 0, slot: 0 }, molds, collectAll: false } } },
  }
}

// v25 → v26 (batch 34): ⭐ Favours. Every offer keeps the ⭐ its tier showed (TIER_STARS_V25, never fewer); no
// fractional ⭐, no Favours bought (Bunkhouse 0, no Seam survey), no Stoker on the job, the furnace not stoked. ⭐,
// cash, inventory, upgrades and furnace levels unchanged.
function migrateV25(save: SaveV25): SaveV26 {
  const { meta, run } = save.state
  const offers = run.orders.offers.map((o) => ('good' in o ? { ...o, stars: TIER_STARS_V25[o.tier] ?? 0 } : o))
  return {
    version: 26,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        orders: { ...run.orders, offers },
        starsFrac: 0,
        favours: { bunkhouse: 0, seam: false, aim: null },
        workers: { ...run.workers, assigned: { ...run.workers.assigned, stoker: 0 } },
        furnace: { ...run.furnace, stoked: 0 },
      },
    },
  }
}

// v26 → v27 (batch 35): the 10-crop ladder. Licences, crop-to-plant, field chips and crop offers move by RANK_MAP_V26
// (same price row) plus 🥔 potato free; fields access follows the row (fieldsGranted). Planted tiles and plots keep
// their crop and finish; where a crop's base sale fell (corn) the drop is credited now. Seeds of a crop no longer
// licensed, or whose seed got cheaper (corn), are refunded at the old seed price. Renown, harvests, milestones and the
// market stay on their crop id.
function migrateV26(save: SaveV26): SaveV27 {
  const { meta, run } = save.state
  const rank = (c: CropId) => RANK_MAP_V26[c as CropIdV26] ?? c
  const licenses = CROP_IDS.filter((c) => c === 'potato' || run.licenses.some((o) => rank(o) === c))
  const harvests = (c: CropId) => run.lifetime.harvests[c] ?? 0
  const fieldsGranted = CROP_IDS.filter(
    (c) => harvests(c) < FIELDS_CROP_HARVESTS_V26 && run.licenses.some((o) => rank(o) === c && harvests(o) >= FIELDS_CROP_HARVESTS_V26),
  )
  const fresh = createInitialMeta()
  let cash = run.cash
  const seeds = { ...run.seeds }
  for (const c of CROP_IDS_V26) {
    const n = seeds[c] ?? 0
    if (n > 0 && (!licenses.includes(c) || cropSeedCost(c, fresh) < CROP_SEED_V26[c])) {
      cash += n * Math.round(CROP_SEED_V26[c] * multiplier(meta, 'cost'))
      delete seeds[c]
    }
    if (cropSellPrice(c, fresh, 0) < CROP_SELL_V26[c]) {
      const planted =
        run.tiles.filter((t) => t.status === 'planted' && t.cropId === c).length +
        run.fields.list.reduce((a, f) => a + f.plots.filter((p) => p.crop === c).length, 0) * plotTiles()
      cash += planted * (sellPrice(CROP_SELL_V26[c], meta, run.upgrades.sellPrice) - cropSellPrice(c, meta, run.upgrades.sellPrice))
    }
  }
  const offers = run.orders.offers.map((o): Offer | { cooldownTicks: number } => ('good' in o && o.good in RANK_MAP_V26 ? { ...o, good: rank(o.good as CropId) } : o))
  return {
    version: 27,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        cash,
        seeds,
        licenses,
        plantCrop: rank(run.plantCrop),
        fields: { ...run.fields, list: run.fields.list.map((f) => ({ ...f, crop: f.crop && rank(f.crop) })) },
        orders: { ...run.orders, offers },
        market: { ...run.market, potato: 0, eggplant: 0 },
        lifetime: { ...run.lifetime, fieldsGranted },
      },
    },
  }
}

type RawSave = { version?: unknown; savedAtMs?: unknown; state?: { meta?: unknown; run?: { tiles?: unknown } } }

/** brings any known version up to the current Save; null for unknown or future versions */
function migrate(data: RawSave): Save | null {
  // shape every version shares, checked before migrating so a migration never reads a missing field
  if (typeof data.savedAtMs !== 'number' || !data.state?.meta || !Array.isArray(data.state.run?.tiles)) return null
  if (data.version === 27) return data as SaveV27
  if (data.version === 26) return migrateV26(data as SaveV26)
  if (data.version === 25) return migrateV26(migrateV25(data as SaveV25))
  if (data.version === 24) return migrateV26(migrateV25(migrateV24(data as SaveV24)))
  if (data.version === 23) return migrateV26(migrateV25(migrateV24(migrateV23(data as SaveV23))))
  if (data.version === 22) return migrateV26(migrateV25(migrateV24(migrateV23(migrateV22(data as SaveV22)))))
  if (data.version === 21) return migrateV26(migrateV25(migrateV24(migrateV23(migrateV22(migrateV21(data as SaveV21))))))
  const v20 = toV20(data)
  return v20 && migrateV26(migrateV25(migrateV24(migrateV23(migrateV22(migrateV21(migrateV20(v20)))))))
}

/** v1 … v20 up to v20; null for anything else */
function toV20(data: RawSave): SaveV20 | null {
  if (data.version === 20) return data as SaveV20
  if (data.version === 19) return migrateV19(data as SaveV19)
  if (data.version === 18) return migrateV19(migrateV18(data as SaveV18))
  if (data.version === 17) return migrateV19(migrateV18(migrateV17(data as SaveV17)))
  if (data.version === 16) return migrateV19(migrateV18(migrateV17(migrateV16(data as SaveV16))))
  if (data.version === 15) return migrateV19(migrateV18(migrateV17(migrateV16(migrateV15(data as SaveV15)))))
  if (data.version === 14) return migrateV19(migrateV18(migrateV17(migrateV16(migrateV15(migrateV14(data as SaveV14))))))
  if (data.version === 13) return migrateV19(migrateV18(migrateV17(migrateV16(migrateV15(migrateV14(migrateV13(data as SaveV13)))))))
  const v12 = toV12(data)
  return v12 && migrateV19(migrateV18(migrateV17(migrateV16(migrateV15(migrateV14(migrateV13(migrateV12(v12))))))))
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
