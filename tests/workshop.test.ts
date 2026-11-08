import { describe, expect, it } from 'vitest'
import {
  moistureDrainPerTick,
  sprinklerCoalTicks,
  sprinklerCost,
  sprinklerHopper,
  sprinklerMax,
  sprinklerTiles,
  valveCost,
  workerActionTicks,
  workshopCost,
  workshopVeinLevel,
  type Price,
} from '../src/core/balance'
import { buildWorkshop, buySprinkler, buyValve, fillHopper, sprinklersAct, sprinklerTargets } from '../src/core/workshop'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { catchUp } from '../src/save/serialize'

const init = createInitialState()
const drain = moistureDrainPerTick(init.meta)

/** a workshop-ready run: vein Lv4, the workshop built with `hoppers` coal per machine, planted tiles as given */
function withWorkshop(hoppers: number[], tiles: Tile[], extra: Partial<GameState['run']> = {}): GameState {
  return {
    ...init,
    run: {
      ...init.run,
      tiles,
      vein: { ...init.run.vein, level: 4 },
      workshop: { built: true, hoppers, valve: false },
      ...extra,
    },
  }
}

/** growing lemon tiles with the given moistures (growth far from done, fertilizer 0 → grow 360) */
const growingTiles = (moistures: number[]): Tile[] =>
  moistures.map((moisture) => ({ status: 'planted' as const, cropId: 'lemon' as const, growth: 10, moisture, ticksSinceMature: 0 }))

describe('workshop: balance', () => {
  it('workshop costs 30 stone + 6 iron bars + its cash part and needs vein Lv4; sprinkler recipe, pump and valve numbers', () => {
    expect(workshopCost(init.meta)).toEqual({ stone: 30, ironBar: 6, cash: workshopCost(init.meta).cash })
    expect(Object.entries(workshopCost(init.meta) as Price).length).toBe(3)
    expect(workshopVeinLevel()).toBe(4)
    expect(sprinklerCost(init.meta)).toEqual({ goldBar: 4, ironBar: 8, copperBar: 8, cash: sprinklerCost(init.meta).cash })
    expect(sprinklerMax()).toBe(4)
    expect(sprinklerTiles()).toBe(6)
    // ≈ 12 coal/h per machine: 1 coal per 300 ticks (5 min); the hopper holds ≈ 2 h
    expect(sprinklerCoalTicks()).toBe(300)
    expect(sprinklerHopper()).toBe(24)
    expect(valveCost(init.meta)).toEqual({ goldBar: 2, cash: valveCost(init.meta).cash })
  })
})

describe('buildWorkshop', () => {
  it('is LOCKED below vein Lv4 and ALREADY_OWNED once built', () => {
    const s = { ...init, run: { ...init.run, vein: { ...init.run.vein, level: 3 }, inventory: { stone: 30, ironBar: 6 }, cash: 99999 } }
    expect(buildWorkshop(s)).toEqual({ ok: false, error: 'LOCKED' })
    const built = withWorkshop([], [])
    expect(buildWorkshop(built)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })

  it('pays stone, iron bars and cash; the workshop milestone records', () => {
    const s = { ...init, run: { ...init.run, vein: { ...init.run.vein, level: 4 }, inventory: { stone: 30, ironBar: 6 }, cash: 99999 } }
    const r = buildWorkshop(s)
    if (!r.ok) throw new Error(r.error)
    expect(r.state.run.workshop).toEqual({ built: true, hoppers: [], valve: false })
    expect([r.state.run.inventory.stone, r.state.run.inventory.ironBar]).toEqual([0, 0])
    expect(r.state.run.milestones.workshop).toBe(r.state.run.tick)
    // items first, then cash (the pay order)
    const noItems = { ...s, run: { ...s.run, inventory: {} } }
    expect(buildWorkshop(noItems)).toEqual({ ok: false, error: 'NOT_ENOUGH_ITEMS' })
    const noCash = { ...s, run: { ...s.run, cash: 0 } }
    expect(buildWorkshop(noCash)).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('buySprinkler', () => {
  it('is NO_WORKSHOP without the workshop, MAX_LEVEL at 4 machines, and pays the recipe', () => {
    const full = { stone: 99, ironBar: 99, copperBar: 99, goldBar: 99, coal: 99 }
    expect(buySprinkler({ ...init, run: { ...init.run, inventory: full, cash: 99999 } })).toEqual({ ok: false, error: 'NO_WORKSHOP' })
    const four = withWorkshop([24, 24, 24, 24], [], { inventory: full, cash: 99999 })
    expect(buySprinkler(four)).toEqual({ ok: false, error: 'MAX_LEVEL' })

    const s = withWorkshop([], [], { inventory: full, cash: 99999 })
    const r = buySprinkler(s)
    expect(r.ok && r.state.run.workshop.hoppers).toEqual([0])
    expect(r.ok && r.state.run.milestones.firstSprinkler).toBeDefined()
    expect(r.ok && r.state.run.inventory).toEqual({ stone: 99, ironBar: 91, copperBar: 91, goldBar: 95, coal: 99 })
  })
})

describe('buyValve', () => {
  it('is NO_WORKSHOP without the workshop, ALREADY_OWNED once bought, and pays 2 gold bars', () => {
    expect(buyValve({ ...init, run: { ...init.run, inventory: { goldBar: 2 }, cash: 99999 } })).toEqual({ ok: false, error: 'NO_WORKSHOP' })
    const owned = withWorkshop([24], [], { workshop: { built: true, hoppers: [24], valve: true }, inventory: { goldBar: 2 }, cash: 99999 })
    expect(buyValve(owned)).toEqual({ ok: false, error: 'ALREADY_OWNED' })
    const s = withWorkshop([24], [], { inventory: { goldBar: 2 }, cash: 99999 })
    const r = buyValve(s)
    expect(r.ok && r.state.run.workshop.valve).toBe(true)
    expect(r.ok && r.state.run.inventory.goldBar).toBe(0)
    expect(r.ok && r.state.run.milestones.valve).toBeDefined()
  })
})

describe('fillHopper', () => {
  it('moves coal from storage into the hopper, capped by hopper room and coal in store; FULL / NO_FUEL', () => {
    expect(fillHopper(withWorkshop([24], [], { inventory: { coal: 5 } }), 0)).toEqual({ ok: false, error: 'FULL' })
    expect(fillHopper(withWorkshop([20], [], { inventory: {} }), 0)).toEqual({ ok: false, error: 'NO_FUEL' })
    const r = fillHopper(withWorkshop([20], [], { inventory: { coal: 5 } }), 0, 4)
    expect(r.ok && [r.state.run.workshop.hoppers[0], r.state.run.inventory.coal]).toEqual([24, 1])
    const byRoom = fillHopper(withWorkshop([23], [], { inventory: { coal: 5 } }), 0, 4)
    expect(byRoom.ok && [byRoom.state.run.workshop.hoppers[0], byRoom.state.run.inventory.coal]).toEqual([24, 4])
    const byCoal = fillHopper(withWorkshop([0], [], { inventory: { coal: 2 } }), 0, 4)
    expect(byCoal.ok && [byCoal.state.run.workshop.hoppers[0], byCoal.state.run.inventory.coal]).toEqual([2, 0])
  })
})

describe('sprinklersAct', () => {
  it('waters the 6 driest growing tiles to iron-can moisture on the worker clock, one chunk per machine', () => {
    // 8 growing tiles at 0.2 … 1.6 + 2 tiles that must not be touched: a mature one and a tilled one
    const moistures = [1.6, 1.4, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2]
    const tiles = [
      ...growingTiles(moistures),
      { status: 'planted' as const, cropId: 'lemon' as const, growth: 360, moisture: 0.3, ticksSinceMature: 5 },
      { status: 'tilled' as const, growth: 0, moisture: 0.1, ticksSinceMature: 0 },
    ]
    const s = withWorkshop([24, 24], tiles, { tick: workerActionTicks(init.meta) })
    const { run, held } = sprinklersAct(s)
    // machine 1 takes the 6 driest (0.2 … 1.2), machine 2 the next 2 (1.4, 1.6) — 12 covered, all at 4
    expect(run.tiles.slice(0, 8).map((t) => t.moisture)).toEqual([4, 4, 4, 4, 4, 4, 4, 4])
    expect(run.tiles[8].moisture).toBe(0.3)
    expect(run.tiles[9].moisture).toBe(0.1)
    expect(held.every((h) => !h)).toBe(true)
  })

  it('does nothing off the worker clock except the pump: coal burns 1 per machine every 300 ticks', () => {
    const tiles = growingTiles([1, 1, 1])
    const mid = sprinklersAct(withWorkshop([7, 3], tiles, { tick: 6 }))
    expect(mid.run.tiles.map((t) => t.moisture)).toEqual([1, 1, 1])
    expect(mid.run.workshop.hoppers).toEqual([7, 3])
    const burn = sprinklersAct(withWorkshop([7, 3, 0], tiles, { tick: sprinklerCoalTicks() }))
    expect(burn.run.tiles.map((t) => t.moisture)).toEqual([4, 4, 4]) // tick 300 is also a worker clock tick
    expect(burn.run.workshop.hoppers).toEqual([6, 2, 0])
  })

  it('a machine with an empty hopper waters nothing (its tiles stall, never die)', () => {
    const tiles = growingTiles([1, 1, 1, 1, 1, 1, 1])
    const { run } = sprinklersAct(withWorkshop([24, 0], tiles, { tick: 5 }))
    // machine 1 waters the first 6; machine 2 is dry, so tile 7 (moisture 1, the 7th driest) keeps draining
    expect(run.tiles.map((t) => t.moisture)).toEqual([4, 4, 4, 4, 4, 4, 1])
  })

  it('with the valve, a stalled machine holds every growing tile below the fill (no drain this tick); without it they drain', () => {
    const tiles = growingTiles([2, 2, 2, 2, 2, 2, 2, 3])
    const stalled = withWorkshop([0], tiles, { workshop: { built: true, hoppers: [0], valve: true }, tick: 1 })
    const { run, held } = sprinklersAct(stalled)
    expect(run.tiles.map((t) => t.moisture)).toEqual([2, 2, 2, 2, 2, 2, 2, 3])
    expect(held).toEqual([true, true, true, true, true, true, true, true])
    // held tiles skip the drain but keep growing; growth 10 → 11 everywhere (moisture > 0)
    const stepped = step({ ...stalled, run }, 1)
    expect(stepped.run.tiles.map((t) => t.moisture)).toEqual([2, 2, 2, 2, 2, 2, 2, 3])
    expect(stepped.run.tiles.every((t) => t.growth === 11)).toBe(true)
    const noValve = step(withWorkshop([0], tiles, { tick: 1 }), 1)
    expect(noValve.run.tiles.map((t) => t.moisture)).toEqual(Array(8).fill(2 - drain).map((m, i) => (i === 7 ? 3 - drain : m)))
  })
})

describe('sprinklerTargets', () => {
  it('lists the tiles machine i waters now, driest first, after earlier machines took their chunks', () => {
    const tiles = growingTiles([3, 0.5, 4, 1])
    expect(sprinklerTargets(withWorkshop([24, 24], tiles), 0)).toEqual([1, 3, 0])
    expect(sprinklerTargets(withWorkshop([24, 24], tiles), 1)).toEqual([])
    // a dry machine waters nothing
    expect(sprinklerTargets(withWorkshop([0], tiles), 0)).toEqual([])
  })
})

describe('step with sprinklers', () => {
  const moistures = [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 2]

  it('a sprinkler covers watering through step and during offline catch-up like a worker', () => {
    const s = withWorkshop([24], growingTiles(moistures), { tick: 5 })
    const after = step(s, 1)
    // watered to the fill this tick, then the tick's own drain applies
    expect(after.run.tiles.slice(0, 6).map((t) => t.moisture)).toEqual(Array(6).fill(4 - drain))
    expect(after.run.workshop.hoppers).toEqual([24]) // no burn before tick 300
    // 8 h offline from full hoppers: the pump burns 8 × 12 coal = 96 > 24, so it stalls after 2 h. The machine
    // covered watering while it ran — every tile finished its whole grow-and-rot cycle (tilled again), long before
    // the coal ran out, so the stall cost nothing here
    const away = catchUp(withWorkshop([24], growingTiles(moistures), { tick: 5 }), 8 * 3600 * 1000)
    expect(away.run.workshop.hoppers).toEqual([0])
    expect(away.run.tiles.every((t) => t.status === 'tilled')).toBe(true)
  })

  it('step(s, n) = n × step(s, 1) with the pump, a stalled machine and the valve on', () => {
    const s = withWorkshop([24, 0, 5], growingTiles([...moistures, ...moistures, ...moistures, ...moistures].slice(0, 24)), {
      workshop: { built: true, hoppers: [24, 0, 5], valve: true },
      tick: 4,
      workers: { pool: 1, assigned: { ...init.run.workers.assigned, fuel: 1 }, certificates: ['fuel'] },
      inventory: { coal: 10 },
      cash: 100,
    })
    let one = s
    for (let i = 0; i < 900; i++) one = step(one, 1)
    expect(step(s, 900)).toEqual(one)
  })
})
