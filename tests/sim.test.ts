import { describe, expect, it, vi } from 'vitest'
import { buyLicense, digForSeeds, harvest, plant, selectCrop, till, water, type ActionResult } from '../src/core/actions'
import { CROP_IDS, type CropId } from '../src/core/data/crops'
import { marketSteadyFactor } from '../src/core/market'
import { PICKAXE_TIERS, type PickaxeTier } from '../src/core/data/items'
import { TOOL_JOBS, type ToolJob } from '../src/core/data/tools'
import { buyToolTier, buyTool, pressTool, toolTargets } from '../src/core/tools'
import {
  ACTION_ENERGY_COST,
  OFFLINE_CAP_TICKS,
  TILE_CAP,
  barTicks,
  certificateCost,
  cropGrowTicks,
  cropSeedCost,
  fireCapTicks,
  fireUnitTicks,
  furnaceUpgradeCost,
  furnaceUpgradeMaxLevel,
  FURNACE_UPGRADE_IDS,
  cropSellPrice,
  isSellable,
  itemSellPrice,
  licenseCost,
  furnaceCost,
  furnaceTrayCap,
  mineLicenseCost,
  orderBonus,
  orderSlotStars,
  orderTierCount,
  pickaxeCraftCost,
  pickaxeDurability,
  pickaxeRepairCost,
  smeltFuel,
  smeltOre,
  storageCost,
  storageSlotsPerLevel,
  toolMaxLevel,
  toolTierCost,
  veinDrops,
  veinUpgradeCost,
  type Price,
} from '../src/core/balance'
import { debtDue, repayAll, takeLoan } from '../src/core/bank'
import { ITEM_IDS } from '../src/core/data/items'
import { addFuel, buildFurnace, buyFurnaceUpgrade, collectBars, cycleOre, loadOre, setOreKind } from '../src/core/furnace'
import { catchUp } from '../src/save/serialize'
import { bagCount, buyMineLicense, buyStorage, buyWood, craftPickaxe, dig, repairPickaxe, sellItem, upgradeVein } from '../src/core/mining'
import { createFurnace, createInitialState, createTile, type GameState, type MetaState } from '../src/core/state'
import { step } from '../src/core/step'
import { growthProgress } from '../src/core/tile'
import { WORKER_JOBS, type WorkerJob } from '../src/core/data/workers'
import { assignWorker, buyCertificate, certificateUnlocked, freeWorkers, hireWorker } from '../src/core/workers'
import { acceptOrder, buyOrderBoard, discardOrder, isCropGood, isOffer, orderCount, orderPool, rollOffer } from '../src/core/orders'
import type { OrderGood } from '../src/core/state'
import type { ItemId } from '../src/core/data/items'

// Batch 12: the crop market is on in every run; `withoutMarket` switches it off (factor 1). Batch 16: the pre-market
// era ladders (batch 8–11) run off — at depth 60 the market starves the pre-hand-picked worker bot of cash — so they
// keep replaying their pre-market pins; only their market-on ladder is pinned (stalled) in the batch-12 describe.
const market = vi.hoisted(() => ({ on: true }))
// Batch 13: every run before the "batch 13" describe replays the batch-12 rules (certificates without the tool gate at
// their old prices, hire base 80, no hand-picked bonus), so their pins stay the measured history; `batch13` switches
// the real rules on.
const rules = vi.hoisted(() => ({ batch13: false }))
const OLD_CERTIFICATE = vi.hoisted((): Record<string, { cash: number; stone?: number }> => ({ water: { cash: 100 }, harvest: { stone: 20, cash: 150 } }))
vi.mock('../src/core/balance', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/core/balance')>()
  return {
    ...real,
    marketFactor: (crop: CropId, glut: number) => (market.on ? real.marketFactor(crop, glut) : 1),
    certificateUnlock: (job: WorkerJob) => {
      const unlock = real.certificateUnlock(job)
      if (rules.batch13) return unlock
      const { tool, ...old } = unlock
      void tool
      return old
    },
    certificateCost: (job: WorkerJob, meta: MetaState) => {
      const old = OLD_CERTIFICATE[job]
      return rules.batch13 || !old ? real.certificateCost(job, meta) : { ...old, cash: Math.round(old.cash * real.multiplier(meta, 'cost')) }
    },
    workerHireCost: (pool: number, meta: MetaState) =>
      rules.batch13 ? real.workerHireCost(pool, meta) : Math.round(80 * 1.7 ** pool * real.multiplier(meta, 'cost')),
    handPickedBonus: () => (rules.batch13 ? real.handPickedBonus() : 1),
  }
})
function withoutMarket<T>(run: () => T): T {
  market.on = false
  try {
    return run()
  } finally {
    market.on = true
  }
}

const TICKS = 600
/** the batch-8 worker jobs the ladder bot staffs */
const FARM_JOBS: WorkerJob[] = ['water', 'harvest']

type Milestones = {
  firstRadishHarvest?: number
  pumpkinLicenseAffordable?: number
  pumpkinLicenseBought?: number
  firstPumpkinPlanted?: number
  firstPumpkinHarvest?: number
  mineLicenseAffordable?: number
  mineLicenseBought?: number
  firstDig?: number
}

// Greedy farmer: one best farm action at a time, by priority, across all tiles (lowest index first).
// "Dry" = moisture exactly 0 (step snaps float residue to 0); mature crops are never watered.
// `crops` = what to plant, best first (each tried on every tile before the next).
// Batch 8: a job with a worker on it is left to the workers (the player never harvests / waters it).
function bestFarmAction(s: GameState, crops: CropId[] = ['pumpkin', 'radish']): { state: GameState; kind: string } | null {
  const tiles = s.run.tiles
  const growing = (i: number) => {
    const { cropId, growth } = tiles[i]
    return cropId !== undefined && growth < cropGrowTicks(cropId, s.meta, s.run.upgrades.fertilizer)
  }
  const byPlayer = (job: WorkerJob) => s.run.workers.assigned[job] === 0
  const tries: Array<[string, (i: number) => ActionResult | null]> = [
    ['harvest', (i) => (byPlayer('harvest') ? harvest(s, i) : null)],
    ['water', (i) => (byPlayer('water') && tiles[i].moisture === 0 && growing(i) ? water(s, i) : null)],
    ...crops.map((crop): [string, (i: number) => ActionResult | null] => [`plant:${crop}`, (i) => (byPlayer('plant') ? plant(s, i, crop) : null)]),
    ['till', (i) => (byPlayer('plant') ? till(s, i) : null)],
  ]
  for (const [kind, act] of tries) {
    for (let i = 0; i < tiles.length; i++) {
      const result = act(i)
      if (result?.ok) return { state: result.state, kind: `${kind}:${tiles[i].cropId ?? ''}` }
    }
  }
  return null
}

/** the smallest number in the run a bug could push below 0: cash, energy, storage, pouch, durability, furnace */
const lowestValue = ({ run }: GameState) =>
  Math.min(
    run.cash,
    run.energy,
    ...Object.values(run.inventory),
    ...Object.values(run.seeds),
    run.pickaxe?.durability ?? 0,
    run.furnace.fire,
    run.furnace.ore,
    run.furnace.ready,
    run.furnace.progress,
  )

/** batch 7 ladder goals, in order; `keep` = items mining must not sell while this goal is next */
type LadderStep =
  | 'storageLv1'
  | 'veinLv1'
  | 'furnace'
  | 'storageLv2'
  | 'veinLv2'
  | 'copperPickaxe'
  | `copper:${ToolJob}`
  | 'oreCertificate'
  | 'fuelCertificate'
  | 'smart'
  | 'plantCertificate'
  | 'storageLv3'
  | 'veinLv3'
  | 'ironPickaxe'
  | 'mineCertificate'
  | `iron:${ToolJob}`
type Goal = { name: LadderStep; done: (s: GameState) => boolean; buy: (s: GameState) => ActionResult; keep: (s: GameState) => Price }
const COPPER_PICKAXE_BARS = pickaxeCraftCost('copper', createInitialState().meta).copperBar!
const COPPER_TOOL_BARS = toolTierCost(1, createInitialState().meta).copperBar!
/** cycles loaded in the furnace (ore in the slot, fuelled with them); the old queue */
const cyclesLoaded = ({ run }: GameState) => Math.floor(run.furnace.ore / smeltOre())
/** keep `bars` bars plus the ore and coal to smelt the ones not yet in storage, the furnace or its tray */
const keepBars =
  (bars: number) =>
  (s: GameState): Price => {
    const { run } = s
    const toSmelt = Math.max(0, bars - (run.inventory.copperBar ?? 0) - cyclesLoaded(s) - run.furnace.ready)
    return { cash: 0, copperBar: bars, copperOre: smeltOre() * toSmelt, coal: smeltFuel('coal') * toSmelt }
  }
/**
 * batch 9: what the batch-7 bot's "enqueue coal jobs while it can" does on the fuelled furnace: load k cycles of ore
 * and exactly k coal together, k ≤ the old 5-job cap (cycles loaded + tray), so the fire never burns without ore
 */
function smeltCoalJobs(s: GameState): ActionResult {
  const { inventory, furnace } = s.run
  const k = Math.min(
    Math.floor((inventory.copperOre ?? 0) / smeltOre()),
    Math.floor((inventory.coal ?? 0) / smeltFuel('coal')),
    furnaceTrayCap() - cyclesLoaded(s) - furnace.ready,
  )
  if (k < 1) return { ok: false, error: 'NOTHING_TO_DO' }
  const ore = loadOre(s, k * smeltOre())
  return ore.ok ? addFuel(ore.state, 'coal', k * smeltFuel('coal')) : ore
}
const LADDER: Goal[] = [
  { name: 'storageLv1', done: (s) => s.run.storageLevel >= 1, buy: buyStorage, keep: (s) => storageCost(s.run.storageLevel, s.meta) },
  { name: 'veinLv1', done: (s) => s.run.vein.level >= 1, buy: upgradeVein, keep: (s) => veinUpgradeCost(s.run.vein.level, s.meta)! },
  { name: 'furnace', done: (s) => s.run.furnace.built, buy: buildFurnace, keep: (s) => furnaceCost(s.meta) },
  { name: 'storageLv2', done: (s) => s.run.storageLevel >= 2, buy: buyStorage, keep: (s) => storageCost(s.run.storageLevel, s.meta) },
  { name: 'veinLv2', done: (s) => s.run.vein.level >= 2, buy: upgradeVein, keep: (s) => veinUpgradeCost(s.run.vein.level, s.meta)! },
  {
    name: 'copperPickaxe',
    // copper or better (batch 11: an iron pickaxe in hand must not send the ladder back to crafting copper)
    done: (s) => PICKAXE_TIERS.indexOf(s.run.pickaxe?.tier ?? 'wooden') >= PICKAXE_TIERS.indexOf('copper'),
    buy: (s) => craftPickaxe(s, 'copper'),
    keep: keepBars(COPPER_PICKAXE_BARS),
  },
]
/** batch 7.1: after the copper pickaxe, each job's copper tier in order (buying the job's tool Lv1 with it if missing) */
const COPPER_LADDER: Goal[] = [
  ...LADDER,
  ...TOOL_JOBS.map(
    (job): Goal => ({
      name: `copper:${job}`,
      done: (s) => s.run.toolTier[job] >= 1,
      buy: (s) => {
        const tool = s.run.tools[job] < 1 ? buyTool(s, job) : ({ ok: true, state: s } as const)
        return tool.ok ? buyToolTier(tool.state, job) : tool
      },
      keep: keepBars(COPPER_TOOL_BARS),
    }),
  ),
]
/** batch 9: after the copper tools, the ore loader's and fuel loader's certificates, then the smart furnace */
const FURNACE_LADDER: Goal[] = [
  ...COPPER_LADDER,
  ...(['ore', 'fuel'] as const).map(
    (job): Goal => ({
      name: `${job}Certificate`,
      done: (s) => s.run.workers.certificates.includes(job),
      buy: (s) => buyCertificate(s, job),
      keep: keepBars(certificateCost(job, createInitialState().meta).copperBar!),
    }),
  ),
  {
    name: 'smart',
    done: (s) => s.run.furnace.smart,
    buy: (s) => buyFurnaceUpgrade(s, 'smart'),
    keep: keepBars(furnaceUpgradeCost('smart', 0, createInitialState().meta)!.copperBar!),
  },
]
/** batch 10: after the smart furnace, the plant worker's certificate */
const PLANT_LADDER: Goal[] = [
  ...FURNACE_LADDER,
  {
    name: 'plantCertificate',
    done: (s) => s.run.workers.certificates.includes('plant'),
    buy: (s) => buyCertificate(s, 'plant'),
    keep: keepBars(certificateCost('plant', createInitialState().meta).copperBar!),
  },
]
/** keep `bars` iron bars plus the iron ore and coal to smelt the ones not yet in storage or the (iron) furnace */
const keepIronBars =
  (bars: number) =>
  (s: GameState): Price => {
    const { run } = s
    const inFurnace = run.furnace.oreKind === 'ironOre' ? cyclesLoaded(s) + run.furnace.ready : 0
    const toSmelt = Math.max(0, bars - (run.inventory.ironBar ?? 0) - inFurnace)
    return { cash: 0, ironBar: bars, ironOre: smeltOre() * toSmelt, coal: smeltFuel('coal', 'ironOre') * toSmelt }
  }
const IRON_PRICE = createInitialState().meta
/** batch 11: after the plant certificate, storage Lv3 (vein Lv3's 45 items need it), vein Lv3, iron pickaxe, mine certificate */
const IRON_LADDER: Goal[] = [
  ...PLANT_LADDER,
  { name: 'storageLv3', done: (s) => s.run.storageLevel >= 3, buy: buyStorage, keep: (s) => storageCost(s.run.storageLevel, s.meta) },
  {
    name: 'veinLv3',
    done: (s) => s.run.vein.level >= 3,
    buy: upgradeVein,
    // the stone, and the copper bars with the ore and coal to smelt them
    keep: (s) => ({ ...keepBars(veinUpgradeCost(2, IRON_PRICE)!.copperBar!)(s), stone: veinUpgradeCost(2, s.meta)!.stone }),
  },
  { name: 'ironPickaxe', done: (s) => s.run.pickaxe?.tier === 'iron', buy: (s) => craftPickaxe(s, 'iron'), keep: keepIronBars(pickaxeCraftCost('iron', IRON_PRICE).ironBar!) },
  {
    name: 'mineCertificate',
    done: (s) => s.run.workers.certificates.includes('mine'),
    buy: (s) => buyCertificate(s, 'mine'),
    keep: keepIronBars(certificateCost('mine', IRON_PRICE).ironBar!),
  },
]
/** batch 15: after the mine certificate, each job's iron tier in order (water → harvest → plant) */
const IRON_TOOLS_LADDER: Goal[] = [
  ...IRON_LADDER,
  ...TOOL_JOBS.map(
    (job): Goal => ({
      name: `iron:${job}`,
      done: (s) => s.run.toolTier[job] >= 2,
      buy: (s) => buyToolTier(s, job),
      keep: keepIronBars(toolTierCost(2, createInitialState().meta).ironBar!),
    }),
  ),
]
// the goals that need the furnace on iron (the iron pickaxe, the mine certificate and the three iron tools)
const IRON_ON_GOALS = IRON_TOOLS_LADDER.slice(IRON_TOOLS_LADDER.length - 5)
const smeltsFor = (g: Goal | undefined) =>
  g !== undefined && (g.name === 'copperPickaxe' || g.name.startsWith('copper:') || PLANT_LADDER.slice(COPPER_LADDER.length).includes(g))

/**
 * batch 9: the player's share of the furnace once the ore loader loads ore and collects: coal for every cycle of ore in
 * the slot and storage the fire does not cover yet (one coal per cycle), so the fire never burns without ore
 */
function fuelForOre(s: GameState): ActionResult {
  const { inventory, furnace } = s.run
  const k = Math.floor((furnace.ore + (inventory.copperOre ?? 0)) / cycleOre(furnace)) - Math.ceil(furnace.fire / barTicks())
  return k >= 1 ? addFuel(s, 'coal', k * smeltFuel('coal')) : { ok: false, error: 'NOTHING_TO_DO' }
}

/** mineEarly: buy the mine license as soon as it is affordable while energy is idle;
 *  otherwise only once the pumpkin license is owned (the main crop is never delayed).
 *  licenses: bought in this order, each as soon as it is affordable; crops: what to plant, best first. */
function runBot(
  mineEarly: boolean,
  {
    ticks = TICKS,
    licenses = ['pumpkin'],
    crops = ['pumpkin', 'radish'],
    saveForStorage = false,
    ladder = false,
    copperTools = false,
    workers = false,
    furnace = false,
    planter = false,
    iron = false,
    ironTools = false,
    buyTools = false,
    onEnd,
    onTick,
  }: {
    ticks?: number
    licenses?: CropId[]
    crops?: CropId[]
    saveForStorage?: boolean
    ladder?: boolean
    copperTools?: boolean
    /** batch 8: buys each certificate and hires whenever affordable, puts free workers on water first */
    workers?: boolean
    /**
     * batch 9 (with ladder, copperTools and workers): FURNACE_LADDER after the copper tools; a certified loader gets a
     * worker (taken from the bigger farm job when none is free), and the bot stops doing what a loader does
     */
    furnace?: boolean
    /**
     * batch 10 (with furnace): PLANT_LADDER; once certified the planter gets one worker like a loader, "Crop to plant"
     * follows the best licensed crop, and the bot stops tilling and planting
     */
    planter?: boolean
    /**
     * batch 11 (with planter): IRON_LADDER; while an iron goal is next and the furnace is still on copper, the bot sells
     * the copper ore in storage before each tick (so the ore loader stops loading it), collects the tray, and picks iron
     * once the slot and tray are empty; the mine worker, once certified, gets one worker like a loader
     */
    iron?: boolean
    /**
     * batch 15 (with iron): IRON_TOOLS_LADDER; after the mine certificate the bot buys the three iron farm tools
     * (water → harvest → plant), keeping the iron bars for each
     */
    ironTools?: boolean
    /**
     * batch 13 (with workers): buys the water and harvest tool levels (and plant with `planter`) as soon as each is
     * unlocked and affordable, since a farm certificate needs its job's Lv3 tool; keeps the unbought farm
     * certificates' stone and coal when storage is full; hires only once a farm certificate is owned
     */
    buyTools?: boolean
    /** receives the state at the cut-off */
    onEnd?: (s: GameState) => void
    /** batch 14: receives the state after every tick */
    onTick?: (s: GameState) => void
  } = {},
) {
  const goals = ironTools ? IRON_TOOLS_LADDER : iron ? IRON_LADDER : planter ? PLANT_LADDER : furnace ? FURNACE_LADDER : copperTools ? COPPER_LADDER : LADDER
  const ladderTicks: Partial<Record<LadderStep | 'firstBar' | 'ironPicked' | 'firstIronBar', number>> = {}
  const workerTicks: Partial<Record<'firstCertificate' | `${WorkerJob}Certificate` | 'firstHire' | 'pool3', number>> = {}
  // batch 13: the first tick each certificate could be bought (its gates met) and the storage held then
  const certUnlocked: Partial<Record<WorkerJob, { tick: number; bagCapacity: number }>> = {}
  const toolJobs: ToolJob[] = buyTools ? ['water', 'harvest', ...(planter ? (['plant'] as const) : [])] : []
  let s = createInitialState()
  const m: Milestones = {}
  let minCash = s.run.cash
  let lowest = lowestValue(s)
  // the tick each license became affordable while it was the next one to buy, and the tick it was bought
  const licenseAffordable: Partial<Record<CropId, number>> = {}
  const licenseBought: Partial<Record<CropId, number>> = {}
  let storageAffordable: number | undefined
  let storageBought: number | undefined
  let veinBought: number | undefined
  // net cash and energy per activity; licenses are one-off capital and excluded from both
  const farm = { cash: 0, energy: 0 }
  const mine = { cash: 0, energy: 0 }
  const mineLicense = mineLicenseCost(s.meta)
  const nextLicense = () => licenses.find((id) => !s.run.licenses.includes(id))
  const seen = () => {
    minCash = Math.min(minCash, s.run.cash)
    lowest = Math.min(lowest, lowestValue(s))
  }
  const track = (next: GameState, into: { cash: number; energy: number }, energy = 0) => {
    into.cash += next.run.cash - s.run.cash
    into.energy += energy
    s = next
    seen()
  }
  const tryAct = (r: ActionResult, into: { cash: number; energy: number } | null, energy = 0) => {
    if (!r.ok) return false
    if (into) track(r.state, into, energy)
    else {
      s = r.state
      seen()
    }
    return true
  }

  // Mining fills idle energy only. Order: license → sell stone when the bag is full
  // → wood + pickaxe when it has none, wood + repair when blunt (never mines by hand) → mine.
  const mineOnce = (tick: number): boolean => {
    if (!s.run.mineLicense) {
      if (!mineEarly && !s.run.licenses.includes('pumpkin')) return false
      if (!tryAct(buyMineLicense(s), null)) return false
      m.mineLicenseBought ??= tick
    }
    // the pinned runs only check storage; saveForStorage keeps its stone (and stops mining when storage is full)
    // until it buys storage level 1, then vein level 1
    if (buyStorage(s).ok) storageAffordable ??= tick
    if (ladder) {
      // batch 7: buy the next goal as soon as it can be paid; smelt (coal fuel) and collect while the copper pickaxe
      // is the goal; when storage is full sell only what the goal does not need, else stop mining
      const goal = goals.find((g) => !g.done(s))
      if (goal && tryAct(goal.buy(s), null)) ladderTicks[goal.name] ??= tick
      const next = goals.find((g) => !g.done(s))
      if (smeltsFor(next)) {
        const { assigned } = s.run.workers
        if (assigned.ore === 0) {
          tryAct(smeltCoalJobs(s), null)
          tryAct(collectBars(s), null)
        } else if (assigned.fuel === 0) tryAct(fuelForOre(s), null)
      }
      if (bagCount(s.run) >= s.run.bagCapacity) {
        const keep: Price = { ...(next?.keep(s) ?? { cash: 0 }) }
        for (const job of buyTools ? FARM_JOBS : [])
          if (!s.run.workers.certificates.includes(job))
            for (const [id, n] of Object.entries(certificateCost(job, s.meta)) as [keyof Price, number][])
              if (id !== 'cash') keep[id] = Math.max(keep[id] ?? 0, n)
        for (const id of ['stone', 'coal', 'copperOre', 'ironOre'] as const) {
          const extra = (s.run.inventory[id] ?? 0) - (keep[id] ?? 0)
          if (extra > 0) tryAct(sellItem(s, id, extra), mine)
        }
        if (bagCount(s.run) >= s.run.bagCapacity) return false
      }
    } else if (saveForStorage && s.run.storageLevel === 0) {
      if (tryAct(buyStorage(s), null)) storageBought = tick
      else if (bagCount(s.run) >= s.run.bagCapacity) return false
    } else if (saveForStorage && s.run.vein.level === 0) {
      if (tryAct(upgradeVein(s), null)) veinBought = tick
      else if (bagCount(s.run) >= s.run.bagCapacity) return false
    }
    if (bagCount(s.run) >= s.run.bagCapacity) tryAct(sellItem(s, 'stone', s.run.inventory.stone ?? 0), mine)
    if (!s.run.pickaxe) {
      const need = pickaxeCraftCost('wooden', s.meta).wood! - (s.run.inventory.wood ?? 0)
      if (need > 0 && !tryAct(buyWood(s, need), mine)) return false
      if (!tryAct(craftPickaxe(s), mine)) return false
    } else if (s.run.pickaxe.durability === 0 && s.run.pickaxe.tier !== 'wooden') {
      tryAct(repairPickaxe(s), null) // bars; mines by hand until it can
    } else if (s.run.pickaxe.durability === 0) {
      const need = pickaxeRepairCost('wooden', s.meta).wood! - (s.run.inventory.wood ?? 0)
      if (need > 0 && !tryAct(buyWood(s, need), mine)) return false
      if (!tryAct(repairPickaxe(s), mine)) return false
    }
    if (!tryAct(dig(s), mine, ACTION_ENERGY_COST)) return false
    m.firstDig ??= tick
    return true
  }

  // batch 8: certificates (water first), then every affordable hire; a free worker goes to water while water has no
  // more workers than harvest, else to harvest. Certificates bought here are farm jobs only; the loaders' come from
  // FURNACE_LADDER and, with `furnace`, each certified loader gets one worker before free ones go to the farm.
  const staff = (tick: number) => {
    for (const job of FARM_JOBS)
      if (tryAct(buyCertificate(s, job), null)) {
        workerTicks.firstCertificate ??= tick
        workerTicks[`${job}Certificate`] = tick
      }
    const certified = !buyTools || FARM_JOBS.some((job) => s.run.workers.certificates.includes(job))
    while (certified && tryAct(hireWorker(s), null)) {
      workerTicks.firstHire ??= tick
      if (s.run.workers.pool >= 3) workerTicks.pool3 ??= tick
    }
    const oneEach: WorkerJob[] = [
      ...(furnace ? (['ore', 'fuel'] as const) : []),
      ...(planter ? (['plant'] as const) : []),
      ...(iron || ironTools ? (['mine'] as const) : []),
    ]
    for (const job of oneEach) {
      const { assigned, certificates } = s.run.workers
      if (!certificates.includes(job) || assigned[job] > 0) continue
      if (freeWorkers(s.run) < 1) tryAct(assignWorker(s, assigned.water > assigned.harvest ? 'water' : 'harvest', -1), null)
      tryAct(assignWorker(s, job, 1), null)
    }
    const best = crops.find((c) => s.run.licenses.includes(c))
    if (s.run.workers.assigned.plant > 0 && best && best !== s.run.plantCrop) tryAct(selectCrop(s, best), null)
    while (freeWorkers(s.run) > 0) {
      const { assigned, certificates } = s.run.workers
      const job: WorkerJob = certificates.includes('water') && (assigned.water <= assigned.harvest || !certificates.includes('harvest')) ? 'water' : 'harvest'
      if (!tryAct(assignWorker(s, job, 1), null)) break
    }
  }

  let borrowed = false
  for (let t = 0; t < ticks; t++) {
    borrowed ||= s.run.loan !== null
    const tick = s.run.tick
    const milestones = () => {
      const want = nextLicense()
      if (want && s.run.cash >= licenseCost(want, s.meta)) licenseAffordable[want] ??= tick
      if (s.run.cash >= mineLicense) m.mineLicenseAffordable ??= tick
      if (buyStorage(s).ok) storageAffordable ??= tick
    }
    milestones()
    const want = nextLicense()
    if (want && tryAct(buyLicense(s, want), null)) licenseBought[want] ??= tick
    for (const job of toolJobs) while (s.run.tools[job] < toolMaxLevel(job) && tryAct(buyTool(s, job), null));
    if (buyTools)
      for (const job of WORKER_JOBS) if (certificateUnlocked(s.run, job)) certUnlocked[job] ??= { tick, bagCapacity: s.run.bagCapacity }
    if (workers) staff(tick)
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s, crops)
      if (next) {
        track(next.state, farm, ACTION_ENERGY_COST)
        if (next.kind.startsWith('harvest') && next.kind.endsWith(':radish')) m.firstRadishHarvest ??= tick
        if (next.kind.startsWith('harvest') && next.kind.endsWith(':pumpkin')) m.firstPumpkinHarvest ??= tick
        if (next.kind.startsWith('plant:pumpkin')) m.firstPumpkinPlanted ??= tick
        milestones()
      } else if (!mineOnce(tick)) break
    }
    milestones()
    if ((iron || ironTools) && s.run.furnace.oreKind !== 'ironOre' && IRON_ON_GOALS.includes(goals.find((g) => !g.done(s))!)) {
      tryAct(sellItem(s, 'copperOre', s.run.inventory.copperOre ?? 0), mine)
      tryAct(collectBars(s), null)
      if (tryAct(setOreKind(s, 'ironOre'), null)) ladderTicks.ironPicked ??= tick
    }
    // the only cash a tick moves is the workers' (harvest sales − wages): farming income bought without energy
    const before = s.run.cash
    s = step(s, 1)
    farm.cash += s.run.cash - before
    seen()
    if (s.run.furnace.ready > 0) ladderTicks.firstBar ??= s.run.tick
    if (s.run.lifetime.ironBarsSmelted > 0) ladderTicks.firstIronBar ??= s.run.tick
    onTick?.(s)
  }
  // unfinished work at the cut-off counts for both activities: bag items at their sell price,
  // standing crops at sell price × growth progress (their seeds are already charged to farming)
  const bagValue = ITEM_IDS.filter(isSellable).reduce(
    (sum, id) => sum + (s.run.inventory[id] ?? 0) * itemSellPrice(id, s.meta, s.run.upgrades.sellPrice),
    0,
  )
  const fieldValue = s.run.tiles.reduce(
    (sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, s.run.upgrades.sellPrice) * growthProgress(t, s) : 0),
    0,
  )
  borrowed ||= s.run.loan !== null
  onEnd?.(s)
  return {
    borrowed,
    workerTicks,
    certUnlocked,
    wagesPaid: s.run.lifetime.wagesPaid,
    milestones: { ...m, pumpkinLicenseAffordable: licenseAffordable.pumpkin, pumpkinLicenseBought: licenseBought.pumpkin },
    licenseAffordable,
    licenseBought,
    storageAffordable,
    storageBought,
    veinBought,
    ladderTicks,
    lowest,
    masteryXp: s.run.mastery.wooden ?? 0,
    minCash,
    finalCash: s.run.cash,
    finalTick: s.run.tick,
    rngState: s.run.rngState,
    counters: s.run.counters,
    bagValue,
    fieldValue,
    farm,
    mine,
    farmingCashPerEnergy: (farm.cash + fieldValue) / farm.energy,
    miningCashPerEnergy: (mine.cash + bagValue) / mine.energy,
  }
}

describe.each([
  // pumpkin license by ~250 holds only when the mine license waits for it; see PLAN.md "Batch 3 results"
  {
    name: 'pumpkin-first',
    mineEarly: false,
    pumpkinBy: 250,
    batch3: {
      milestones: {
        firstRadishHarvest: 100,
        mineLicenseAffordable: 124,
        pumpkinLicenseAffordable: 200,
        pumpkinLicenseBought: 207,
        firstPumpkinPlanted: 215,
        firstPumpkinHarvest: 455,
        mineLicenseBought: 455,
        firstDig: 464,
      },
      minCash: 2,
      finalCash: 394,
      counters: { harvests: 31, sales: 31, mines: 19, digs: 0 },
    },
  },
  {
    name: 'mine-early',
    mineEarly: true,
    pumpkinBy: 350,
    batch3: {
      milestones: {
        firstRadishHarvest: 100,
        mineLicenseAffordable: 124,
        mineLicenseBought: 129,
        firstDig: 147,
        pumpkinLicenseAffordable: 336,
        pumpkinLicenseBought: 337,
        firstPumpkinPlanted: 354,
        firstPumpkinHarvest: 594,
      },
      minCash: 0,
      // batch 3–5: 116. Batch 6: durability 25 and repair (2 wood) instead of a 3rd craft save 4 wood over 43 mines
      finalCash: 132,
      counters: { harvests: 30, sales: 70, mines: 43, digs: 0 },
    },
  },
])('greedy bot $name (farm first, dig with idle energy), 600 ticks', ({ name, mineEarly, pumpkinBy, batch3 }) => {
  const summary = runBot(mineEarly)
  console.log(`sim summary ${name}`, JSON.stringify(summary, null, 1))

  it('never borrows, and its batch-3 numbers are unchanged', () => {
    expect(summary.borrowed).toBe(false)
    expect(summary).toMatchObject(batch3)
  })

  it('never goes negative on cash', () => {
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.finalTick).toBe(TICKS)
  })

  it('can afford the mine license by tick ~150', () => {
    expect(summary.milestones.mineLicenseAffordable).toBeLessThanOrEqual(150)
  })

  it(`buys the pumpkin license by tick ${pumpkinBy} and harvests a pumpkin`, () => {
    expect(summary.milestones.pumpkinLicenseBought).toBeLessThanOrEqual(pumpkinBy)
    expect(summary.milestones.firstPumpkinHarvest).toBeDefined()
  })

  it('mining earns less cash per energy than farming', () => {
    expect(summary.mine.energy).toBeGreaterThan(0)
    expect(summary.farm.energy).toBeGreaterThan(0)
    expect(summary.miningCashPerEnergy).toBeLessThan(summary.farmingCashPerEnergy)
  })
})

/** the round-2 playtest soft-lock: cash 1 (< radish seed 2), all 9 tiles tilled, empty bag, no pickaxe */
function softLockState(): GameState {
  const s = createInitialState()
  const tiles = s.run.tiles.map((t) => ({ ...t, status: 'tilled' as const }))
  return { ...s, run: { ...s.run, cash: 1, tiles, mineLicense: true, pickaxe: null, inventory: {} } }
}

// Borrows only when stuck (no loan, no crop in the ground, cash below a radish seed), farms greedily, and
// repays in full once that still leaves a seed's worth of cash, so repaying never soft-locks it again.
function runRecovery() {
  let s = softLockState()
  const startCash = s.run.cash
  const seed = cropSeedCost('radish', s.meta)
  const r: { loans: number; borrowedAt?: number; repaidAt?: number; paid?: number } = { loans: 0 }
  for (let t = 0; t < TICKS; t++) {
    const stuck = !s.run.loan && s.run.cash < seed && s.run.tiles.every((tile) => tile.status !== 'planted')
    if (stuck) {
      const loan = takeLoan(s)
      if (loan.ok) {
        s = loan.state
        r.loans++
        r.borrowedAt ??= s.run.tick
      }
    }
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s)
      if (!next) break
      s = next.state
    }
    if (s.run.loan && s.run.cash - debtDue(s.run.loan) >= seed) {
      const due = debtDue(s.run.loan)
      const paid = repayAll(s)
      if (paid.ok) {
        s = paid.state
        r.repaidAt ??= s.run.tick
        r.paid ??= due
      }
    }
    s = step(s, 1)
  }
  return { ...r, startCash, finalCash: s.run.cash, loan: s.run.loan, ticksToRepay: r.repaidAt! - r.borrowedAt! }
}

describe('soft-lock recovery through a loan (round-2 state), 600 ticks', () => {
  const summary = runRecovery()
  console.log('recovery summary', JSON.stringify(summary, null, 1))

  it('is stuck without a loan: no farm action is possible', () => {
    expect(bestFarmAction(softLockState())).toBeNull()
  })

  it('takes one loan, repays it in full, and ends with more cash than it started with', () => {
    expect(summary.loans).toBe(1)
    expect(summary.borrowedAt).toBe(0)
    expect(summary.repaidAt).toBeDefined()
    expect(summary.loan).toBeNull()
    expect(summary.finalCash).toBeGreaterThan(summary.startCash)
  })
})

// Batch 5 (a), "a tool press equals the same manual actions in sequence, at every level", is the tools.test.ts case
// of that name; it is not repeated here.

// Farms greedily; when no farm action is possible it digs for seeds (never borrows, never mines). Dug seeds are
// valued at their buy price on both sides: income for digging, a cost for the farming that plants them.
function runDigBot(start: GameState, ticks: number) {
  let s = start
  const seed = cropSeedCost('radish', s.meta)
  const farm = { cash: 0, energy: 0 }
  const digging = { seeds: 0, energy: 0 }
  let minCash = s.run.cash
  let firstHarvest: number | undefined
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const pouch = s.run.seeds.radish ?? 0
      const next = bestFarmAction(s)
      if (next) {
        const used = pouch - (next.state.run.seeds.radish ?? 0)
        farm.cash += next.state.run.cash - s.run.cash - used * seed
        farm.energy += ACTION_ENERGY_COST
        if (next.kind.startsWith('harvest')) firstHarvest ??= s.run.tick
        s = next.state
      } else {
        const dug = digForSeeds(s)
        if (!dug.ok) break
        digging.seeds += (dug.state.run.seeds.radish ?? 0) - pouch
        digging.energy += ACTION_ENERGY_COST
        s = dug.state
      }
      minCash = Math.min(minCash, s.run.cash)
    }
    s = step(s, 1)
  }
  const fieldValue = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  return {
    startCash: start.run.cash,
    finalCash: s.run.cash,
    minCash,
    firstHarvest,
    loan: s.run.loan,
    counters: s.run.counters,
    digging,
    farm,
    digCashPerEnergy: (digging.seeds * seed) / digging.energy,
    farmingCashPerEnergy: (farm.cash + fieldValue) / farm.energy,
  }
}

describe('soft-lock recovery by digging for seeds alone (round-2 state, no loan), 600 ticks', () => {
  const start = softLockState()
  const summary = runDigBot(start, TICKS)
  console.log('dig recovery summary', JSON.stringify(summary, null, 1))

  it('starts stuck: no farm action is possible, no loan', () => {
    expect(start.run.loan).toBeNull()
    expect(bestFarmAction(start)).toBeNull()
  })

  it('digs its way back to farming and ends with more cash, never borrowing or mining', () => {
    expect(summary.firstHarvest).toBeDefined()
    expect(summary.finalCash).toBeGreaterThan(summary.startCash)
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.loan).toBeNull()
    expect(summary.counters.mines).toBe(0)
  })

  it('digging earns less cash per energy than farming (seeds valued at their buy price)', () => {
    expect(summary.digging.energy).toBeGreaterThan(0)
    expect(summary.digCashPerEnergy).toBeLessThan(summary.farmingCashPerEnergy)
  })
})

// Greedy farmer that buys every tool level the moment buyTool allows it (unlocked, cash, level k − 1 owned) and uses
// its tools before manual taps: harvest press, water press only while some growing tile is dry, plant press.
// The pumpkin license is bought first, as in the greedy bot. No digging, mining or loans.
function runToolBot(ticks: number) {
  let s = createInitialState()
  let minCash = s.run.cash
  // per job, the tick each level became affordable (index 0 = level 1); the bot buys it that same tick
  const affordable = { water: [], harvest: [], plant: [] } as Record<ToolJob, number[]>
  const dry = (st: GameState) => toolTargets(st, 'water').some((i) => st.run.tiles[i].moisture === 0)
  const buy = () => {
    for (const job of TOOL_JOBS) {
      const r = buyTool(s, job)
      if (!r.ok) continue
      affordable[job].push(s.run.tick)
      s = r.state
    }
  }
  const press = (job: ToolJob, cropId: CropId) => {
    if (s.run.tools[job] < 1) return false
    const r = pressTool(s, job, cropId)
    if (!r.ok || r.done === 0) return false
    s = r.state
    return true
  }
  for (let t = 0; t < ticks; t++) {
    if (!s.run.licenses.includes('pumpkin')) {
      const r = buyLicense(s, 'pumpkin')
      if (r.ok) s = r.state
    }
    buy()
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const crop: CropId = s.run.licenses.includes('pumpkin') && s.run.cash >= cropSeedCost('pumpkin', s.meta) ? 'pumpkin' : 'radish'
      const acted =
        press('harvest', crop) ||
        (dry(s) && press('water', crop)) ||
        press('plant', crop) ||
        (() => {
          const next = bestFarmAction(s)
          if (next) s = next.state
          return next !== null
        })()
      if (!acted) break
      minCash = Math.min(minCash, s.run.cash)
      buy()
    }
    s = step(s, 1)
  }
  return { affordable, minCash, finalCash: s.run.cash, finalTick: s.run.tick, owned: s.run.tools, counters: s.run.counters }
}

describe('tool-buying bot, 1200 ticks', () => {
  const summary = runToolBot(1200)
  console.log('tool bot summary', JSON.stringify(summary, null, 1))

  it('never goes negative on cash', () => {
    expect(summary.minCash).toBeGreaterThanOrEqual(0)
    expect(summary.finalTick).toBe(1200)
  })

  it('can afford every level-1 tool within ~300 ticks (about 5 minutes)', () => {
    for (const job of TOOL_JOBS) expect(summary.affordable[job][0]).toBeLessThanOrEqual(300)
  })

  it('pins the Batch 5 results milestones (PLAN.md)', () => {
    // harvest and plant level 3 need 120 harvests / plants, not reached in 1200 ticks
    expect(summary.affordable).toEqual({ water: [120, 655, 984], harvest: [233, 886], plant: [200, 683] })
  })
})

// ---- Batch 6: two-tier cash/energy hierarchy, four crops, storage ----

const SESSION = 1200
/** license order and best-first planting for the four-crop bots */
const LICENSE_ORDER: CropId[] = ['chilli', 'pumpkin', 'lemon']
const PLANT_ORDER: CropId[] = ['lemon', 'pumpkin', 'chilli', 'radish']

// One crop on the 9 starting tiles for a session, license owned and cash to spare (so seeds never block it), farmed
// by the greedy bot's own priority. Same accounting as runBot: harvest income − seeds per farm action (till, plant,
// water, harvest all count 1 energy), plus the crops standing at the cut-off at sell price × growth progress.
// Batch 8: `assigned` puts workers on jobs from tick 0 (certificates owned); the player then only tills and plants, and
// perMin = net cash per minute over the whole run (worker sales − wages included, which per-energy cannot show).
// Batch 10: `assigned.plant` adds planters ("Crop to plant" = crop, auto-buy on); the player then does nothing on the farm.
function runCropBot(
  crop: CropId,
  ticks = SESSION,
  toolTier = createInitialState().run.toolTier,
  assigned: { water: number; harvest: number; plant?: number } = { water: 0, harvest: 0 },
  /** batch 12: farm size; bought tiles start untilled like the batch-1 rule */
  tileCount = createInitialState().run.tiles.length,
) {
  const init = createInitialState()
  const jobs = { plant: 0, ...assigned, ore: 0, fuel: 0, mine: 0, clerk: 0 }
  const workers = { pool: jobs.plant + jobs.water + jobs.harvest, assigned: jobs, certificates: [...WORKER_JOBS] }
  const tiles = [...init.run.tiles, ...Array.from({ length: tileCount - init.run.tiles.length }, createTile)]
  let s: GameState = { ...init, run: { ...init.run, cash: 1000, licenses: [...new Set<CropId>(['radish', crop])], plantCrop: crop, toolTier, workers, tiles } }
  const farm = { cash: 0, energy: 0 }
  let lowest = s.run.cash
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const next = bestFarmAction(s, [crop])
      if (!next) break
      farm.cash += next.state.run.cash - s.run.cash
      farm.energy += ACTION_ENERGY_COST
      s = next.state
    }
    s = step(s, 1)
    lowest = Math.min(lowest, s.run.cash)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  const { harvests, waters } = s.run.counters
  const perMin = (s.run.cash - 1000 + field) / (ticks / 60)
  return {
    ...farm,
    field,
    harvests,
    waters,
    watersPerHarvest: waters / harvests,
    cashPerEnergy: (farm.cash + field) / farm.energy,
    perMin,
    wages: s.run.lifetime.wagesPaid,
    workerPlants: s.run.lifetime.workerPlants,
    lowest,
  }
}

// Steady-state mining at a fixed mastery level: energy is refilled before every mine action and the mastery xp put back
// after it, so the level never moves. Sells stone and coal before storage runs out of room, crafts the first pickaxe
// and repairs it when blunt (buying the wood; both count against mining), and values what is left in storage at the end.
// Copper bars cannot be bought or sold, so the copper bench charges them at their inputs' sell value (2 ore + 1 coal).
function mineBench({
  pickaxe,
  tier = 'wooden',
  xp = 0,
  mastered = false,
  vein = 0,
  actions = 5000,
}: { pickaxe: boolean; tier?: PickaxeTier; xp?: number; mastered?: boolean; vein?: number; actions?: number }) {
  const init = createInitialState()
  const fixed = { mastery: { [tier]: xp }, masteredTiers: mastered ? [tier] : [] }
  let s: GameState = { ...init, run: { ...init.run, cash: 1e6, mineLicense: true, vein: { level: vein, progress: 0, rock: 'stone' }, ...fixed } }
  const start = s.run.cash
  const recipe = { wood: pickaxeCraftCost('wooden', init.meta).wood!, repairWood: pickaxeRepairCost('wooden', init.meta).wood! }
  // batch 11: an iron pickaxe's iron bars likewise at 2 iron ore + 2 coal
  const ore = tier === 'iron' ? 'ironOre' : 'copperOre'
  const bar = tier === 'iron' ? 'ironBar' : 'copperBar'
  const barValue = smeltOre() * itemSellPrice(ore, init.meta, 0) + smeltFuel('coal', ore) * itemSellPrice('coal', init.meta, 0)
  const giveBars = (n: number) => {
    s = { ...s, run: { ...s.run, cash: s.run.cash - n * barValue, inventory: { ...s.run.inventory, [bar]: (s.run.inventory[bar] ?? 0) + n } } }
  }
  let repairs = 0
  const act = (r: ActionResult) => {
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  for (let i = 0; i < actions; i++) {
    if (bagCount(s.run) + recipe.wood >= s.run.bagCapacity)
      for (const id of ['stone', 'coal', 'copperOre', 'ironOre'] as const) if (s.run.inventory[id]) act(sellItem(s, id, s.run.inventory[id]!))
    if (pickaxe && !s.run.pickaxe && tier !== 'wooden') {
      giveBars(pickaxeCraftCost(tier, s.meta)[bar]!)
      act(craftPickaxe(s, tier))
    } else if (pickaxe && !s.run.pickaxe) {
      act(buyWood(s, recipe.wood))
      act(craftPickaxe(s))
    } else if (pickaxe && s.run.pickaxe!.durability === 0) {
      if (tier !== 'wooden') giveBars(pickaxeRepairCost(tier, s.meta)[bar]!)
      else act(buyWood(s, recipe.repairWood))
      act(repairPickaxe(s))
      repairs++
    }
    s = { ...s, run: { ...s.run, energy: ACTION_ENERGY_COST } }
    act(dig(s))
    s = { ...s, run: { ...s.run, ...fixed } }
  }
  const bag = ITEM_IDS.filter(isSellable).reduce((sum, id) => sum + (s.run.inventory[id] ?? 0) * itemSellPrice(id, s.meta, 0), 0)
  return { repairs, cashPerEnergy: (s.run.cash - start + bag) / actions }
}

/** dig for seeds, energy refilled every time; dug seeds valued at their buy price (batch 5 definition) */
function digBench(actions = 5000) {
  let s = createInitialState()
  for (let i = 0; i < actions; i++) {
    const r = digForSeeds({ ...s, run: { ...s.run, energy: ACTION_ENERGY_COST } })
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return ((s.run.seeds.radish ?? 0) * cropSeedCost('radish', s.meta)) / actions
}

describe('batch 6: two-tier cash/energy hierarchy', () => {
  const farming = Object.fromEntries((['radish', 'chilli', 'pumpkin', 'lemon'] as const).map((c) => [c, runCropBot(c)]))
  const mining = {
    dig: digBench(),
    hand: mineBench({ pickaxe: false }).cashPerEnergy,
    pickaxeLv0: mineBench({ pickaxe: true }).cashPerEnergy,
    pickaxeLv10: mineBench({ pickaxe: true, xp: 400, mastered: true }).cashPerEnergy,
    veinLv1Lv10: mineBench({ pickaxe: true, xp: 400, mastered: true, vein: 1 }).cashPerEnergy,
  }
  console.log('batch 6 hierarchy', JSON.stringify({ farming, mining }, null, 1))
  const carrot = farming.radish.cashPerEnergy
  const pumpkin = farming.pumpkin.cashPerEnergy

  it('(a) dig < hand mining < pickaxe Lv0 < 0.9 × carrot farming', () => {
    expect(mining.dig).toBeLessThan(mining.hand)
    expect(mining.hand).toBeLessThan(mining.pickaxeLv0)
    expect(mining.pickaxeLv0).toBeLessThan(0.9 * carrot)
  })

  it('(b) pickaxe Lv10 and vein Lv1 + Lv10, repairs included, < 0.9 × pumpkin farming', () => {
    expect(mining.pickaxeLv10).toBeLessThan(0.9 * pumpkin)
    expect(mining.veinLv1Lv10).toBeLessThan(0.9 * pumpkin)
  })

  it('(c) farming cash/energy: carrot < chilli < pumpkin < lemon', () => {
    const order = [farming.radish, farming.chilli, farming.pumpkin, farming.lemon].map((f) => f.cashPerEnergy)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
    expect(new Set(order).size).toBe(4)
  })
})

describe.each([
  { name: 'pumpkin-first', mineEarly: false },
  { name: 'mine-early', mineEarly: true },
])('batch 6: four-crop session bot $name, 1200 ticks', ({ name, mineEarly }) => {
  const summary = runBot(mineEarly, { ticks: SESSION, licenses: LICENSE_ORDER, crops: PLANT_ORDER })
  console.log(`session summary ${name}`, JSON.stringify(summary, null, 1))

  it('(c) can afford each license in order within the session', () => {
    const ticks = LICENSE_ORDER.map((id) => summary.licenseAffordable[id])
    for (const t of ticks) expect(t).toBeLessThanOrEqual(SESSION)
    expect([...ticks].sort((x, y) => x! - y!)).toEqual(ticks)
  })

  it('(d) storage level 1 becomes affordable within ~600 ticks (checked, not bought)', () => {
    expect(summary.storageAffordable).toBeLessThanOrEqual(600)
  })

  it('(e) nothing goes negative and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(SESSION)
  })
})

describe('batch 6.1: stone-keeping mine-early bot buys storage Lv1, then vein Lv1', () => {
  // mine-early as pinned above, but it keeps its stone (stops mining when storage is full) until it buys
  // storage level 1, then vein level 1
  const summary = runBot(true, { saveForStorage: true, ticks: 1200 })
  console.log('storage summary', JSON.stringify(summary, null, 1))

  it('(d) storage level 1 is bought within ~600 ticks, vein level 1 after it within the session', () => {
    expect(summary.storageBought).toBeLessThanOrEqual(600)
    expect(summary.veinBought).toBeGreaterThan(summary.storageBought!)
    expect(summary.veinBought).toBeLessThanOrEqual(1200)
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
  })
})

// ---- Batch 7: furnace, copper ore, copper pickaxe ----

const HOUR_TICKS = 3600

describe('batch 7: copper pickaxe cash/energy (repairs at input value) < 0.9 × pumpkin farming', () => {
  const pumpkin = runCropBot('pumpkin').cashPerEnergy
  const bench = (tier: PickaxeTier, lv10: boolean, vein: number) =>
    mineBench({ pickaxe: true, tier, vein, xp: lv10 ? 400 * (tier === 'copper' ? 2 : 1) : 0, mastered: lv10 }).cashPerEnergy
  const mining = {
    woodLv10Vein1: bench('wooden', true, 1),
    woodLv10Vein2: bench('wooden', true, 2),
    copperLv0Vein1: bench('copper', false, 1),
    copperLv0Vein2: bench('copper', false, 2),
    copperLv10Vein1: bench('copper', true, 1),
    copperLv10Vein2: bench('copper', true, 2),
  }
  console.log('batch 7 mining', JSON.stringify({ pumpkin, mining }, null, 1))

  it('every pickaxe on vein Lv1 and Lv2 stays below 0.9 × pumpkin', () => {
    for (const v of Object.values(mining)) expect(v).toBeLessThan(0.9 * pumpkin)
  })
})

describe('batch 7: ladder bot (four crops, mine-early, keeps what the next goal needs), 3600 ticks', () => {
  const summary = runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true })
  console.log('ladder summary', JSON.stringify(summary, null, 1))
  const t = summary.ladderTicks

  it('reaches vein Lv1 → furnace → storage Lv2 → vein Lv2 → first bar → copper pickaxe, in order, within the hour', () => {
    const order = [t.veinLv1, t.furnace, t.storageLv2, t.veinLv2, t.firstBar, t.copperPickaxe]
    for (const tick of order) expect(tick).toBeLessThanOrEqual(HOUR_TICKS)
    expect([...order].sort((a, b) => a! - b!)).toEqual(order)
  })

  it('nothing goes negative and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(HOUR_TICKS)
  })

  // pinned from the batch-7 code before copper farm tools: a run with every toolTier at 0 must replay exactly,
  // PRNG position included. Cash re-pinned in batch 12 (market prices) and batch 16 (depth 60)
  it('pins the Batch 7 results (ticks, final cash, counters, PRNG state)', () => {
    expect(t).toEqual({ storageLv1: 477, veinLv1: 684, furnace: 936, storageLv2: 1110, veinLv2: 1350, firstBar: 1776, copperPickaxe: 2172 })
    expect(summary.finalCash).toBe(5801)
    expect(summary.rngState).toBe(1328891991)
    // bars (batch 9) = the 5 bars the copper pickaxe took, collected from the tray
    expect(summary.counters).toEqual({ harvests: 107, sales: 386, mines: 447, digs: 0, waters: 525, plants: 116, bars: 5, orders: 0 })
  })
})

describe('batch 7: every multi-item price fits the storage the player has when it becomes buyable', () => {
  const meta = createInitialState().meta
  const items = (p: Price) => Object.entries(p).reduce((sum, [k, n]) => (k === 'cash' ? sum : sum + n), 0)
  // capacity when buyable: furnace right after vein Lv1 (storage Lv1 = 30); vein Lv2 and the copper pickaxe after
  // storage Lv2 (40)
  it.each<[string, Price, number]>([
    ['furnace', furnaceCost(meta), 30],
    ['vein Lv2', veinUpgradeCost(1, meta)!, 40],
    ['copper pickaxe', pickaxeCraftCost('copper', meta), 40],
    // batch 7.1: copper farm tools come after the copper pickaxe (storage Lv2)
    ['copper farm tool', toolTierCost(1, meta), 40],
    // batch 9: the loaders' certificates and every furnace upgrade level, all after the copper pickaxe (storage Lv2)
    ['ore loader certificate', certificateCost('ore', meta), 40],
    ['fuel loader certificate', certificateCost('fuel', meta), 40],
    // batch 10: the plant certificate (copper bars, so after the copper pickaxe too)
    ['plant certificate', certificateCost('plant', meta), 40],
    ...FURNACE_UPGRADE_IDS.flatMap((id) =>
      Array.from({ length: furnaceUpgradeMaxLevel(id) }, (_, l): [string, Price, number] => [`${id} Lv${l + 1}`, furnaceUpgradeCost(id, l, meta)!, 40]),
    ),
    // batch 11: vein Lv3 (40 stone + 5 copper bars) comes after storage Lv3 (50), as each vein level after its storage level
    ['vein Lv3', veinUpgradeCost(2, meta)!, 50],
    // storage Lv3 itself is bought with storage Lv2 (40); the iron prices come after vein Lv3 (storage Lv3)
    ['storage Lv3', { ...storageCost(2, meta) }, 40],
    ['iron pickaxe', pickaxeCraftCost('iron', meta), 50],
    ['iron pickaxe repair', pickaxeRepairCost('iron', meta), 50],
    ['mine certificate', certificateCost('mine', meta), 50],
    // batch 15: the iron farm tool (🥈4) comes after storage Lv3 too
    ['iron farm tool', toolTierCost(2, meta), 50],
  ])('%s', (_, price, capacity) => {
    expect(items(price)).toBeLessThanOrEqual(capacity)
  })
})

// ---- Batch 7.1: copper farm tools ----

const ALL_COPPER = { water: 1, harvest: 1, plant: 1 }

describe('batch 7.1: copper farm tools vs none, one crop on 9 tiles, 1200 ticks', () => {
  const farming = Object.fromEntries(
    (['radish', 'pumpkin'] as const).map((c) => [c, { none: runCropBot(c), copper: runCropBot(c, SESSION, ALL_COPPER) }]),
  )
  console.log('batch 7.1 farming', JSON.stringify(farming, null, 1))

  it.each(['radish', 'pumpkin'])('%s: fewer waterings per harvest and more cash per energy with all three copper tools', (crop) => {
    const { none, copper } = farming[crop]
    expect(copper.watersPerHarvest).toBeLessThan(none.watersPerHarvest)
    expect(copper.cashPerEnergy).toBeGreaterThan(none.cashPerEnergy)
  })

  it('mining stays below farming: the batch-7 copper pickaxe benches < 0.9 × pumpkin without copper tools', () => {
    const pumpkin = farming.pumpkin.none.cashPerEnergy
    for (const vein of [1, 2])
      for (const lv10 of [false, true])
        expect(mineBench({ pickaxe: true, tier: 'copper', vein, xp: lv10 ? 800 : 0, mastered: lv10 }).cashPerEnergy).toBeLessThan(0.9 * pumpkin)
  })
})

describe('batch 7.1: ladder bot continues to the three copper farm tools', () => {
  // the batch-7 ladder bot, then water → harvest → plant copper tiers (each with its tool Lv1 if missing)
  const summary = runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, copperTools: true })
  console.log('copper ladder', JSON.stringify({ ...summary.ladderTicks, finalCash: summary.finalCash, counters: summary.counters }, null, 1))
  const t = summary.ladderTicks

  it('the batch-7 steps are unchanged (copper tools only come after the copper pickaxe)', () => {
    const { firstBar, storageLv1, veinLv1, furnace, storageLv2, veinLv2, copperPickaxe } = t
    expect({ storageLv1, veinLv1, furnace, storageLv2, veinLv2, firstBar, copperPickaxe }).toEqual({
      storageLv1: 477, veinLv1: 684, furnace: 936, storageLv2: 1110, veinLv2: 1350, firstBar: 1776, copperPickaxe: 2172,
    })
  })

  it('buys the three copper tools in order after the copper pickaxe, within the hour (pinned) (final cash re-pinned batch 16: depth 60)', () => {
    const order = [t.copperPickaxe, t['copper:water'], t['copper:harvest'], t['copper:plant']]
    expect(order).toEqual([2172, 2598, 2835, 3075])
    expect(summary.finalCash).toBe(5918)
  })

  it('nothing goes negative over 3600 ticks and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(HOUR_TICKS)
  })
})

// ---- Batch 8: workers + auto-smelt ----

describe('batch 8: workers vs manual, one crop on 9 tiles, 1200 ticks (runCropBot, net cash per minute)', () => {
  const W = { water: 1, harvest: 1 }
  const farming = Object.fromEntries(
    (['radish', 'pumpkin'] as const).map((c) => [
      c,
      {
        manual: runCropBot(c),
        workers: runCropBot(c, SESSION, undefined, W),
        copperCan: { manual: runCropBot(c, SESSION, { ...ALL_COPPER, harvest: 0, plant: 0 }), workers: runCropBot(c, SESSION, { ...ALL_COPPER, harvest: 0, plant: 0 }, W) },
      },
    ]),
  )
  const rates = Object.fromEntries(
    Object.entries(farming).map(([c, f]) => [
      c,
      {
        manual: f.manual.perMin,
        workers: f.workers.perMin,
        share: f.workers.perMin / f.manual.perMin,
        wages: f.workers.wages,
        copperCan: { manual: f.copperCan.manual.perMin, workers: f.copperCan.workers.perMin, share: f.copperCan.workers.perMin / f.copperCan.manual.perMin, wages: f.copperCan.workers.wages },
      },
    ]),
  )
  console.log('batch 8 cash/min manual vs workers', JSON.stringify(rates, null, 1))

  it('pumpkin: water + harvest workers with the player only planting net ≥ 80 % of the manual rate (with a copper can too)', () => {
    expect(rates.pumpkin.share).toBeGreaterThanOrEqual(0.8)
    expect(rates.pumpkin.copperCan.share).toBeGreaterThanOrEqual(0.8)
  })

  it('the player spends energy only on tilling and planting when workers water and harvest', () => {
    const { manual, workers } = farming.pumpkin
    expect(workers.energy).toBeLessThan(manual.energy / 2)
    expect(workers.wages).toBeGreaterThan(0)
  })
})

describe('batch 8: ladder bot with workers (certificates and hires when affordable, water first), 3600 ticks', () => {
  let end = createInitialState()
  // batch 16: market off — at depth 60 the market-on run of this pre-hand-picked era starves the bot of cash
  // (workers wait at cash 0 while crops rot); off, it replays the pre-market pins
  const summary = withoutMarket(() =>
    runBot(true, {
      ticks: HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      onEnd: (s) => (end = s),
    }),
  )
  const { workerTicks, ladderTicks, finalCash, wagesPaid, farmingCashPerEnergy, miningCashPerEnergy, counters } = summary
  console.log('batch 8 workers ladder', JSON.stringify({ workerTicks, ladderTicks, finalCash, wagesPaid, farmingCashPerEnergy, miningCashPerEnergy, counters, workers: end.run.workers }, null, 1))

  it('reaches the first certificate, the first hire and a pool of 3 within the hour, in that order', () => {
    const order = [workerTicks.firstCertificate, workerTicks.firstHire, workerTicks.pool3]
    for (const tick of order) expect(tick).toBeLessThanOrEqual(HOUR_TICKS)
    expect([...order].sort((a, b) => a! - b!)).toEqual(order)
  })

  it('pins the Batch 8 results (worker ticks, final cash, wages) (re-pinned batch 16: market off)', () => {
    expect(workerTicks).toEqual({ firstCertificate: 628, waterCertificate: 628, harvestCertificate: 1141, firstHire: 643, pool3: 1024 })
    expect([finalCash, wagesPaid]).toEqual([3452, 379])
  })

  it('nothing goes negative and it never borrows', () => {
    expect(summary.lowest).toBeGreaterThanOrEqual(0)
    expect(summary.borrowed).toBe(false)
    expect(summary.finalTick).toBe(HOUR_TICKS)
  })

  it('mining stays below farming (cash per player energy, worker income net of wages counted as farming)', () => {
    expect(miningCashPerEnergy).toBeLessThan(farmingCashPerEnergy)
  })

  it('cash 0 with every worker assigned: they idle, nothing is charged, cash stays 0', () => {
    let s: GameState = { ...end, run: { ...end.run, cash: 0 } }
    while (freeWorkers(s.run) > 0) {
      const r = assignWorker(s, 'water', 1)
      if (!r.ok) break
      s = r.state
    }
    expect(freeWorkers(s.run)).toBe(0)
    for (let t = 0; t < 600; t++) {
      s = step(s, 1)
      expect(s.run.cash).toBe(0)
    }
    expect(s.run.lifetime.wagesPaid).toBe(end.run.lifetime.wagesPaid)
  })

  // batch 9: auto-smelt is gone; the player loads ore and fills the fire with coal before leaving
  it('8 h offline with workers and a loaded furnace: more cash, and every bar the loaded ore, fire and tray allow', () => {
    const loaded = loadOre(end)
    const ored = loaded.ok ? loaded.state : end
    const fuelled = addFuel(ored, 'coal')
    const before = fuelled.ok ? fuelled.state : ored
    const { inventory, furnace } = before.run
    const ore = furnace.ore
    const coal = inventory.coal ?? 0
    const bars = (s: GameState) => (s.run.inventory.copperBar ?? 0) + s.run.furnace.ready
    const allowed =
      bars(before) + Math.min(Math.floor(ore / smeltOre()), Math.floor(furnace.fire / barTicks()), furnaceTrayCap() - furnace.ready)
    const t0 = performance.now()
    const after = withoutMarket(() => catchUp(before, OFFLINE_CAP_TICKS * 1000))
    const runtimeMs = performance.now() - t0
    const offline = {
      cash: [before.run.cash, after.run.cash],
      bars: [bars(before), bars(after)],
      allowed,
      stock: { ore, coal, fire: furnace.fire, ready: furnace.ready, storage: `${bagCount(before.run)}/${before.run.bagCapacity}` },
      wagesPaid: after.run.lifetime.wagesPaid - before.run.lifetime.wagesPaid,
      runtimeMs: Math.round(runtimeMs),
    }
    console.log('batch 8 offline 8 h', JSON.stringify(offline))
    expect(after.run.cash).toBeGreaterThan(before.run.cash)
    expect(bars(after)).toBeGreaterThanOrEqual(allowed)
    expect(runtimeMs).toBeLessThan(3000)
  })
})

// ---- Batch 9: fuelled furnace, furnace loaders, smart furnace ----

type Loaders = { ore?: boolean; fuel?: boolean }

/** a built furnace at base levels with ore and coal in a roomy storage and cash for wages; loaders certified + staffed */
function smeltery({ ore = 0, coal = 0, fire = 0, fireCap = 0, smart = false, loaders = {} as Loaders } = {}): GameState {
  const init = createInitialState()
  const assigned = { plant: 0, water: 0, harvest: 0, ore: Number(!!loaders.ore), fuel: Number(!!loaders.fuel), mine: 0, clerk: 0 }
  const furnace = { ...createFurnace(), built: true, fire, smart, levels: { fireCap, batch: 0 } }
  const workers = { pool: assigned.ore + assigned.fuel, assigned, certificates: ['ore', 'fuel'] as WorkerJob[] }
  return { ...init, run: { ...init.run, cash: 1000, bagCapacity: 1e4, inventory: { copperOre: ore, coal }, furnace, workers } }
}

/** what a furnace run did: bars smelted, fire wasted (units), coal used, wages, and the lowest value seen */
function furnaceReport(before: GameState, after: GameState, lowest = lowestValue(after)) {
  const { barsSmelted, fireWasted, wagesPaid } = after.run.lifetime
  return {
    bars: barsSmelted - before.run.lifetime.barsSmelted,
    wastedUnits: (fireWasted - before.run.lifetime.fireWasted) / fireUnitTicks(),
    coalUsed: (before.run.inventory.coal ?? 0) - (after.run.inventory.coal ?? 0),
    wages: wagesPaid - before.run.lifetime.wagesPaid,
    lowest,
  }
}

const STOCK = { ore: 1000, coal: 500 }
/**
 * Bars per hour from an unlimited stock. The player tends the furnace every `cadence` ticks (collect the tray, load
 * the ore slot full, fill the fire with coal) and skips what a loader does; loaders act on their own clock.
 */
function furnaceBench({ cadence = HOUR_TICKS, loaders = {}, smart = false, fireCap = 0 }: { cadence?: number; loaders?: Loaders; smart?: boolean; fireCap?: number }) {
  const start = smeltery({ ...STOCK, smart, loaders, fireCap })
  const tend: Array<(s: GameState) => ActionResult> = [
    ...(loaders.ore ? [] : [collectBars, (s: GameState) => loadOre(s)]),
    ...(loaders.fuel ? [] : [(s: GameState) => addFuel(s, 'coal')]),
  ]
  let s = start
  let lowest = lowestValue(s)
  for (let t = 0; t < HOUR_TICKS; t++) {
    if (t % cadence === 0)
      for (const f of tend) {
        const r = f(s)
        if (r.ok) s = r.state
      }
    s = step(s, 1)
    lowest = Math.min(lowest, lowestValue(s))
  }
  return furnaceReport(start, s, lowest)
}

describe('batch 9: bars per hour, manual vs ore loader vs both loaders vs smart (unlimited stock, base levels)', () => {
  const bench = {
    manual120: furnaceBench({ cadence: 120 }),
    manual600: furnaceBench({ cadence: 600 }),
    oreLoader600: furnaceBench({ cadence: 600, loaders: { ore: true } }),
    oreLoader600FireCap1: furnaceBench({ cadence: 600, loaders: { ore: true }, fireCap: 1 }),
    both: furnaceBench({ loaders: { ore: true, fuel: true } }),
    bothSmart: furnaceBench({ loaders: { ore: true, fuel: true }, smart: true }),
    manual600Smart: furnaceBench({ cadence: 600, smart: true }),
  }
  console.log('batch 9 bars/hour', JSON.stringify(bench, null, 1))
  const pick = (k: keyof typeof bench) => [bench[k].bars, bench[k].wages]

  it('pins bars and wages per hour (PLAN.md "Batch 9 results")', () => {
    expect(Object.keys(bench).map((k) => pick(k as keyof typeof bench))).toEqual([
      [60, 0],
      [30, 0],
      [30, 66],
      [60, 124],
      [60, 188],
      [60, 188],
      [30, 0],
    ])
  })

  it('both loaders run the furnace at full speed with no player; a 10-minute player needs the ore loader and fire cap Lv1 for it', () => {
    const full = HOUR_TICKS / barTicks()
    expect(bench.both.bars).toBe(full)
    expect(bench.manual600.bars).toBeLessThan(full)
    expect(bench.oreLoader600.bars).toBeLessThan(full) // one base tank lasts 5 cycles, half the 10 minutes
    expect(bench.oreLoader600FireCap1.bars).toBe(full)
  })

  it('with ore always in stock nothing is wasted, smart or plain, and nothing goes negative', () => {
    for (const r of Object.values(bench)) {
      expect(r.wastedUnits).toBe(0)
      expect(r.lowest).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('batch 9: a plain furnace wastes at most one tank', () => {
  it.each([0, 1, 2])('fire cap level %i: a full tank and no ore burns away in 8 h, and no more', (fireCap) => {
    const s = smeltery({ fire: fireCapTicks(fireCap), fireCap })
    const r = furnaceReport(s, catchUp(s, OFFLINE_CAP_TICKS * 1000))
    console.log('batch 9 idle tank', fireCap, JSON.stringify(r))
    expect(r.wastedUnits * fireUnitTicks()).toBe(fireCapTicks(fireCap))
  })
})

describe('batch 9: 8 h offline with loaders when the ore runs out (ore for 10 bars, 30 coal)', () => {
  const offline = (loaders: Loaders, smart: boolean, fire = 0) => {
    const s = smeltery({ ore: 20, coal: 30, loaders, smart, fire })
    return furnaceReport(s, catchUp(s, OFFLINE_CAP_TICKS * 1000))
  }
  const runs = {
    bothPlain: offline({ ore: true, fuel: true }, false),
    bothSmart: offline({ ore: true, fuel: true }, true),
    orePlainFullTank: offline({ ore: true }, false, fireCapTicks(0)),
    // ore for 3 bars only: the full tank outlasts it
    orePlainFullTankShortOre: (() => {
      const s = smeltery({ ore: 6, coal: 30, loaders: { ore: true }, fire: fireCapTicks(0) })
      return furnaceReport(s, catchUp(s, OFFLINE_CAP_TICKS * 1000))
    })(),
  }
  console.log('batch 9 offline 8 h', JSON.stringify(runs, null, 1))
  const tank = fireCapTicks(0) / fireUnitTicks()

  it('both loaders smelt every bar the ore allows, plain or smart; smart wastes nothing and keeps the coal', () => {
    expect([runs.bothPlain.bars, runs.bothSmart.bars]).toEqual([10, 10])
    expect(runs.bothSmart.wastedUnits).toBe(0)
    expect(runs.bothSmart.coalUsed).toBe(15) // 10 bars + a full tank (5 coal) left in the fire
  })

  it('plain with only the ore loader wastes at most the tank it was left with', () => {
    expect(runs.orePlainFullTankShortOre.bars).toBe(3)
    expect(runs.orePlainFullTankShortOre.wastedUnits).toBeLessThanOrEqual(tank)
    expect(runs.orePlainFullTank.wastedUnits).toBe(0)
  })

  // DECISIONS "Fuelled furnace": the fuel loader keeps a plain furnace burning after the ore runs out; that loss is
  // what the smart furnace buys. Bounded by the coal in storage, not by one tank (see PLAN.md Deviations, task 61).
  it('plain with both loaders burns the rest of the coal stock once the ore is gone (pinned, more than one tank)', () => {
    expect(runs.bothPlain).toMatchObject({ wastedUnits: 40, coalUsed: 30 })
    expect(runs.bothPlain.wastedUnits).toBeGreaterThan(tank)
  })

  it('cash and every stock stay ≥ 0', () => {
    for (const r of Object.values(runs)) expect(r.lowest).toBeGreaterThanOrEqual(0)
  })
})

describe('batch 9: ladder bot continues to the ore / fuel certificates and the smart furnace', () => {
  let end = createInitialState()
  // batch 16: market off — see the batch-8 note; off, it replays the pre-market pins
  const summary = withoutMarket(() =>
    runBot(true, {
      ticks: 2 * HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      onEnd: (s) => (end = s),
    }),
  )
  const { ladderTicks, workerTicks, finalCash, wagesPaid, counters, lowest, borrowed } = summary
  const { fireBurnt, fireWasted, barsSmelted } = end.run.lifetime
  console.log(
    'batch 9 ladder',
    JSON.stringify({ ladderTicks, workerTicks, finalCash, wagesPaid, counters, lowest, borrowed, fireBurnt, fireWasted, barsSmelted, workers: end.run.workers.assigned }, null, 1),
  )

  it('the batch-8 steps are unchanged; ore certificate → fuel certificate → smart furnace follow, pinned (re-pinned batch 16: market off, replays the pre-market pins)', () => {
    expect(ladderTicks).toEqual({
      storageLv1: 477,
      veinLv1: 666,
      furnace: 885,
      storageLv2: 951,
      veinLv2: 1255,
      firstBar: 1389,
      copperPickaxe: 1644,
      'copper:water': 1884,
      'copper:harvest': 2196,
      'copper:plant': 2361,
      oreCertificate: 2550,
      fuelCertificate: 3141,
      smart: 3741,
    })
    expect(workerTicks).toEqual({ firstCertificate: 628, waterCertificate: 628, harvestCertificate: 1141, firstHire: 643, pool3: 1024 })
    expect([finalCash, wagesPaid, counters.bars, barsSmelted]).toEqual([13900, 898, 80, 80])
  })

  it('each loader gets a worker; mining keeps ore coming, so the fire is never wasted', () => {
    expect(end.run.workers.assigned).toEqual({ plant: 0, water: 2, harvest: 2, ore: 1, fuel: 1, mine: 0, clerk: 0 })
    expect(fireBurnt).toBe(barsSmelted * barTicks())
    expect(fireWasted).toBe(0)
  })

  it('nothing goes negative and it never borrows', () => {
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(borrowed).toBe(false)
  })
})

// ---- Batch 10: plant worker ----

describe('batch 10: plant + water + harvest workers vs manual, one crop on 9 tiles, 1 h (runCropBot, net cash per hour)', () => {
  const ALL = { plant: 1, water: 1, harvest: 1 }
  const runs = Object.fromEntries(
    (['pumpkin', 'lemon'] as const).map((c) => [
      c,
      {
        manual: runCropBot(c, HOUR_TICKS),
        waterHarvest: runCropBot(c, HOUR_TICKS, undefined, { water: 1, harvest: 1 }),
        all: runCropBot(c, HOUR_TICKS, undefined, ALL),
        allCopper: runCropBot(c, HOUR_TICKS, ALL_COPPER, ALL),
      },
    ]),
  )
  const perHour = (r: ReturnType<typeof runCropBot>) => Math.round(r.perMin * 60)
  const table = Object.fromEntries(
    Object.entries(runs).map(([c, r]) => [
      c,
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { perHour: perHour(v), wages: v.wages, playerEnergy: v.energy, workerPlants: v.workerPlants, lowest: v.lowest }])),
    ]),
  )
  console.log('batch 10 cash/hour', JSON.stringify(table, null, 1))

  it('with all three farm workers the player spends no energy on the farm; cash never goes below 0', () => {
    for (const r of Object.values(runs)) {
      expect(r.all.energy).toBe(0)
      expect(r.all.workerPlants).toBeGreaterThan(0)
      for (const v of Object.values(r)) expect(v.lowest).toBeGreaterThanOrEqual(0)
    }
  })

  it('all three farm workers net ≥ 80 % of the manual rate, and above it with the three copper tools', () => {
    for (const r of Object.values(runs)) {
      expect(r.all.perMin / r.manual.perMin).toBeGreaterThanOrEqual(0.8)
      expect(r.allCopper.perMin).toBeGreaterThan(r.manual.perMin)
    }
  })

  it('pins cash per hour (PLAN.md "Batch 10 results") (re-pinned batch 16: depth 60)', () => {
    const pinned = (c: string) => Object.fromEntries(Object.entries(table[c]).map(([k, v]) => [k, [v.perHour, v.wages, v.workerPlants]]))
    expect(pinned('pumpkin')).toEqual({ manual: [6461, 0, 0], waterHarvest: [5597, 715, 0], all: [5391, 855, 135], allCopper: [6473, 536, 135] })
    expect(pinned('lemon')).toEqual({ manual: [7764, 0, 0], waterHarvest: [6981, 670, 0], all: [6807, 765, 90], allCopper: [8267, 448, 90] })
  })
})

describe('batch 10: 8 h offline from the batch-8 workers ladder end, with one worker moved to planting', () => {
  let end = createInitialState()
  // batch 16: market off — see the batch-8 note; off, it replays the pre-market pins
  withoutMarket(() => runBot(true, { ticks: HOUR_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, copperTools: true, workers: true, onEnd: (s) => (end = s) }))
  // batch 8's start: the player loads the furnace before leaving
  const ok = (r: ActionResult, s: GameState) => (r.ok ? r.state : s)
  const loaded = ok(addFuel(ok(loadOre(end), end), 'coal'), ok(loadOre(end), end))
  const best = PLANT_ORDER.find((c) => loaded.run.licenses.includes(c))!
  const certified: GameState = { ...loaded, run: { ...loaded.run, workers: { ...loaded.run.workers, certificates: [...loaded.run.workers.certificates, 'plant'] } } }
  const planter = ok(selectCrop(ok(assignWorker(ok(assignWorker(certified, 'water', -1), certified), 'plant', 1), certified), best), certified)
  /** the 8 h catch-up one tick at a time (step(s, n) = n × step(s, 1)), keeping the lowest cash */
  const away = (s: GameState) => {
    let t = s
    let lowest = t.run.cash
    for (let i = 0; i < OFFLINE_CAP_TICKS; i++) {
      t = step(t, 1)
      lowest = Math.min(lowest, t.run.cash)
    }
    return { after: t, lowest, gain: t.run.cash - s.run.cash, wages: t.run.lifetime.wagesPaid - s.run.lifetime.wagesPaid }
  }
  // batch 16: the whole offline measurement runs market off, like its ladder start
  const base = withoutMarket(() => away(loaded))
  const planted = withoutMarket(() => away(planter))
  const noSeeds = (s: GameState): GameState => ({ ...s, run: { ...s.run, autoBuySeeds: false, seeds: {} } })
  const idle = withoutMarket(() => away(noSeeds(planter)))
  const unstaffed = withoutMarket(() => away(noSeeds(ok(assignWorker(planter, 'plant', -1), planter))))
  console.log(
    'batch 10 offline 8 h',
    JSON.stringify({
      start: { cash: loaded.run.cash, assigned: planter.run.workers.assigned, crop: best, tiles: loaded.run.tiles.length, seeds: loaded.run.seeds },
      base: { gain: base.gain, wages: base.wages, lowest: base.lowest },
      planter: { gain: planted.gain, wages: planted.wages, lowest: planted.lowest, workerPlants: planted.after.run.lifetime.workerPlants, harvests: planted.after.run.counters.harvests - planter.run.counters.harvests },
      autoBuyOff: { gain: idle.gain, wages: idle.wages, workerPlants: idle.after.run.lifetime.workerPlants },
    }),
  )

  it('the base run is batch 8\'s gain on the same start, no planter (re-pinned batch 16: market off)', () => {
    expect(base.gain).toBe(1085)
  })

  it('a planter keeps the loop running offline: more cash than batch 8, never below 0 (pinned) (re-pinned batch 16: market off)', () => {
    expect(planted.gain).toBeGreaterThan(base.gain)
    expect([planted.gain, planted.wages, planted.after.run.lifetime.workerPlants]).toEqual([69849, 3551, 711])
    expect(planted.lowest).toBeGreaterThanOrEqual(0)
  })

  it('auto-buy off and an empty pouch: the planter idles, costing exactly what no planter costs', () => {
    expect(idle.after.run.lifetime.workerPlants).toBe(0)
    expect(idle.after.run.cash).toBe(unstaffed.after.run.cash)
    expect(idle.wages).toBe(unstaffed.wages)
  })
})

describe('batch 10: ladder bot continues to the plant certificate after the furnace loaders and smart furnace', () => {
  let end = createInitialState()
  // batch 16: market off — see the batch-8 note; off, it replays the pre-market pins
  const summary = withoutMarket(() =>
    runBot(true, {
      ticks: 2 * HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      onEnd: (s) => (end = s),
    }),
  )
  const { ladderTicks, finalCash, wagesPaid, lowest, borrowed } = summary
  console.log('batch 10 ladder', JSON.stringify({ ladderTicks, finalCash, wagesPaid, lowest, borrowed, workerPlants: end.run.lifetime.workerPlants, plantCrop: end.run.plantCrop, workers: end.run.workers.assigned }, null, 1))

  it('every batch-9 step is unchanged; the plant certificate follows the smart furnace, pinned (re-pinned batch 16: market off, replays the pre-market pins)', () => {
    expect(ladderTicks).toEqual({
      storageLv1: 477,
      veinLv1: 666,
      furnace: 885,
      storageLv2: 951,
      veinLv2: 1255,
      firstBar: 1389,
      copperPickaxe: 1644,
      'copper:water': 1884,
      'copper:harvest': 2196,
      'copper:plant': 2361,
      oreCertificate: 2550,
      fuelCertificate: 3141,
      smart: 3741,
      plantCertificate: 4341,
    })
    expect([finalCash, wagesPaid, end.run.lifetime.workerPlants]).toEqual([13694, 999, 72])
  })

  it('the planter gets a worker and plants; nothing goes negative and it never borrows', () => {
    expect(end.run.workers.assigned.plant).toBe(1)
    expect(end.run.lifetime.workerPlants).toBeGreaterThan(0)
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(borrowed).toBe(false)
  })
})

// ---- Batch 11: iron tier + mine worker ----

const IRON_TICKS = 2 * HOUR_TICKS
// batch 16: market off — at depth 60 the market-on iron ladder of this pre-hand-picked era stalls cash-broke after
// storage Lv2 (the market-on run is pinned in the batch-12 describe); off, it replays the pre-market pins
const ironLadder = withoutMarket(() => {
  let end = createInitialState()
  const summary = runBot(true, {
    ticks: IRON_TICKS,
    licenses: LICENSE_ORDER,
    crops: PLANT_ORDER,
    ladder: true,
    copperTools: true,
    workers: true,
    furnace: true,
    planter: true,
    iron: true,
    onEnd: (s) => (end = s),
  })
  return { summary, end }
})

describe('batch 11: ladder bot continues to storage Lv3, vein Lv3, the first iron bar, the iron pickaxe and the mine worker', () => {
  const { summary, end } = ironLadder
  const { ladderTicks, finalCash, wagesPaid, lowest, borrowed } = summary
  const { ironBarsSmelted, ironBars, workerMines, workerPlants } = end.run.lifetime
  console.log(
    'batch 11 ladder',
    JSON.stringify({ ladderTicks, finalCash, wagesPaid, lowest, borrowed, ironBarsSmelted, ironBars, workerMines, workerPlants, workers: end.run.workers.assigned, pickaxe: end.run.pickaxe }, null, 1),
  )

  it('every batch-10 step is unchanged; storage Lv3 → vein Lv3 → iron picked → first iron bar → iron pickaxe → mine certificate follow, pinned (re-pinned batch 16: market off, replays the pre-market pins)', () => {
    const { storageLv3, veinLv3, ironPicked, firstIronBar, ironPickaxe, mineCertificate, ...older } = ladderTicks
    expect(older).toEqual({
      storageLv1: 477,
      veinLv1: 666,
      furnace: 885,
      storageLv2: 951,
      veinLv2: 1255,
      firstBar: 1389,
      copperPickaxe: 1644,
      'copper:water': 1884,
      'copper:harvest': 2196,
      'copper:plant': 2361,
      oreCertificate: 2550,
      fuelCertificate: 3141,
      smart: 3741,
      plantCertificate: 4341,
    })
    const order = [storageLv3, veinLv3, ironPicked, firstIronBar, ironPickaxe, mineCertificate]
    for (const tick of order) expect(tick).toBeLessThanOrEqual(IRON_TICKS)
    expect([...order].sort((a, b) => a! - b!)).toEqual(order)
    expect({ storageLv3, veinLv3, ironPicked, firstIronBar, ironPickaxe, mineCertificate }).toEqual({
      storageLv3: 4389,
      veinLv3: 4641,
      ironPicked: 4938,
      firstIronBar: 5060,
      ironPickaxe: 5541,
      mineCertificate: 6141,
    })
    expect([finalCash, wagesPaid, workerMines, ironBarsSmelted]).toEqual([12550, 1189, 205, 18])
  })

  it('the miner gets a worker and mines; nothing goes negative and it never borrows', () => {
    expect(end.run.workers.assigned.mine).toBe(1)
    expect(workerMines).toBeGreaterThan(0)
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(borrowed).toBe(false)
  })
})

/** vein Lv3, storage Lv3, a fresh iron pickaxe and a furnace on iron, with a miner (and the two loaders) staffed */
function ironWorks({ smart = false, loaders = true }: { smart?: boolean; loaders?: boolean }): GameState {
  const init = createInitialState()
  const assigned = { plant: 0, water: 0, harvest: 0, ore: Number(loaders), fuel: Number(loaders), mine: 1, clerk: 0 }
  const furnace = { ...createFurnace(), built: true, smart, oreKind: 'ironOre' as const }
  const workers = { pool: assigned.ore + assigned.fuel + 1, assigned, certificates: ['ore', 'fuel', 'mine'] as WorkerJob[] }
  return {
    ...init,
    run: {
      ...init.run,
      cash: 1000,
      mineLicense: true,
      storageLevel: 3,
      bagCapacity: init.run.bagCapacity + 3 * storageSlotsPerLevel(),
      vein: { level: 3, progress: 0, rock: 'stone' },
      pickaxe: { tier: 'iron', durability: pickaxeDurability('iron') },
      furnace,
      workers,
    },
  }
}

/** coal the player leaves in storage for the fuel loader when selling */
const KEEP_COAL = 10
/**
 * One hour of the mine → furnace chain with no player but a seller: every `cadence` ticks the player sells what the
 * chain does not use (stone, copper ore, coal above KEEP_COAL; with no loaders also the iron ore), so storage has room.
 */
function ironBench({ cadence, smart = false, loaders = true }: { cadence: number; smart?: boolean; loaders?: boolean }) {
  const start = ironWorks({ smart, loaders })
  let s = start
  let lowest = lowestValue(s)
  const sell = (id: 'stone' | 'copperOre' | 'coal' | 'ironOre', keep = 0) => {
    const r = sellItem(s, id, (s.run.inventory[id] ?? 0) - keep)
    if (r.ok) s = r.state
  }
  for (let t = 0; t < HOUR_TICKS; t++) {
    if (t % cadence === 0) {
      sell('stone')
      sell('copperOre')
      sell('coal', loaders ? KEEP_COAL : 0)
      if (!loaders) sell('ironOre')
    }
    s = step(s, 1)
    lowest = Math.min(lowest, lowestValue(s))
  }
  const was = start.run.lifetime
  const now = s.run.lifetime
  return {
    ironBars: now.ironBarsSmelted - was.ironBarsSmelted,
    workerMines: now.workerMines - was.workerMines,
    wages: now.wagesPaid - was.wagesPaid,
    wastedUnits: (now.fireWasted - was.fireWasted) / fireUnitTicks(),
    cash: s.run.cash - start.run.cash,
    durability: s.run.pickaxe!.durability,
    lowest,
  }
}

describe('batch 11: iron bars per hour with mine + ore + fuel workers, plain vs smart (player only sells)', () => {
  const bench = {
    plain120: ironBench({ cadence: 120 }),
    smart120: ironBench({ cadence: 120, smart: true }),
    plain600: ironBench({ cadence: 600 }),
    smart600: ironBench({ cadence: 600, smart: true }),
    minerOnly120: ironBench({ cadence: 120, loaders: false }),
  }
  console.log('batch 11 iron bars/hour', JSON.stringify(bench, null, 1))

  it('pins iron bars, miner presses, wages and fire wasted per hour (PLAN.md "Batch 11 results")', () => {
    expect(Object.fromEntries(Object.entries(bench).map(([k, v]) => [k, [v.ironBars, v.workerMines, v.wages, Math.ceil(v.wastedUnits)]]))).toEqual({
      plain120: [28, 679, 801, 4],
      smart120: [28, 679, 799, 0],
      plain600: [15, 329, 418, 60],
      smart600: [11, 269, 315, 0],
      minerOnly120: [0, 720, 720, 0],
    })
  })

  it('the furnace never beats its iron ceiling (one bar per 120 s), smart wastes no fire, nothing goes negative', () => {
    for (const r of Object.values(bench)) {
      expect(r.ironBars).toBeLessThanOrEqual(HOUR_TICKS / barTicks('ironOre'))
      expect(r.lowest).toBeGreaterThanOrEqual(0)
    }
    expect([bench.smart120.wastedUnits, bench.smart600.wastedUnits]).toEqual([0, 0])
  })
})

describe('batch 11: 8 h offline from the batch-11 ladder end with the whole chain (miner, loaders, farm workers)', () => {
  // before leaving the player sells the stone and copper ore (the coal and iron ore stay for the loaders)
  const sold = (s: GameState, id: 'stone' | 'copperOre') => {
    const r = sellItem(s, id, s.run.inventory[id] ?? 0)
    return r.ok ? r.state : s
  }
  // batch 16: the whole offline measurement runs market off, like its ladder start
  const { start, t, offline, minerStop, lowest } = withoutMarket(() => {
    const start = sold(sold(ironLadder.end, 'stone'), 'copperOre')
    let t = start
    let lowest = t.run.cash
    let minerStop = 0
    for (let i = 0; i < OFFLINE_CAP_TICKS; i++) {
      const mines = t.run.lifetime.workerMines
      t = step(t, 1)
      if (t.run.lifetime.workerMines > mines) minerStop = i + 1
      lowest = Math.min(lowest, t.run.cash)
    }
    const was = start.run.lifetime
    const now = t.run.lifetime
    const offline = {
      start: {
        cash: start.run.cash,
        storage: `${bagCount(start.run)}/${start.run.bagCapacity}`,
        inventory: start.run.inventory,
        durability: start.run.pickaxe?.durability,
        assigned: start.run.workers.assigned,
      },
      minerStop,
      storage: `${bagCount(t.run)}/${t.run.bagCapacity}`,
      inventory: t.run.inventory,
      durability: t.run.pickaxe?.durability,
      mines: now.workerMines - was.workerMines,
      ironBars: now.ironBarsSmelted - was.ironBarsSmelted,
      copperBars: now.barsSmelted - was.barsSmelted,
      plants: now.workerPlants - was.workerPlants,
      gain: t.run.cash - start.run.cash,
      wages: now.wagesPaid - was.wagesPaid,
      lowest,
    }
    return { start, t, offline, minerStop, lowest }
  })
  console.log('batch 11 offline 8 h', JSON.stringify(offline, null, 1))

  it('the miner stops because storage is full, not because the pickaxe went blunt (pinned) (re-pinned batch 16: market off)', () => {
    expect(bagCount(t.run)).toBe(t.run.bagCapacity)
    expect(t.run.pickaxe!.durability).toBeGreaterThan(0)
    expect(minerStop).toBeLessThan(OFFLINE_CAP_TICKS)
    expect([minerStop, offline.mines, offline.ironBars, offline.gain, offline.wages]).toEqual([981, 54, 9, 69387, 3633])
  })

  it('cash never goes below 0 and step(s, n) = n × step(s, 1) over the whole 8 h', () => {
    expect(lowest).toBeGreaterThanOrEqual(0)
    expect(withoutMarket(() => step(start, OFFLINE_CAP_TICKS))).toEqual(t)
  })
})

describe('batch 11: mining stays below the farm cap with the iron tier', () => {
  const pumpkin = runCropBot('pumpkin').cashPerEnergy
  const bench = (tier: PickaxeTier, lv10: boolean) =>
    mineBench({ pickaxe: true, tier, vein: 3, xp: lv10 ? 400 * { wooden: 1, copper: 2, iron: 4 }[tier] : 0, mastered: lv10 }).cashPerEnergy
  const mining = {
    woodLv10Vein3: bench('wooden', true),
    copperLv10Vein3: bench('copper', true),
    ironLv0Vein3: bench('iron', false),
    ironLv10Vein3: bench('iron', true),
  }
  // the miner spends no player energy: compare its net cash per hour (sales − its wages) with farm workers'
  const miner = ironBench({ cadence: 120, loaders: false })
  const farmWorkers = runCropBot('pumpkin', HOUR_TICKS, undefined, { plant: 1, water: 1, harvest: 1 }).perMin * 60
  console.log('batch 11 mining', JSON.stringify({ pumpkin, mining, minerCashPerHour: miner.cash, farmWorkersCashPerHour: farmWorkers }, null, 1))

  it('every pickaxe on vein Lv3 stays below 0.9 × pumpkin (cash per energy, repairs at input value)', () => {
    for (const v of Object.values(mining)) expect(v).toBeLessThan(0.9 * pumpkin)
  })

  it('a miner nets less cash per hour than the three pumpkin farm workers', () => {
    expect(miner.cash).toBeLessThan(farmWorkers)
  })
})

/** batch 12 farm runs: 2 h, so the glut (30 min half-life) is near its steady state for most of the run */
const MARKET_TICKS = 2 * HOUR_TICKS
const FARM_PAIRS: [CropId, CropId][] = CROP_IDS.flatMap((a, i) => CROP_IDS.slice(i + 1).map((b): [CropId, CropId] => [a, b]))

/**
 * 24 tiles, the first `first` planted with pair[0] and the rest with pair[1], farmed by hand with bestFarmAction's
 * priority (harvest → water a dry growing tile → plant the tile's own crop → till), cash 💰10 000 so seeds never block
 * it. Net cash per hour, standing crops at sell price × growth (runCropBot's accounting).
 */
function splitFarm(pair: [CropId, CropId], first: number, ticks = MARKET_TICKS): number {
  const init = createInitialState()
  const tiles = [...init.run.tiles, ...Array.from({ length: TILE_CAP - init.run.tiles.length }, createTile)]
  const cash = 10_000
  let s: GameState = { ...init, run: { ...init.run, cash, licenses: [...new Set<CropId>(['radish', ...pair])], tiles } }
  const cropAt = (i: number) => (i < first ? pair[0] : pair[1])
  const growing = (i: number) => {
    const { cropId, growth } = s.run.tiles[i]
    return cropId !== undefined && growth < cropGrowTicks(cropId, s.meta, 0)
  }
  const tries: ((i: number) => ActionResult | null)[] = [
    (i) => harvest(s, i),
    (i) => (s.run.tiles[i].moisture === 0 && growing(i) ? water(s, i) : null),
    (i) => plant(s, i, cropAt(i)),
    (i) => till(s, i),
  ]
  const next = () => {
    for (const act of tries)
      for (let i = 0; i < s.run.tiles.length; i++) {
        const r = act(i)
        if (r?.ok) return r.state
      }
    return null
  }
  for (let t = 0; t < ticks; t++) {
    while (s.run.energy >= ACTION_ENERGY_COST) {
      const n = next()
      if (!n) break
      s = n
    }
    s = step(s, 1)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  return Math.round((s.run.cash - cash + field) / (ticks / HOUR_TICKS))
}

describe('batch 12: crop market — steady state, income before/after, hierarchy, no stall', () => {
  const meta = createInitialState().meta
  const steady = Object.fromEntries(
    CROP_IDS.map((c) => [c, { t24: marketSteadyFactor(c, 24, meta, 0), t120: marketSteadyFactor(c, 120, meta, 0) }]),
  )
  const lemon24Fert5 = marketSteadyFactor('lemon', 24, meta, 5)

  const hour = (perMin: number) => Math.round(perMin * 60)
  const ALL_THREE = { plant: 1, water: 1, harvest: 1 }
  const lemonManual = (on: boolean) => {
    const run = () => runCropBot('lemon', MARKET_TICKS, undefined, undefined, TILE_CAP)
    return hour((on ? run() : withoutMarket(run)).perMin)
  }
  const lemonWorkers = (on: boolean) => {
    const run = () => runCropBot('lemon', MARKET_TICKS, undefined, ALL_THREE, TILE_CAP)
    return hour((on ? run() : withoutMarket(run)).perMin)
  }
  const income = {
    lemon24Manual: { before: lemonManual(false), after: lemonManual(true) },
    lemon24Workers: { before: lemonWorkers(false), after: lemonWorkers(true) },
  }
  // the best 2-crop split (steps of 4 tiles) with the market on, then the same split and the best one-crop farm off
  const splits = FARM_PAIRS.flatMap((pair) => [4, 8, 12, 16, 20].map((first) => ({ pair, first, perHour: splitFarm(pair, first) })))
  const best = splits.reduce((a, b) => (b.perHour > a.perHour ? b : a))
  const single = CROP_IDS.map((c) => ({ crop: c, perHour: splitFarm([c, c], TILE_CAP) })).reduce((a, b) => (b.perHour > a.perHour ? b : a))
  const bestSplit = {
    ...best,
    before: withoutMarket(() => splitFarm(best.pair, best.first)),
    bestOneCrop: { ...single, before: withoutMarket(() => splitFarm([single.crop, single.crop], TILE_CAP)) },
  }

  // ladder bots: ironLadder above is the market-off run (replays the pre-market pins); this is the market-on run at
  // depth 60 (batch 16) — it stalls cash-broke after storage Lv2, pinned as the retune's cost on the pre-hand-picked era
  const ladderOn = runBot(true, { ticks: IRON_TICKS, licenses: LICENSE_ORDER, crops: PLANT_ORDER, ladder: true, copperTools: true, workers: true, furnace: true, planter: true, iron: true })
  const ladder = {
    finalCash: { before: ironLadder.summary.finalCash, after: ladderOn.finalCash },
    mineCertificate: { before: ironLadder.summary.ladderTicks.mineCertificate, after: ladderOn.ladderTicks.mineCertificate },
  }

  // hierarchy at the size the market bites: 24 pumpkin tiles by hand, market on, vs the batch-11 mining benches
  const pumpkin24 = runCropBot('pumpkin', MARKET_TICKS, undefined, undefined, TILE_CAP).cashPerEnergy
  const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy

  // no stall: the milestones the core recorded on the iron ladder run, from tick 0 to the last one
  const reached = Object.entries(ironLadder.end.run.milestones).sort((a, b) => a[1]! - b[1]!)
  const gaps = reached.map(([id, tick], i) => ({ id, gap: tick! - (i ? reached[i - 1][1]! : 0) }))
  const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))

  console.log('batch 12 market', JSON.stringify({ steady, lemon24Fert5, income, bestSplit, ladder, pumpkin24, ironLv10, reached, longest }, null, 1))

  it('steady-state factor of one crop: 24 tiles 0.78–0.82, 120 tiles 0.50 (every crop, base grow time) (re-pinned batch 16: depth 60)', () => {
    for (const { t24, t120 } of Object.values(steady)) {
      expect(t24).toBeGreaterThanOrEqual(0.78)
      expect(t24).toBeLessThanOrEqual(0.82)
      expect(t120).toBeCloseTo(0.5, 2)
    }
    expect(lemon24Fert5).toBeCloseTo(0.6, 2)
  })

  it('the market costs income on a 24-tile one-crop farm, manual and with workers (pinned) (re-pinned batch 16: depth 60)', () => {
    expect(income.lemon24Manual.after).toBeLessThan(income.lemon24Manual.before)
    expect(income.lemon24Workers.after).toBeLessThan(income.lemon24Workers.before)
    expect(income).toEqual({
      lemon24Manual: { before: 13321, after: 12031 },
      lemon24Workers: { before: 9507, after: 8682 },
    })
  })

  it('the best 2-crop split on 24 tiles (pinned) still earns less than 24 lemon tiles at depth 60 — the split goal of batch 16 is not reached (96.5 % of mono)', () => {
    expect(bestSplit).toEqual({
      pair: ['pumpkin', 'lemon'],
      first: 4,
      perHour: 11612,
      before: 12355,
      bestOneCrop: { crop: 'lemon', perHour: 12031, before: 13321 },
    })
  })

  it('market off replays the pre-market pins (12550 / 6141); market on at depth 60 stalls cash-broke after storage Lv2 (re-pinned batch 16)', () => {
    expect(ladder.finalCash.before).toBe(12550)
    expect(ladder.mineCertificate.before).toBe(6141)
    expect(ladder.finalCash.after).toBe(0)
    expect(ladder.mineCertificate.after).toBeUndefined()
    expect(ladderOn.ladderTicks.storageLv2).toBe(951)
  })

  it('mining stays below farming with the market on: iron Lv10 on vein Lv3 < 0.9 × 24-tile pumpkin by hand', () => {
    expect(ironLv10).toBeLessThan(0.9 * pumpkin24)
  })

  it('no stall: the ladder never waits more than 60 game-minutes between two consecutive milestones (re-pinned batch 16: market off)', () => {
    expect(longest.gap).toBeLessThanOrEqual(HOUR_TICKS)
    expect([reached.length, reached.at(-1), longest]).toEqual([30, ['certMine', 6141], { id: 'ironPickaxe', gap: 900 }])
  })

  it('step(s, n) = n × step(s, 1) with the market decaying, milestones recording and workers on', () => {
    const start = ironLadder.end
    expect(Object.values(start.run.market).some((g) => g > 0)).toBe(true)
    let one = start
    for (let i = 0; i < 600; i++) one = step(one, 1)
    expect(step(start, 600)).toEqual(one)
  })
})

function withBatch13<T>(run: () => T): T {
  rules.batch13 = true
  try {
    return run()
  } finally {
    rules.batch13 = false
  }
}

/** the player's harvest pace on a staffed farm in the research model (docs/research/pacing-liveops.md A4) */
const ATTENTIVE_ENERGY_PER_MIN = 4

/**
 * 24 lemon tiles fully staffed (one planter, waterer and harvester), 💰1000 so seeds never block, for `ticks`. Idle =
 * the player does nothing; attentive = before each tick the player harvests ripe tiles (the same 1-energy harvest a
 * tool press does per tile), at most ATTENTIVE_ENERGY_PER_MIN a minute, before the harvester gets to them. Gross = crop
 * sales; net = cash change plus standing crops at sell price × growth (runCropBot's accounting), both per hour.
 */
function staffedLemon(attentive: boolean, toolTier = createInitialState().run.toolTier, ticks = MARKET_TICKS) {
  const init = createInitialState()
  const tiles = [...init.run.tiles, ...Array.from({ length: TILE_CAP - init.run.tiles.length }, createTile)]
  const assigned = { plant: 1, water: 1, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0 }
  const workers = { pool: 3, assigned, certificates: [...WORKER_JOBS] }
  let s: GameState = { ...init, run: { ...init.run, cash: 1000, licenses: ['radish', 'lemon'], plantCrop: 'lemon', toolTier, workers, tiles } }
  let budget = 0
  let picked = 0
  let lowest = s.run.cash
  for (let t = 0; t < ticks; t++) {
    if (attentive) {
      budget = Math.min(budget + ATTENTIVE_ENERGY_PER_MIN / 60, ATTENTIVE_ENERGY_PER_MIN)
      for (let i = 0; i < s.run.tiles.length && budget >= 1; i++) {
        const r = harvest(s, i)
        if (!r.ok) continue
        s = r.state
        budget -= 1
        picked++
      }
    }
    s = step(s, 1)
    lowest = Math.min(lowest, s.run.cash)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  const hours = ticks / HOUR_TICKS
  return {
    grossPerHour: Math.round(s.run.lifetime.cashEarned / hours),
    netPerHour: Math.round((s.run.cash - 1000 + field) / hours),
    picked,
    harvests: s.run.counters.harvests,
    wages: s.run.lifetime.wagesPaid,
    lowest,
  }
}

describe('batch 13: tool-gated certificates, hand-picked ×1.25, iron open (rules.batch13 on)', () => {
  const r = withBatch13(() => {
    let end = createInitialState()
    const ladder = runBot(true, {
      ticks: IRON_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      iron: true,
      buyTools: true,
      onEnd: (s) => (end = s),
    })
    const minute = (tick: number | undefined) => (tick === undefined ? null : Math.round((tick / 60) * 10) / 10)
    // the order clerk (batch 14) is not on the batch-13 ladder
    const certificates = Object.fromEntries(
      WORKER_JOBS.filter((job) => job !== 'clerk').map((job) => [
        job,
        {
          unlocked: minute(ladder.certUnlocked[job]?.tick),
          bought: minute(job === 'water' || job === 'harvest' ? ladder.workerTicks[`${job}Certificate`] : ladder.ladderTicks[`${job}Certificate`]),
        },
      ]),
    )
    // farm certificate items vs the storage held the tick each became buyable
    const fits = (['water', 'harvest', 'plant'] as const).map((job) => {
      const { cash, ...items } = certificateCost(job, end.meta)
      void cash
      return { job, items: Object.values(items).reduce((a, b) => a + (b ?? 0), 0), bagCapacity: ladder.certUnlocked[job]?.bagCapacity }
    })
    const reached = Object.entries(end.run.milestones).sort((a, b) => a[1]! - b[1]!)
    const gaps = reached.map(([id, tick], i) => ({ id, gap: tick! - (i ? reached[i - 1][1]! : 0) }))
    const longest = gaps.reduce((a, b) => (b.gap > a.gap ? b : a))
    const idle = staffedLemon(false)
    const attentive = staffedLemon(true)
    // the same farm with the three copper tools the ladder owns by the time it staffs (a copper can halves the waterings)
    const copper = { idle: staffedLemon(false, ALL_COPPER), attentive: staffedLemon(true, ALL_COPPER) }
    const pumpkin24 = runCropBot('pumpkin', MARKET_TICKS, undefined, undefined, TILE_CAP).cashPerEnergy
    const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy
    return { ladder, end, certificates, fits, reached, longest, idle, attentive, copper, pumpkin24, ironLv10 }
  })
  const { ladder, end, certificates, fits, reached, longest, idle, attentive, copper, pumpkin24, ironLv10 } = r
  const gain = (a: typeof idle, b: typeof idle) => ({ gross: b.grossPerHour - a.grossPerHour, net: b.netPerHour - a.netPerHour })
  const handPickedGain = gain(idle, attentive)
  const copperGain = gain(copper.idle, copper.attentive)
  console.log(
    'batch 13',
    JSON.stringify(
      { certificates, workerTicks: ladder.workerTicks, ladderTicks: ladder.ladderTicks, finalCash: ladder.finalCash, fits, reached, longest, idle, attentive, handPickedGain, copper, copperGain, pumpkin24, ironLv10, lowest: ladder.lowest, borrowed: ladder.borrowed },
      null,
      1,
    ),
  )

  it('the ladder buys the water and harvest certificates once each tool is at Lv3, water first (pinned minutes)', () => {
    expect(certificates.water.unlocked).not.toBeNull()
    expect(certificates.harvest.unlocked).not.toBeNull()
    expect(certificates.water.bought!).toBeGreaterThanOrEqual(certificates.water.unlocked!)
    expect(certificates.harvest.bought!).toBeGreaterThanOrEqual(certificates.harvest.unlocked!)
    expect(certificates.water.bought!).toBeLessThan(certificates.harvest.bought!)
    expect(end.run.tools).toEqual({ water: 3, harvest: 3, plant: 3 })
    expect(certificates).toEqual({
      plant: { unlocked: 59.3, bought: 78.9 },
      water: { unlocked: 23.3, bought: 24.8 },
      harvest: { unlocked: 65.3, bought: 65.3 },
      ore: { unlocked: 38, bought: 49 },
      fuel: { unlocked: 58.9, bought: 58.9 },
      mine: { unlocked: 83.9, bought: 107.3 },
    })
    expect([ladder.finalCash, longest]).toEqual([11118, { id: 'certPlant', gap: 815 }])
  })

  it('no stall: no wait between two consecutive milestones is longer than 60 game-minutes', () => {
    expect(longest.gap).toBeLessThanOrEqual(HOUR_TICKS)
  })

  it('every farm certificate fits the storage the player holds when it becomes buyable', () => {
    for (const f of fits) expect(f.items).toBeLessThanOrEqual(f.bagCapacity!)
  })

  it('a pure farmer (no storage bought) fits water and plant; harvest\'s 25 items need storage Lv1 (30), named on its row', () => {
    const start = createInitialState().run.bagCapacity
    const items = Object.fromEntries(fits.map((f) => [f.job, f.items]))
    expect(items).toEqual({ water: 20, harvest: 25, plant: 10 })
    expect([items.water <= start, items.plant <= start, items.harvest <= start, items.harvest <= start + storageSlotsPerLevel()]).toEqual([true, true, false, true])
  })

  it('nothing goes negative and it never borrows', () => {
    expect(ladder.lowest).toBeGreaterThanOrEqual(0)
    expect(ladder.borrowed).toBe(false)
  })

  it('24 lemon tiles fully staffed: the attentive player (✋ ×1.25) out-earns idle workers, gross and net (re-pinned batch 16: depth 60)', () => {
    expect(attentive.picked).toBeGreaterThan(0)
    expect(handPickedGain.gross).toBeGreaterThan(0)
    expect(handPickedGain.net).toBeGreaterThan(0)
    expect([idle.lowest, attentive.lowest, copper.idle.lowest, copper.attentive.lowest].every((c) => c >= 0)).toBe(true)
    expect(copperGain.gross).toBeGreaterThan(handPickedGain.gross)
    expect({ handPickedGain, copperGain }).toEqual({ handPickedGain: { gross: 2727, net: 3154 }, copperGain: { gross: 5036, net: 5295 } })
  })

  it('mining stays below farming with hand-picked on: iron Lv10 on vein Lv3 < 0.9 × 24-tile pumpkin by hand', () => {
    expect(ironLv10).toBeLessThan(0.9 * pumpkin24)
  })

  it('step(s, n) = n × step(s, 1) with workers, the market and hand-picked sales on', () => {
    withBatch13(() => {
      // a few hand-picked sales on top of the ladder end, so the glut holds player sales too
      let start = end
      for (let i = 0; i < start.run.tiles.length; i++) {
        const h = harvest(start, i)
        if (h.ok) start = h.state
      }
      expect(Object.values(start.run.market).some((g) => g > 0)).toBe(true)
      expect(Object.values(start.run.workers.assigned).some((n) => n > 0)).toBe(true)
      let one = start
      for (let i = 0; i < 600; i++) one = step(one, 1)
      expect(step(start, 600)).toEqual(one)
    })
  })
})

/**
 * Batch 14: one crop on `tileCount` tiles for `ticks`, 💰1000 at the start (seeds never block it), with or without the
 * 📋 board (bought at tick 0, the purchase refunded so both runs start alike). Board policy before each tick: accept
 * every open offer for the farmed crop, discard every other (the cooldown then refills the slot); never rerolls, never
 * spends ⭐. perJob 0 = runCropBot's player (bestFarmAction with all its energy); perJob k = staffedLemon's farm with k
 * planters, waterers and harvesters and its attentive player. Income = cash change + standing crops (runCropBot's
 * accounting) per hour.
 */
function orderFarm(crop: CropId, tileCount: number, perJob: number, board: boolean, ticks = MARKET_TICKS) {
  const init = createInitialState()
  const tiles = [...init.run.tiles, ...Array.from({ length: tileCount - init.run.tiles.length }, createTile)]
  const n = perJob
  const staffed = n > 0
  const assigned = { plant: n, water: n, harvest: n, ore: 0, fuel: 0, mine: 0, clerk: 0 }
  const workers = { pool: 3 * n, assigned, certificates: [...WORKER_JOBS] }
  let s: GameState = { ...init, run: { ...init.run, cash: 1000, licenses: [...new Set<CropId>(['radish', crop])], plantCrop: crop, workers, tiles } }
  if (board) {
    const bought = buyOrderBoard({ ...s, run: { ...s.run, inventory: { stone: 10 }, counters: { ...s.run.counters, sales: 50 } } })
    if (!bought.ok) throw new Error(bought.error)
    s = { ...s, run: { ...s.run, orders: bought.state.run.orders, rngState: bought.state.run.rngState } }
  }
  const take = (r: ActionResult) => {
    if (r.ok) s = r.state
    return r.ok
  }
  let budget = 0
  let lowest = s.run.cash
  for (let t = 0; t < ticks; t++) {
    s.run.orders.offers.forEach((o, i) => {
      if (isOffer(o) && !o.accepted) take(o.good === crop ? acceptOrder(s, i) : discardOrder(s, i))
    })
    if (staffed) {
      budget = Math.min(budget + ATTENTIVE_ENERGY_PER_MIN / 60, ATTENTIVE_ENERGY_PER_MIN)
      for (let i = 0; i < s.run.tiles.length && budget >= 1; i++) if (take(harvest(s, i))) budget -= 1
    } else
      while (s.run.energy >= ACTION_ENERGY_COST) {
        const next = bestFarmAction(s, [crop])
        if (!next) break
        s = next.state
      }
    s = step(s, 1)
    lowest = Math.min(lowest, s.run.cash)
  }
  const field = s.run.tiles.reduce((sum, t) => sum + (t.cropId ? cropSellPrice(t.cropId, s.meta, 0) * growthProgress(t, s) : 0), 0)
  const hours = ticks / HOUR_TICKS
  return {
    incomePerHour: Math.round((s.run.cash - 1000 + field) / hours),
    starsPerHour: Math.round((s.run.lifetime.starsEarned / hours) * 10) / 10,
    ordersPerHour: Math.round((s.run.lifetime.ordersCompleted / hours) * 10) / 10,
    harvestsPerHour: Math.round(s.run.counters.harvests / hours),
    lowest,
    end: s,
  }
}

/** the goods a state can make, written apart from orderPool: what the property test checks the generator against */
function canProduce(run: GameState['run'], good: OrderGood): boolean {
  if ((CROP_IDS as readonly string[]).includes(good)) return run.licenses.includes(good as CropId)
  const mined = (id: ItemId) =>
    run.mineLicense && (veinDrops(run.vein.level)[id] ?? 0) > 0 && (id !== 'ironOre' || PICKAXE_TIERS.indexOf(run.pickaxe?.tier ?? 'wooden') >= 1)
  if (good === 'copperBar') return run.furnace.built && mined('copperOre')
  if (good === 'ironBar') return run.furnace.built && mined('ironOre')
  return mined(good as ItemId)
}

describe('batch 14: 📋 orders and ⭐ (rules.batch13 on)', () => {
  const r = withBatch13(() => {
    const farm = (crop: CropId, tileCount: number, perJob: number) => {
      const on = orderFarm(crop, tileCount, perJob, true)
      const off = orderFarm(crop, tileCount, perJob, false)
      const { end, ...shown } = on
      void end
      return { ...shown, incomeOff: off.incomePerHour, bonusPct: Math.round(((on.incomePerHour - off.incomePerHour) / off.incomePerHour) * 1000) / 10 }
    }
    // the batch-13 24-tile lemon farm (one worker per job), and the same farm with the full pool of six (two per job)
    const farms = { carrot9: farm('radish', 9, 0), lemon24: farm('lemon', TILE_CAP, 1), lemon24x6: farm('lemon', TILE_CAP, 2) }
    // the whole ⭐ shop: 3rd + 4th slot and the clerk certificate (rerolls are consumables)
    const shopStars = orderSlotStars(2)! + orderSlotStars(3)! + certificateCost('clerk', createInitialState().meta).stars!
    const hoursToShop = Object.fromEntries(Object.entries(farms).map(([k, f]) => [k, Math.round((shopStars / f.starsPerHour) * 10) / 10]))
    // hierarchy: the best mining bench with every item paid at (1 + bonus) vs 24-tile pumpkin farming with no orders
    const pumpkin24 = runCropBot('pumpkin', MARKET_TICKS, undefined, undefined, TILE_CAP).cashPerEnergy
    const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy
    const miningWithBonus = ironLv10 * (1 + orderBonus())
    // the generator over the ladder bot's states (every 60 ticks of the batch-13 iron ladder)
    const states: GameState[] = []
    runBot(true, {
      ticks: IRON_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      iron: true,
      buyTools: true,
      onTick: (s) => {
        if (s.run.tick % 60 === 0) states.push(s)
      },
    })
    return { farms, shopStars, hoursToShop, pumpkin24, ironLv10, miningWithBonus, states }
  })
  const { farms, shopStars, hoursToShop, pumpkin24, ironLv10, miningWithBonus, states } = r
  // every good of every sampled state's pool, every tier: the count and the bag capacity at that moment
  const counts = states.flatMap((s) =>
    orderPool(s.run).flatMap((good) => Array.from({ length: orderTierCount() }, (_, tier) => ({ tick: s.run.tick, good, tier, count: orderCount(s, good, tier), bag: s.run.bagCapacity }))),
  )
  const items = counts.filter((c) => !isCropGood(c.good))
  const poolSizes = states.map((s) => orderPool(s.run).length)
  console.log(
    'batch 14',
    JSON.stringify(
      { farms, shopStars, hoursToShop, pumpkin24, ironLv10, miningWithBonus, cap: 0.9 * pumpkin24, states: states.length, poolSizes: [Math.min(...poolSizes), Math.max(...poolSizes)], maxItemShare: Math.max(...items.map((c) => c.count / c.bag)) },
      null,
      1,
    ),
  )

  it('⭐ per hour is paced by time: every farm earns 4–12 ⭐/h; equal within 1.5 ⭐/h when the farm makes what the count assumes', () => {
    for (const f of Object.values(farms)) {
      expect(f.starsPerHour).toBeGreaterThanOrEqual(4)
      expect(f.starsPerHour).toBeLessThanOrEqual(12)
      expect(f.lowest).toBeGreaterThanOrEqual(0)
    }
    // carrot by hand harvests ~99 % of tiles ÷ grow time, six lemon workers ~95 %; three make ~48 %, so they earn ~half
    expect(Math.abs(farms.carrot9.starsPerHour - farms.lemon24x6.starsPerHour)).toBeLessThanOrEqual(1.5)
  })

  it('orders add income on every farm; ⭐/h, order cash bonus and hours to the whole ⭐ shop pinned (PLAN.md "Batch 14 results")', () => {
    for (const f of Object.values(farms)) expect(f.bonusPct).toBeGreaterThan(0)
    const pick = ({ starsPerHour, ordersPerHour, harvestsPerHour, incomePerHour, incomeOff, bonusPct }: (typeof farms)['carrot9']) => ({
      starsPerHour,
      ordersPerHour,
      harvestsPerHour,
      incomePerHour,
      incomeOff,
      bonusPct,
    })
    expect({ carrot9: pick(farms.carrot9), lemon24: pick(farms.lemon24), lemon24x6: pick(farms.lemon24x6), shopStars, hoursToShop }).toEqual({
      carrot9: { starsPerHour: 11, ordersPerHour: 6.5, harvestsPerHour: 320, incomePerHour: 3861, incomeOff: 3161, bonusPct: 22.1 },
      lemon24: { starsPerHour: 5, ordersPerHour: 3, harvestsPerHour: 114, incomePerHour: 14374, incomeOff: 11836, bonusPct: 21.4 },
      lemon24x6: { starsPerHour: 10, ordersPerHour: 6.5, harvestsPerHour: 228, incomePerHour: 25631, incomeOff: 19287, bonusPct: 32.9 },
      shopStars: 60,
      hoursToShop: { carrot9: 5.5, lemon24: 12, lemon24x6: 6 },
    })
  })

  it('hierarchy: the best mining bench with every item at (1 + bonus) stays < 0.9 × 24-tile pumpkin farming', () => {
    expect(miningWithBonus).toBeLessThan(0.9 * pumpkin24)
  })

  it('every item order count ≤ the bag capacity at its moment (and ≤ half of it)', () => {
    expect(items.length).toBeGreaterThan(0)
    for (const c of items) expect(c.count).toBeLessThanOrEqual(Math.floor(c.bag / 2))
    for (const c of counts) expect(c.count).toBeGreaterThanOrEqual(1)
  })

  it('the generator only offers goods the state can produce (pool and 20 rolls per sampled ladder state)', () => {
    expect(states.length).toBe(IRON_TICKS / 60)
    for (const s of states) {
      for (const good of orderPool(s.run)) expect(canProduce(s.run, good), `${good} at tick ${s.run.tick}`).toBe(true)
      for (let k = 0; k < 20; k++) {
        const [offer] = rollOffer(s, (k * 2654435761) >>> 0)
        expect(canProduce(s.run, offer.good), `${offer.good} at tick ${s.run.tick}`).toBe(true)
      }
    }
    // the ladder reaches iron, so the pool grows from the starting crop to crops, vein items and both bars
    expect(Math.max(...poolSizes)).toBeGreaterThanOrEqual(8)
  })
})

// ---- Batch 15: iron farm tools ----

const ALL_IRON = { water: 2, harvest: 2, plant: 2 }

describe('batch 15: ladder bot buys the three iron tools after the mine certificate (rules.batch13 on)', () => {
  const minute = (tick: number | undefined) => (tick === undefined ? null : Math.round((tick / 60) * 10) / 10)
  const r = withBatch13(() => {
    let end = createInitialState()
    // per tool, in order: the first tick 4 🥈 were held (after the previous tool was bought) / the cash was, once each
    const ready: Partial<Record<`iron:${ToolJob}`, { bars: number; cash: number }>> = {}
    // the phase from the mine certificate to the third iron tool: cash income and iron bars smelted
    const phase = { start: 0, cashEarned: 0, barsSmelted: 0, done: 0, cashEarnedAtDone: 0, barsSmeltedAtDone: 0 }
    const ladder = runBot(true, {
      ticks: 6 * HOUR_TICKS,
      licenses: LICENSE_ORDER,
      crops: PLANT_ORDER,
      ladder: true,
      copperTools: true,
      workers: true,
      furnace: true,
      planter: true,
      iron: true,
      ironTools: true,
      buyTools: true,
      onEnd: (s) => (end = s),
      onTick: (s) => {
        if (!phase.start && s.run.workers.certificates.includes('mine')) {
          phase.start = s.run.tick
          phase.cashEarned = s.run.lifetime.cashEarned
          phase.barsSmelted = s.run.lifetime.ironBarsSmelted
        }
        for (const [i, job] of TOOL_JOBS.entries()) {
          // the water tool's turn starts at the mine certificate (the ladder step before it, which spends its own bars)
          const prevBought = i === 0 ? s.run.workers.certificates.includes('mine') : s.run.toolTier[TOOL_JOBS[i - 1]] >= 2
          if (!prevBought) continue
          const key = `iron:${job}` as `iron:${ToolJob}`
          const rd = (ready[key] ??= { bars: Infinity, cash: Infinity })
          const cost = toolTierCost(2, s.meta)
          if (rd.bars === Infinity && (s.run.inventory.ironBar ?? 0) >= cost.ironBar!) rd.bars = s.run.tick
          if (rd.cash === Infinity && s.run.cash >= cost.cash) rd.cash = s.run.tick
        }
        if (!phase.done && TOOL_JOBS.every((job) => s.run.toolTier[job] >= 2)) {
          phase.done = s.run.tick
          phase.cashEarnedAtDone = s.run.lifetime.cashEarned
          phase.barsSmeltedAtDone = s.run.lifetime.ironBarsSmelted
        }
      },
    })
    const hours = (phase.done - phase.start) / HOUR_TICKS
    const incomePerHour = (phase.cashEarnedAtDone - phase.cashEarned) / hours
    const barsPerHour = (phase.barsSmeltedAtDone - phase.barsSmelted) / hours
    const t = ladder.ladderTicks
    const steps = [t.mineCertificate, t['iron:water'], t['iron:harvest'], t['iron:plant']].map((x) => x!)
    const gaps = steps.slice(1).map((x, i) => x - steps[i])
    const pumpkinIron = runCropBot('pumpkin', MARKET_TICKS, ALL_IRON, undefined, TILE_CAP).cashPerEnergy
    const ironLv10 = mineBench({ pickaxe: true, tier: 'iron', vein: 3, xp: 1600, mastered: true }).cashPerEnergy
    // income/h on a 24-tile staffed lemon farm before (copper) and after (iron) the three tools, idle and attentive
    const before = { idle: staffedLemon(false, ALL_COPPER), attentive: staffedLemon(true, ALL_COPPER) }
    const after = { idle: staffedLemon(false, ALL_IRON), attentive: staffedLemon(true, ALL_IRON) }
    const gain = (a: typeof before.idle, b: typeof before.idle) => ({ gross: b.grossPerHour - a.grossPerHour, net: b.netPerHour - a.netPerHour })
    return { ladder, end, ready, phase, steps, gaps, incomePerHour, barsPerHour, pumpkinIron, ironLv10, before, after, ironGain: gain(before.idle, after.idle), ironGainAttentive: gain(before.attentive, after.attentive) }
  })
  const { ladder, end, ready, phase, steps, gaps, incomePerHour, barsPerHour, pumpkinIron, ironLv10, before, after, ironGain, ironGainAttentive } = r
  console.log(
    'batch 15',
    JSON.stringify(
      {
        bought: { water: minute(steps[1]), harvest: minute(steps[2]), plant: minute(steps[3]) },
        ready: Object.fromEntries(
          TOOL_JOBS.map((job) => [`iron:${job}`, { bars: minute(ready[`iron:${job}`]?.bars), cash: minute(ready[`iron:${job}`]?.cash), bought: minute(ladder.ladderTicks[`iron:${job}`]) }]),
        ),
        gapsMinutes: gaps.map((g) => Math.round((g / 60) * 10) / 10),
        phase: {
          minutes: Math.round(((phase.done - phase.start) / 60) * 10) / 10,
          incomePerHour: Math.round(incomePerHour),
          barsNeeded: 3 * toolTierCost(2, end.meta).ironBar!,
          barsSmelted: phase.barsSmeltedAtDone - phase.barsSmelted,
          barsPerHour: Math.round(barsPerHour),
        },
        cashPartHours: Math.round((toolTierCost(2, end.meta).cash! / incomePerHour) * 10) / 10,
        pumpkinIron,
        ironLv10,
        before,
        after,
        ironGain,
        ironGainAttentive,
        lowest: ladder.lowest,
        borrowed: ladder.borrowed,
        finalCash: ladder.finalCash,
      },
      null,
      1,
    ),
  )

  it('buys the three iron tools in order after the mine certificate; every step ≤ 60 game-minutes', () => {
    expect([...steps].sort((a, b) => a - b)).toEqual(steps)
    expect(phase.done).toBeLessThanOrEqual(6 * HOUR_TICKS)
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(HOUR_TICKS)
  })

  it('pinned minutes: each tool affordable (bars, cash) and bought; the steps after the mine certificate (PLAN.md "Batch 15 results") (re-pinned batch 16: depth 60)', () => {
    expect(minute(steps[0])).toBe(107.3) // the mine certificate
    expect(gaps.map((g) => minute(g))).toEqual([8, 46.3, 39.3])
    expect(minute(phase.done)).toBe(200.8)
    expect(
      Object.fromEntries(
        TOOL_JOBS.map((job) => {
          const rd = ready[`iron:${job}`]!
          return [`iron:${job}`, { bars: minute(rd.bars), cash: minute(rd.cash), bought: minute(ladder.ladderTicks[`iron:${job}`]) }]
        }),
      ),
    ).toEqual({
      'iron:water': { bars: 115.3, cash: 114.9, bought: 115.3 },
      'iron:harvest': { bars: 123.3, cash: 161.5, bought: 161.6 },
      'iron:plant': { bars: 161.6, cash: 200.8, bought: 200.8 },
    })
  })

  it('pinned: the phase income, and the bars needed vs smelted; the cash part is 0.5–1.5 h of that income, rounded to 💰500', () => {
    expect({
      minutes: minute(phase.done - phase.start),
      incomePerHour: Math.round(incomePerHour),
      barsNeeded: 3 * toolTierCost(2, end.meta).ironBar!,
      barsSmelted: phase.barsSmeltedAtDone - phase.barsSmelted,
      barsPerHour: Math.round(barsPerHour),
    }).toEqual({ minutes: 93.5, incomePerHour: 16936, barsNeeded: 12, barsSmelted: 46, barsPerHour: 30 })
    expect(toolTierCost(2, end.meta).cash).toBe(10000)
    expect(10000 % 500).toBe(0)
    expect(10000 / incomePerHour).toBeGreaterThanOrEqual(0.5)
    expect(10000 / incomePerHour).toBeLessThanOrEqual(1.5)
  })

  it('pinned: the iron tools add income on a 24-tile staffed lemon farm (market on), idle and attentive (re-pinned batch 16: depth 60)', () => {
    expect({ before, after, ironGain, ironGainAttentive }).toEqual({
      before: {
        idle: { grossPerHour: 22793, netPerHour: 18802, picked: 0, harvests: 444, wages: 2326, lowest: 472 },
        attentive: { grossPerHour: 27829, netPerHour: 24097, picked: 390, harvests: 447, wages: 1955, lowest: 472 },
      },
      after: {
        idle: { grossPerHour: 24809, netPerHour: 21370, picked: 0, harvests: 456, wages: 1680, lowest: 556 },
        attentive: { grossPerHour: 30194, netPerHour: 27190, picked: 391, harvests: 456, wages: 1288, lowest: 556 },
      },
      ironGain: { gross: 2016, net: 2568 },
      ironGainAttentive: { gross: 2365, net: 3093 },
    })
  })

  it('each tool is bought the minute both its bars and its cash are ready (the bot never waits)', () => {
    for (const job of TOOL_JOBS) {
      const rd = ready[`iron:${job}`]!
      const bought = ladder.ladderTicks[`iron:${job}`]!
      expect([rd.bars, rd.cash].every((t) => Number.isFinite(t))).toBe(true)
      expect(bought).toBeGreaterThanOrEqual(Math.max(rd.bars, rd.cash))
      expect(bought - Math.max(rd.bars, rd.cash)).toBeLessThanOrEqual(2)
    }
  })

  it('nothing goes negative and it never borrows', () => {
    expect(ladder.lowest).toBeGreaterThanOrEqual(0)
    expect(ladder.borrowed).toBe(false)
    expect(end.run.toolTier).toEqual(ALL_IRON)
  })

  it('mining stays below the farm cap with the iron tools: iron Lv10 on vein Lv3 < 0.9 × 24-tile pumpkin', () => {
    expect(ironLv10).toBeLessThan(0.9 * pumpkinIron)
  })

  it('step(s, n) = n × step(s, 1) with the iron tiers, workers, the market and hand-picked sales on', () => {
    withBatch13(() => {
      let start = end
      for (let i = 0; i < start.run.tiles.length; i++) {
        const h = harvest(start, i)
        if (h.ok) start = h.state
      }
      let one = start
      for (let i = 0; i < 600; i++) one = step(one, 1)
      expect(step(start, 600)).toEqual(one)
    })
  })
})