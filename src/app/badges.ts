import { buyUpgrade } from '../core/actions'
import { CROP_IDS } from '../core/data/crops'
import { PICKAXE_TIERS } from '../core/data/items'
import type { WorkerJob } from '../core/data/workers'
import { TOOL_JOBS } from '../core/data/tools'
import { UPGRADE_IDS } from '../core/data/upgrades'
import { TILE_CAP, licenseCost, mineLicenseCost, tileCost, toolMaxLevel, toolUnlock, upgradeUnlocked } from '../core/balance'
import { buildFurnace } from '../core/furnace'
import { buildWorkshop } from '../core/workshop'
import { unlockFields } from '../core/fields'
import { bestPickaxeTier, buyStorage, craftPickaxe, upgradeVein } from '../core/mining'
import type { GameState } from '../core/state'
import { buyToolTier, buyTool } from '../core/tools'
import { buyCertificate, certificateUnlocked } from '../core/workers'

export const BADGE_TABS = ['shop', 'upgrades', 'farm', 'mine'] as const
export type BadgeTab = (typeof BADGE_TABS)[number]
export const isBadgeTab = (t: string): t is BadgeTab => (BADGE_TABS as readonly string[]).includes(t)

/**
 * One key per thing that is unlocked or affordable right now, per tab. A tab shows a badge dot while it has a key
 * the player has not seen yet (`tiles.ui` `seen`); levels are in the key, so the next level is news again.
 * Seed and wood buys are left out: always available, never news.
 */
export function availableKeys(state: GameState): Record<BadgeTab, string[]> {
  const { run, meta } = state
  const shop: string[] = []
  for (const id of CROP_IDS) if (!run.licenses.includes(id) && run.cash >= licenseCost(id, meta)) shop.push(`license:${id}`)
  if (!run.mineLicense && run.cash >= mineLicenseCost(meta)) shop.push('mineLicense')
  if (buildFurnace(state).ok) shop.push('furnace')
  // the sprinkler and valve recipes live in the 🌾 Farm tab's Workshop card, which is not a badge tab — no keys for them
  if (buildWorkshop(state).ok) shop.push('workshop')
  if (unlockFields(state).ok) shop.push('fields')
  const tiles = run.tiles.length
  if (tiles < TILE_CAP && run.cash >= tileCost(tiles, meta)) shop.push(`tile:${tiles}`)
  for (const job of TOOL_JOBS) {
    if (run.tools[job] >= 1 && run.toolTier[job] === 0) shop.push(`copper:${job}`)
    if (buyToolTier(state, job).ok) shop.push(`${run.toolTier[job] ? 'iron' : 'copper'}:${job}:buy`)
    const level = run.tools[job] + 1
    if (level > toolMaxLevel(job)) continue
    const { counter, at } = toolUnlock(job, level)
    if (run.counters[counter] >= at) shop.push(`tool:${job}${level}`)
    if (buyTool(state, job).ok) shop.push(`tool:${job}${level}:buy`)
  }

  const upgrades: string[] = []
  for (const id of UPGRADE_IDS) {
    if (!upgradeUnlocked(id, run.counters)) continue
    upgrades.push(id)
    if (buyUpgrade(state, id).ok) upgrades.push(`${id}@${run.upgrades[id]}`)
  }
  if (run.mineLicense) {
    upgrades.push('mine')
    if (buyStorage(state).ok) upgrades.push(`storage@${run.storageLevel}`)
    if (upgradeVein(state).ok) upgrades.push(`vein@${run.vein.level}`)
  }

  // batch 31.1 (task 166a): the 🌱 Farm and ⛏️ Mine nav items — certificates (unlocked, then affordable), the order
  // board, and a pickaxe tier above the one held
  const certs = (jobs: readonly WorkerJob[]) =>
    jobs.flatMap((job) =>
      run.workers.certificates.includes(job) || !certificateUnlocked(run, job) ? [] : [`cert:${job}`, ...(buyCertificate(state, job).ok ? [`cert:${job}:buy`] : [])],
    )
  const farm = [...certs(['plant', 'water', 'harvest', 'clerk', 'manager']), ...(run.orders.unlocked ? ['orders'] : [])]
  const best = bestPickaxeTier(run)
  const bestIndex = best ? PICKAXE_TIERS.indexOf(best) : -1
  const mine = [...certs(['ore', 'fuel', 'mine']), ...PICKAXE_TIERS.filter((t, i) => i > bestIndex && craftPickaxe(state, t).ok).map((t) => `pick:${t}`)]
  return { shop, upgrades, farm, mine }
}
