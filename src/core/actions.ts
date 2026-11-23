import {
  ACTION_ENERGY_COST,
  ANCIENT_SEED_EXTRA,
  DIG_ANCIENT_CHANCE,
  DIG_DUST_CHANCE,
  DIG_SHARD_CHANCE,
  SOIL_RICH_DOUBLE,
  TILE_CAP,
  cropGrowTicks,
  cropSeedCost,
  digSeedDrop,
  doubleHarvestChance,
  seedDropChance,
  RENOWN_BY_HAND,
  RENOWN_BY_WORKER,
  addRenown,
  handPickedBonus,
  licenseCost,
  seedKeepChance,
  tileCost,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
  waterMoisture,
} from './balance'
import { ANCIENT_CROP, CROP_IDS, STARTING_CROP, type CropId } from './data/crops'
import { RELIC_IDS } from './data/relics'
// actions ↔ relics is a cycle of function bindings only (used at call time), like actions ↔ orders
import { spendEnergy } from './relics'
import { districtSells } from './data/districts'
import { recordMilestones } from './data/milestones'
import type { UpgradeId } from './data/upgrades'
import { cropRenownGrow } from './market'
// actions ↔ orders is a cycle of function bindings only (used at call time), like step ↔ workers
import { harvestSale } from './orders'
// actions ↔ survey is a cycle of function bindings only (used at call time)
import { bedSaleSoil, bedTrait, soilPair } from './survey'
import { createTile, type GameState, type Lifetime, type RunState, type Tile } from './state'
import { clearedTile } from './step'
// actions ↔ tree is a cycle of function bindings only (used at call time)
import { BED_TILES, harvestTreeTile, isTreeTile } from './tree'
// actions ↔ workshop is a cycle of function bindings only (hoisted, used at call time), so module order does not matter
import { isIrrigated } from './workshop'

export type ActionError =
  | 'NO_ENERGY'
  | 'BAD_TILE'
  | 'NOT_UNTILLED'
  | 'NOT_TILLED'
  | 'NOT_PLANTED'
  | 'IRRIGATED'
  | 'NOT_MATURE'
  | 'NO_LICENSE'
  | 'NO_CASH'
  | 'MAX_LEVEL'
  | 'TILE_CAP'
  | 'ALREADY_OWNED'
  | 'LOCKED'
  | 'NO_MINE_LICENSE'
  | 'NO_PICKAXE'
  | 'NO_IRON_PICKAXE'
  | 'NOT_BLUNT'
  | 'BAG_FULL'
  | 'NOT_ENOUGH_ITEMS'
  | 'BAD_AMOUNT'
  | 'LOAN_ACTIVE'
  | 'NO_LOAN'
  | 'NOT_ENOUGH_CASH'
  | 'NO_SEEDS'
  | 'NOTHING_TO_DO'
  | 'NOT_SELLABLE'
  | 'NO_FURNACE'
  | 'NO_WORKSHOP'
  | 'FULL'
  | 'NO_ORE'
  | 'NO_FUEL'
  | 'NO_CERTIFICATE'
  | 'POOL_FULL'
  | 'NO_FREE_WORKER'
  | 'BAD_SLOT'
  | 'NO_STARS'
  | 'BAD_ORE'
  | 'NO_DEEDS'
  | 'NO_GAIN'
  | 'NO_PIVOT'
  | 'NO_CROP'
  | 'PUMP_FULL'
  | 'REROLL_MAX'
  | 'MAX_RIGS'
  | 'NO_RIGS'
  | 'BAD_CHOICE'
  | 'NOT_SOLD_HERE'
  | 'BED_BUSY'

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: ActionError }

export const fail = (error: ActionError): ActionResult => ({ ok: false, error })

export function withRun(state: GameState, run: Partial<RunState>): ActionResult {
  const merged = { ...state.run, ...run }
  return { ok: true, state: { meta: state.meta, run: recordMilestones(state.run, merged) } }
}

export const isAmount = (n: number) => Number.isInteger(n) && n >= 1

/** lifetime totals after an action that spent `energy`, earned `cash` and harvested `crop` */
export function addLifetime(run: RunState, energy: number, cash: number, crop?: CropId): Lifetime {
  const l = run.lifetime
  return {
    ...l,
    energySpent: l.energySpent + energy,
    cashEarned: l.cashEarned + cash,
    harvests: crop ? { ...l.harvests, [crop]: (l.harvests[crop] ?? 0) + 1 } : l.harvests,
  }
}

/** mulberry32: a float in [0, 1) and the next uint32 state */
export function nextRandom(rngState: number): [number, number] {
  const next = (rngState + 0x6d2b79f5) >>> 0
  let t = Math.imul(next ^ (next >>> 15), next | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

// Farm actions validate in this order: BAD_TILE, tile status, license/seeds/cash (plant), NO_ENERGY.
// `energy` = what the action costs the player (0 when a worker does it). `run` = the run with the action's other
// changes (seeds, rngState, market, orders …); energy, cash, tiles, counters and lifetime are applied on top of it.
export function farmAction(
  state: GameState,
  i: number,
  check: (tile: Tile) => ActionError | null,
  apply: (tile: Tile) => {
    tile: Tile
    cashDelta?: number
    counters?: Partial<RunState['counters']>
    harvested?: CropId
    run?: RunState
  },
  energy = ACTION_ENERGY_COST,
): ActionResult {
  const { run } = state
  if (!Number.isInteger(i) || i < 0 || i >= run.tiles.length) return fail('BAD_TILE')
  const error = check(run.tiles[i])
  if (error) return fail(error)
  // batch 36.4: ⚡ first, then the 🔋 reserve (spendEnergy); cost 0 (workers) always succeeds unchanged
  const spent = spendEnergy(run, energy)
  if (!spent) return fail('NO_ENERGY')
  const { tile, cashDelta = 0, counters, harvested, run: next = run } = apply(run.tiles[i])
  return withRun(state, {
    ...next,
    energy: spent.energy,
    energyReserve: spent.energyReserve,
    cash: run.cash + cashDelta,
    tiles: run.tiles.map((t, j) => (j === i ? tile : t)),
    counters: { ...next.counters, ...counters },
    lifetime: addLifetime(next, energy, harvested ? cashDelta : 0, harvested),
  })
}

/** one roll against `chance`, only for a tier above basic, so tier-0 runs keep their exact PRNG sequence */
function tierRoll(run: RunState, tier: number, chance: number): { hit: boolean; rngState: number } {
  if (tier === 0) return { hit: false, rngState: run.rngState }
  const [r, rngState] = nextRandom(run.rngState)
  return { hit: r < chance, rngState }
}

/** the double-harvest roll (batch 36.5): a 💎 rich bed adds to the chance, so a tier-0 tile on one still rolls;
 * a tier-0 tile on a plain bed rolls nothing — tier-0 runs keep their exact PRNG sequence */
function doubleRoll(run: RunState, tier: number, rich: number): { hit: boolean; rngState: number } {
  if (tier === 0 && rich === 0) return { hit: false, rngState: run.rngState }
  const [r, rngState] = nextRandom(run.rngState)
  return { hit: r < doubleHarvestChance(tier) + rich, rngState }
}

export function till(state: GameState, i: number, energy = ACTION_ENERGY_COST): ActionResult {
  return farmAction(
    state,
    i,
    (t) => (isTreeTile(state.run, i) ? 'LOCKED' : t.status === 'untilled' ? null : 'NOT_UNTILLED'),
    (t) => ({ tile: { ...t, status: 'tilled' } }),
    energy,
  )
}

// Planting uses 1 seed from the pouch. With 0 in stock and autoBuySeeds on it buys that one seed at the
// seed price instead (the pre-v4 cost, so auto-buy costs exactly what planting always did). A copper dibber may keep
// the seed: the checks still need one in hand, but a kept seed leaves the pouch as it was and auto-buy charges nothing.
// The ancient crop (batch 36.4) is licence-free and never auto-bought; planting its last seed switches "Crop to
// plant" to the top licensed shop crop so the plant worker never idles on an empty ancient pouch.
export function plant(state: GameState, i: number, cropId: CropId, energy = ACTION_ENERGY_COST): ActionResult {
  const { run } = state
  const stock = run.seeds[cropId] ?? 0
  const price = stock > 0 ? 0 : cropSeedCost(cropId, state.meta)
  const ancient = cropId === ANCIENT_CROP
  return farmAction(
    state,
    i,
    (t) => {
      if (isTreeTile(run, i)) return 'LOCKED'
      if (t.status !== 'tilled') return 'NOT_TILLED'
      if (!ancient && !run.licenses.includes(cropId)) return 'NO_LICENSE'
      if (stock === 0 && (ancient || !run.autoBuySeeds)) return 'NO_SEEDS'
      return run.cash < price ? 'NO_CASH' : null
    },
    (t) => {
      const { hit: kept, rngState } = tierRoll(run, run.toolTier.plant, seedKeepChance(run.toolTier.plant))
      return {
        tile: { ...t, status: 'planted', cropId, growth: 0, ticksSinceMature: 0 },
        cashDelta: kept ? 0 : -price,
        counters: { plants: run.counters.plants + 1 },
        run: {
          ...run,
          rngState,
          seeds: stock > 0 && !kept ? { ...run.seeds, [cropId]: stock - 1 } : run.seeds,
          plantCrop: ancient && stock === 1 && !kept ? topLicensedCrop(run) : run.plantCrop,
        },
      }
    },
    energy,
  )
}

/** the highest licensed shop crop (the last of CROP_IDS in licence order); potato when none is licensed */
const topLicensedCrop = (run: RunState): CropId => CROP_IDS.reduce((best, c) => (run.licenses.includes(c) ? c : best), STARTING_CROP as CropId)

/** "Crop to plant" for taps, the plant tool and the plant worker; free, needs the license (the ancient crop: a seed in hand) */
export function selectCrop(state: GameState, cropId: CropId): ActionResult {
  if (cropId === ANCIENT_CROP) return (state.run.seeds[ANCIENT_CROP] ?? 0) > 0 ? withRun(state, { plantCrop: cropId }) : fail('NO_SEEDS')
  return state.run.licenses.includes(cropId) ? withRun(state, { plantCrop: cropId }) : fail('NO_LICENSE')
}

export function water(state: GameState, i: number, energy = ACTION_ENERGY_COST): ActionResult {
  const { run } = state
  return farmAction(
    state,
    i,
    // the irrigated check sits before the energy spend: a sprinkler-covered bed never costs the player anything
    (t) => (isTreeTile(run, i) ? 'IRRIGATED' : t.status !== 'planted' ? 'NOT_PLANTED' : isIrrigated(run, i) ? 'IRRIGATED' : null),
    (t) => ({ tile: { ...t, moisture: waterMoisture(run.toolTier.water) }, counters: { waters: run.counters.waters + 1 } }),
    energy,
  )
}

// Harvest sells instantly: there is no inventory and no separate sell action. A copper sickle may yield 2 crops:
// both sell (sales +2, cash ×2), but it is still one harvest (counters and per-crop totals +1). An accepted order for
// the crop takes the units first (harvestSale), so every harvest — tap, tool press or worker — fills it.
/** renown one home harvest earns: a tap or tool press +2, a worker +1 (+2 with 🎓 Apprentices, batch 36.6) */
export const harvestRenown = (state: GameState, energy: number): number =>
  energy > 0 || state.meta.upgrades.keepRenown > 0 ? RENOWN_BY_HAND : RENOWN_BY_WORKER

export function harvest(state: GameState, i: number, energy = ACTION_ENERGY_COST): ActionResult {
  if (isTreeTile(state.run, i)) return harvestTreeTile(state, i, energy)
  return farmAction(
    state,
    i,
    (t) => {
      if (t.status !== 'planted' || !t.cropId) return 'NOT_PLANTED'
      return t.growth < cropGrowTicks(t.cropId, state.meta, state.run.upgrades.fertilizer, state.run.listing.soil, cropRenownGrow(state.run, t.cropId)) ? 'NOT_MATURE' : null
    },
    (t) => {
      const { run } = state
      const { harvests, sales } = run.counters
      const tier = run.toolTier.harvest
      // batch 36.5: 💎 rich adds +0.10 (+0.15) to the double-harvest chance of this tile's bed
      const rich = bedTrait(run, Math.floor(i / BED_TILES)) === 'rich' ? soilPair(run, SOIL_RICH_DOUBLE) : 0
      const { hit, rngState: afterDouble } = doubleRoll(run, tier, rich)
      // batch 32: then the sickle's seed roll (tier 0 rolls nothing), +1 seed of the crop into the pouch
      const { hit: seed, rngState: afterSeed } = tierRoll({ ...run, rngState: afterDouble }, tier, seedDropChance(tier))
      const crops = hit ? 2 : 1
      // batch 36.4: the ancient crop's seed always comes back; one tier-independent draw may add a second, and it pays
      // no renown. Other crops draw nothing new (their replay stays exact).
      const ancient = t.cropId === ANCIENT_CROP
      let extraSeeds = 0
      let rngState = afterSeed
      if (ancient) {
        const [r, next] = nextRandom(afterSeed)
        rngState = next
        extraSeeds = r < ANCIENT_SEED_EXTRA ? 2 : 1
      }
      // the market prices each unit at the glut before that unit's sale, in sequence; a player's harvest (energy spent)
      // is hand-picked, a worker's (energy 0) is not. A 🥔/🍅/🍓 price trait lifts this bed's group sales (batch 36.5)
      const bonus = energy > 0 ? handPickedBonus() : 1
      const sale = harvestSale({ ...state, run: { ...run, rngState } }, t.cropId!, crops, bonus, bonus, bedSaleSoil(run, Math.floor(i / BED_TILES), t.cropId!))
      return {
        tile: clearedTile(t),
        cashDelta: sale.cash,
        counters: { harvests: harvests + 1, sales: sales + crops },
        harvested: t.cropId,
        run: {
          ...sale.run,
          renown: ancient ? sale.run.renown : addRenown(sale.run.renown, t.cropId!, harvestRenown(state, energy)),
          seeds: ancient || seed ? { ...sale.run.seeds, [t.cropId!]: (sale.run.seeds[t.cropId!] ?? 0) + (ancient ? extraSeeds : 1) } : sale.run.seeds,
        },
      }
    },
    energy,
  )
}

// Dig for seeds: the anti-soft-lock floor. No tile, no license, free from tick 0; 1 energy, and a chance of one
// seed into the pouch. The roll and the digs counter advance whether or not a seed drops.
// Batch 36.4: after the potato roll every dig draws THREE finds in a fixed order (shard, star dust, ancient seed),
// independent of it — a fixed count keeps runs replayable. 1 ✨ = ⭐1. After the full relic set the shard draw pays a
// second ancient seed instead. The run's first dig opens the 📖 book.
export function digForSeeds(state: GameState): ActionResult {
  const { run } = state
  const spent = spendEnergy(run, ACTION_ENERGY_COST)
  if (!spent) return fail('NO_ENERGY')
  const [r, rngState] = nextRandom(run.rngState)
  const { crop, chance } = digSeedDrop()
  const [r2, afterShard] = nextRandom(rngState)
  const [r3, afterDust] = nextRandom(afterShard)
  const [r4, afterAncient] = nextRandom(afterDust)
  const setDone = run.relics.length === RELIC_IDS.length
  const dust = r3 < DIG_DUST_CHANCE
  const seeds = { ...run.seeds }
  if (r < chance) seeds[crop] = (seeds[crop] ?? 0) + 1
  const finds = { ...run.finds, book: true }
  const lifetime = { ...run.lifetime }
  const seedFind = (n: number) => {
    seeds[ANCIENT_CROP] = (seeds[ANCIENT_CROP] ?? 0) + n
    finds.ancientSeeds += n
    lifetime.ancientSeedsFound += n
  }
  if (setDone) {
    if (r2 < DIG_ANCIENT_CHANCE) seedFind(1)
  } else if (r2 < DIG_SHARD_CHANCE) {
    finds.shards += 1
    lifetime.shardsFound += 1
  }
  if (dust) {
    finds.starDust += 1
    lifetime.starDustFound += 1
  }
  if (r4 < DIG_ANCIENT_CHANCE) seedFind(1)
  return withRun(state, {
    energy: spent.energy,
    energyReserve: spent.energyReserve,
    rngState: afterAncient,
    stars: run.stars + (dust ? 1 : 0),
    seeds,
    finds,
    counters: { ...run.counters, digs: run.counters.digs + 1 },
    lifetime: addLifetime({ ...run, lifetime }, ACTION_ENERGY_COST, 0),
  })
}

// Shop actions cost no energy. Buying energyMax raises the cap only; current energy is not refilled.
export function buyUpgrade(state: GameState, upgradeId: UpgradeId): ActionResult {
  const { run } = state
  if (!upgradeUnlocked(upgradeId, run.counters)) return fail('LOCKED')
  const level = run.upgrades[upgradeId]
  if (level >= upgradeMaxLevel(upgradeId)) return fail('MAX_LEVEL')
  const cost = upgradeCost(upgradeId, level, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, upgrades: { ...run.upgrades, [upgradeId]: level + 1 } })
}

export function buyLicense(state: GameState, cropId: CropId): ActionResult {
  const { run } = state
  if (run.licenses.includes(cropId)) return fail('ALREADY_OWNED')
  if (!districtSells(run.listing.district, cropId)) return fail('NOT_SOLD_HERE')
  const cost = licenseCost(cropId, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, licenses: [...run.licenses, cropId] })
}

/** seeds go to the pouch, not the bag; needs the crop's license */
export function buySeeds(state: GameState, cropId: CropId, n: number): ActionResult {
  const { run } = state
  if (!isAmount(n)) return fail('BAD_AMOUNT')
  if (!run.licenses.includes(cropId)) return fail('NO_LICENSE')
  const cost = n * cropSeedCost(cropId, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, seeds: { ...run.seeds, [cropId]: (run.seeds[cropId] ?? 0) + n } })
}

/** one flag for every crop; costs nothing */
export function setAutoBuySeeds(state: GameState, on: boolean): ActionResult {
  return withRun(state, { autoBuySeeds: on })
}

export function buyTile(state: GameState): ActionResult {
  const { run } = state
  // cap before cash: tileCost is Infinity at the cap
  if (run.tiles.length >= TILE_CAP) return fail('TILE_CAP')
  const cost = tileCost(run.tiles.length, state.meta)
  if (run.cash < cost) return fail('NO_CASH')
  return withRun(state, { cash: run.cash - cost, tiles: [...run.tiles, createTile()] })
}
