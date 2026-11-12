// ⭐ Favours (batch 34, DECISIONS "Batch 34 refined"): ⭐-only rows that extend a cash or bar ladder past its max, plus
// the Bunkhouse, the Seam survey and the Stoker certificate. Every ⭐ level lives on the ladder it extends (fertilizer,
// sell price, furnace speed / batch), so every reader picks it up; all of it resets on Sell the farm. No number here:
// prices, caps and gates are in balance.ts.
import { fail, withRun, type ActionResult } from './actions'
import { batchBars, certificateCost, favourStars, furnaceTrayCap, furnaceUpgradeMaxLevel, seamVeinLevel, upgradeMaxLevel, veinDrops, type Price } from './balance'
import type { OreId } from './data/items'
import { batchLocked } from './furnace'
import { pay } from './mining'
import type { GameState, MetaState, RunState } from './state'
import { certificateUnlocked, hireUnlocked, stokerReady } from './workers'

export const FAVOUR_IDS = ['bunkhouse', 'mist', 'sell', 'furnaceSpeed', 'furnaceBatch', 'seam', 'stoker'] as const
export type FavourId = (typeof FAVOUR_IDS)[number]

/** ⭐ levels bought of a row (one-time rows: 0 or 1) */
export function favourLevel(run: RunState, id: FavourId): number {
  switch (id) {
    case 'bunkhouse':
      return run.favours.bunkhouse
    case 'mist':
      return Math.max(0, run.upgrades.fertilizer - upgradeMaxLevel('fertilizer'))
    case 'sell':
      return Math.max(0, run.upgrades.sellPrice - upgradeMaxLevel('sellPrice'))
    case 'furnaceSpeed':
      return Math.max(0, run.furnace.levels.speed - furnaceUpgradeMaxLevel('speed'))
    case 'furnaceBatch':
      return Math.max(0, run.furnace.levels.batch - furnaceUpgradeMaxLevel('batch'))
    case 'seam':
      return Number(run.favours.seam)
    case 'stoker':
      return Number(run.workers.certificates.includes('stoker'))
  }
}

/** every row is listed (with its lock reason) except the Stoker, shown once it is ready or owned */
export function favourShown(run: RunState, id: FavourId): boolean {
  return id !== 'stoker' || stokerReady(run) || favourLevel(run, id) > 0
}

/** why a row cannot be bought yet (null = its gate is met): the ladder it extends is not at its max, or what it needs */
export type FavourLock = 'hire' | 'fertilizer' | 'sellPrice' | 'furnace' | 'speed' | 'batch' | 'tray' | 'slot' | 'vein' | 'stoker'
export function favourLock(run: RunState, id: FavourId): FavourLock | null {
  const f = run.furnace
  switch (id) {
    case 'bunkhouse':
      return hireUnlocked(run) ? null : 'hire'
    case 'mist':
      return run.upgrades.fertilizer >= upgradeMaxLevel('fertilizer') ? null : 'fertilizer'
    case 'sell':
      return run.upgrades.sellPrice >= upgradeMaxLevel('sellPrice') ? null : 'sellPrice'
    case 'furnaceSpeed':
      return !f.built ? 'furnace' : f.levels.speed >= furnaceUpgradeMaxLevel('speed') ? null : 'speed'
    case 'furnaceBatch':
      if (!f.built) return 'furnace'
      if (f.levels.batch < furnaceUpgradeMaxLevel('batch')) return 'batch'
      // the bar ladder's batch lock rule applies to the ⭐ levels too: the tray first, then the ore slot
      if (!batchLocked(f)) return null
      return furnaceTrayCap(f.levels.tray) < 2 * batchBars(f.levels.batch + 1) ? 'tray' : 'slot'
    case 'seam':
      return run.vein.level >= seamVeinLevel() ? null : 'vein'
    case 'stoker':
      return certificateUnlocked(run, 'stoker') ? null : 'stoker'
  }
}

/** the next ⭐ level's price; null at the max (or owned) */
export function favourPrice(run: RunState, meta: MetaState, id: FavourId): Price | null {
  if (id === 'stoker') return favourLevel(run, id) > 0 ? null : certificateCost('stoker', meta)
  const stars = favourStars(id, favourLevel(run, id))
  return stars === null ? null : { cash: 0, stars }
}

/** what one ⭐ level of the row changes */
function favourGain(run: RunState, id: FavourId): Partial<RunState> {
  const f = run.furnace
  switch (id) {
    case 'bunkhouse':
      return { favours: { ...run.favours, bunkhouse: run.favours.bunkhouse + 1 } }
    case 'mist':
      return { upgrades: { ...run.upgrades, fertilizer: run.upgrades.fertilizer + 1 } }
    case 'sell':
      return { upgrades: { ...run.upgrades, sellPrice: run.upgrades.sellPrice + 1 } }
    case 'furnaceSpeed':
      return { furnace: { ...f, levels: { ...f.levels, speed: f.levels.speed + 1 } } }
    case 'furnaceBatch':
      return { furnace: { ...f, levels: { ...f.levels, batch: f.levels.batch + 1 } } }
    case 'seam':
      return { favours: { ...run.favours, seam: true } }
    case 'stoker':
      return { workers: { ...run.workers, certificates: [...run.workers.certificates, 'stoker'] } }
  }
}

// One ⭐ level. Order: LOCKED (gate not met), MAX_LEVEL, then pay's NOT_ENOUGH_ITEMS, NO_STARS.
export function buyFavour(state: GameState, id: FavourId): ActionResult {
  const { run, meta } = state
  if (favourLock(run, id) !== null) return fail('LOCKED')
  const price = favourPrice(run, meta, id)
  if (!price) return fail('MAX_LEVEL')
  return pay(state, price, favourGain(run, id))
}

// The Seam survey's aim: free and immediate. Order: LOCKED (no survey), BAD_ORE (an ore the vein does not drop).
export function setSeamAim(state: GameState, aim: OreId | null): ActionResult {
  const { run } = state
  if (!run.favours.seam) return fail('LOCKED')
  if (aim !== null && !(veinDrops(run.vein.level)[aim] ?? 0)) return fail('BAD_ORE')
  return withRun(state, { favours: { ...run.favours, aim } })
}
