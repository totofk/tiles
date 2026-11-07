import { describe, expect, it } from 'vitest'
import { availableKeys } from '../src/app/badges'
import { createInitialState, type GameState } from '../src/core/state'

const withRun = (run: Partial<GameState['run']>): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}

describe('availableKeys', () => {
  it('fresh game: only the unlocked energy upgrades', () => {
    expect(availableKeys(createInitialState())).toEqual({ shop: [], upgrades: ['energyMax', 'energyRegen'] })
  })

  it('affordable licenses, tiles and upgrade levels carry their level, so the next level is news again', () => {
    const s = createInitialState()
    const rich = withRun({ cash: 1e4, mineLicense: true, inventory: { stone: 30 }, upgrades: { ...s.run.upgrades, energyMax: 3 } })
    const keys = availableKeys(rich)
    expect(keys.shop).toEqual(['license:chilli', 'license:pumpkin', 'license:lemon', 'tile:9'])
    expect(keys.upgrades).toEqual(['energyMax', 'energyMax@3', 'energyRegen', 'energyRegen@0', 'mine', 'storage@0', 'vein@0'])
  })

  it('a tool level is news when its milestone is reached, and again once it is affordable', () => {
    const s = createInitialState()
    const counters = { ...s.run.counters, harvests: 15 }
    expect(availableKeys(withRun({ counters })).shop).toEqual(['tool:harvest1'])
    expect(availableKeys(withRun({ counters, cash: 1e4 })).shop).toContain('tool:harvest1:buy')
    expect(availableKeys(withRun({ counters, tools: { ...s.run.tools, harvest: 3 } })).shop).toEqual([])
  })
})
