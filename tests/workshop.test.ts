import { describe, expect, it } from 'vitest'
import { moistureDrainPerTick, sprinklerCost, sprinklerMax, valveCost, workshopCost, workshopVeinLevel, type Price } from '../src/core/balance'
import { buyTile, water } from '../src/core/actions'
import { toolTargets } from '../src/core/tools'
import { createInitialState, createTile, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { buildSprinkler, buildWorkshop, buyValve, isIrrigated } from '../src/core/workshop'

const init = createInitialState()
const drain = moistureDrainPerTick(init.meta)
const NO_BEDS = [false, false, false, false]
/** the full sprinkler recipe beside the cash it needs */
const FULL = { stone: 99, ironBar: 99, copperBar: 99, goldBar: 99, cash: 99999 }

/** a workshop-ready run: vein Lv4, the workshop built with the given bed sockets, tiles as given */
function withWorkshop(beds: boolean[], tiles: Tile[], extra: Partial<GameState['run']> = {}): GameState {
  return {
    ...init,
    run: {
      ...init.run,
      tiles,
      vein: { ...init.run.vein, level: 4 },
      workshop: { built: true, beds, valve: false },
      ...extra,
    },
  }
}

/** growing lemon tiles with the given moistures (growth far from done, fertilizer 0 → grow 360) */
const growingTiles = (moistures: number[]): Tile[] =>
  moistures.map((moisture) => ({ status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture, ticksSinceMature: 0 }))

describe('workshop: balance', () => {
  it('workshop costs 30 stone + 6 iron bars + its cash part and needs vein Lv4; sprinkler recipe unchanged', () => {
    expect(workshopCost(init.meta)).toEqual({ stone: 30, ironBar: 6, cash: workshopCost(init.meta).cash })
    expect(Object.entries(workshopCost(init.meta) as Price).length).toBe(3)
    expect(workshopVeinLevel()).toBe(4)
    expect(sprinklerCost(init.meta)).toEqual({ goldBar: 4, ironBar: 8, copperBar: 8, cash: sprinklerCost(init.meta).cash })
    // 4 beds of 6 tiles; the valve keeps its recipe for batch 28
    expect(sprinklerMax()).toBe(4)
    expect(valveCost(init.meta)).toEqual({ goldBar: 2, cash: valveCost(init.meta).cash })
  })
})

describe('buildWorkshop', () => {
  it('is LOCKED below vein Lv4 and ALREADY_OWNED once built', () => {
    const s = { ...init, run: { ...init.run, vein: { ...init.run.vein, level: 3 }, inventory: { stone: 30, ironBar: 6 }, cash: 99999 } }
    expect(buildWorkshop(s)).toEqual({ ok: false, error: 'LOCKED' })
    const built = withWorkshop([...NO_BEDS], [])
    expect(buildWorkshop(built)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('pays stone, iron bars and cash; the workshop milestone records', () => {
    const s = { ...init, run: { ...init.run, vein: { ...init.run.vein, level: 4 }, inventory: { stone: 30, ironBar: 6 }, cash: 99999 } }
    const r = buildWorkshop(s)
    if (!r.ok) throw new Error(r.error)
    expect(r.state.run.workshop).toEqual({ built: true, beds: NO_BEDS, valve: false })
    expect([r.state.run.inventory.stone, r.state.run.inventory.ironBar]).toEqual([0, 0])
    expect(r.state.run.milestones.workshop).toBe(r.state.run.tick)
    // items first, then cash (the pay order)
    const noItems = { ...s, run: { ...s.run, inventory: {} } }
    expect(buildWorkshop(noItems)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const noCash = { ...s, run: { ...s.run, cash: 0 } }
    expect(buildWorkshop(noCash)).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buildSprinkler', () => {
  it('is NO_WORKSHOP without the workshop, LOCKED off the lot or on a bed with no owned tile, ALREADY_OWNED on a built bed', () => {
    expect(buildSprinkler({ ...init, run: { ...init.run, inventory: { ...FULL }, cash: FULL.cash } }, 0)).toEqual({ ok: false, error: 'NO_WORKSHOP' })
    const nine = withWorkshop(NO_BEDS, Array.from({ length: 9 }, createTile), { inventory: { ...FULL }, cash: FULL.cash })
    // bed 3 has no owned tile at 9 tiles (3 × 6 = 18 > 9), and there is no bed 4 or −1
    expect(buildSprinkler(nine, 3)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildSprinkler(nine, 4)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildSprinkler(nine, -1)).toEqual({ ok: false, error: 'LOCKED' })
    expect(buildSprinkler(nine, 0.5)).toEqual({ ok: false, error: 'LOCKED' })
    const built = withWorkshop([true, false, false, false], nine.run.tiles, { inventory: { ...FULL }, cash: FULL.cash })
    expect(buildSprinkler(built, 0)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('pays the recipe on the build itself and lights bed 1; the milestone records; a tile bought into the bed later is irrigated at once', () => {
    const s = withWorkshop(NO_BEDS, Array.from({ length: 9 }, createTile), { inventory: { ...FULL }, cash: FULL.cash })
    const r = buildSprinkler(s, 1)
    expect(r.ok && r.state.run.workshop.beds).toEqual([false, true, false, false])
    expect(r.ok && r.state.run.milestones.firstSprinkler).toBeDefined()
    expect(r.ok && r.state.run.inventory).toEqual({ ...FULL, ironBar: 91, copperBar: 91, goldBar: 95 })
    expect(r.ok && r.state.run.cash).toBe(FULL.cash - sprinklerCost(s.meta).cash)
    // bed 1 covers tiles 6–11 but only 6–8 exist: tile 9 bought into it is irrigated the moment it exists (beds-only formula)
    expect(isIrrigated(r.ok ? r.state.run : s.run, 6)).toBe(true)
    expect(isIrrigated(r.ok ? r.state.run : s.run, 12)).toBe(false)
    const grown = buyTile({ ...(r.ok ? r.state : s), run: { ...(r.ok ? r.state : s).run, cash: 999999 } })
    expect(grown.ok && isIrrigated(grown.state.run, 9)).toBe(true)

    const noItems = withWorkshop(NO_BEDS, s.run.tiles, { inventory: {}, cash: FULL.cash })
    expect(buildSprinkler(noItems, 0)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const noCash = withWorkshop(NO_BEDS, s.run.tiles, { inventory: { ...FULL }, cash: 0 })
    expect(buildSprinkler(noCash, 0)).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buyValve', () => {
  it('batch 28: order NO_WORKSHOP, LOCKED (Fields not unlocked), ALREADY_OWNED, NOT_ENOUGH_ITEMS, NO_CASH; pays 2 Au + cash', () => {
    const fields = { ...init.run.fields, unlocked: true }
    expect(buyValve({ ...init, run: { ...init.run, fields, inventory: { goldBar: 2 }, cash: 99999 } })).toEqual({ ok: false, error: 'NO_WORKSHOP' })
    expect(buyValve(withWorkshop(NO_BEDS, [], { inventory: { goldBar: 2 }, cash: 99999 }))).toEqual({ ok: false, error: 'LOCKED' })
    const ready = withWorkshop(NO_BEDS, [], { fields, inventory: { goldBar: 2 }, cash: 99999 })
    expect(buyValve({ ...ready, run: { ...ready.run, workshop: { ...ready.run.workshop, valve: true } } })).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    expect(buyValve({ ...ready, run: { ...ready.run, inventory: { goldBar: 1 } } })).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    expect(buyValve({ ...ready, run: { ...ready.run, cash: valveCost(init.meta).cash - 1 } })).toEqual({ ok: false, error: 'NO_CASH' })
    const r = buyValve(ready)
    if (!r.ok) throw new Error(r.error)
    expect([r.state.run.workshop.valve, r.state.run.inventory.goldBar, r.state.run.cash]).toEqual([true, 0, 99999 - valveCost(init.meta).cash])
    expect(r.state.run.milestones.valve).toBe(r.state.run.tick)
  })
})

describe('watering skips irrigated tiles', () => {
  it('water on an irrigated tile is IRRIGATED and spends no energy; toolTargets never lists one', () => {
    const s = withWorkshop([true, false, false, false], growingTiles([0, 0, 0, 0, 0, 0, 0, 0, 0]))
    expect(water(s, 3)).toEqual({ ok: false, error: 'IRRIGATED' })
    const wet = water(s, 7) // bed 1 has no sprinkler
    expect(wet.ok).toBe(true)
    expect(wet.ok && wet.state.run.energy).toBe(s.run.energy - 1)
    expect(toolTargets(s, 'water')).toEqual([6, 7, 8])
  })

  it('the water worker with every tile irrigated takes no action and is paid nothing', () => {
    const s = withWorkshop(
      [true, true, true, true],
      growingTiles(Array(24).fill(0)),
      { workers: { pool: 1, assigned: { ...init.run.workers.assigned, water: 1 }, certificates: ['water'] }, cash: 100 },
    )
    const after = step(s, 600)
    expect(after.run.counters.waters).toBe(0)
    expect(after.run.lifetime.wagesPaid).toBe(0)
    expect(after.run.cash).toBe(100)
  })
})

describe('step with irrigated beds', () => {
  it('an irrigated planted tile at moisture 0 grows to full and never drains; rot is unchanged', () => {
    const s = withWorkshop([true, false, false, false], growingTiles([0, 0, 0, 0, 0, 0, 2]), { tick: 5 })
    // lemon grows 360 ticks from 10, then rots after a 720-tick grace → tilled at step 1,071, still holding moisture 4
    const after = step(s, 1100)
    expect(after.run.tiles.slice(0, 6).map((t) => t.status)).toEqual(Array(6).fill('tilled'))
    expect(after.run.tiles.slice(0, 6).every((t) => t.moisture === 4)).toBe(true)
    // bed 1's tile kept draining: moisture 2 ran out after 2/drain = 120 growth ticks, stalled dry at growth 130
    expect(after.run.tiles[6]).toMatchObject({ status: 'planted', growth: 130, moisture: 0 })
  })

  it('an irrigated tile at moisture 0 grows on the very first step; a dry tile outside the bed drains', () => {
    const s = withWorkshop([true, false, false, false], growingTiles([0, 0, 0, 0, 0, 0, 2]), { tick: 5 })
    const after = step(s, 1)
    expect(after.run.tiles[0]).toMatchObject({ growth: 11, moisture: 4 })
    expect(after.run.tiles[6]).toMatchObject({ growth: 11, moisture: 2 - drain })
  })

  it('step(s, n) = n × step(s, 1) with 2 built beds (batch 26 pin c)', () => {
    const moistures = [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 2, 0, 1, 3, 0.5, 4]
    const s = withWorkshop([true, true, false, false], growingTiles(moistures), {
      workers: { pool: 1, assigned: { ...init.run.workers.assigned, fuel: 1 }, certificates: ['fuel'] },
      inventory: { coal: 10 },
      cash: 100,
      tick: 4,
    })
    let one = s
    for (let i = 0; i < 900; i++) one = step(one, 1)
    expect(step(s, 900)).toEqual(one)
  })
})
