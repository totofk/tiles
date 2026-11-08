// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Fields } from '../src/app/Fields'
import type { Act } from '../src/app/useGame'
import { ITEMS } from '../src/core/data/items'
import { createInitialState, createMachines, type GameState } from '../src/core/state'

afterEach(cleanup)

/** a fields-unlocked run (both certificates by default, like the fields test helper) */
function setup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  let state: GameState = {
    ...s,
    run: {
      ...s.run,
      fields: { ...s.run.fields, unlocked: true, count: 60, machines: createMachines() },
      workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
      ...run,
    },
  }
  const act: Act = (fn) => {
    const r = fn(state)
    if (r.ok) state = r.state
  }
  const ui = () => <Fields state={state} act={act} />
  const view = render(ui())
  return { get: () => state, rerender: () => view.rerender(ui()) }
}

const row = (label: RegExp) => screen.getByText(label).closest('.worker-row') as HTMLElement

describe('the machine rows in the 🚜 Fields card (batch 19, task 98)', () => {
  it('five rows with tier, throughput, upkeep and coal-free; greyed with the certificate reason before the ladder holds', () => {
    setup({ workers: { ...createInitialState().run.workers, certificates: [] } })
    const mk1 = row(/Harvester Mk1/)
    expect(mk1.textContent).toContain('harvests 1800 tiles/h')
    expect(mk1.textContent).toContain('💰60/h upkeep · coal-free')
    expect(mk1.textContent).toContain('needs the harvest certificate')
    expect(mk1.querySelector('button')!.disabled).toBe(true)
    const seeder = row(/Seeder Mk2/)
    expect(seeder.textContent).toContain('plants 3600 tiles/h')
    expect(seeder.textContent).toContain('needs the plant certificate')
    expect(row(/Harvester Mk3/).textContent).toContain('harvests 7200 tiles/h')
  })

  it('with the certificate the reason line becomes the missing-materials line, and a buy lands as ✓ with the rate', () => {
    setup({ cash: 999999 })
    expect(row(/Harvester Mk1/).textContent).toContain(`needs ${ITEMS.ironBar.emoji}12 more`) // cash is there, the bar is not
    cleanup()
    const t = setup({ inventory: { ironBar: 12 }, cash: 999999 })
    const mk1 = row(/Harvester Mk1/)
    expect(mk1.textContent).not.toContain('certificate')
    fireEvent.click(mk1.querySelector('button')!)
    t.rerender()
    expect(t.get().run.fields.machines.harvester).toEqual([1])
    expect(row(/Harvester Mk1/).textContent).toContain('✓ 1800 tiles/h')
  })
})
