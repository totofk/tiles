// "Sell the farm" (batch 20, DECISIONS "Prestige: Sell the farm"). The gate needs every farm job covered by worker
// or machine (the Fields unlock gate) and PRESTIGE_GATE_DEEDS lifetime-cash deeds; the sale resets the run to a fresh
// one and the cash deeds move to meta's ledger. The ⭐ balance carries, capped at STAR_CARRY_CAP, and no longer turns
// into deeds (batch 34); everything bought with ⭐ resets. Lifetime totals carry (they are Stats totals and the deed
// meter reads them), so deedsClaimed keeps the same lifetime cash from paying twice.
import { fail, type ActionResult } from './actions'
import {
  DEED_ROW_IDS,
  PRESTIGE_GATE_DEEDS,
  RENOWN_TIERS,
  RUN_HISTORY_CAP,
  deedCost,
  deedMaxLevel,
  deedsFor,
  orderStartSlots,
  renownTier,
  type DeedRowId,
} from './balance'
import { STARTING_CROP } from './data/crops'
import { fieldsUnlockable } from './fields'
import { createFreshRun, type GameState } from './state'

/** lifetime-cash deeds not granted yet (the meter minus what earlier sales already claimed) */
export function deedsClaimable(state: GameState): number {
  return Math.max(0, deedsFor(state.run.lifetime.cashEarned) - state.meta.deedsClaimed)
}

/** the sale's gate: farm jobs covered and enough lifetime-cash deeds on the meter */
export function sellFarmUnlocked(state: GameState): boolean {
  return fieldsUnlockable(state.run) && deedsFor(state.run.lifetime.cashEarned) >= PRESTIGE_GATE_DEEDS
}

// Order: MAX_LEVEL, NO_DEEDS.
export function buyMetaUpgrade(state: GameState, id: DeedRowId): ActionResult {
  const { meta } = state
  const level = meta.upgrades[id]
  if (level >= deedMaxLevel(id)) return fail('MAX_LEVEL')
  const cost = deedCost(id, level)
  if (meta.deeds < cost) return fail('NO_DEEDS')
  return { ok: true, state: { ...state, meta: { ...meta, deeds: meta.deeds - cost, upgrades: { ...meta.upgrades, [id]: level + 1 } } } }
}

/** every Legacy row at its max level — the shop's "all done" state */
export const legacyMaxed = (meta: GameState['meta']): boolean => DEED_ROW_IDS.every((id) => meta.upgrades[id] >= deedMaxLevel(id))

// Order: LOCKED, LOAN_ACTIVE, NO_GAIN.
export function sellFarm(state: GameState): ActionResult {
  const { run, meta } = state
  if (!sellFarmUnlocked(state)) return fail('LOCKED')
  if (run.loan !== null) return fail('LOAN_ACTIVE')
  const gained = deedsClaimable(state)
  if (gained < 1) return fail('NO_GAIN')
  const nextMeta = {
    ...meta,
    prestigeCount: meta.prestigeCount + 1,
    deeds: meta.deeds + gained,
    deedsClaimed: meta.deedsClaimed + gained,
    runs: [...meta.runs, { endedAtTick: run.tick, deeds: gained }].slice(-RUN_HISTORY_CAP),
  }
  return {
    ok: true,
    state: {
      meta: nextMeta,
      run: createFreshRun(nextMeta, {
        // the keep rows (bought as deeds, read here); without them the starting license and no certificates
        licenses: nextMeta.upgrades.keepLicenses > 0 ? run.licenses : [STARTING_CROP],
        certificates: nextMeta.upgrades.keepFirstCertificates > 0 ? ['plant', 'water', 'harvest'] : [],
        orderSlots: Math.max(run.orders.slots, orderStartSlots()),
        lifetime: run.lifetime,
        stars: run.stars,
        // Kept renown keeps each crop's reached tier threshold, not its points; tier 0 crops are dropped
        renown:
          nextMeta.upgrades.keepRenown > 0
            ? Object.fromEntries(
                Object.entries(run.renown).flatMap(([c, p]) => {
                  const tier = renownTier(p ?? 0)
                  return tier > 0 ? [[c, RENOWN_TIERS[tier - 1]]] : []
                }),
              )
            : {},
      }),
    },
  }
}
