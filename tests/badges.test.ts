import { describe, expect, it } from 'vitest'
import { availableKeys } from '../src/app/badges'
import { createInitialState, type GameState } from '../src/core/state'

const withRun = (run: Partial<GameState['run']>): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}

describe('availableKeys', () => {
  it('fresh game: only the unlocked energy upgrades', () => {
    expect(availableKeys(createInitialState())).toEqual({ shop: [], upgrades: ['energyMax', 'energyRegen'], farm: [], mine: [] })
  })

  it('batch 31.1: farm / mine keys — a certificate unlocked, then affordable; the order board; a pickaxe tier above the one held', () => {
    const s = createInitialState()
    const tools = { ...s.run.tools, harvest: 3 }
    const counters = { ...s.run.counters, harvests: 40, bars: 10 }
    const locked = withRun({ tools })
    expect([availableKeys(locked).farm, availableKeys(locked).mine]).toEqual([[], []])
    const unlocked = availableKeys(withRun({ tools, counters, cash: 0 }))
    expect([unlocked.farm, unlocked.mine]).toEqual([['cert:harvest'], ['cert:ore']])
    const rich = availableKeys(withRun({ tools, counters, cash: 1e6, inventory: { stone: 50, coal: 50, copperBar: 50, wood: 50 }, orders: { ...s.run.orders, unlocked: true } }))
    expect(rich.farm).toEqual(['cert:harvest', 'cert:harvest:buy', 'orders'])
    expect(rich.mine.slice(0, 2)).toEqual(['cert:ore', 'cert:ore:buy'])
    expect(rich.mine).toContain('pick:wooden')
    const held = availableKeys(withRun({ cash: 1e6, inventory: { wood: 50, copperBar: 50 }, pickaxe: { tier: 'copper', durability: 100 } }))
    expect(held.mine.filter((k) => k.startsWith('pick:'))).not.toContain('pick:wooden')
  })

  it('affordable licenses, tiles and upgrade levels carry their level, so the next level is news again', () => {
    const s = createInitialState()
    const rich = withRun({ cash: 3e4, mineLicense: true, inventory: { stone: 30 }, upgrades: { ...s.run.upgrades, energyMax: 3 } })
    const keys = availableKeys(rich)
    expect(keys.shop).toEqual(['license:chilli', 'license:pumpkin', 'license:lemon', 'license:tomato', 'license:corn', 'license:grape', 'license:strawberry', 'tile:9'])
    expect(keys.upgrades).toEqual(['energyMax', 'energyMax@3', 'energyRegen', 'energyRegen@0', 'mine', 'storage@0', 'vein@0'])
  })

  it('a tool level is news when its milestone is reached, and again once it is affordable', () => {
    const s = createInitialState()
    const counters = { ...s.run.counters, harvests: 15 }
    expect(availableKeys(withRun({ counters })).shop).toEqual(['tool:harvest1'])
    expect(availableKeys(withRun({ counters, cash: 1e4 })).shop).toContain('tool:harvest1:buy')
    // the max tool level unlocks the job's copper row; it is news again once 🟧4 💰100 are in hand, and gone once owned
    const maxed = { counters, tools: { ...s.run.tools, harvest: 3 } }
    expect(availableKeys(withRun(maxed)).shop).toEqual(['copper:harvest'])
    const affordable = availableKeys(withRun({ ...maxed, cash: 100, inventory: { copperBar: 4 } })).shop
    expect(affordable.filter((k) => k.startsWith('copper'))).toEqual(['copper:harvest', 'copper:harvest:buy'])
    expect(availableKeys(withRun({ ...maxed, toolTier: { ...s.run.toolTier, harvest: 1 } })).shop).toEqual([])
  })

  it('the workshop key is news once the build is affordable, and gone once it is built (batch 17)', () => {
    const s = createInitialState()
    const vein4 = { ...s.run.vein, level: 4 as const }
    const affordable = { vein: vein4, cash: 20000, inventory: { stone: 30, ironBar: 6 } }
    expect(availableKeys(withRun(affordable)).shop).toContain('workshop')
    expect(availableKeys(withRun({ ...affordable, workshop: { built: true, beds: [false, false, false, false], valve: false } })).shop).not.toContain('workshop')
    // the gate open but materials short: no key yet
    expect(availableKeys(withRun({ vein: vein4, cash: 20000 })).shop).not.toContain('workshop')
  })
})
