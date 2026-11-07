import { describe, expect, it } from 'vitest'
import { harvest, plant, till, water, type ActionResult } from '../src/core/actions'
import { ACTION_ENERGY_COST, START_TILES, cropGrowTicks, cropRotGraceTicks, cropSeedCost, cropSellPrice } from '../src/core/balance'
import { createInitialState, type GameState, type Tile } from '../src/core/state'

function withTile(tile: Partial<Tile>, run: Partial<GameState['run']> = {}): GameState {
  const s = createInitialState()
  s.run = { ...s.run, ...run }
  s.run.tiles[0] = { ...s.run.tiles[0], ...tile }
  return s
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const meta = createInitialState().meta
const tilled = { status: 'tilled' } as const
const planted = { status: 'planted', cropId: 'radish' } as const
const mature = { ...planted, growth: cropGrowTicks('radish', meta, 0) }

describe('till', () => {
  it('turns an untilled tile into tilled and costs energy', () => {
    const s = createInitialState()
    const next = okState(till(s, 0))
    expect(next.run.tiles[0].status).toBe('tilled')
    expect(next.run.energy).toBe(s.run.energy - ACTION_ENERGY_COST)
    expect(s.run.tiles[0].status).toBe('untilled')
  })
  it('rejects bad indexes', () => {
    const s = createInitialState()
    for (const i of [-1, START_TILES, 1.5, NaN]) expect(till(s, i)).toEqual({ ok: false, error: 'BAD_TILE' })
  })
  it('rejects a tile that is not untilled', () => {
    expect(till(withTile(tilled), 0)).toEqual({ ok: false, error: 'NOT_UNTILLED' })
  })
  it('rejects when energy is below the action cost', () => {
    expect(till(withTile({}, { energy: 0.99 }), 0)).toEqual({ ok: false, error: 'NO_ENERGY' })
  })
})

describe('plant', () => {
  it('plants a licensed crop on a tilled tile and pays the seed', () => {
    const s = withTile(tilled)
    const next = okState(plant(s, 0, 'radish'))
    expect(next.run.tiles[0]).toMatchObject({ status: 'planted', cropId: 'radish', growth: 0 })
    expect(next.run.cash).toBe(s.run.cash - cropSeedCost('radish', meta))
    expect(next.run.energy).toBe(s.run.energy - ACTION_ENERGY_COST)
  })
  it('rejects a tile that is not tilled', () => {
    expect(plant(createInitialState(), 0, 'radish')).toEqual({ ok: false, error: 'NOT_TILLED' })
  })
  it('rejects an unlicensed crop', () => {
    expect(plant(withTile(tilled, { cash: 1000 }), 0, 'pumpkin')).toEqual({ ok: false, error: 'NO_LICENSE' })
  })
  it('rejects when the seed is unaffordable', () => {
    const cash = cropSeedCost('radish', meta) - 1
    expect(plant(withTile(tilled, { cash }), 0, 'radish')).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('rejects without energy', () => {
    expect(plant(withTile(tilled, { energy: 0 }), 0, 'radish')).toEqual({ ok: false, error: 'NO_ENERGY' })
  })
  it('rejects bad indexes', () => {
    expect(plant(createInitialState(), 99, 'radish')).toEqual({ ok: false, error: 'BAD_TILE' })
  })
})

describe('water', () => {
  it('fills a planted tile to moisture 1', () => {
    const next = okState(water(withTile({ ...planted, moisture: 0.2 }), 0))
    expect(next.run.tiles[0].moisture).toBe(1)
  })
  it('rejects a tile without a crop', () => {
    expect(water(withTile(tilled), 0)).toEqual({ ok: false, error: 'NOT_PLANTED' })
  })
  it('rejects without energy', () => {
    expect(water(withTile(planted, { energy: 0 }), 0)).toEqual({ ok: false, error: 'NO_ENERGY' })
  })
  it('rejects bad indexes', () => {
    expect(water(createInitialState(), -1)).toEqual({ ok: false, error: 'BAD_TILE' })
  })
})

describe('harvest', () => {
  it('sells a mature crop instantly and leaves the tile tilled', () => {
    const s = withTile(mature)
    const next = okState(harvest(s, 0))
    expect(next.run.cash).toBe(s.run.cash + cropSellPrice('radish', meta, 0))
    expect(next.run.tiles[0]).toMatchObject({ status: 'tilled', growth: 0, ticksSinceMature: 0 })
    expect(next.run.tiles[0].cropId).toBeUndefined()
    expect(next.run.energy).toBe(s.run.energy - ACTION_ENERGY_COST)
    expect(next.run.counters).toEqual({ harvests: 1, sales: 1, digs: 0 })
  })
  it('applies the sellPrice upgrade (+10 % per level)', () => {
    const s = withTile(mature, { upgrades: { ...createInitialState().run.upgrades, sellPrice: 2 } })
    expect(okState(harvest(s, 0)).run.cash).toBe(s.run.cash + Math.round(cropSellPrice('radish', meta, 0) * 1.2))
  })
  it('fertilizer shortens grow time (−10 % per level) but not the rot window', () => {
    const fertilized = { ...createInitialState().run.upgrades, fertilizer: 3 }
    const grow = cropGrowTicks('radish', meta, 3)
    expect(grow).toBe(Math.round(cropGrowTicks('radish', meta, 0) * 0.7))
    expect(harvest(withTile({ ...planted, growth: grow }, { upgrades: fertilized }), 0).ok).toBe(true)
    expect(harvest(withTile({ ...planted, growth: grow }), 0)).toEqual({ ok: false, error: 'NOT_MATURE' })
    expect(cropRotGraceTicks('radish', meta)).toBe(2 * cropGrowTicks('radish', meta, 0))
  })
  it('rejects an immature crop', () => {
    expect(harvest(withTile({ ...planted, growth: 1 }), 0)).toEqual({ ok: false, error: 'NOT_MATURE' })
  })
  it('rejects a tile without a crop', () => {
    expect(harvest(withTile(tilled), 0)).toEqual({ ok: false, error: 'NOT_PLANTED' })
  })
  it('rejects without energy', () => {
    expect(harvest(withTile(mature, { energy: 0 }), 0)).toEqual({ ok: false, error: 'NO_ENERGY' })
  })
  it('rejects bad indexes', () => {
    expect(harvest(createInitialState(), START_TILES)).toEqual({ ok: false, error: 'BAD_TILE' })
  })
})
