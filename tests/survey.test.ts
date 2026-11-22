// 🧭 Soil survey pins (batch 36.5, task 233): the ⭐ ladder and its rolls (PIN36p), every trait at Lv1 and Lv3
// measured on the real hook (PIN36q), and the veteran report — the migrated v33 fixture stepped 2 h with and
// without its rolled traits (PIN36s). Pure core, no bot.
import { describe, expect, it } from 'vitest'
import { harvest } from '../src/core/actions'
import { cropGrowTicks, cropRotGraceTicks, fieldPlots, soilRerollStars } from '../src/core/balance'
import { CROP_GROUPS } from '../src/core/data/crops'
import type { FieldTraitId, HomeTraitId } from '../src/core/data/soil'
import { buyFavour, favourPrice } from '../src/core/favours'
import { buyPlot, sowPlot } from '../src/core/fields'
import { cropSale } from '../src/core/market'
import { cropOrderPrice, harvestSale } from '../src/core/orders'
import { sellFarm } from '../src/core/prestige'
import { createInitialState, createMachines, type Field, type GameState, type Offer, type RunState, type Survey } from '../src/core/state'
import { step } from '../src/core/step'
import { bedSaleSoil, drawField, drawHome, fieldCreekSlip, fieldDenseBurn, fieldGrowFactor, fieldSaleSoil, rerollSoil } from '../src/core/survey'
import { ticksUntilRot } from '../src/core/tile'
import { deserialize } from '../src/save/serialize'
import v33 from './fixtures/save-v33.json?raw'

const init = createInitialState()
const meta = init.meta

/** a survey at `level` with rolled `beds` / `fields` traits (null = the slot exists but is unrolled) */
const survey = (level: number, beds: (HomeTraitId | null)[], fields: (FieldTraitId | null)[] = []): Survey => ({
  level,
  beds: beds.map((trait) => ({ trait, rerolls: 0 })),
  fields: fields.map((trait) => ({ trait, rerolls: 0 })),
})
const withSurvey = (s: GameState, sv: Survey, run: Partial<RunState> = {}): GameState => ({ ...s, run: { ...s.run, ...run, survey: sv } })
const okRun = (level: number, beds: (HomeTraitId | null)[], fields: (FieldTraitId | null)[] = [], run: Partial<RunState> = {}): GameState =>
  withSurvey(init, survey(level, beds, fields), { stars: 1_000, ...run })
const onePlot = (crop: Field['crop']): Field => ({ pivot: true, crop, pinned: false, plots: [{ crop: null, readyTick: 0 }] })
/** one unlocked field; a `survey` or partial `fields` piece in `run` wins over the defaults */
type FieldRun = Omit<Partial<RunState>, 'survey' | 'fields'> & { survey?: Survey; fields?: Partial<GameState['run']['fields']> }
const withField = (s: GameState, field: Field, run: FieldRun = {}): GameState => {
  const { survey: sv, fields, ...rest } = run
  return withSurvey(s, sv ?? s.run.survey, { ...rest, fields: { ...s.run.fields, unlocked: true, list: [field], machines: createMachines(), ...fields } })
}

describe('PIN36p: the ⭐ ladder and the rolls', () => {
  it('prices ⭐80 / ⭐200 / ⭐320 then MAX_LEVEL; Lv2 is LOCKED before the Fields open', () => {
    expect(favourPrice(okRun(0, [null, null, null, null]).run, meta, 'soilSurvey')).toEqual({ cash: 0, stars: 80 })
    expect(favourPrice(okRun(1, []).run, meta, 'soilSurvey')).toEqual({ cash: 0, stars: 200 })
    expect(favourPrice(okRun(2, []).run, meta, 'soilSurvey')).toEqual({ cash: 0, stars: 320 })
    expect(favourPrice(okRun(3, []).run, meta, 'soilSurvey')).toBeNull()
    expect(buyFavour(okRun(3, []), 'soilSurvey')).toEqual({ ok: false, error: 'MAX_LEVEL' })
    expect(buyFavour(okRun(1, []), 'soilSurvey')).toEqual({ ok: false, error: 'LOCKED' })
  })

  it('Lv1 rolls the 4 beds, Lv2 every field, Lv3 rolls nothing (rngState equal); a field bought at Lv2+ rolls at purchase', () => {
    const lv1 = buyFavour(okRun(0, [null, null, null, null]), 'soilSurvey')
    if (!lv1.ok) throw new Error(lv1.error)
    expect(lv1.state.run.survey.beds.every((b) => b.trait !== null)).toBe(true)
    expect(lv1.state.run.rngState).not.toBe(init.run.rngState)
    const at2 = withSurvey(init, survey(1, []), {
      stars: 1_000,
      fields: { ...init.run.fields, unlocked: true, list: [onePlot('potato'), onePlot('potato')], machines: createMachines() },
    })
    const lv2 = buyFavour(at2, 'soilSurvey')
    if (!lv2.ok) throw new Error(lv2.error)
    expect(lv2.state.run.survey.level).toBe(2)
    expect(lv2.state.run.survey.fields).toHaveLength(2)
    expect(lv2.state.run.survey.fields.every((f) => f.trait !== null)).toBe(true)
    const before = lv2.state.run.rngState
    const lv3 = buyFavour(lv2.state, 'soilSurvey')
    if (!lv3.ok) throw new Error(lv3.error)
    expect([lv3.state.run.survey.level, lv3.state.run.rngState]).toEqual([3, before])
    // a new field rolls at purchase once the survey is at Lv2, not at Lv1 (a full field, so the plot opens one)
    const full: Field = { pivot: true, crop: null, pinned: false, plots: Array.from({ length: fieldPlots() }, () => ({ crop: null, readyTick: 0 })) }
    const rolled2 = buyPlot(withField(okRun(2, [], ['creek']), full, { cash: 1e9 }))
    if (!rolled2.ok) throw new Error(rolled2.error)
    expect(rolled2.state.run.survey.fields).toHaveLength(2)
    expect(rolled2.state.run.survey.fields[1]!.trait).not.toBeNull()
    const unrolled = buyPlot(withField(okRun(1, []), full, { cash: 1e9 }))
    if (!unrolled.ok) throw new Error(unrolled.error)
    expect(unrolled.state.run.survey.fields).toEqual([])
  })

  it('7,000 home and 6,000 field rolls from a fixed seed: 1/7 and 1/6 shares ± 15 %, group prices a third each ± 20 %', () => {
    let rng = 20261123
    const home = new Map<HomeTraitId, number>()
    for (let i = 0; i < 7_000; i++) {
      const [t, next] = drawHome(rng)
      home.set(t, (home.get(t) ?? 0) + 1)
      rng = next
    }
    // 1/7 of 7,000 = 1,000 ± 15 % relative = 850..1,150
    for (const t of ['roots', 'fruitVeg', 'berry', 'clay', 'loose', 'rich', 'fertile'] as HomeTraitId[]) {
      expect(home.get(t) ?? 0).toBeGreaterThan(850)
      expect(home.get(t) ?? 0).toBeLessThan(1_150)
    }
    let rng2 = 20261123
    const field = new Map<FieldTraitId, number>()
    for (let i = 0; i < 6_000; i++) {
      const [t, next] = drawField(rng2)
      field.set(t, (field.get(t) ?? 0) + 1)
      rng2 = next
    }
    // the six entries: {group price, creek, dense, contract, easySell, fertile}, each 1,000 ± 150
    const prices = (['rootsPrice', 'fruitVegPrice', 'berryPrice'] as FieldTraitId[]).reduce((n, t) => n + (field.get(t) ?? 0), 0)
    expect(prices).toBeGreaterThan(850)
    expect(prices).toBeLessThan(1_150)
    for (const t of ['creek', 'dense', 'contract', 'easySell', 'fertile'] as FieldTraitId[]) {
      expect(field.get(t) ?? 0).toBeGreaterThan(850)
      expect(field.get(t) ?? 0).toBeLessThan(1_150)
    }
    for (const t of ['rootsPrice', 'fruitVegPrice', 'berryPrice'] as FieldTraitId[]) {
      const share = (field.get(t) ?? 0) / prices
      expect(Math.abs(share - 1 / 3)).toBeLessThan((0.2 * 1) / 3)
    }
  })

  it('rerolls cost ⭐16 / 24 / 36 / 54 / 81 per unit, redraw that unit only, and fail LOCKED / BAD_TILE / NO_STARS', () => {
    expect([0, 1, 2, 3, 4].map(soilRerollStars)).toEqual([16, 24, 36, 54, 81])
    const s = okRun(1, ['clay', 'clay', 'clay', 'clay'])
    const first = rerollSoil(s, 'bed', 0)
    if (!first.ok) throw new Error(first.error)
    expect([first.state.run.stars, first.state.run.survey.beds.map((b) => b.rerolls)]).toEqual([984, [1, 0, 0, 0]])
    const second = rerollSoil(first.state, 'bed', 0)
    if (!second.ok) throw new Error(second.error)
    expect([second.state.run.stars, second.state.run.survey.beds.map((b) => b.rerolls)]).toEqual([960, [2, 0, 0, 0]])
    // only bed 1 redraws — the others keep clay
    expect(second.state.run.survey.beds.slice(1).every((b) => b.trait === 'clay')).toBe(true)
    expect(rerollSoil(okRun(1, ['clay', 'clay', 'clay', 'clay'], [], { stars: 15 }), 'bed', 0)).toEqual({ ok: false, error: 'NO_STARS' })
    expect(rerollSoil(withSurvey(init, survey(0, [null, null, null, null])), 'bed', 0)).toEqual({ ok: false, error: 'LOCKED' })
    expect(rerollSoil(s, 'bed', 9)).toEqual({ ok: false, error: 'BAD_TILE' })
    expect(rerollSoil(withSurvey(init, survey(1, [], ['creek'])), 'field', 0)).toEqual({ ok: false, error: 'LOCKED' })
  })

  it('sellFarm resets the survey; the same seed rolls the same state', () => {
    const gate = okRun(2, ['rich', 'rich', 'rich', 'rich'], ['creek', 'dense'], {
      lifetime: { ...init.run.lifetime, cashEarned: 640_000 },
      workers: { ...init.run.workers, certificates: ['plant', 'harvest'] },
      workshop: { built: true, beds: [true, false, false, false], valve: false },
    })
    const sold = sellFarm(gate)
    expect(sold.ok && sold.state.run.survey).toEqual(survey(0, [null, null, null, null]))
    const a = buyFavour(okRun(0, [null, null, null, null]), 'soilSurvey')
    const b = buyFavour(okRun(0, [null, null, null, null]), 'soilSurvey')
    if (!a.ok || !b.ok) throw new Error('buy failed')
    expect(a.state.run.survey).toEqual(b.state.run.survey)
  })
})

describe('PIN36q: every trait at Lv1 and Lv3, on the real hook', () => {
  const grow = cropGrowTicks('potato', meta, 0, null)
  const grace = cropRotGraceTicks('potato', meta, null)
  const maturePotato = { status: 'planted' as const, cropId: 'potato' as const, growth: grow, moisture: 1, ticksSinceMature: 0 }
  /** bed 1 planted `tile`, sprinklered so it grows every tick; the workshop can be turned off by the caller */
  const bed = (sv: Survey, tile = maturePotato, sprinkler = true): GameState => ({
    ...init,
    run: {
      ...init.run,
      survey: sv,
      workshop: { ...init.run.workshop, built: sprinkler, beds: [sprinkler, false, false, false], valve: false },
      tiles: init.run.tiles.map((t, i) => (i === 0 ? tile : t)),
    },
  })

  it('🌻 fertile matures in round(grow × 0.9) wet ticks (0.85 at Lv3); a plain bed takes grow', () => {
    const sprout = { ...maturePotato, growth: 0 }
    const ticksToMature = (s: GameState): number => {
      let cur = s
      for (let n = 1; n < 10_000; n++) {
        cur = step(cur, 1)
        if (cur.run.tiles[0]!.growth >= grow) return n
      }
      throw new Error('never matured')
    }
    const lv1 = ticksToMature(bed(survey(1, ['fertile', null, null, null]), sprout))
    const lv3 = ticksToMature(bed(survey(3, ['fertile', null, null, null]), sprout))
    expect(Math.abs(lv1 - grow * 0.9)).toBeLessThanOrEqual(1)
    expect(Math.abs(lv3 - grow * 0.85)).toBeLessThanOrEqual(1)
    expect(ticksToMature(bed(survey(1, [null, null, null, null]), sprout))).toBe(grow)
  })

  it('🧱 clay keeps a full bar wet 1 / 0.6 (Lv3 1 / 0.4) as long as a plain bed', () => {
    const dryAfter = (sv: Survey): number => {
      let cur = bed(sv, { ...maturePotato, growth: 0 }, false)
      for (let n = 1; n < 10_000; n++) {
        cur = step(cur, 1)
        if (cur.run.tiles[0]!.moisture <= 0) return n
      }
      throw new Error('never dry')
    }
    const plain = dryAfter(survey(1, [null, null, null, null]))
    expect(dryAfter(survey(1, ['clay', null, null, null])) / plain).toBeCloseTo(1 / 0.6, 1)
    expect(dryAfter(survey(3, ['clay', null, null, null])) / plain).toBeCloseTo(1 / 0.4, 1)
  })

  it('🍂 loose rots after grace × 2 (× 2.5 at Lv3) and ticksUntilRot(tile, s, i) agrees', () => {
    for (const [level, factor] of [[1, 2], [3, 2.5]] as const) {
      const s = bed(survey(level, ['loose', null, null, null]))
      expect(ticksUntilRot(s.run.tiles[0]!, s, 0)).toBe(Math.floor(grace * factor) + 1)
      let cur = s
      let n = 0
      while (cur.run.tiles[0]!.status === 'planted' && n < 10_000) {
        cur = step(cur, 1)
        n++
      }
      expect(n).toBe(Math.floor(grace * factor) + 1)
    }
  })

  it('💎 rich: 20,000 tier-0 harvests double 10 % ± 1 (15 % ± 1 at Lv3); a plain bed never rolls', () => {
    const doubles = (sv: Survey): number => {
      let s = bed(sv)
      let hits = 0
      for (let n = 0; n < 20_000; n++) {
        const r = harvest(s, 0, 0)
        if (!r.ok) throw new Error(r.error)
        if (r.state.run.counters.sales - s.run.counters.sales === 2) hits++
        s = { ...r.state, run: { ...r.state.run, tiles: r.state.run.tiles.map((t, i) => (i === 0 ? maturePotato : t)), market: s.run.market } }
      }
      return hits
    }
    const lv1 = doubles(survey(1, ['rich', null, null, null]))
    expect(Math.abs(lv1 - 2_000)).toBeLessThanOrEqual(200)
    const lv3 = doubles(survey(3, ['rich', null, null, null]))
    expect(Math.abs(lv3 - 3_000)).toBeLessThanOrEqual(200)
    expect(doubles(survey(1, [null, null, null, null]))).toBe(0)
  })

  it('🥔 home and field price: the market unit × 1.15 / 1.225 (home) and × 1.2 / 1.3 (field), ± rounding; an order unit pays cropOrderPrice unchanged', () => {
    const plain = cropSale(init, 'potato', 1, 1).cash
    for (const [level, factor] of [[1, 1.15], [3, 1.225]] as const) {
      const s = okRun(level, ['roots', null, null, null])
      expect(Math.abs(cropSale(s, 'potato', 1, 1, bedSaleSoil(s.run, 0, 'potato')).cash - Math.round(plain * factor))).toBeLessThanOrEqual(1)
    }
    for (const [level, factor] of [[2, 1.2], [3, 1.3]] as const) {
      const s = withField(init, onePlot('potato'), { survey: survey(level, [], ['rootsPrice']) })
      expect(Math.abs(cropSale(s, 'potato', 1, 1, fieldSaleSoil(s.run, 0, 'potato')).cash - Math.round(plain * factor))).toBeLessThanOrEqual(1)
    }
    // the price trait lifts the market, not the order: an accepted potato order pays cropOrderPrice whatever the soil
    const offered = okRun(1, ['roots', null, null, null], [], { orders: { ...init.run.orders, unlocked: true, slots: 1, offers: [{ good: 'potato', count: 5, done: 0, tier: 1, accepted: true, stars: 1 }] } })
    expect(harvestSale(offered, 'potato', 1, 1, 1, bedSaleSoil(offered.run, 0, 'potato')).cash).toBe(cropOrderPrice(offered, 'potato'))
  })

  it('field 🌻 fertile: sowPlot\'s readyTick = tick + ceil(grow × 0.9 / 2) (0.85 at Lv3)', () => {
    const cycles = (sv: Survey): number => {
      const s = withField(init, onePlot('potato'), { cash: 1e9, autoBuySeeds: true, licenses: ['potato'], survey: sv })
      const r = sowPlot(s, 0, 0)
      if (!r.ok) throw new Error(r.error)
      return r.state.run.fields.list[0]!.plots[0]!.readyTick - s.run.tick
    }
    expect(cycles(survey(2, [], ['fertile']))).toBe(Math.ceil((grow * 0.9) / 2))
    expect(cycles(survey(3, [], ['fertile']))).toBe(Math.ceil((grow * 0.85) / 2))
    expect(cycles(survey(2, []))).toBe(Math.ceil(grow / 2))
  })

  it('💦 creek: an unpaid corn plot ripens at ×1.3 (×1.45 at Lv3) of the plain unpaid pace, ± 1 %', () => {
    const cornGrow = cropGrowTicks('corn', meta, 0, null)
    const ripens = (sv: Survey): number => {
      // tank 0: the pivot cannot pay, so the plot slips on the unpaid rule (plain odd ticks, the creek's everyNth)
      const s = withField(init, { pivot: true, crop: 'corn', pinned: false, plots: [{ crop: 'corn', readyTick: cornGrow / 2 }] }, { survey: sv, fields: { tank: 0 } })
      let cur = s
      const start = cur.run.tick
      while (cur.run.tick < cur.run.fields.list[0]!.plots[0]!.readyTick && cur.run.tick - start < 10_000) cur = step(cur, 1)
      return cur.run.tick - start
    }
    const plain = ripens(survey(2, []))
    const creek = ripens(survey(2, [], ['creek']))
    expect(Math.abs(plain / creek - 1.3)).toBeLessThanOrEqual(0.013)
    const plain3 = ripens(survey(3, []))
    const creek3 = ripens(survey(3, [], ['creek']))
    expect(Math.abs(plain3 / creek3 - 1.45)).toBeLessThanOrEqual(0.0145)
  })

  it('🌑 dense: 1,000 ticks burn 700 (550 at Lv3) tank units per burning plot', () => {
    const burn = (sv: Survey): number => {
      const TANK = 100_000
      const s = withField(init, { pivot: true, crop: 'potato', pinned: false, plots: [{ crop: 'potato', readyTick: 10_000_000 }] }, { survey: sv, fields: { tank: TANK } })
      return TANK - step(s, 1_000).run.fields.tank
    }
    expect(burn(survey(2, [], ['dense']))).toBe(700)
    expect(burn(survey(3, [], ['dense']))).toBe(550)
    expect(burn(survey(2, []))).toBe(1_000)
  })

  it('📜 contract: 10 units fill 15 (17 at Lv3) of the order and pay 10 × cropOrderPrice; 🤝 easySell: 10 units glut 7 (5.5)', () => {
    const offered = (sv: Survey): GameState =>
      withField(init, onePlot('potato'), {
        survey: sv,
        orders: { ...init.run.orders, unlocked: true, slots: 1, offers: [{ good: 'potato', count: 20, done: 0, tier: 1, accepted: true, stars: 1 } as Offer] },
      })
    for (const [level, fill] of [[2, 15], [3, 17]] as const) {
      const s = offered(survey(level, [], ['contract']))
      const sale = harvestSale(s, 'potato', 10, 1, 1, fieldSaleSoil(s.run, 0, 'potato'))
      expect(sale.cash).toBe(10 * cropOrderPrice(s, 'potato'))
      expect((sale.run.orders.offers[0] as Offer).done).toBe(fill)
    }
    for (const [level, glut] of [[2, 7], [3, 5.5]] as const) {
      const s = withField(init, onePlot('potato'), { survey: survey(level, [], ['easySell']) })
      const sale = harvestSale(s, 'potato', 10, 1, 1, fieldSaleSoil(s.run, 0, 'potato'))
      expect(sale.run.market.potato).toBeCloseTo(glut, 5)
    }
  })

  it('a level-0 run with traits written into survey equals the plain run: the hooks read plain and the steps are identical', () => {
    const traited = withSurvey(init, survey(0, ['fertile', 'clay', 'loose', 'rich'], ['creek', 'dense', 'contract', 'easySell']))
    expect([bedSaleSoil(traited.run, 0, 'potato'), fieldSaleSoil(traited.run, 0, 'potato'), fieldGrowFactor(traited.run, 0), fieldCreekSlip(traited.run, 0), fieldDenseBurn(traited.run, 0)]).toEqual([{ price: 1, glut: 1, order: 1 }, { price: 1, glut: 1, order: 1 }, 1, null, null])
    const running = (s: GameState): GameState => ({
      ...s,
      run: {
        ...s.run,
        cash: 1e9,
        autoBuySeeds: true,
        licenses: ['potato'],
        fields: { ...s.run.fields, unlocked: true, tank: 0, list: [{ pivot: true, crop: 'potato', pinned: false, plots: [{ crop: 'potato', readyTick: 9_000 }] }], machines: createMachines() },
        tiles: s.run.tiles.map((t, i) => (i < 6 ? { status: 'planted', cropId: 'potato' as const, growth: 0, moisture: 1, ticksSinceMature: 0 } : t)),
      },
    })
    // survey content aside (asserted plain above), the two runs step identically
    expect({ ...step(running(traited), 300).run, survey: undefined }).toEqual({ ...step(running(init), 300).run, survey: undefined })
  })
})

describe('PIN36s: the veteran report — the migrated v33 fixture, 2 game-h with and without its rolled traits', () => {
  it(
    'surveyed ≥ 0.98 × plain cash for each of 3 seeds; berryPrice closed form ×1.2 / ×1.3',
    () => {
      const base = deserialize(v33)!.state
      // Lv3 with its own rolled traits: the three ⭐ buys off the fixture's own rngState (⭐ granted for the roll)
      let rolled = base
      for (let n = 0; n < 3; n++) {
        const r = buyFavour({ ...rolled, run: { ...rolled.run, stars: rolled.run.stars + 400 } }, 'soilSurvey')
        if (!r.ok) throw new Error(r.error)
        rolled = r.state
      }
      expect([rolled.run.survey.level, rolled.run.survey.beds.every((b) => b.trait !== null), rolled.run.survey.fields.length]).toEqual([3, true, base.run.fields.list.length])
      for (const seed of [base.run.rngState, 987_654_321, 42]) {
        const plain = step({ ...base, run: { ...base.run, rngState: seed } }, 7_200)
        const rich = step({ ...rolled, run: { ...rolled.run, rngState: seed } }, 7_200)
        const gained = [plain.run.cash - base.run.cash, rich.run.cash - base.run.cash]
        console.log('PIN36s', { seed, plainCash: gained[0], surveyedCash: gained[1], ratio: gained[1]! / gained[0]! })
        expect(gained[1]).toBeGreaterThanOrEqual(0.98 * gained[0]!)
      }
      // the closed form: a berryPrice field's market unit = plain × 1.2 (Lv2) / × 1.3 (Lv3), ± rounding
      const berry = CROP_GROUPS.berry[0]!
      const plainUnit = cropSale(base, berry, 1, 1).cash
      for (const [level, factor] of [[2, 1.2], [3, 1.3]] as const) {
        const soil = fieldSaleSoil(withSurvey(base, survey(level, [], ['berryPrice'])).run, 0, berry)
        expect(Math.abs(cropSale(base, berry, 1, 1, soil).cash - Math.round(plainUnit * factor))).toBeLessThanOrEqual(1)
      }
    },
    60_000,
  )
})
