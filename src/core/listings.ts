// Sale listings (batch 36.1, DECISIONS "Batch 36.1 refined"): the next farm is the plain farm or one of two rolled
// listings, each a district and a soil. The offer is a pure function of (listingSeed, prestigeCount, listingRerolls),
// so actions never move it and a reload shows the same one; it never reads run.rngState.
import { fail, nextRandom, type ActionResult } from './actions'
import { LISTING_REROLL_MAX, LISTING_WEIGHT_PLAYED, LISTING_WEIGHT_UNPLAYED, listingRerollStars } from './balance'
import { GROUP_IDS, type ListingSoil } from './data/crops'
import { ROLLED_DISTRICTS, type DistrictId } from './data/districts'
import { pay } from './mining'
// listings ↔ prestige is a cycle of function bindings only (used at call time)
import { sellFarmUnlocked } from './prestige'
import type { GameState, MetaState } from './state'

export type Listing = { district: DistrictId; soil: ListingSoil | null }

export const PLAIN_LISTING: Listing = { district: 'plain', soil: null }

const SOILS: ListingSoil[] = GROUP_IDS.flatMap((fast) => GROUP_IDS.filter((slow) => slow !== fast).map((slow) => ({ fast, slow })))

/** one uint32 from a list of non-negative integers */
function hash(...xs: number[]): number {
  let h = 0x811c9dc5
  for (const x of xs) {
    for (const part of [x >>> 0, Math.floor(x / 4294967296) >>> 0]) {
      h = Math.imul(h ^ part, 0x01000193)
      h ^= h >>> 15
    }
  }
  return h >>> 0
}

/** the seed a migrated save starts from (a new game starts at 0) */
export const listingSeedFor = (prestigeCount: number, deedsClaimed: number, cashEarned: number): number => hash(prestigeCount, deedsClaimed, cashEarned)

/** the plain farm and two rolled listings with distinct districts; see the module comment */
export function currentListings(meta: MetaState, lastPlayed: DistrictId): [Listing, Listing, Listing] {
  let rng = hash(meta.listingSeed, meta.prestigeCount, meta.listingRerolls)
  const draw = (): number => {
    const [r, next] = nextRandom(rng)
    rng = next
    return r
  }
  const first = meta.listingRerolls === 0
  let pool = first ? ROLLED_DISTRICTS.filter((d) => d !== lastPlayed) : [...ROLLED_DISTRICTS]
  const weight = (d: DistrictId) => (!first ? 1 : meta.districtsPlayed.includes(d) ? LISTING_WEIGHT_PLAYED : LISTING_WEIGHT_UNPLAYED)
  const rolled = [0, 1].map((): Listing => {
    let x = draw() * pool.reduce((sum, d) => sum + weight(d), 0)
    const district = pool.find((d) => (x -= weight(d)) < 0) ?? pool[pool.length - 1]
    pool = pool.filter((d) => d !== district)
    return { district, soil: SOILS[Math.floor(draw() * SOILS.length)] }
  })
  return [PLAIN_LISTING, rolled[0], rolled[1]]
}

// Order: LOCKED (sale gate closed), REROLL_MAX, NO_STARS. Replaces both rolled listings.
export function rerollListings(state: GameState): ActionResult {
  const { meta } = state
  if (!sellFarmUnlocked(state)) return fail('LOCKED')
  if (meta.listingRerolls >= LISTING_REROLL_MAX) return fail('REROLL_MAX')
  const paid = pay(state, { cash: 0, stars: listingRerollStars(meta.listingRerolls) })
  return paid.ok ? { ok: true, state: { ...paid.state, meta: { ...meta, listingRerolls: meta.listingRerolls + 1 } } } : paid
}
