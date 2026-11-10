// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fieldTileCost, pipeCover } from '../src/core/balance'
import { CROPS } from '../src/core/data/crops'
import { ITEMS } from '../src/core/data/items'
import { fieldsStats, plantFields } from '../src/core/fields'
import { createInitialState, createMachines, type GameState } from '../src/core/state'
import { Estate } from '../src/app/Estate'
import { fleetTilesPerHour } from '../src/app/estateText'
import type { UiState } from '../src/app/uiState'
import type { Act } from '../src/app/useGame'
import { deserialize } from '../src/save/serialize'
import v19 from './fixtures/save-v19.json?raw'

afterEach(cleanup)

/** the Tractor state: the v19 fixture migrated through the save code (Fields unlocked, 400 tiles, pipes 2) */
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

describe('the 🚜 Estate stop (batch 27, task 143)', () => {
  it('one row per licensed crop, tiles and ready counts from the run; the strip chips from fieldsStats', () => {
    const { container } = render(<Estate state={base} act={() => {}} ui={ui} />)
    const stats = fieldsStats(base.run)
    for (const id of base.run.licenses) {
      const row = screen.getByText(new RegExp(`${CROPS[id].name} · ${base.run.fields.planted[id] ?? 0} tiles`))
      expect(row.closest('.estate-row')).toBeTruthy()
    }
    expect(container.querySelectorAll('.estate-row')).toHaveLength(base.run.licenses.length)
    const { free, covered, ready } = stats
    expect(screen.getByText(`💧 ${covered}/${pipeCover(base.run.fields.pipes)} watered`)).toBeTruthy()
    expect(screen.getByText(`🌱 ${fleetTilesPerHour(base.run.fields.machines, 'seeder')}/h · ${free} empty`)).toBeTruthy()
    expect(screen.getByText(`🌾 ${fleetTilesPerHour(base.run.fields.machines, 'harvester')}/h · ${ready} ready`)).toBeTruthy()
  })

  it('Plant then Stop go through act: plantCrop is set, then cleared', () => {
    const s = { ...base, run: { ...base.run, fields: { ...base.run.fields, plantCrop: null } } }
    const t = setup(s)
    fireEvent.click(screen.getAllByRole('button', { name: /^Plant 10/ })[0]!)
    expect(t.cur.run.fields.plantCrop).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(t.cur.run.fields.plantCrop).toBeNull()
  })

  it('the ghost row buys 10 tiles when cash allows, and only as many as it can afford', () => {
    const rich = setup({ ...base, run: { ...base.run, cash: 1_000_000_000 } })
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }))
    expect(rich.cur.run.fields.count).toBe(base.run.fields.count + 10)
    cleanup()

    // cash for exactly the first three of the ten: a partial buy still succeeds
    const meta = base.meta
    const three = fieldTileCost(base.run.fields.count, meta) + fieldTileCost(base.run.fields.count + 1, meta) + fieldTileCost(base.run.fields.count + 2, meta)
    const poor = setup({ ...base, run: { ...base.run, cash: three } })
    fireEvent.click(screen.getByRole('button', { name: 'Buy' }))
    expect(poor.cur.run.fields.count).toBe(base.run.fields.count + 3)
  })

  it('Plant is checked against plantFields (the Plant button gate) and the machines group starts closed', () => {
    const { container } = render(<Estate state={base} act={() => {}} ui={ui} />)
    const details = container.querySelector<HTMLDetailsElement>('details.estate-machines')
    expect(details).toBeTruthy()
    expect(details!.open).toBe(false)
    // a licensed, plantable crop's button is enabled exactly when plantFields succeeds
    const id = base.run.licenses.find((c) => plantFields(base, c).ok)!
    const row = screen.getByText(new RegExp(`${CROPS[id].name} ·`)).closest('.estate-row')!
    expect(row.querySelector('button')!.disabled).toBe(false)
  })
})

/** a fresh fields-unlocked run (the old Fields-card machine tests moved here, batch 27 task 143) */
function machineSetup(run: Partial<GameState['run']>) {
  const s = createInitialState()
  return setup({
    ...s,
    run: {
      ...s.run,
      fields: { ...s.run.fields, unlocked: true, count: 60, machines: createMachines() },
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
