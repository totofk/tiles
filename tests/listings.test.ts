import { describe, expect, it } from 'vitest'
import { LISTING_REROLL_MAX, cropGrowTicks, cropRotGraceTicks, listingGrowFactor, listingRerollStars } from '../src/core/balance'
import { CROP_GROUPS, CROP_IDS, GROUP_IDS, cropGroup, type ListingSoil } from '../src/core/data/crops'
import { ROLLED_DISTRICTS, type DistrictId } from '../src/core/data/districts'
import { PLAIN_LISTING, currentListings, rerollListings } from '../src/core/listings'
import { createInitialState, type GameState, type MetaState } from '../src/core/state'

const meta = createInitialState().meta
const atGate = (stars: number): GameState => {
  const s = createInitialState()
  return {
    ...s,
    run: {
      ...s.run,
      lifetime: { ...s.run.lifetime, cashEarned: 640_000 },
      workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
      workshop: { built: true, beds: [true, false, false, false], valve: false },
      stars,
    },
  }
}
const ok = (r: ReturnType<typeof rerollListings>): GameState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

describe('crop groups and soil', () => {
  it('puts every crop in exactly one group', () => {
    for (const c of CROP_IDS) expect(GROUP_IDS.filter((g) => CROP_GROUPS[g].includes(c))).toEqual([cropGroup(c)])
    expect(GROUP_IDS.flatMap((g) => CROP_GROUPS[g]).length).toBe(CROP_IDS.length)
  })

  it('grows the fast group ×0.8, the slow group ×1.2, the third ×1; rot grace = 2 × the soil grow ticks', () => {
    const soil: ListingSoil = { fast: 'berry', slow: 'fruitVeg' }
    expect(listingGrowFactor('strawberry', soil)).toBe(0.8)
    expect(listingGrowFactor('chilli', soil)).toBe(1.2)
    expect(listingGrowFactor('potato', soil)).toBe(1)
    expect(listingGrowFactor('strawberry', null)).toBe(1)
    for (const c of CROP_IDS) {
      expect(cropGrowTicks(c, meta, 0, soil)).toBe(Math.round(cropGrowTicks(c, meta, 0) * listingGrowFactor(c, soil)))
      expect(cropRotGraceTicks(c, meta, soil)).toBe(2 * cropGrowTicks(c, meta, 0, soil))
    }
  })

  it('prices rerolls ⭐40 / 80 / 160 / 320', () => {
    expect([0, 1, 2, 3].map(listingRerollStars)).toEqual([40, 80, 160, 320])
    expect(LISTING_REROLL_MAX).toBe(4)
  })
})

describe('the listing roll', () => {
  const withMeta = (over: Partial<MetaState>): MetaState => ({ ...meta, ...over })

  it('is the same for the same meta; plain first; two distinct rolled districts with fast ≠ slow soils', () => {
    for (let seed = 0; seed < 200; seed++) {
      const m = withMeta({ listingSeed: seed * 7919, prestigeCount: seed % 5, listingRerolls: seed % 3 })
      const offer = currentListings(m, 'plain')
      expect(currentListings(m, 'plain')).toEqual(offer)
      expect(offer[0]).toEqual(PLAIN_LISTING)
      expect(offer[1].district).not.toBe(offer[2].district)
      for (const l of offer.slice(1)) {
        expect(ROLLED_DISTRICTS).toContain(l.district)
        expect(l.soil!.fast).not.toBe(l.soil!.slow)
      }
    }
  })

  it('leaves the last-played district out of the first offer of a sale, but a reroll can fetch it', () => {
    let rerolledBack = 0
    for (let seed = 0; seed < 200; seed++) {
      for (let p = 0; p < 5; p++) {
        const m = withMeta({ listingSeed: seed, prestigeCount: p, districtsPlayed: ['orchardValley'] })
        expect(currentListings(m, 'orchardValley').map((l) => l.district)).not.toContain('orchardValley')
        if (currentListings({ ...m, listingRerolls: 1 }, 'orchardValley').some((l) => l.district === 'orchardValley')) rerolledBack++
      }
    }
    expect(rerolledBack).toBeGreaterThan(0)
  })

  it('offers unplayed districts more often than played ones', () => {
    const count: Record<DistrictId, number> = { plain: 0, orchardValley: 0, ironHills: 0, wetlands: 0 }
    for (let seed = 0; seed < 2000; seed++) {
      // last played plain, Wetlands played before: Orchard Valley and Iron Hills are unplayed
      const m = withMeta({ listingSeed: seed, prestigeCount: 2, districtsPlayed: ['wetlands', 'plain'] })
      for (const l of currentListings(m, 'plain').slice(1)) count[l.district]++
    }
    expect(count.orchardValley).toBeGreaterThan(count.wetlands)
    expect(count.ironHills).toBeGreaterThan(count.wetlands)
  })
})

describe('the ⭐ reroll', () => {
  it('costs ⭐40 / 80 / 160 / 320, then REROLL_MAX; each reroll changes the offer', () => {
    let s = atGate(700)
    const paid: number[] = []
    for (let i = 0; i < 4; i++) {
      const before = currentListings(s.meta, 'plain')
      const next = ok(rerollListings(s))
      paid.push(s.run.stars - next.run.stars)
      expect(next.meta.listingRerolls).toBe(i + 1)
      expect(currentListings(next.meta, 'plain')).not.toEqual(before)
      s = next
    }
    expect(paid).toEqual([40, 80, 160, 320])
    expect(s.run.stars).toBe(100)
    expect(rerollListings(s)).toEqual({ ok: false, error: 'REROLL_MAX' })
  })

  it('refuses NO_STARS with ⭐39 and LOCKED before the gate', () => {
    expect(rerollListings(atGate(39))).toEqual({ ok: false, error: 'NO_STARS' })
    expect(rerollListings({ ...createInitialState(), run: { ...createInitialState().run, stars: 400 } })).toEqual({ ok: false, error: 'LOCKED' })
  })
})
