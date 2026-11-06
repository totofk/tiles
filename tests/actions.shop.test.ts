import { describe, expect, it } from 'vitest'
import { buyLicense, buyTile, buyUpgrade, type ActionResult } from '../src/core/actions'
import {
  TILE_CAP,
  energyMax,
  licenseCost,
  tileCost,
  upgradeCost,
  upgradeMaxLevel,
} from '../src/core/balance'
import { createInitialState, createTile, type GameState } from '../src/core/state'

function withRun(run: Partial<GameState['run']>): GameState {
  const s = createInitialState()
  s.run = { ...s.run, ...run }
  return s
}

function okState(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r.state
}

const meta = createInitialState().meta

describe('buyUpgrade', () => {
  it('pays the cost, raises the level and costs no energy', () => {
    const cost = upgradeCost('energyMax', 0, meta)
    const s = withRun({ cash: cost + 5, energy: 7 })
    const next = okState(buyUpgrade(s, 'energyMax'))
    expect(next.run.upgrades.energyMax).toBe(1)
    expect(next.run.cash).toBe(5)
    expect(next.run.energy).toBe(7) // not refilled
    expect(energyMax(next.run.upgrades.energyMax, meta)).toBeGreaterThan(energyMax(0, meta))
    expect(s.run.upgrades.energyMax).toBe(0)
  })
  it('charges the next level price', () => {
    const cost = upgradeCost('energyRegen', 2, meta)
    const s = withRun({ cash: cost, upgrades: { energyMax: 0, energyRegen: 2 } })
    expect(okState(buyUpgrade(s, 'energyRegen')).run.cash).toBe(0)
  })
  it('rejects when unaffordable', () => {
    const s = withRun({ cash: upgradeCost('energyRegen', 0, meta) - 1 })
    expect(buyUpgrade(s, 'energyRegen')).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('rejects at max level', () => {
    const s = withRun({ cash: 1e12, upgrades: { energyMax: upgradeMaxLevel('energyMax'), energyRegen: 0 } })
    expect(buyUpgrade(s, 'energyMax')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })
})

describe('buyLicense', () => {
  it('pays the license and adds the crop', () => {
    const cost = licenseCost('pumpkin', meta)
    const next = okState(buyLicense(withRun({ cash: cost }), 'pumpkin'))
    expect(next.run.licenses).toContain('pumpkin')
    expect(next.run.cash).toBe(0)
  })
  it('rejects when unaffordable', () => {
    const s = withRun({ cash: licenseCost('pumpkin', meta) - 1 })
    expect(buyLicense(s, 'pumpkin')).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('rejects an owned license', () => {
    expect(buyLicense(withRun({ cash: 1e6 }), 'radish')).toEqual({ ok: false, error: 'ALREADY_OWNED' })
  })
})

describe('buyTile', () => {
  it('adds an untilled tile at the geometric price', () => {
    const cost = tileCost(6, meta)
    const next = okState(buyTile(withRun({ cash: cost })))
    expect(next.run.tiles).toHaveLength(7)
    expect(next.run.tiles[6]).toEqual(createTile())
    expect(next.run.cash).toBe(0)
  })
  it('rejects when unaffordable', () => {
    expect(buyTile(withRun({ cash: tileCost(6, meta) - 1 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('stops at the tile cap', () => {
    let s = withRun({ cash: 1e12 })
    for (let i = s.run.tiles.length; i < TILE_CAP; i++) s = okState(buyTile(s))
    expect(s.run.tiles).toHaveLength(TILE_CAP)
    expect(buyTile(s)).toEqual({ ok: false, error: 'TILE_CAP' })
  })
})
