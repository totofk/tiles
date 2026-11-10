import { describe, expect, it } from 'vitest'
import { PRESTIGE_GATE_DEEDS, deedsFor, energyMax, startTiles, workerActsAt, workerActionTicks } from '../src/core/balance'
import { deedsClaimable, saleDeeds, sellFarm, sellFarmUnlocked, starDeeds } from '../src/core/prestige'
import { createInitialState, type GameState, type MetaState } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

/** a run at the sale gate: farm jobs covered (planter + harvester certificate, a sprinkler) and 💰640k lifetime (8 deeds) */
const atGate = (over: Partial<GameState['run']> = {}): GameState => {
  const s = createInitialState()
  return {
    ...s,
    run: {
      ...s.run,
      lifetime: { ...s.run.lifetime, cashEarned: 640_000 },
      workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
      workshop: { built: true, beds: [true, false, false, false], valve: false },
      stars: 37,
      ...over,
    },
  }
}

describe('the sale gate', () => {
  it('needs every farm job covered and PRESTIGE_GATE_DEEDS lifetime deeds', () => {
    expect(PRESTIGE_GATE_DEEDS).toBe(8)
    expect(deedsFor(640_000)).toBe(8)
    expect(sellFarmUnlocked(createInitialState())).toBe(false)
    expect(sellFarmUnlocked(atGate())).toBe(true)
    // one gate short: no harvester certificate, or one deed short (💰639,999 → 7 deeds)
    expect(sellFarmUnlocked(atGate({ workers: { ...atGate().run.workers, certificates: ['plant'] } }))).toBe(false)
    expect(sellFarmUnlocked(atGate({ lifetime: { ...atGate().run.lifetime, cashEarned: 639_999 } }))).toBe(false)
  })
})

describe('sellFarm', () => {
  it('resets the run, moves lifetime and ⭐-bought order slots over, and pays cash + ⭐ deeds into the ledger', () => {
    const s = atGate({ orders: { unlocked: true, slots: 5, offers: [] }, tick: 12_345 })
    const sale = sellFarm(s)
    expect(sale.ok).toBe(true)
    if (!sale.ok) return
    const { meta, run } = sale.state
    expect(meta).toMatchObject({ prestigeCount: 1, deeds: 9, deedsClaimed: 8, runs: [{ endedAtTick: 12_345, deeds: 9 }] })
    expect([deedsClaimable(s), starDeeds(s), saleDeeds(s)]).toEqual([8, 1, 9])
    expect(run).toMatchObject({
      tick: 0,
      cash: 20,
      tiles: Array.from({ length: 9 }, () => expect.objectContaining({ status: 'untilled' })),
      licenses: ['radish'],
      milestones: {},
      stars: 0,
      orders: { unlocked: false, slots: 5, offers: [] },
      workers: { pool: 0, certificates: [] },
      lifetime: s.run.lifetime,
    })
    expect(run.workshop).toEqual({ built: false, beds: [false, false, false, false], valve: false })
  })

  it('refuses a loan in progress, then refuses NO_GAIN once the deeds are claimed', () => {
    const loan = { principal: 30, debt: 31.2 }
    expect(sellFarm(atGate({ loan }))).toEqual({ ok: false, error: 'LOAN_ACTIVE' })
    const sale = sellFarm(atGate())
    expect(sale.ok).toBe(true)
    if (!sale.ok) return
    // gate re-opened on the fresh run (the certificates and sprinkler were lost with it): the same lifetime cash is
    // never paid twice, and the ⭐ balance reset with the run
    const again = atGate({ stars: 0 })
    const regated: GameState = { meta: sale.state.meta, run: { ...again.run, lifetime: sale.state.run.lifetime } }
    expect(sellFarm(regated)).toEqual({ ok: false, error: 'NO_GAIN' })
  })

  it('the keep rows carry the crop licenses and the three farm certificates', () => {
    const meta = (levels: Partial<MetaState['upgrades']>): MetaState => ({ ...createInitialState().meta, upgrades: { ...createInitialState().meta.upgrades, ...levels } })
    const s: GameState = { meta: meta({ keepLicenses: 1, keepFirstCertificates: 1 }), run: atGate().run }
    const sale = sellFarm(s)
    expect(sale.ok).toBe(true)
    if (!sale.ok) return
    expect(sale.state.run.licenses).toBe(s.run.licenses)
    expect(sale.state.run.workers.certificates).toEqual(['plant', 'water', 'harvest'])
  })

  it('caps the run history at RUN_HISTORY_CAP entries, newest last', () => {
    const old = Array.from({ length: 20 }, (_, i) => ({ endedAtTick: i, deeds: 1 }))
    const s: GameState = { meta: { ...atGate().meta, runs: old }, run: atGate().run }
    const sale = sellFarm(s)
    expect(sale.ok).toBe(true)
    if (!sale.ok) return
    expect(sale.state.meta.runs).toHaveLength(20)
    expect(sale.state.meta.runs[19]).toEqual({ endedAtTick: 0, deeds: 9 })
  })
})

describe('the Legacy rows in balance', () => {
  const meta = (levels: Partial<MetaState['upgrades']>): MetaState => ({ ...createInitialState().meta, upgrades: { ...createInitialState().meta.upgrades, ...levels } })

  it('start tiles: a fresh run starts with 9 + 2 per level', () => {
    expect(startTiles(meta({}))).toBe(9)
    expect(startTiles(meta({ startTiles: 3 }))).toBe(15)
    expect(sellFarm({ meta: meta({ startTiles: 2 }), run: atGate().run }).ok).toBe(true)
  })

  it('energy: +2 max per level, no multiplier on top', () => {
    expect(energyMax(0, meta({}))).toBe(10)
    expect(energyMax(0, meta({ energy: 5 }))).toBe(20)
    expect(energyMax(4, meta({ energy: 5 }))).toBe(40)
  })

  it('worker speed: −0.5 s per level, the clock crossing whole multiples (tick 0 included)', () => {
    expect(workerActionTicks(meta({}))).toBe(5)
    expect(workerActionTicks(meta({ workerSpeed: 2 }))).toBe(4)
    // the integer clock is the old `tick % every === 0`, tick 0 acting included
    for (let tick = 0; tick < 40; tick++) expect(workerActsAt(tick, 5)).toBe(tick % 5 === 0)
    // 4.5 s spreads the actions evenly: 0, 5, 9, 14, 18, 23, 27 …
    const acts = Array.from({ length: 46 }, (_, t) => t).filter((t) => workerActsAt(t, 4.5))
    expect(acts).toEqual([0, 5, 9, 14, 18, 23, 27, 32, 36, 41, 45])
  })
})

describe('step identity with prestige applied', () => {
  it('meta rows on, a worker staffed, catch-up: step(s, n) = n × step(s, 1) and catchUp(s, n s) = step(s, n)', () => {
    const base = sellFarm({ meta: { ...createInitialState().meta, upgrades: { ...createInitialState().meta.upgrades, growTime: 1, sellPrice: 1, cost: 1, energy: 1, startTiles: 1, workerSpeed: 2 } }, run: atGate().run })
    expect(base.ok).toBe(true)
    if (!base.ok) return
    const s: GameState = {
      ...base.state,
      run: {
        ...base.state.run,
        cash: 5_000,
        tiles: base.state.run.tiles.map((t, i) => (i < 4 ? { ...t, status: 'planted' as const, cropId: 'lemon' as const, moisture: 4 } : t)),
        workers: { ...base.state.run.workers, pool: 1, assigned: { ...base.state.run.workers.assigned, water: 1 }, certificates: ['water'] },
      },
    }
    let folded = s
    for (let i = 0; i < 600; i++) folded = step(folded, 1)
    expect(step(s, 600)).toEqual(folded)
    expect(catchUp(s, 600_000)).toEqual(step(s, 600))
  })
})
