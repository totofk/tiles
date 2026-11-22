// The 6 dig relics (batch 36.4): run-long rules bought with 🏺 relic shards dug from the farm. The rule table lives
// in balance.ts (RELIC_*); this file is the set / reserve / spending logic and the pick action. Pure: no DOM, no clock.
import { fail, withRun, type ActionResult } from './actions'
import { RELIC_PICK_SHARDS, RELIC_REGEN_FACTOR, RELIC_RESERVE_CAP, energyMax, relicTier } from './balance'
import { RELIC_IDS, type RelicId } from './data/relics'
import type { GameState, MetaState, RunState } from './state'

/** all 6 rules owned: every rule's numbers take their set column */
export const relicSet = (run: Pick<RunState, 'relics'>): boolean => run.relics.length === RELIC_IDS.length

/** ⚡ Second wind: regen ×1.10 (×1.15 in a set) */
export const relicRegenFactor = (relics: readonly RelicId[]): number => RELIC_REGEN_FACTOR[relicTier(relics, 'energyRegen')]

/** 🔋 Reserve: regen past ⚡ max banks up to 20 × the ⚡ max (30 × in a set); 0 without the rule */
export function reserveCap(run: Pick<RunState, 'relics' | 'upgrades'>, meta: MetaState): number {
  return RELIC_RESERVE_CAP[relicTier(run.relics, 'overflowReserve')] * energyMax(run.upgrades.energyMax, meta)
}

/**
 * pays an action's ⚡ cost: ⚡ first, then the 🔋 reserve; null when both together are short. Cost 0 (workers) always
 * succeeds and changes nothing; with no reserve banked every result equals the plain ⚡ spend.
 */
export function spendEnergy(run: Pick<RunState, 'energy' | 'energyReserve'>, cost: number): { energy: number; energyReserve: number } | null {
  if (run.energy >= cost) return { energy: run.energy - cost, energyReserve: run.energyReserve }
  const fromReserve = cost - run.energy
  return run.energyReserve >= fromReserve ? { energy: 0, energyReserve: run.energyReserve - fromReserve } : null
}

/** 5 🏺 shards pick one of the 6 rules, every unowned rule offered (no random pick); the set bonus is lost on the sale */
export function pickRelic(state: GameState, id: RelicId): ActionResult {
  const { run } = state
  if (run.relics.includes(id)) return fail('ALREADY_OWNED')
  if (run.finds.shards < RELIC_PICK_SHARDS) return fail('NOT_ENOUGH_ITEMS')
  return withRun(state, {
    finds: { ...run.finds, shards: run.finds.shards - RELIC_PICK_SHARDS },
    relics: [...run.relics, id],
    lifetime: run.lifetime.relicsEver.includes(id) ? run.lifetime : { ...run.lifetime, relicsEver: [...run.lifetime.relicsEver, id] },
  })
}
