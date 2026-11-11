// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { plotCost, pumpFieldCap } from '../src/core/balance'
import { ITEMS } from '../src/core/data/items'
import { fieldsOverview } from '../src/core/fields'
import { createInitialState, createMachines, type GameState } from '../src/core/state'
import { Estate } from '../src/app/Estate'
import { fleetTilesPerHour } from '../src/app/estateText'
import type { UiState } from '../src/app/uiState'
import type { Act } from '../src/app/useGame'
import { deserialize } from '../src/save/serialize'
import v19 from './fixtures/save-v19.json?raw'

afterEach(cleanup)

/** the Tractor state: the v19 fixture migrated through the save code (Fields unlocked, 40 plots, pump 2) */
const base = deserialize(v19)!.state
const ui: UiState = { view: 'farm', tab: 'farm', collapsed: false, toolsOpen: true, stop: 'estate', pulledBack: true, seen: { shop: [], upgrades: [] }, priceShown: {} }

/** renders against a mutable `cur` so an act is visible on the next render (the App loop, miniaturised) */
function setup(state: GameState) {
  let cur = state
  const act: Act = (fn) => {
    const r = fn(cur)
    if (r.ok) cur = r.state
    rerender(<Estate state={cur} act={act} ui={ui} />)
  }
  const { rerender } = render(<Estate state={cur} act={act} ui={ui} />)
  return { get cur() { return cur } }
}

const plots = (s: GameState) => s.run.fields.list.reduce((n, f) => n + f.plots.length, 0)

describe('the 🚜 Estate stop (batch 27, task 143; a plots stopgap since batch 28 — task 148 lays it out)', () => {
  it('one row per field with its plots and chip; the strip chips from fieldsOverview', () => {
    const { container } = render(<Estate state={base} act={() => {}} ui={ui} />)
    expect(container.querySelectorAll('.estate-row')).toHaveLength(base.run.fields.list.length)
    expect(screen.getByText(/^Field 1 · .+ · 5\/5 plots/)).toBeTruthy()
    const { emptyWet, ready, wetFields } = fieldsOverview(base.run)
    expect(screen.getByText(`💧 ${wetFields}/${pumpFieldCap(base.run.fields.pump)} fields wet`)).toBeTruthy()
    expect(screen.getByText(`🌱 ${fleetTilesPerHour(base.run.fields.machines, 'seeder')}/h · ${emptyWet} plots to sow`)).toBeTruthy()
    expect(screen.getByText(`🌾 ${fleetTilesPerHour(base.run.fields.machines, 'harvester')}/h · ${ready} ready`)).toBeTruthy()
  })

  it('the crop chip goes through setFieldCrop, Sow through sowPlot; a dry field shows Build pivot instead of Sow', () => {
    const list = base.run.fields.list.map((f, i) => (i === 0 ? { ...f, crop: null, plots: f.plots.map(() => ({ crop: null, readyTick: 0 })) } : f))
    const t = setup({ ...base, run: { ...base.run, fields: { ...base.run.fields, list } } })
    const chip = screen.getByRole('combobox', { name: 'Field 1 crop' }) as HTMLSelectElement
    const crop = chip.options[1]!.value // the first fields-plantable crop
    fireEvent.change(chip, { target: { value: crop } })
    expect(t.cur.run.fields.list[0].crop).toBe(crop)
    const row = screen.getByText(/^Field 1 ·/).closest('.estate-row')!
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Sow' }))
    expect(t.cur.run.fields.list[0].plots[0].crop).toBe(crop)
    const dry = t.cur.run.fields.list.findIndex((f) => !f.pivot)
    const dryRow = screen.getByText(new RegExp(`^Field ${dry + 1} ·`)).closest('.estate-row') as HTMLElement
    expect(within(dryRow).getByRole('button', { name: /^Build pivot/ })).toBeTruthy()
    expect(dryRow.textContent).toContain('no pivot — cannot sow')
  })

  it('the ghost row buys one plot when cash allows', () => {
    const rich = setup({ ...base, run: { ...base.run, cash: 1_000_000_000 } })
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }))
    expect(plots(rich.cur)).toBe(plots(base) + 1)
    cleanup()
    const poor = setup({ ...base, run: { ...base.run, cash: plotCost(plots(base), base.meta) - 1 } })
    expect((screen.getByRole('button', { name: /^Buy/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(plots(poor.cur)).toBe(plots(base))
  })

  it('the machines group starts closed', () => {
    const { container } = render(<Estate state={base} act={() => {}} ui={ui} />)
    const details = container.querySelector<HTMLDetailsElement>('details.estate-machines')
    expect(details).toBeTruthy()
    expect(details!.open).toBe(false)
  })
})

/** a fresh fields-unlocked run (the old Fields-card machine tests moved here, batch 27 task 143) */
function machineSetup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  return setup({
    ...s,
    run: {
      ...s.run,
      fields: { ...s.run.fields, unlocked: true, list: [{ pivot: true, crop: null, pinned: false, plots: [{ crop: null, readyTick: 0 }] }], machines: createMachines() },
      workers: { ...s.run.workers, certificates: ['plant', 'harvest'] },
      ...run,
    },
  })
}

const mrow = (label: RegExp) => screen.getByText(label).closest('.recipe-row') as HTMLElement

describe('the machine rows behind the Estate closed details (moved from the 🚜 Fields card)', () => {
  it('five rows with tier, throughput, upkeep and coal-free; greyed with the certificate reason before the ladder holds', () => {
    machineSetup({ workers: { ...createInitialState().run.workers, certificates: [] } })
    const mk1 = mrow(/Harvester Mk1/)
    expect(mk1.textContent).toContain('harvests 1800 tiles/h')
    expect(mk1.textContent).toContain('💰60/h upkeep · coal-free')
    expect(mk1.textContent).toContain('uses your best sickle') // batch 20.1: the machine inherits the sickle
    expect(mk1.textContent).toContain('needs the harvest certificate')
    expect(mk1.querySelector('button')!.disabled).toBe(true)
    const seeder = mrow(/Seeder Mk2/)
    expect(seeder.textContent).toContain('plants 3600 tiles/h')
    expect(seeder.textContent).toContain('needs the plant certificate')
    expect(mrow(/Harvester Mk3/).textContent).toContain('harvests 7200 tiles/h')
  })

  it('with the certificate the reason line becomes the missing-materials line, and a buy lands as ✓ with the rate', () => {
    machineSetup({ cash: 999999 })
    expect(mrow(/Harvester Mk1/).textContent).toContain(`needs ${ITEMS.ironBar.emoji}⁠12 more`) // cash is there, the bar is not
    cleanup()
    const t = machineSetup({ inventory: { ironBar: 12 }, cash: 999999 })
    const mk1 = mrow(/Harvester Mk1/)
    expect(mk1.textContent).not.toContain('certificate')
    fireEvent.click(mk1.querySelector('button')!)
    expect(t.cur.run.fields.machines.harvester).toEqual([1])
    expect(mrow(/Harvester Mk1/).querySelector('.owned-badge')!.textContent).toBe('✓ Built')
    expect(mrow(/Harvester Mk1/).textContent).toContain('1800 tiles/h')
  })
})
