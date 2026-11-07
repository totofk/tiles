import { buyUpgrade } from '../core/actions'
import { CROP_IDS } from '../core/data/crops'
import { TOOL_JOBS } from '../core/data/tools'
import { UPGRADE_IDS } from '../core/data/upgrades'
import { TILE_CAP, licenseCost, mineLicenseCost, tileCost, toolMaxLevel, toolUnlock, upgradeUnlocked } from '../core/balance'
import { buildFurnace } from '../core/furnace'
import { buyStorage, upgradeVein } from '../core/mining'
import type { GameState } from '../core/state'
import { buyCopperTool, buyTool } from '../core/tools'

export const BADGE_TABS = ['shop', 'upgrades'] as const
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
  const tiles = run.tiles.length
  if (tiles < TILE_CAP && run.cash >= tileCost(tiles, meta)) shop.push(`tile:${tiles}`)
  for (const job of TOOL_JOBS) {
    if (run.tools[job] >= 1 && run.toolTier[job] === 0) shop.push(`copper:${job}`)
    if (buyCopperTool(state, job).ok) shop.push(`copper:${job}:buy`)
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
  return { shop, upgrades }
}
