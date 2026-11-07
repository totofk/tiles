// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Upgrades } from '../src/app/Upgrades'
import { upgradeMaxLevel } from '../src/core/balance'
import { createInitialState, type GameState } from '../src/core/state'

afterEach(cleanup)

const noop = () => {}
const names = () => screen.getAllByRole('button').map((b) => b.firstChild?.textContent)

describe('Upgrades tab', () => {
  it('shows only the unlocked upgrades', () => {
    render(<Upgrades state={createInitialState()} act={noop} />)
    expect(names()).toEqual(['Bigger stamina', 'Faster recovery'])
  })

  it('shows milestone upgrades once their counters pass the threshold', () => {
    const s = createInitialState()
    const state: GameState = { ...s, run: { ...s.run, counters: { ...s.run.counters, harvests: 1000, sales: 1000 } } }
    render(<Upgrades state={state} act={noop} />)
    expect(names()).toEqual(['Bigger stamina', 'Faster recovery', 'Better prices', 'Fertilizer'])
  })

  it('disables a maxed upgrade and says so', () => {
    const s = createInitialState()
    const level = upgradeMaxLevel('energyMax')
    const state: GameState = { ...s, run: { ...s.run, cash: 1e9, upgrades: { ...s.run.upgrades, energyMax: level } } }
    render(<Upgrades state={state} act={noop} />)
    const btn = screen.getByRole('button', { name: /Bigger stamina/ })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(btn.textContent).toContain('max level')
  })
})
