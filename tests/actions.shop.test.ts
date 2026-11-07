import { describe, expect, it } from 'vitest'
import { buyLicense, buySeeds, buyTile, buyUpgrade, setAutoBuySeeds, type ActionResult } from '../src/core/actions'
import {
  START_TILES,
  TILE_CAP,
  cropSeedCost,
  energyMax,
  licenseCost,
  tileCost,
  upgradeCost,
  upgradeMaxLevel,
  upgradeUnlocked,
} from '../src/core/balance'
import { bagCount } from '../src/core/mining'
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
const noUpgrades = createInitialState().run.upgrades

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
    const s = withRun({ cash: cost, upgrades: { ...noUpgrades, energyRegen: 2 } })
    expect(okState(buyUpgrade(s, 'energyRegen')).run.cash).toBe(0)
  })
  it('rejects when unaffordable', () => {
    const s = withRun({ cash: upgradeCost('energyRegen', 0, meta) - 1 })
    expect(buyUpgrade(s, 'energyRegen')).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('rejects at max level', () => {
    const s = withRun({ cash: 1e12, upgrades: { ...noUpgrades, energyMax: upgradeMaxLevel('energyMax') } })
    expect(buyUpgrade(s, 'energyMax')).toEqual({ ok: false, error: 'MAX_LEVEL' })
  })
  it('milestone upgrades are locked until their counter reaches the threshold', () => {
    const counters = createInitialState().run.counters
    expect(buyUpgrade(withRun({ cash: 1e6, counters: { ...counters, sales: 24 } }), 'sellPrice')).toEqual({
      ok: false,
      error: 'LOCKED',
    })
    expect(buyUpgrade(withRun({ cash: 1e6, counters: { ...counters, sales: 25 } }), 'sellPrice').ok).toBe(true)
    expect(upgradeUnlocked('fertilizer', { ...counters, harvests: 14 })).toBe(false)
    expect(upgradeUnlocked('fertilizer', { ...counters, harvests: 15 })).toBe(true)
    expect(upgradeUnlocked('energyMax', counters)).toBe(true)
  })
  it('milestone upgrades cap at level 5 with geometric cost', () => {
    expect(upgradeMaxLevel('sellPrice')).toBe(5)
    expect(upgradeMaxLevel('fertilizer')).toBe(5)
    expect(upgradeCost('sellPrice', 1, meta)).toBe(Math.round(80 * 1.6))
    expect(upgradeCost('fertilizer', 2, meta)).toBe(Math.round(120 * 1.7 ** 2))
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
    const cost = tileCost(START_TILES, meta)
    const next = okState(buyTile(withRun({ cash: cost })))
    expect(next.run.tiles).toHaveLength(START_TILES + 1)
    expect(next.run.tiles[START_TILES]).toEqual(createTile())
    expect(next.run.cash).toBe(0)
  })
  it('rejects when unaffordable', () => {
    expect(buyTile(withRun({ cash: tileCost(START_TILES, meta) - 1 }))).toEqual({ ok: false, error: 'NO_CASH' })
  })
  it('stops at the tile cap', () => {
    let s = withRun({ cash: 1e12 })
    for (let i = s.run.tiles.length; i < TILE_CAP; i++) s = okState(buyTile(s))
    expect(s.run.tiles).toHaveLength(TILE_CAP)
    expect(buyTile(s)).toEqual({ ok: false, error: 'TILE_CAP' })
  })
})

describe('buySeeds', () => {
  it('adds n seeds to the pouch for n × the seed price, no energy, no bag space', () => {
    const s = withRun({ cash: 50, seeds: { radish: 1 } })
    const next = okState(buySeeds(s, 'radish', 10))
    expect(next.run.seeds).toEqual({ radish: 11 })
    expect(next.run.cash).toBe(50 - 10 * cropSeedCost('radish', meta))
    expect(next.run.energy).toBe(s.run.energy)
    expect(bagCount(next.run)).toBe(0)
  })
  it('rejects bad amounts, unlicensed crops and short cash', () => {
    const s = withRun({ cash: 50 })
    for (const n of [0, -1, 1.5, NaN]) expect(buySeeds(s, 'radish', n)).toEqual({ ok: false, error: 'BAD_AMOUNT' })
    expect(buySeeds(s, 'pumpkin', 1)).toEqual({ ok: false, error: 'NO_LICENSE' })
    expect(buySeeds(withRun({ cash: 1 }), 'radish', 1)).toEqual({ ok: false, error: 'NO_CASH' })
  })
})

describe('setAutoBuySeeds', () => {
  it('switches the one auto-buy flag and changes nothing else', () => {
    const s = createInitialState()
    const off = okState(setAutoBuySeeds(s, false))
    expect(off.run).toEqual({ ...s.run, autoBuySeeds: false })
    expect(okState(setAutoBuySeeds(off, true)).run).toEqual(s.run)
  })
})
