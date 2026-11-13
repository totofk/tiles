import { describe, expect, it } from 'vitest'
import { cropGrowTicks, cropRotGraceTicks } from '../src/core/balance'
import { createInitialState, type GameState, type Tile } from '../src/core/state'
import { step } from '../src/core/step'
import { growthProgress, isDry, nextTileAction, tapTile, ticksUntilRot } from '../src/core/tile'

const s0 = createInitialState()
const meta = s0.meta
const grow = cropGrowTicks('radish', meta, 0)
const tile = (t: Partial<Tile>): Tile => ({ ...createInitialState().run.tiles[0], ...t })
const planted = (t: Partial<Tile> = {}) => tile({ status: 'planted', cropId: 'radish', ...t })

function withTile(t: Tile): GameState {
  const s = createInitialState()
  s.run.tiles[0] = t
  return s
}

describe('nextTileAction', () => {
  it('follows harvest → water → plant → till', () => {
    expect(nextTileAction(planted({ growth: grow, moisture: 0 }), s0)).toBe('harvest')
    expect(nextTileAction(planted({ moisture: 0 }), s0)).toBe('water')
    expect(nextTileAction(planted({ moisture: 0.5 }), s0)).toBe('water')
    expect(nextTileAction(tile({ status: 'tilled' }), s0)).toBe('plant')
    expect(nextTileAction(tile({ status: 'untilled' }), s0)).toBe('till')
  })
})

describe('helpers', () => {
  it('isDry only at exactly 0', () => {
    expect(isDry(tile({ moisture: 0 }))).toBe(true)
    expect(isDry(tile({ moisture: 0.01 }))).toBe(false)
  })

  it('growthProgress is 0..1', () => {
    expect(growthProgress(tile({ status: 'tilled' }), s0)).toBe(0)
    expect(growthProgress(planted({ growth: grow / 2 }), s0)).toBe(0.5)
    expect(growthProgress(planted({ growth: grow }), s0)).toBe(1)
  })

  it('ticksUntilRot matches step: the crop is gone after exactly that many ticks', () => {
    expect(ticksUntilRot(planted(), s0)).toBeNull()
    const t = planted({ growth: grow, ticksSinceMature: 0 })
    const left = ticksUntilRot(t, s0)!
    expect(left).toBe(cropRotGraceTicks('radish', meta) + 1)
    const s = withTile(t)
    expect(step(s, left - 1).run.tiles[0].status).toBe('planted')
    expect(step(s, left).run.tiles[0].status).toBe('tilled')
  })
})

describe('tapTile', () => {
  it('tills, plants, waters, harvests in turn', () => {
    let s = createInitialState()
    const tap = () => {
      const r = tapTile(s, 0, 'potato')
      if (!r?.ok) throw new Error(String(r && r.error))
      s = r.state
    }
    tap()
    expect(s.run.tiles[0].status).toBe('tilled')
    tap()
    expect(s.run.tiles[0].status).toBe('planted')
    tap()
    expect(s.run.tiles[0].moisture).toBe(1)
    s = step(s, 10)
    const energy = s.run.energy
    tap() // a moist tile can be topped up: refills to 1 for 1 energy
    expect(s.run.tiles[0].moisture).toBe(1)
    expect(s.run.energy).toBe(energy - 1)
    s.run.tiles[0] = { ...s.run.tiles[0], growth: grow }
    const cash = s.run.cash
    tap()
    expect(s.run.tiles[0].status).toBe('tilled')
    expect(s.run.cash).toBeGreaterThan(cash)
  })

  it('returns the typed error instead of throwing', () => {
    const s = createInitialState()
    s.run.energy = 0
    expect(tapTile(s, 0, 'radish')).toEqual({ ok: false, error: 'NO_ENERGY' })
    expect(tapTile(s, 99, 'radish')).toEqual({ ok: false, error: 'BAD_TILE' })
  })
})
