// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Upgrades } from '../src/app/Upgrades'
import { toolCost, upgradeMaxLevel } from '../src/core/balance'
import { buyStorage } from '../src/core/mining'
import { createInitialState, type GameState } from '../src/core/state'
import { buyTool } from '../src/core/tools'

afterEach(cleanup)

const noop = () => {}
/** the buttons in the row under a heading */
const row = (heading: string) => within(screen.getByRole('heading', { name: heading }).nextElementSibling as HTMLElement).getAllByRole('button')
const names = () => row('Upgrades').map((b) => b.firstChild?.textContent)
const withRun = (run: Partial<GameState['run']>): GameState => {
  const s = createInitialState()
  return { ...s, run: { ...s.run, ...run } }
}
const tool = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) }) as HTMLButtonElement

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

describe('Mine upgrades in the Upgrades tab', () => {
  it('appear only with the mine license: storage and vein with stone + cash prices', () => {
    render(<Upgrades state={createInitialState()} act={noop} />)
    expect(screen.queryByRole('heading', { name: 'Mine' })).toBeNull()
    cleanup()

    const act = vi.fn()
    const state = withRun({ mineLicense: true, cash: 50, inventory: { stone: 20 } })
    render(<Upgrades state={state} act={act} />)
    const [storage, vein] = row('Mine') as HTMLButtonElement[]
    expect(storage.textContent).toBe('📦 Storage Lv 0/5+10 slots · 🪨15 💰50')
    expect(storage.disabled).toBe(false)
    expect(vein.textContent).toContain('🪨25 💰100')
    expect(vein.disabled).toBe(true)
    fireEvent.click(storage)
    const fn = act.mock.calls[0][0] as (s: GameState) => ReturnType<typeof buyStorage>
    expect(fn(state)).toEqual(buyStorage(state))
  })
})

describe('Tools in the Upgrades tab', () => {
  it('lists all 9 tool levels, locked ones with their milestone progress', () => {
    const s = createInitialState()
    render(<Upgrades state={withRun({ counters: { ...s.run.counters, harvests: 7 } })} act={noop} />)
    expect(row('Tools').map((b) => b.firstChild?.textContent)).toEqual([
      'Watering Can', 'Garden Hose', 'Water Cart', 'Sickle', 'Scythe', 'Reaper', 'Dibber', 'Seed Drill', 'Seed Spreader',
    ])
    expect(row('Tools').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(tool('Sickle').textContent).toContain('harvest 7/15')
    expect(tool('Watering Can').textContent).toContain('water 0/20')
  })

  it('buys only the next level: level k needs k − 1', () => {
    const s = createInitialState()
    const act = vi.fn()
    // harvests far past every threshold, but no Sickle yet
    const state = withRun({ cash: 1000, counters: { ...s.run.counters, harvests: 500 } })
    render(<Upgrades state={state} act={act} />)
    expect(tool('Sickle').disabled).toBe(false)
    expect(tool('Sickle').textContent).toContain(`💰${toolCost('harvest', 1, s.meta)}`)
    expect(tool('Scythe').disabled).toBe(true)
    expect(tool('Scythe').textContent).toContain('needs Sickle')
    fireEvent.click(tool('Sickle'))
    const fn = act.mock.calls[0][0] as (s: GameState) => ReturnType<typeof buyTool>
    expect(fn(state)).toEqual(buyTool(state, 'harvest'))

    cleanup()
    render(<Upgrades state={withRun({ ...state.run, tools: { ...state.run.tools, harvest: 1 } })} act={noop} />)
    expect(tool('Sickle').textContent).toContain('owned')
    expect(tool('Sickle').disabled).toBe(true)
    expect(tool('Scythe').disabled).toBe(false)
  })
})
