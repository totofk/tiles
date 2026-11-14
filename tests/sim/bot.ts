import { expect } from 'vitest'
import {
  buyLicense,
  buyTile,
  harvest,
  plant,
  selectCrop,
  till,
  water,
  type ActionResult,
} from '../../src/core/actions'
import { type CropId } from '../../src/core/data/crops'
import { ORE_IDS, PICKAXE_TIERS, type OreId, type PickaxeTier } from '../../src/core/data/items'
import { TOOL_JOBS, type ToolJob } from '../../src/core/data/tools'
import { buyToolTier, buyTool } from '../../src/core/tools'
import {
  ACTION_ENERGY_COST,
  TILE_CAP,
  certificateCost,
  cropGrowTicks,
  furnaceUpgradeCost,
  cropSellPrice,
  isSellable,
  itemSellPrice,
  licenseCost,
  furnaceCost,
  furnaceTrayCap,
  moldPrice,
  mineLicenseCost,
  pickaxeCraftCost,
  pickaxeRepairCost,
  smeltFuel,
  smeltOre,
  fuelTicks,
  fieldsCost,
  FIELD_PRESSURE,
  TANK_UNITS_PER_COAL,
  fieldCoalPerPlotHour,
  machineCost,
  pivotCost,
  plotTiles,
  pumpCost,
  pumpFieldCap,
  tankCapCoal,
  sprinklerCost,
  storageCost,
  toolMaxLevel,
  toolTierCost,
  veinUpgradeCost,
  workshopCost,
  type Price,
} from '../../src/core/balance'
import { ITEM_IDS } from '../../src/core/data/items'
import {
  addFuel,
  buildFurnace,
  buyFurnaceUpgrade,
  buyMold,
  collectBars,
  cycleOre,
  loadOre,
} from '../../src/core/furnace'
import {
  bagCount,
  bestPickaxeTier,
  buyMineLicense,
  buyStorage,
  buyWood,
  craftPickaxe,
  dig,
  heldPickaxe,
  repairPickaxe,
  selectPickaxe,
  sellItem,
  upgradeVein,
} from '../../src/core/mining'
import {
  createInitialState,
  createTile,
  type Field,
  type GameState,
  type Plot,
} from '../../src/core/state'
import { step } from '../../src/core/step'
import { growthProgress } from '../../src/core/tile'
import { WORKER_JOBS, type WorkerJob } from '../../src/core/data/workers'
import {
  assignWorker,
  buyCertificate,
  certificateUnlocked,
  freeWorkers,
  hireWorker,
} from '../../src/core/workers'
import { buildSprinkler, buildWorkshop } from '../../src/core/workshop'
import {
  buildPivot,
  buyMachine,
  buyPlot,
  buyPump,
  fieldsOverview,
  fieldsPlantable,
  fillTank,
  pivotsOwned,
  setFieldCrop,
  unlockFields,
} from '../../src/core/fields'
import { acceptOrder, discardOrder, isContract, isOffer } from '../../src/core/orders'
import { simLog } from '../simLog'
import { market, rules } from './balanceMock'

function withoutMarket<T>(run: () => T): T {
  market.on = false
  try {
    return run()
  } finally {
    market.on = true
  }
}

const TICKS = 600

/** batch 34 (task 181): ladder runs per test so far, for the default SIM_LOG scenario name */
const logRuns = new Map<string | undefined, number>()

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
function bestFarmAction(s: GameState, crops: CropId[] = ['eggplant', 'radish', 'potato']): { state: GameState; kind: string } | null {
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
    ...Object.values(run.rack),
    run.furnace.fire,
    ...Object.values(run.furnace.molds).flatMap((m) => [m.ore, m.ready, m.progress]),
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
  | 'storageLv4'
  | 'veinLv4'
  | 'goldPickaxe'
  | `gold:${ToolJob}`
  | 'workshop'
  | 'tiles13'
  | 'tiles19'
  | `sprinkler${1 | 2 | 3 | 4}`
  | 'fields'
  | 'pivot2'
  | 'plots10'
  | 'pump1'
  | 'plots30'
  | 'harvester1'
  | 'seeder1'
  | 'pump2'
  | 'plots60'
  | 'harvester2'
  | 'seeder2'
  | 'harvester3'

type Goal = { name: LadderStep; done: (s: GameState) => boolean; buy: (s: GameState) => ActionResult; keep: (s: GameState) => Price }

const COPPER_PICKAXE_BARS = pickaxeCraftCost('copper', createInitialState().meta).copperBar!

const COPPER_TOOL_BARS = toolTierCost(1, createInitialState().meta).copperBar!

/** bars of this kind still in its mold: whole bars' ore loaded (the old queue) + its tray; 0 with no such mold */
const inMold = ({ run }: GameState, ore: OreId) => {
  const m = run.furnace.molds[ore]
  return m ? Math.floor(m.ore / smeltOre()) + m.ready : 0
}

/** keep `bars` bars plus the ore and coal to smelt the ones not yet in storage, the copper mold or its tray */
const keepBars =
  (bars: number) =>
  (s: GameState): Price => {
    const toSmelt = Math.max(0, bars - (s.run.inventory.copperBar ?? 0) - inMold(s, 'copperOre'))
    return { cash: 0, copperBar: bars, copperOre: smeltOre() * toSmelt, coal: smeltFuel('coal') * toSmelt }
  }
/**
 * batch 9: what the batch-7 bot's "enqueue coal jobs while it can" does on the fuelled furnace: load k cycles of ore
 * and exactly k coal together, k ≤ the old 5-job cap (cycles loaded + tray), so the fire never burns without ore.
 * Batch 16 (`capped`, the gold runs' hand-smelting): capped at the goal's ore shortfall so surplus ore sells instead of
 * becoming an unsellable bar; the ore load and the fuel are capped separately, so leftover fire or the fire cap never
 * vetoes the other half. Batch 33 (molds): every owned mold whose kind the keep lists (gold also while the repair
 * reserve is unbanked) loads at once — the keep's ore field is the signal of what to smelt
 */

function smeltCoalJobs(s: GameState, keep: Price, capped: boolean): ActionResult {
  let r: ActionResult = { ok: false, error: 'NOTHING_TO_DO' }
  for (const kind of ORE_IDS) {
    const { inventory, furnace } = s.run
    if (!furnace.molds[kind] || (keep[kind] === undefined && !(kind === 'goldOre' && goldReserveShort(s)))) continue
    const fuel = smeltFuel('coal', kind)
    const room = furnaceTrayCap(furnace.levels.tray) - inMold(s, kind)
    if (!capped) {
      const k = Math.min(Math.floor((inventory[kind] ?? 0) / smeltOre()), Math.floor((inventory.coal ?? 0) / fuel), room)
      if (k < 1) continue
      const ore = loadOre(s, kind, k * smeltOre())
      const done = ore.ok ? addFuel(ore.state, 'coal', k * fuel) : ore
      if (done.ok) r = { ok: true, state: (s = done.state) }
      continue
    }
    const n = Math.max(0, Math.min(Math.ceil((keep[kind] ?? 0) / smeltOre()), room))
    const ore = loadOre(s, kind, n * smeltOre())
    const fuelled = addFuel(ore.ok ? ore.state : s, 'coal', n * fuel)
    const done = ore.ok ? (fuelled.ok ? fuelled : ore) : fuelled
    if (done.ok) r = { ok: true, state: (s = done.state) }
  }
  return r
}

/** every owned mold's tray into storage, copper → iron → gold, as far as room goes */
function collectMolds(s: GameState): ActionResult {
  let r: ActionResult = { ok: false, error: 'NOTHING_TO_DO' }
  for (const kind of ORE_IDS) {
    const c = collectBars(s, kind)
    if (c.ok) r = { ok: true, state: (s = c.state) }
  }
  return r
}
/**
 * batch 33: a mold not owned yet is the goal while a goal that smelts its kind is next — keep its price (bars, with the
 * ore and coal to smelt them, and stone) so mining does not sell what it needs
 */

const moldKeep = (kind: 'ironOre' | 'goldOre') => (s: GameState): Price => {
  const price = moldPrice(kind, s.meta)
  const bars = kind === 'ironOre' ? keepBars(price.copperBar!)(s) : keepIronBars(price.ironBar!)(s)
  return { ...bars, stone: price.stone }
}

const needsMold = (kind: 'ironOre' | 'goldOre', g: Goal): Goal => ({
  ...g,
  keep: (s) => (s.run.furnace.built && !s.run.furnace.molds[kind] ? moldKeep(kind)(s) : g.keep(s)),
})

/** batch 32: a crafted tier stays on the rack, so a pickaxe rung is done once its tier is owned */
const rackRung = (tier: PickaxeTier): Pick<Goal, 'done' | 'buy'> => ({
  done: (s) => s.run.rack[tier] !== undefined,
  buy: (s) => craftPickaxe(s, tier),
})

const LADDER: Goal[] = [
  { name: 'storageLv1', done: (s) => s.run.storageLevel >= 1, buy: buyStorage, keep: (s) => storageCost(s.run.storageLevel, s.meta) },
  { name: 'veinLv1', done: (s) => s.run.vein.level >= 1, buy: upgradeVein, keep: (s) => veinUpgradeCost(s.run.vein.level, s.meta)! },
  { name: 'furnace', done: (s) => s.run.furnace.built, buy: buildFurnace, keep: (s) => furnaceCost(s.meta) },
  { name: 'storageLv2', done: (s) => s.run.storageLevel >= 2, buy: buyStorage, keep: (s) => storageCost(s.run.storageLevel, s.meta) },
  { name: 'veinLv2', done: (s) => s.run.vein.level >= 2, buy: upgradeVein, keep: (s) => veinUpgradeCost(s.run.vein.level, s.meta)! },
  {
    name: 'copperPickaxe',
    ...rackRung('copper'),
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

/** keep `bars` iron bars plus the iron ore and coal to smelt the ones not yet in storage or the iron mold */
const keepIronBars =
  (bars: number) =>
  (s: GameState): Price => {
    const toSmelt = Math.max(0, bars - (s.run.inventory.ironBar ?? 0) - inMold(s, 'ironOre'))
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
  // iron or better (batch 16: a gold pickaxe in hand must not send the ladder back to crafting iron)
  needsMold('ironOre', { name: 'ironPickaxe', ...rackRung('iron'), keep: keepIronBars(pickaxeCraftCost('iron', IRON_PRICE).ironBar!) }),
  needsMold('ironOre', {
    name: 'mineCertificate',
    done: (s) => s.run.workers.certificates.includes('mine'),
    buy: (s) => buyCertificate(s, 'mine'),
    keep: keepIronBars(certificateCost('mine', IRON_PRICE).ironBar!),
  }),
]

/** batch 15: after the mine certificate, each job's iron tier in order (water → harvest → plant) */
const IRON_TOOLS_LADDER: Goal[] = [
  ...IRON_LADDER,
  ...TOOL_JOBS.map(
    (job): Goal =>
      needsMold('ironOre', {
        name: `iron:${job}`,
        done: (s) => s.run.toolTier[job] >= 2,
        buy: (s) => buyToolTier(s, job),
        keep: keepIronBars(toolTierCost(2, createInitialState().meta).ironBar!),
      }),
  ),
]

// the goals that need the furnace on iron (the iron pickaxe, the mine certificate and the three iron tools)
const IRON_ON_GOALS = IRON_TOOLS_LADDER.slice(IRON_TOOLS_LADDER.length - 5)

/** keep `bars` gold bars plus the gold ore and coal to smelt the ones not yet in storage or the gold mold */
const keepGoldBars =
  (bars: number) =>
  (s: GameState): Price => {
    const toSmelt = Math.max(0, bars - (s.run.inventory.goldBar ?? 0) - inMold(s, 'goldOre'))
    return { cash: 0, goldBar: bars, goldOre: smeltOre() * toSmelt, coal: smeltFuel('coal', 'goldOre') * toSmelt }
  }
/**
 * batch 19: every goal from the machines on banks the gold pickaxe's repair bars (2 gold) on top of its own gold
 * target, and its buy leaves them in the bag (`goldCost` = the gold bars the buy itself spends). A blunt gold pickaxe
 * mines iron and gold rocks as stone; with no bars left to repair, that wedge is permanent (the first run stalled
 * 106 h on it). The reserve is one combined chain — goal bars + reserve — because keepGoldBars(2) next to 8 banked
 * goal bars sees no shortfall of its own; while it is unbanked the gold chain smelts first (the furnace takes gold
 * before the goal's ore) and the goal's banked bars stay floored so a mid-goal repair cannot sell them out from
 * under the ladder. Batch 21: the workshop-ladder goals wrap in it too — under the re-tuned market the pickaxe went
 * blunt mid-workshop with zero gold banked and the run wedged for good
 */

const repairSafe = (g: Goal, goldCost: (s: GameState) => number = () => 0): Goal => ({
  ...g,
  keep: (s: GameState): Price => {
    const reserve = pickaxeRepairCost('gold', s.meta).goldBar!
    const banked = (s.run.inventory.goldBar ?? 0) + inMold(s, 'goldOre')
    const gk = g.keep(s)
    if (banked < reserve) {
      const chain = keepGoldBars(reserve)(s)
      return { cash: 0, ironBar: gk.ironBar ?? 0, goldBar: reserve, goldOre: chain.goldOre, coal: chain.coal }
    }
    const target = (gk.goldBar ?? 0) + reserve
    const chain = keepGoldBars(target)(s)
    return { ...gk, goldBar: target, goldOre: chain.goldOre, coal: Math.max(gk.coal ?? 0, chain.coal ?? 0) }
  },
  buy: (s: GameState) =>
    s.run.rack.gold === undefined || (s.run.inventory.goldBar ?? 0) >= goldCost(s) + pickaxeRepairCost('gold', s.meta).goldBar!
      ? g.buy(s)
      : { ok: false, error: 'NOT_ENOUGH_CASH' },
})

/** batch 16: after the iron tools, storage Lv4 (vein Lv4's 53 items need it), vein Lv4, gold pickaxe, gold sickle and dibber */
const GOLD_LADDER: Goal[] = [
  ...IRON_TOOLS_LADDER,
  { name: 'storageLv4', done: (s) => s.run.storageLevel >= 4, buy: buyStorage, keep: (s) => storageCost(s.run.storageLevel, s.meta) },
  {
    name: 'veinLv4',
    done: (s) => s.run.vein.level >= 4,
    buy: upgradeVein,
    // the stone and the iron bars with the ore and coal to smelt them
    keep: (s) => ({ ...keepIronBars(veinUpgradeCost(3, IRON_PRICE)!.ironBar!)(s), stone: veinUpgradeCost(3, s.meta)!.stone }),
  },
  needsMold('goldOre', { name: 'goldPickaxe', ...rackRung('gold'), keep: keepGoldBars(pickaxeCraftCost('gold', IRON_PRICE).goldBar!) }),
  ...(['harvest', 'plant'] as const).map(
    (job): Goal =>
      needsMold('goldOre', {
        name: `gold:${job}`,
        done: (s) => s.run.toolTier[job] >= 3,
        buy: (s) => buyToolTier(s, job),
        keep: keepGoldBars(toolTierCost(3, createInitialState().meta).goldBar!),
      }),
  ),
]

// the goals that need the furnace on gold (the gold pickaxe and the two gold farm tools)
const GOLD_ON_GOALS = GOLD_LADDER.slice(GOLD_LADDER.length - 3)

/** batch 17: keep every bar kind one sprinkler still needs, with the ore and coal to smelt the shortfall */
const keepSprinklerBars = (s: GameState): Price => {
  const cost = sprinklerCost(s.meta)
  const parts = [
    ['copperBar', 'copperOre'],
    ['ironBar', 'ironOre'],
    ['goldBar', 'goldOre'],
  ] as const
  const keep: Price = { cash: 0 }
  let coal = 0
  for (const [bar, ore] of parts) {
    const bars = cost[bar]!
    keep[bar] = bars
    const toSmelt = Math.max(0, bars - (s.run.inventory[bar] ?? 0) - inMold(s, ore))
    keep[ore] = smeltOre() * toSmelt
    coal += smeltFuel('coal', ore) * toSmelt
  }
  return { ...keep, coal }
}
/**
 * batch 17 (re-shaped batch 26): after the gold tools, the workshop, then a sprinkler on each bed's socket — the valve
 * is gone (batch 28) and beds 3–4 need tiles first (bed k is socketed once tile 6k+1 exists), so tiles are bought to
 * 13 before bed 3 and to 19 before bed 4
 */

const WORKSHOP_LADDER: Goal[] = [
  ...GOLD_LADDER,
  repairSafe({
    name: 'workshop',
    done: (s) => s.run.workshop.built,
    buy: buildWorkshop,
    keep: (s) => ({ ...keepIronBars(workshopCost(s.meta).ironBar!)(s), stone: workshopCost(s.meta).stone }),
  }),
  repairSafe({ name: 'sprinkler1', done: (s) => s.run.workshop.beds[0] === true, buy: (s) => buildSprinkler(s, 0), keep: keepSprinklerBars }, (s) => sprinklerCost(s.meta).goldBar!),
  repairSafe({ name: 'sprinkler2', done: (s) => s.run.workshop.beds[1] === true, buy: (s) => buildSprinkler(s, 1), keep: keepSprinklerBars }, (s) => sprinklerCost(s.meta).goldBar!),
  { name: 'tiles13', done: (s) => s.run.tiles.length >= 13, buy: buyTile, keep: () => ({ cash: 0 }) },
  repairSafe({ name: 'sprinkler3', done: (s) => s.run.workshop.beds[2] === true, buy: (s) => buildSprinkler(s, 2), keep: keepSprinklerBars }, (s) => sprinklerCost(s.meta).goldBar!),
  { name: 'tiles19', done: (s) => s.run.tiles.length >= 19, buy: buyTile, keep: () => ({ cash: 0 }) },
  repairSafe({ name: 'sprinkler4', done: (s) => s.run.workshop.beds[3] === true, buy: (s) => buildSprinkler(s, 3), keep: keepSprinklerBars }, (s) => sprinklerCost(s.meta).goldBar!),
]

// the goals that need the furnace smelting (the workshop's iron bars and the sprinklers' mixed bars)
const WORKSHOP_ON_GOALS = WORKSHOP_LADDER.slice(GOLD_LADDER.length)
/**
 * batch 21: true while the gold pickaxe's 2 repair bars are not banked (bag + a gold furnace's slot and tray). A blunt
 * gold pickaxe mines no ore and repairs only with gold bars, so once blunt with none banked the run wedges for good —
 * the batch 19 machines lesson, now applied from the workshop on: the reserve smelts before any goal ore
 */

const goldReserveShort = (s: GameState): boolean => {
  const banked = (s.run.inventory.goldBar ?? 0) + inMold(s, 'goldOre')
  // batch 32: only while a sharp iron or gold pickaxe can mine gold ore (the old "gold in hand"); with none, a furnace
  // held on gold for a reserve nothing can mine wedges the run (every rack tier blunt, 🥇0)
  const canMineGold = (s.run.rack.iron ?? 0) > 0 || (s.run.rack.gold ?? 0) > 0
  return s.run.rack.gold !== undefined && canMineGold && banked < pickaxeRepairCost('gold', s.meta).goldBar!
}

/** the next piece of land: the pivot of the first dry field holding plots, else the next plot */
const buyLand = (s: GameState) => {
  const dry = s.run.fields.list.findIndex((f) => !f.pivot)
  return dry >= 0 ? buildPivot(s, dry) : buyPlot(s)
}

const pivotGold = (s: GameState) => pivotCost(pivotsOwned(s.run.fields) + 1, s.meta).goldBar!

const keepPivot = (s: GameState): Price => {
  const cost = pivotCost(pivotsOwned(s.run.fields) + 1, s.meta)
  return plusKeep(plusKeep(keepBars(cost.copperBar!), keepIronBars(cost.ironBar!)), keepGoldBars(cost.goldBar!))(s)
}

/** the gold the next piece of land spends: a pivot's bars, a plot none */
const landGold = (s: GameState) => (s.run.fields.list.some((f) => !f.pivot) ? pivotGold(s) : 0)

/** n plots owned, every field pivoted */
const plotsGoal = (name: 'plots10' | 'plots30' | 'plots60', n: number): Goal =>
  repairSafe({ name, done: (s) => fieldsOverview(s.run).plots >= n && pivotsOwned(s.run.fields) === s.run.fields.list.length, buy: buyLand, keep: keepPivot }, landGold)

/** an hour of the pivoted plots' tank burn, in coal */
const hourOfBurn = (s: GameState) => Math.ceil(fieldCoalPerPlotHour() * s.run.fields.list.reduce((n, f) => (f.pivot ? n + f.plots.length : n), 0))
/**
 * batch 18: after the workshop ladder — the fields unlock (iron bars). Batch 28 (task 148g): the second field's pivot
 * and land to 10 plots (both Pump-0 fields).
 */

const FIELDS_LADDER: Goal[] = [
  ...WORKSHOP_LADDER,
  { name: 'fields', done: (s) => s.run.fields.unlocked, buy: unlockFields, keep: (s) => keepIronBars(fieldsCost(s.meta).ironBar!)(s) },
  repairSafe({ name: 'pivot2', done: (s) => pivotsOwned(s.run.fields) >= 2, buy: buyLand, keep: keepPivot }, landGold),
  plotsGoal('plots10', 10),
]

const FIELDS_ON_GOALS = FIELDS_LADDER.slice(WORKSHOP_LADDER.length)

/** the sum of two keeps, except coal: the bigger phase budget covers both (batch 19: the sum topped the bag and wedged the miner on a full coal bag; kept as is with molds, batch 33) */
const plusKeep = (a: (s: GameState) => Price, b: (s: GameState) => Price) => (s: GameState): Price => {
  const out = a(s)
  for (const [id, n] of Object.entries(b(s)) as [keyof Price, number][]) out[id] = id === 'coal' ? Math.max(out[id] ?? 0, n) : (out[id] ?? 0) + n
  return out
}
/**
 * batch 19: after the first 10 plots — the throughput machines with the pumps and land they need to matter (batch 28,
 * task 148g: pump1 → plots30 → harvester1 → seeder1 → pump2 → plots60 → harvester2 → seeder2 → harvester3).
 */

const machineKeep = (kind: 'harvester' | 'seeder', tier: 1 | 2 | 3): ((s: GameState) => Price) => {
  const cost = (s: GameState) => machineCost(kind, tier, s.meta)
  return tier === 1
    ? (s) => keepIronBars(cost(s).ironBar!)(s)
    : tier === 2
      ? (s) => plusKeep(keepIronBars(cost(s).ironBar!), keepGoldBars(cost(s).goldBar!))(s)
      : (s) => keepGoldBars(cost(s).goldBar!)(s)
}

const MACHINES_LADDER: Goal[] = [
  ...FIELDS_LADDER,
  repairSafe({ name: 'pump1', done: (s) => s.run.fields.pump >= 1, buy: buyPump, keep: (s) => keepBars(pumpCost(0, s.meta)!.copperBar!)(s) }),
  plotsGoal('plots30', 30),
  repairSafe({ name: 'harvester1', done: (s) => s.run.fields.machines.harvester.includes(1), buy: (s) => buyMachine(s, 'harvester', 1), keep: machineKeep('harvester', 1) }),
  repairSafe({ name: 'seeder1', done: (s) => s.run.fields.machines.seeder.includes(1), buy: (s) => buyMachine(s, 'seeder', 1), keep: machineKeep('seeder', 1) }),
  repairSafe({ name: 'pump2', done: (s) => s.run.fields.pump >= 2, buy: buyPump, keep: (s) => keepIronBars(pumpCost(1, s.meta)!.ironBar!)(s) }),
  plotsGoal('plots60', 60),
  repairSafe({ name: 'harvester2', done: (s) => s.run.fields.machines.harvester.includes(2), buy: (s) => buyMachine(s, 'harvester', 2), keep: machineKeep('harvester', 2) }, (s) => machineCost('harvester', 2, s.meta).goldBar!),
  repairSafe({ name: 'seeder2', done: (s) => s.run.fields.machines.seeder.includes(2), buy: (s) => buyMachine(s, 'seeder', 2), keep: machineKeep('seeder', 2) }, (s) => machineCost('seeder', 2, s.meta).goldBar!),
  repairSafe({ name: 'harvester3', done: (s) => s.run.fields.machines.harvester.includes(3), buy: (s) => buyMachine(s, 'harvester', 3), keep: machineKeep('harvester', 3) }, (s) => machineCost('harvester', 3, s.meta).goldBar!),
]

const MACHINES_ON_GOALS = MACHINES_LADDER.slice(FIELDS_LADDER.length)

// the goals whose ore the furnace must be smelting (with loaders assigned the branch below still skips the manual
// jobs, so the extra names only matter for a batch-16 gold run, which hand-smelts every tier)
const smeltsFor = (g: Goal | undefined) =>
  g !== undefined &&
  (g.name === 'copperPickaxe' ||
    g.name.startsWith('copper:') ||
    PLANT_LADDER.slice(COPPER_LADDER.length).includes(g) ||
    IRON_ON_GOALS.includes(g) ||
    (g.name === 'veinLv3' || g.name === 'veinLv4') ||
    GOLD_ON_GOALS.includes(g) ||
    WORKSHOP_ON_GOALS.includes(g) ||
    // batch 29 (task 151e): plots10 too — its pivots need gold bars, so the bot smelts the gold ore it holds
    FIELDS_ON_GOALS.slice(0, 3).includes(g) ||
    MACHINES_ON_GOALS.includes(g))

/**
 * batch 9: the player's share of the furnace once the ore loader loads ore and collects: coal for every cycle of ore in
 * the slot and storage the fire does not cover yet (one coal per cycle), so the fire never burns without ore
 */

function fuelForOre(s: GameState): ActionResult {
  const { inventory, furnace } = s.run
  // batch 33: every owned mold's cycles (slot + storage) at its own coal per cycle, less the fire already lit (in coal)
  const need = ORE_IDS.reduce((n, kind) => {
    const m = furnace.molds[kind]
    return m ? n + Math.floor((m.ore + (inventory[kind] ?? 0)) / cycleOre(furnace)) * smeltFuel('coal', kind) : n
  }, 0)
  const k = need - Math.ceil(furnace.fire / fuelTicks('coal'))
  return k >= 1 ? addFuel(s, 'coal', k) : { ok: false, error: 'NOTHING_TO_DO' }
}

/** mineEarly: buy the mine license as soon as it is affordable while energy is idle;
 *  otherwise only once the pumpkin license is owned (the main crop is never delayed).
 *  licenses: bought in this order, each as soon as it is affordable; crops: what to plant, best first. */

function runBot(
  mineEarly: boolean,
  {
    ticks = TICKS,
    // batch 35: carrot (the old free start) is now the first paid rung; the bot starts on potato
    licenses = ['radish', 'eggplant'],
    crops = ['eggplant', 'radish', 'potato'],
    saveForStorage = false,
    ladder = false,
    copperTools = false,
    workers = false,
    furnace = false,
    planter = false,
    iron = false,
    ironTools = false,
    gold = false,
    sprinklers = false,
    fields = false,
    /** batch 19 (with fields): MACHINES_LADDER; the machines are bought as goals, the keeps hold their bars */
    machines = false,
    buyTools = false,
    onEnd,
    onTick,
    initial,
    drainSlot = false,
    log: logName,
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
     * batch 11 (with planter): IRON_LADDER; while an iron goal is next the bot buys the iron mold (batch 33; the goal
     * keeps its price until then), and with an ore loader on it sells the copper ore in storage before each tick once
     * the mold is in (so the loader does not fill storage with copper bars); the mine worker, once certified, gets one
     * worker like a loader
     */
    iron?: boolean
    /**
     * batch 15 (with iron): IRON_TOOLS_LADDER; after the mine certificate the bot buys the three iron farm tools
     * (water → harvest → plant), keeping the iron bars for each
     */
    ironTools?: boolean
    /**
     * batch 16 (with ironTools): GOLD_LADDER; while a gold goal is next the bot buys the gold mold (batch 33; the goal
     * keeps its price until then)
     */
    gold?: boolean
    /**
     * batch 17 (with gold): WORKSHOP_LADDER; every bar kind the next goal is still short of smelts in its own mold at
     * once (batch 33; before, one kind at a time); a fuel loader and a miner join the staff (the ore
     * loader stays off — hand-smelting keeps the keep's cap); once the machines cover every tile, the water
     * workers move to planting; the bag keeps an hour of pump coal beyond the goal's needs
     */
    sprinklers?: boolean
    /**
     * batch 18 (with sprinklers): FIELDS_LADDER; after the valve and sprinklers 2–4 the fields unlock (iron bars),
     * then the first pipes (copper bars), then fields are bought one at a time toward 100 whenever affordable; the
     * planter and harvester work them whenever the home plot is idle, the bag keeps an hour of pipe coal too
     */
    fields?: boolean
    /**
     * batch 19 (with fields): MACHINES_LADDER; after the first 100 fields the machines are bought as goals
     * (harvester1, seeder1, pipes 2–3, fields to 300, harvester2, seeder2, harvester3), keeping each recipe's bars
     */
    machines?: boolean
    /**
     * batch 13 (with workers): buys the water and harvest tool levels (and plant with `planter`) as soon as each is
     * unlocked and affordable, since a farm certificate needs its job's Lv3 tool; keeps the unbought farm
     * certificates' stone and coal when storage is full; hires only once a farm certificate is owned
     */
    buyTools?: boolean
    /** batch 20: the prestige sim's run 2 starts from a sold state (createFreshRun already shaped it) */
    initial?: GameState
    /**
     * batch 20: never sells the ore that completes a mold's partial cycle — the hand-smelt loads smeltOre units but a
     * cycle takes smeltOre × batchBars, and once the surplus ore is sold the residue can never finish (the prestige
     * sim's run 2 wedged on 1 copper ore for 150 h when a residue blocked the old kind switch)
     */
    drainSlot?: boolean
    /** receives the state at the cut-off */
    onEnd?: (s: GameState) => void
    /** batch 14: receives the state after every tick */
    onTick?: (s: GameState) => void
    /** batch 34 (task 181): the scenario part of the SIM_LOG=1 file name (default `run<n>` within the test) */
    log?: string
  } = {},
) {
  const testName = expect.getState().currentTestName
  const runNo = (logRuns.get(testName) ?? 0) + 1
  logRuns.set(testName, runNo)
  const log = simLog(testName, logName ?? `run${runNo}`)
  let bought: string[] = []
  const marked = new Set<string>()
  const goals = machines ? MACHINES_LADDER : fields ? FIELDS_LADDER : sprinklers ? WORKSHOP_LADDER : gold ? GOLD_LADDER : ironTools ? IRON_TOOLS_LADDER : iron ? IRON_LADDER : planter ? PLANT_LADDER : furnace ? FURNACE_LADDER : copperTools ? COPPER_LADDER : LADDER
  const ladderTicks: Partial<Record<LadderStep | 'firstBar' | 'ironMold' | 'firstIronBar' | 'goldMold' | 'firstGoldBar', number>> = {}
  const workerTicks: Partial<Record<'firstCertificate' | `${WorkerJob}Certificate` | 'firstHire' | 'pool3', number>> = {}
  // batch 13: the first tick each certificate could be bought (its gates met) and the storage held then
  const certUnlocked: Partial<Record<WorkerJob, { tick: number; bagCapacity: number }>> = {}
  const toolJobs: ToolJob[] = buyTools ? ['water', 'harvest', ...(planter ? (['plant'] as const) : [])] : []
  let s = initial ?? createInitialState()
  const m: Milestones = {}
  let minCash = s.run.cash
  let lowest = lowestValue(s)
  // the tick each license became affordable while it was the next one to buy, and the tick it was bought
  const licenseAffordable: Partial<Record<CropId, number>> = {}
  const licenseBought: Partial<Record<CropId, number>> = {}
  let storageAffordable: number | undefined
  let storageBought: number | undefined
  let veinBought: number | undefined
  // batch 28.1: set once the bot swapped a blunt pickaxe for a lower tier; the pickaxe rungs then smelt their kind
  let swapped = false
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
  /** a logged buy attempt (batch 34 task 181); `price` is read only when SIM_LOG=1 */
  const buyAs = (item: string, r: ActionResult, price?: () => Price) => {
    if (log) {
      log.attempt(s, item, r, price?.())
      if (r.ok) bought.push(`buy:${item}`)
    }
    return tryAct(r, null)
  }

  // Mining fills idle energy only. Order: license → sell stone when the bag is full
  // → wood + pickaxe when it has none, wood + repair when blunt (never mines by hand) → mine.
  const mineOnce = (tick: number): boolean => {
    if (!s.run.mineLicense) {
      if (!mineEarly && !s.run.licenses.includes('eggplant')) return false
      if (!tryAct(buyMineLicense(s), null)) return false
      m.mineLicenseBought ??= tick
    }
    // the pinned runs only check storage; saveForStorage keeps its stone (and stops mining when storage is full)
    // until it buys storage level 1, then vein level 1
    if (buyStorage(s).ok) storageAffordable ??= tick
    // when the bag is full, sell only what the goal does not need; true when it stays full (stop mining)
    const sellSurplus = (goal: Goal | undefined): boolean => {
      if (bagCount(s.run) < s.run.bagCapacity) return false
      const keep: Price = { ...(goal?.keep(s) ?? { cash: 0 }) }
      // batch 18: an hour of the Fields' coal stays too (batch 28: the pivoted plots' tank burn; machines runs too)
      if (fields || machines)
        keep.coal = Math.max(keep.coal ?? 0, hourOfBurn(s) - Math.floor(s.run.fields.tank / TANK_UNITS_PER_COAL))
      // batch 20 (drainSlot): the ore that completes a mold's partial cycle never sells
      if (drainSlot) {
        const f = s.run.furnace
        for (const kind of ORE_IDS) {
          const ore = f.molds[kind]?.ore ?? 0
          const topUp = (cycleOre(f) - (ore % cycleOre(f))) % cycleOre(f)
          if (ore > 0 && topUp > 0) keep[kind] = Math.max(keep[kind] ?? 0, topUp)
        }
      }
      for (const job of buyTools ? FARM_JOBS : [])
        if (!s.run.workers.certificates.includes(job))
          for (const [id, n] of Object.entries(certificateCost(job, s.meta)) as [keyof Price, number][])
            if (id !== 'cash') keep[id] = Math.max(keep[id] ?? 0, n)
      for (const id of ['stone', 'coal', 'copperOre', 'ironOre', 'goldOre'] as const) {
        const extra = (s.run.inventory[id] ?? 0) - (keep[id] ?? 0)
        if (extra > 0) tryAct(sellItem(s, id, extra), mine)
      }
      return bagCount(s.run) >= s.run.bagCapacity
    }
    if (ladder) {
      // batch 7: buy the next goal as soon as it can be paid; smelt (coal fuel) and collect while the copper pickaxe
      // is the goal; when storage is full sell only what the goal does not need, else stop mining
      const goal = goals.find((g) => !g.done(s))
      if (goal && buyAs(goal.name, goal.buy(s), () => goal.keep(s))) ladderTicks[goal.name] ??= tick
      const next = goals.find((g) => !g.done(s))
      if (smeltsFor(next)) {
        const { assigned } = s.run.workers
        if (assigned.ore === 0) {
          // the keep's ore field is also the signal of what to smelt (batch 33: every mold it lists at once; batch 21:
          // the gold mold also while the repair reserve is unbanked, whatever the goal's keep says)
          tryAct(smeltCoalJobs(s, next!.keep(s), gold), null)
          // batch 17: ready bars need bag room before they can be collected — sell the surplus first, or the dig below
          // refills every freed slot and the last bar never leaves the tray (the sprinkler keeps have no surplus)
          if (sprinklers && Object.values(s.run.furnace.molds).some((m) => m.ready > 0)) sellSurplus(next)
          tryAct(collectMolds(s), null)
          if (gold) tryAct(fuelForOre(s), null)
        } else if (assigned.fuel === 0) tryAct(fuelForOre(s), null)
      }
      if (sellSurplus(next)) return false
    } else if (saveForStorage && s.run.storageLevel === 0) {
      if (tryAct(buyStorage(s), null)) storageBought = tick
      else if (bagCount(s.run) >= s.run.bagCapacity) return false
    } else if (saveForStorage && s.run.vein.level === 0) {
      if (tryAct(upgradeVein(s), null)) veinBought = tick
      else if (bagCount(s.run) >= s.run.bagCapacity) return false
    }
    if (bagCount(s.run) >= s.run.bagCapacity) tryAct(sellItem(s, 'stone', s.run.inventory.stone ?? 0), mine)
    // batch 32 (task 172c rule, landed with the rack in 168): repair a blunt tier the bag pays for (bars still in the
    // tray count; never sells bars for it), then mine with the best sharp tier on the rack; with none sharp, the wooden
    // pickaxe (crafted or repaired with bought wood) is the floor
    if (PICKAXE_TIERS.some((t) => t !== 'wooden' && s.run.rack[t] === 0)) {
      tryAct(collectMolds(s), null)
      for (const t of PICKAXE_TIERS) if (t !== 'wooden' && s.run.rack[t] === 0) tryAct(repairPickaxe(s, t), null)
    }
    const sharp = PICKAXE_TIERS.findLast((t) => (s.run.rack[t] ?? 0) > 0)
    if (!sharp) {
      const owned = s.run.rack.wooden !== undefined
      if (bestPickaxeTier(s.run)) swapped = true
      const need = (owned ? pickaxeRepairCost : pickaxeCraftCost)('wooden', s.meta).wood! - (s.run.inventory.wood ?? 0)
      if (need > 0 && !tryAct(buyWood(s, need), mine)) return false
      if (!tryAct(owned ? repairPickaxe(s, 'wooden') : craftPickaxe(s), mine)) return false
    }
    if (s.run.selectedPickaxe !== (sharp ?? 'wooden')) tryAct(selectPickaxe(s, sharp ?? 'wooden'), null)
    if (!tryAct(dig(s), mine, ACTION_ENERGY_COST)) return false
    m.firstDig ??= tick
    return true
  }

  // batch 8: certificates (water first), then every affordable hire; a free worker goes to water while water has no
  // more workers than harvest, else to harvest. Certificates bought here are farm jobs only; the loaders' come from
  // FURNACE_LADDER and, with `furnace`, each certified loader gets one worker before free ones go to the farm.
  const staff = (tick: number) => {
    for (const job of FARM_JOBS)
      if (buyAs(`${job}Certificate`, buyCertificate(s, job), () => certificateCost(job, s.meta))) {
        workerTicks.firstCertificate ??= tick
        workerTicks[`${job}Certificate`] = tick
      }
    const certified = !buyTools || FARM_JOBS.some((job) => s.run.workers.certificates.includes(job))
    while (certified && buyAs('hire', hireWorker(s))) {
      workerTicks.firstHire ??= tick
      if (s.run.workers.pool >= 3) workerTicks.pool3 ??= tick
    }
    // batch 16: a gold run staffs only the planter and a harvester — with loaders (and a mine worker) on, every ore
    // ever mined becomes an unsellable surplus bar, and by the third iron tool the bag is too full of them to hold the
    // gold prices' stone; the harvester frees the player's energy for the mining the gold goals need.
    // batch 17: a sprinkler run adds the fuel loader (batch 26: furnace-only; the beds take no coal) and the miner back — the ore
    // loader stays off so the keep still caps what gets smelted
    const oneEach: WorkerJob[] = [
      ...(furnace && !gold && !sprinklers ? (['ore', 'fuel'] as const) : []),
      ...(sprinklers ? (['fuel', 'mine'] as const) : []),
      ...(planter ? (['plant'] as const) : []),
      ...((iron || ironTools) && !gold && !sprinklers ? (['mine'] as const) : []),
      ...(gold || sprinklers ? (['harvest'] as const) : []),
    ]
    for (const job of oneEach) {
      const { assigned, certificates } = s.run.workers
      if (!certificates.includes(job) || assigned[job] > 0) continue
      if (freeWorkers(s.run) < 1) tryAct(assignWorker(s, assigned.water > assigned.harvest ? 'water' : 'harvest', -1), null)
      tryAct(assignWorker(s, job, 1), null)
    }
    const best = crops.find((c) => s.run.licenses.includes(c))
    if (s.run.workers.assigned.plant > 0 && best && best !== s.run.plantCrop) tryAct(selectCrop(s, best), null)
    // batch 17: once the beds cover every tile, watering is theirs — the water workers move to planting (batch 26: beds)
    const covered = sprinklers && s.run.workshop.beds.filter(Boolean).length * 6 >= s.run.tiles.length
    while (s.run.workers.assigned.water > 0 && covered && s.run.workers.certificates.includes('plant')) {
      tryAct(assignWorker(s, 'water', -1), null)
      if (!tryAct(assignWorker(s, 'plant', 1), null)) break
    }
    while (freeWorkers(s.run) > 0) {
      const { assigned, certificates } = s.run.workers
      const job: WorkerJob =
        !covered && certificates.includes('water') && (assigned.water <= assigned.harvest || !certificates.includes('harvest')) ? 'water' : 'harvest'
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
    if (want && buyAs(`license:${want}`, buyLicense(s, want), () => ({ cash: licenseCost(want, s.meta) }))) licenseBought[want] ??= tick
    for (const job of toolJobs) while (s.run.tools[job] < toolMaxLevel(job) && tryAct(buyTool(s, job), null));
    if (buyTools)
      for (const job of WORKER_JOBS) if (certificateUnlocked(s.run, job)) certUnlocked[job] ??= { tick, bagCapacity: s.run.bagCapacity }
    if (workers) staff(tick)
    // batch 16: a gold run's staffed lemon farm eats every point of energy, so the ladder buy cannot wait for idle mining
    if (gold || sprinklers) {
      const goal = goals.find((g) => !g.done(s))
      if (goal && buyAs(goal.name, goal.buy(s), () => goal.keep(s))) ladderTicks[goal.name] ??= tick
    }
    // batch 18: the planter works the fields only once a crop is picked — the bot picks lemons, its best licensed crop
    // (batch 28: every pivoted field's chip)
    if ((fields || machines) && s.run.fields.unlocked && fieldsPlantable(s.run, 'pumpkin')) {
      s.run.fields.list.forEach((f, i) => f.pivot && f.crop === null && tryAct(setFieldCrop(s, i, 'pumpkin'), null))
    }
    // batch 28: the hour of burn the bot keeps lives in the tank — storage coal above the next goal's smelting coal
    // goes in while it has room (an hour held in the bag on top of a pivot's bars filled it and wedged the gold pickaxe)
    if ((fields || machines) && s.run.fields.unlocked) {
      const spare = (s.run.inventory.coal ?? 0) - (goals.find((g) => !g.done(s))?.keep(s).coal ?? 0)
      if (spare >= 1) tryAct(fillTank(s, spare), null)
    }
    while (s.run.energy >= ACTION_ENERGY_COST) {
      // batch 16: while a gold run's next goal still waits on mined goods, the player mines instead of supplementing
      // the staffed farm — the farm's actions would otherwise eat every point of energy and stall the ladder
      const nextGoal = (gold || sprinklers) ? goals.find((g) => !g.done(s)) : undefined
      const gatherTail = machines ? MACHINES_LADDER.slice(GOLD_LADDER.length) : fields ? FIELDS_LADDER.slice(GOLD_LADDER.length) : sprinklers ? WORKSHOP_LADDER.slice(GOLD_LADDER.length) : GOLD_LADDER.slice(IRON_TOOLS_LADDER.length)
      const gatherGoal = nextGoal && gatherTail.includes(nextGoal) ? nextGoal : undefined
      const gathering =
        gatherGoal !== undefined &&
        Object.entries(gatherGoal.keep(s)).some(([id, n]) => id !== 'cash' && (s.run.inventory[id as keyof typeof s.run.inventory] ?? 0) < n!)
      const next = gathering ? null : bestFarmAction(s, crops)
      if (next) {
        track(next.state, farm, ACTION_ENERGY_COST)
        if (next.kind.startsWith('harvest') && next.kind.endsWith(':radish')) m.firstRadishHarvest ??= tick
        // batch 35: the "pumpkin" milestones follow pumpkin's old row, now eggplant's
        if (next.kind.startsWith('harvest') && next.kind.endsWith(':eggplant')) m.firstPumpkinHarvest ??= tick
        if (next.kind.startsWith('plant:eggplant')) m.firstPumpkinPlanted ??= tick
        milestones()
      } else if (!mineOnce(tick)) break
    }
    milestones()
    // batch 33: where the bot switched the furnace to iron / gold it buys that mold (the goal's keep holds its price)
    if ((iron || ironTools) && s.run.furnace.built && !s.run.furnace.molds.ironOre && IRON_ON_GOALS.includes(goals.find((g) => !g.done(s))!)) {
      if (buyAs('ironMold', buyMold(s, 'ironOre'), () => moldPrice('ironOre', s.meta))) ladderTicks.ironMold ??= tick
    }
    // batch 33: once the iron mold is in, an ore loader would turn every copper ore into a copper bar nothing spends
    // (the old furnace was on iron here) — the copper ore in storage sells before each tick, as it did before the switch
    if ((iron || ironTools) && s.run.furnace.molds.ironOre && s.run.workers.assigned.ore > 0 && IRON_ON_GOALS.includes(goals.find((g) => !g.done(s))!))
      tryAct(sellItem(s, 'copperOre', s.run.inventory.copperOre ?? 0), mine)
    if (gold && s.run.furnace.built && !s.run.furnace.molds.goldOre && GOLD_ON_GOALS.includes(goals.find((g) => !g.done(s))!)) {
      if (buyAs('goldMold', buyMold(s, 'goldOre'), () => moldPrice('goldOre', s.meta))) ladderTicks.goldMold ??= tick
    }
    if (sprinklers) {
      const next = goals.find((g) => !g.done(s))
      const pickaxeRung = swapped && ['copperPickaxe', 'ironPickaxe', 'goldPickaxe'].includes(next?.name ?? '')
      if (next && (pickaxeRung || WORKSHOP_ON_GOALS.includes(next) || MACHINES_ON_GOALS.includes(next) || (fields && FIELDS_ON_GOALS.slice(0, 3).includes(next)))) {
        // batch 21: top a mold's partial cycle up whenever the bag can — a residue the bag could finish but nothing
        // loads sits in the slot (run 2 of the prestige sim sat 50 h on 1 iron ore with 1 more in the bag). Batch 33:
        // every kind the goal is short of smelts in its own mold at once (smeltCoalJobs), so the kind switch is gone
        for (const kind of ORE_IDS) {
          const g0 = s.run.furnace
          const ore = g0.molds[kind]?.ore ?? 0
          if (ore > 0 && ore % cycleOre(g0) !== 0) {
            const loaded = loadOre(s, kind, cycleOre(g0) - (ore % cycleOre(g0)))
            if (loaded.ok) tryAct(addFuel(loaded.state, 'coal', smeltFuel('coal', kind)), null)
          }
        }
      }
    }
    // the only cash a tick moves is the workers' (harvest sales − wages): farming income bought without energy
    const before = s.run.cash
    s = step(s, 1)
    farm.cash += s.run.cash - before
    seen()
    if ((s.run.furnace.molds.copperOre?.ready ?? 0) > 0) ladderTicks.firstBar ??= s.run.tick
    if (s.run.lifetime.ironBarsSmelted > 0) ladderTicks.firstIronBar ??= s.run.tick
    if (s.run.lifetime.goldBarsSmelted > 0) ladderTicks.firstGoldBar ??= s.run.tick
    onTick?.(s)
    if (log) {
      const fresh = [...Object.keys(ladderTicks), ...Object.keys(workerTicks), ...Object.keys(m), ...Object.keys(s.run.milestones)].filter((k) => !marked.has(k))
      for (const k of fresh) marked.add(k)
      log.tick(s, [...bought, ...fresh], goals.find((g) => !g.done(s))?.name)
      bought = []
    }
  }
  log?.finish(s)
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
    milestones: { ...m, pumpkinLicenseAffordable: licenseAffordable.eggplant, pumpkinLicenseBought: licenseBought.eggplant },
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

// ---- Batch 6: two-tier cash/energy hierarchy, four crops, storage ----

const SESSION = 1200

/** license order and best-first planting for the four-crop bots (batch 35: carrot is now bought first, potato starts) */
const LICENSE_ORDER: CropId[] = ['radish', 'corn', 'eggplant', 'pumpkin']

const PLANT_ORDER: CropId[] = ['pumpkin', 'eggplant', 'corn', 'radish', 'potato']

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
  const jobs = { plant: 0, ...assigned, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }
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
  // batch 11: an iron pickaxe's iron bars likewise at 2 iron ore + 2 coal; batch 16: a gold pickaxe's at 2 gold ore + 3 coal
  const ore = tier === 'iron' ? 'ironOre' : tier === 'gold' ? 'goldOre' : 'copperOre'
  const bar = tier === 'iron' ? 'ironBar' : tier === 'gold' ? 'goldBar' : 'copperBar'
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
      for (const id of ['stone', 'coal', 'copperOre', 'ironOre', 'goldOre'] as const) if (s.run.inventory[id]) act(sellItem(s, id, s.run.inventory[id]!))
    if (pickaxe && !heldPickaxe(s.run) && tier !== 'wooden') {
      giveBars(pickaxeCraftCost(tier, s.meta)[bar]!)
      act(craftPickaxe(s, tier))
    } else if (pickaxe && !heldPickaxe(s.run)) {
      act(buyWood(s, recipe.wood))
      act(craftPickaxe(s))
    } else if (pickaxe && heldPickaxe(s.run)!.durability === 0) {
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

// ---- Batch 7: furnace, copper ore, copper pickaxe ----

const HOUR_TICKS = 3600

// ---- Batch 7.1: copper farm tools ----

const ALL_COPPER = { water: 1, harvest: 1, plant: 1 }

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

/** batch 12 farm runs: 2 h, so the glut (30 min half-life) is near its steady state for most of the run */
const MARKET_TICKS = 2 * HOUR_TICKS

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
  const assigned = { plant: 1, water: 1, harvest: 1, ore: 0, fuel: 0, mine: 0, clerk: 0, manager: 0, stoker: 0 }
  const workers = { pool: 3, assigned, certificates: [...WORKER_JOBS] }
  let s: GameState = { ...init, run: { ...init.run, cash: 1000, licenses: ['radish', 'pumpkin'], plantCrop: 'pumpkin', toolTier, workers, tiles } }
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

/** the pump tier whose wet fields hold `n` tiles (Pump 3 beyond 1,000: the 20-field cap) */
const pumpFor = (n: number) => [0, 1, 2, 3].find((p) => pumpFieldCap(p) * 50 >= n) ?? 3
/**
 * batch 28: a forged Fields state of `n` tiles as round-robin `split` plots, freshly sown (readyTick = tick +
 * ceil(grow / FIELD_PRESSURE), what sowPlot sets), in fields of five; the first pumpFieldCap(pump) fields are pivoted
 * (a migrated save can hold more fields than its pump waters), each chip = its first plot's crop; the tank full,
 * coal and cash topped up so only the fields math moves the measured window
 */

function forgePlots(base: GameState, n: number, pump: number, split: readonly CropId[], cash = 50000): GameState {
  const plots: Plot[] = Array.from({ length: Math.floor(n / plotTiles()) }, (_, i) => {
    const crop = split[i % split.length]!
    return { crop, readyTick: base.run.tick + Math.ceil(cropGrowTicks(crop, base.meta, base.run.upgrades.fertilizer) / FIELD_PRESSURE) }
  })
  const list: Field[] = []
  for (let i = 0; i < plots.length; i += 5) list.push({ pivot: list.length < pumpFieldCap(pump), crop: plots[i]!.crop, pinned: false, plots: plots.slice(i, i + 5) })
  return {
    ...base,
    run: {
      ...base.run,
      cash: Math.max(base.run.cash, cash),
      inventory: { ...base.run.inventory, coal: 500 },
      fields: { ...base.run.fields, unlocked: true, list, pump, tank: tankCapCoal(pump) * TANK_UNITS_PER_COAL },
    },
  }
}

function contractRun(s0: GameState, maxMinutes: number) {
  let s = s0
  let reached: { minute: number; stars: number; cash: number; goldBar: number } | null = null
  let buyable: number | null = null
  for (let m = 0; m < maxMinutes && (reached === null || buyable === null); m++) {
    s.run.orders.offers.forEach((o, i) => {
      if (!isOffer(o) || o.accepted) return
      const grown = s.run.fields.list.some((f) => f.plots.some((p) => p.crop === o.good))
      const r = isContract(s.run, o.good) && grown ? acceptOrder(s, i) : discardOrder(s, i)
      if (r.ok) s = r.state
    })
    s = step(s, 60)
    if (reached === null && s.run.counters.contractsByHand >= 10) reached = { minute: m + 1, stars: s.run.stars, cash: Math.round(s.run.cash), goldBar: s.run.inventory.goldBar ?? 0 }
    if (buyable === null && buyCertificate(s, 'manager').ok) buyable = m + 1
  }
  return { reached, buyable, counter: s.run.counters.contractsByHand }
}

/**
 * batch 34 (task 187): contractRun's accept / discard policy until the 💼 Manager certificate first buys (nothing is
 * bought, so ⭐ is never spent): the minutes the Clerk and the Manager certificates first buy, ⭐ held at the Manager,
 * and ⭐ earned per game-hour over the run
 */

export {
  ALL_COPPER,
  ATTENTIVE_ENERGY_PER_MIN,
  COPPER_LADDER,
  COPPER_PICKAXE_BARS,
  COPPER_TOOL_BARS,
  FARM_JOBS,
  FIELDS_LADDER,
  FIELDS_ON_GOALS,
  FURNACE_LADDER,
  GOLD_LADDER,
  GOLD_ON_GOALS,
  type Goal,
  HOUR_TICKS,
  IRON_LADDER,
  IRON_ON_GOALS,
  IRON_PRICE,
  IRON_TICKS,
  IRON_TOOLS_LADDER,
  LADDER,
  LICENSE_ORDER,
  type LadderStep,
  MACHINES_LADDER,
  MACHINES_ON_GOALS,
  MARKET_TICKS,
  type Milestones,
  PLANT_LADDER,
  PLANT_ORDER,
  SESSION,
  TICKS,
  WORKSHOP_LADDER,
  WORKSHOP_ON_GOALS,
  bestFarmAction,
  buyLand,
  collectMolds,
  contractRun,
  forgePlots,
  fuelForOre,
  goldReserveShort,
  hourOfBurn,
  inMold,
  ironLadder,
  keepBars,
  keepGoldBars,
  keepIronBars,
  keepPivot,
  keepSprinklerBars,
  landGold,
  logRuns,
  lowestValue,
  machineKeep,
  mineBench,
  moldKeep,
  needsMold,
  pivotGold,
  plotsGoal,
  plusKeep,
  pumpFor,
  rackRung,
  repairSafe,
  runBot,
  runCropBot,
  smeltCoalJobs,
  smeltsFor,
  staffedLemon,
  withBatch13,
  withoutMarket,
}
