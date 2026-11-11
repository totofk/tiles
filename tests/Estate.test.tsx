// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TANK_UNITS_PER_COAL, pumpCost, pumpFieldCap, tankCapCoal } from '../src/core/balance'
import { CROPS } from '../src/core/data/crops'
import { ITEMS } from '../src/core/data/items'
import { fieldsOverview, nextReapTarget, nextSowTarget } from '../src/core/fields'
import { createInitialState, createMachines, type Field, type GameState, type Plot } from '../src/core/state'
import { Estate, EstateBar } from '../src/app/Estate'
import { EstateMap } from '../src/app/EstateMap'
import { fleetTilesPerHour } from '../src/app/estateText'
import { priceText } from '../src/app/Mine'
import type { UiState } from '../src/app/uiState'
import { ERROR_TEXT, type Act } from '../src/app/useGame'
import { deserialize } from '../src/save/serialize'
import v19 from './fixtures/save-v19.json?raw'
import v20 from './fixtures/save-v20.json?raw'

// every React.memo component records which plot cell (k,j) rendered: the memo render-count spy (task 152e)
const renders = vi.hoisted(() => [] as string[])
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  type Cell = { k: number; j: number }
  const memo = (C: (p: Cell) => ReactNode, eq?: (a: Cell, b: Cell) => boolean) =>
    actual.memo((p: Cell) => {
      renders.push(`${p.k},${p.j}`)
      return C(p)
    }, eq)
  return { ...actual, memo, default: { ...actual, memo } }
})

afterEach(cleanup)

/** the Tractor state: the v19 fixture migrated through the save code (Fields unlocked, 40 plots in 8 fields, pump 2) */
const base = deserialize(v19)!.state
const ui: UiState = { view: 'farm', tab: 'farm', collapsed: false, toolsOpen: true, stop: 'estate', pulledBack: true, seen: { shop: [], upgrades: [] }, priceShown: {} }

/** renders against a mutable `cur` so an act is visible on the next render (the App loop, miniaturised); toasts as useGame */
function setup(state: GameState) {
  let cur = state
  const toasts: string[] = []
  const act: Act = (fn, okToast) => {
    const r = fn(cur)
    if (!r.ok) toasts.push(ERROR_TEXT[r.error])
    else {
      const text = okToast?.(cur, r.state)
      if (text) toasts.push(text)
      cur = r.state
    }
    rerender(<Estate state={cur} act={act} ui={ui} />)
  }
  const { rerender } = render(<Estate state={cur} act={act} ui={ui} />)
  return { get cur() { return cur }, toasts }
}

const plots = (s: GameState) => s.run.fields.list.reduce((n, f) => n + f.plots.length, 0)
const plot = (crop: Plot['crop'], readyTick = 0): Plot => ({ crop, readyTick })
const field = (ps: Plot[], pivot = true, crop: Field['crop'] = 'radish'): Field => ({ pivot, crop, pinned: false, plots: ps })
const withFields = (list: Field[], run: Partial<GameState['run']> = {}): GameState => ({
  ...base,
  run: { ...base.run, ...run, fields: { ...base.run.fields, machines: createMachines(), ...run.fields, list } },
})
const cell = (name: string | RegExp) => screen.getByRole('button', { name })

describe('the 🚜 Estate stop (batch 27, task 143; the map since batch 30)', () => {
  it('8 fields render 8 map rows of a chip + 5 cells (buttons or spans); the strip chips from fieldsOverview', () => {
    const { container } = render(<Estate state={base} act={() => {}} ui={ui} />)
    expect(base.run.fields.list).toHaveLength(8)
    const rows = container.querySelectorAll('.map-row')
    expect(rows).toHaveLength(8)
    rows.forEach((row) => {
      expect(row.children).toHaveLength(6)
      expect([...row.children].every((c) => c.tagName === 'BUTTON' || c.tagName === 'SPAN')).toBe(true)
      expect(row.children[0].className).toBe('map-chip')
    })
    expect(screen.getByText('1 square = 1 plot of 10 tiles · a field = 5 plots under one ⛲ pivot').className).toBe('map-legend')
    const { emptyWet, ready, wetFields } = fieldsOverview(base.run)
    expect(screen.getByText(`💧 ${wetFields}/${pumpFieldCap(base.run.fields.pump)} fields wet`)).toBeTruthy()
    expect(screen.getByText(`🌱 ${fleetTilesPerHour(base.run.fields.machines, 'seeder')}/h · ${emptyWet} plots to sow`)).toBeTruthy()
    expect(screen.getByText(`🌾 ${fleetTilesPerHour(base.run.fields.machines, 'harvester')}/h · ${ready} ready`)).toBeTruthy()
  })

  it.each([
    [1, '1 plot to sow'],
    [2, '2 plots to sow'],
  ])('batch 28.2: the seeder chip counts %i empty wet plot(s) as "%s"', (n, label) => {
    // every plot growing, then n empty plots in Field 1 (it always has its pivot)
    const list = base.run.fields.list.map((f, i) => ({
      ...f,
      plots: f.plots.map((_, j) => (i === 0 && j < n ? { crop: null, readyTick: 0 } : { crop: 'radish' as const, readyTick: base.run.tick + 999_999 })),
    }))
    const s = { ...base, run: { ...base.run, fields: { ...base.run.fields, list } } }
    expect(fieldsOverview(s.run).emptyWet).toBe(n)
    render(<Estate state={s} act={() => {}} ui={ui} />)
    expect(screen.getByText(`🌱 ${fleetTilesPerHour(s.run.fields.machines, 'seeder')}/h · ${label}`)).toBeTruthy()
  })

  it('tap an empty cell sows it (sowPlot), a ready one reaps it by hand for ⚡10, a growing one answers Not ready yet', () => {
    const t = tick(withFields([field([plot(null), plot('radish', 5), plot('radish', 1e9)])], { cash: 1e9, autoBuySeeds: true, energy: 50 }))
    fireEvent.click(cell('Field 1 plot 1 · empty — sow'))
    expect(t.cur.run.fields.list[0].plots[0].crop).toBe('radish')
    expect(t.toasts.at(-1)).toBe(`🌱 Sowed 10 tiles of ${CROPS.radish.name}`)
    fireEvent.click(cell(`Field 1 plot 2 · ${CROPS.radish.name} ready — reap ⚡10`))
    expect([t.cur.run.fields.list[0].plots[1].crop, t.cur.run.energy]).toEqual([null, 40])
    expect(t.toasts.at(-1)).toBe(`🌾 Reaped ${CROPS.radish.name}`)
    const before = t.cur
    fireEvent.click(cell(/^Field 1 plot 3 · .+ % · ripe in /))
    expect(t.cur).toBe(before)
    expect(t.toasts.at(-1)).toBe('Not ready yet')
  })

  it('the ghost cell buys a plot; without the cash it keeps its look and the tap toasts the error', () => {
    const list = [field([plot(null), plot(null), plot(null)])]
    const rich = setup(withFields(list, { cash: 1e9 }))
    const ghost = cell(/^Buy plot 4 of Field 1 · 💰\d+ · 10 tiles$/)
    expect(ghost.className).toBe('map-cell map-ghost')
    expect(ghost.textContent).toMatch(/^＋ plot💰\d+(k|M)?/)
    fireEvent.click(ghost)
    expect(plots(rich.cur)).toBe(4)
    cleanup()
    const poor = setup(withFields(list, { cash: 0 }))
    fireEvent.click(cell(/^Buy plot 4 of Field 1/))
    expect(plots(poor.cur)).toBe(3)
    expect(poor.toasts).toEqual([ERROR_TEXT.NO_CASH])
  })

  it('a dry cell (no pivot) is dashed and opens the field sheet', () => {
    setup(withFields([field([plot(null)]), field([plot(null)], false, null)]))
    const dry = cell('Field 2 plot 1 · no pivot')
    expect(dry.className).toBe('map-cell map-dry')
    fireEvent.click(dry)
    expect(screen.getByRole('dialog', { name: 'Field 2 · 1/5 plots · 10 tiles' })).toBeTruthy()
  })

  it('the 🚜 marker sits on nextReapTarget / nextSowTarget only while that machine is owned', () => {
    const list = [field([plot('radish', 5), plot(null), plot('radish', 2)])]
    const marked = (s: GameState) => {
      const { container } = render(<Estate state={s} act={() => {}} ui={ui} />)
      const out = [...container.querySelectorAll('.map-marker')].map((m) => m.closest('button')!.getAttribute('aria-label'))
      cleanup()
      return out
    }
    const none = tick(withFields(list)).cur
    expect([nextReapTarget(none.run), nextSowTarget(none.run.fields)]).toEqual([[0, 2], [0, 1]])
    cleanup()
    expect(marked(none)).toEqual([])
    const machines = (harvester: number[], seeder: number[]) => ({ ...none, run: { ...none.run, fields: { ...none.run.fields, machines: { ...createMachines(), harvester, seeder } } } })
    expect(marked(machines([1], []))).toEqual([`Field 1 plot 3 · ${CROPS.radish.name} ready — reap ⚡10 · 🚜 next`])
    expect(marked(machines([], [1]))).toEqual(['Field 1 plot 2 · empty — sow · 🚜 next'])
  })

  it('the strip tank chip: ⛽ coal/cap · ×2 while the tank pays, ⛽ empty · ×1 (warn) when it cannot', () => {
    const paid = { ...base, run: { ...base.run, fields: { ...base.run.fields, tank: 3 * TANK_UNITS_PER_COAL + 5 } } }
    render(<Estate state={paid} act={() => {}} ui={ui} />)
    expect(screen.getByText(`⛽ 3/${tankCapCoal(base.run.fields.pump)} · ×2`)).toBeTruthy()
    cleanup()
    render(<Estate state={{ ...paid, run: { ...paid.run, fields: { ...paid.run.fields, tank: 0 } } }} act={() => {}} ui={ui} />)
    expect(screen.getByText('⛽ empty · ×1').className).toContain('estate-chip-warn')
  })

  it('fields past the pump cap collapse into one row; the ghost field says what opens the next field', () => {
    const full = field(Array.from({ length: 5 }, () => plot(null)))
    const s = withFields([full, full, full], { fields: { ...base.run.fields, pump: 0 } })
    const { container } = render(<Estate state={s} act={() => {}} ui={ui} />)
    expect(container.querySelectorAll('.map-row')).toHaveLength(2)
    expect(screen.getByText('Fields 3–3 · 🚱 beyond Pump 0')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Field 3 ·/ })).toBeNull()
    expect(screen.getByText(`＋ Field 4 · needs Pump Lv1 · ${priceText(pumpCost(0, base.meta)!)}`).tagName).toBe('P')
    cleanup()
    render(<Estate state={withFields([full, full])} act={() => {}} ui={ui} />)
    expect(screen.getByText('＋ Field 3 · opens with the next plot')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Buy plot/ })).toBeNull() // every field full: no ghost cell
    expect(screen.queryByText(/^＋ Plot/)).toBeNull() // the Expand ghost row is gone
    cleanup()
    // no pump left to build: the ghost field is omitted
    const maxed = withFields([full, full], { fields: { ...base.run.fields, pump: 99 } })
    const many = { ...maxed, run: { ...maxed.run, fields: { ...maxed.run.fields, list: Array.from({ length: pumpFieldCap(99) }, () => full) } } }
    render(<Estate state={many} act={() => {}} ui={ui} />)
    expect(screen.queryByText(/^＋ Field/)).toBeNull()
  })

  it('Fill tank moves storage coal into the tank; the smart valve row builds the valve', () => {
    const s = { ...base, run: { ...base.run, cash: 1e6, inventory: { ...base.run.inventory, coal: 7, goldBar: 9 }, fields: { ...base.run.fields, tank: 0 }, workshop: { ...base.run.workshop, built: true, valve: false } } }
    const t = setup(s)
    expect(screen.getByText(`+7 ${ITEMS.coal.emoji} from storage`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }))
    expect([t.cur.run.fields.tank, t.cur.run.inventory.coal]).toEqual([7 * TANK_UNITS_PER_COAL, 0])
    expect(screen.getByText(/pivots burn coal only while a plot grows/)).toBeTruthy()
    fireEvent.click(within(screen.getByText(/Smart valve/).closest('.recipe-row') as HTMLElement).getByRole('button'))
    expect(t.cur.run.workshop.valve).toBe(true)
    expect(screen.queryByText(/Smart valve/)).toBeNull()
  })

  it('the phone bar reaps the oldest ready plot by hand for 10 ⚡', () => {
    const f = { pivot: true, crop: 'radish' as const, pinned: false, plots: [{ crop: 'radish' as const, readyTick: 0 }, { crop: 'radish' as const, readyTick: 1e9 }] }
    let cur: GameState = { ...base, run: { ...base.run, energy: 50, fields: { ...base.run.fields, list: [f] } } }
    render(<EstateBar state={cur} act={(fn) => { const r = fn(cur); if (r.ok) cur = r.state }} />)
    const reap = screen.getByRole('button', { name: '🌾 Reap · 1' }) as HTMLButtonElement
    expect(reap.disabled).toBe(false)
    fireEvent.click(reap)
    expect([fieldsOverview(cur.run).ready, cur.run.energy, cur.run.fields.list[0].plots[0].crop]).toEqual([0, 40, null])
  })

  it('the real v20 fixture renders map rows after the migration and no Pipes text', () => {
    const s = deserialize(v20)!.state
    const { container } = render(<Estate state={s} act={() => {}} ui={ui} />)
    expect(container.querySelectorAll('.map-row').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^Field 1 · / })).toBeTruthy()
    expect(container.textContent).not.toMatch(/pipe/i)
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

/** the forged state at tick 10, so readyTick 5 / 2 plots are ready */
function tick(s: GameState) {
  return setup({ ...s, run: { ...s.run, tick: 10 } })
}

describe('task 152e: PlotCell is memo\'d — a tick re-renders only the cells whose view changed', () => {
  beforeEach(() => {
    renders.length = 0
  })

  it('two ticks that each change one plot re-render exactly that cell', () => {
    // two full fields, no machines, nothing growing: a quiet tick changes no other cell's props
    const s0 = withFields([field([plot('radish', 0), plot(null), plot(null), plot(null), plot(null)]), field(Array.from({ length: 5 }, () => plot(null)))], { tick: 10 })
    const act: Act = () => {}
    const { rerender } = render(<EstateMap state={s0} act={act} ui={ui} />)
    expect(renders).toHaveLength(10)
    renders.length = 0
    const at = (prev: GameState, j: number, p: Plot): GameState => {
      const list = prev.run.fields.list.map((f, k) => (k === 0 ? { ...f, plots: f.plots.map((q, i) => (i === j ? p : q)) } : f))
      return { ...prev, run: { ...prev.run, tick: prev.run.tick + 1, fields: { ...prev.run.fields, list } } }
    }
    const s1 = at(s0, 1, plot('radish', 1e9))
    rerender(<EstateMap state={s1} act={act} ui={ui} />)
    expect(renders).toEqual(['0,1'])
    renders.length = 0
    rerender(<EstateMap state={at(s1, 0, plot(null))} act={act} ui={ui} />)
    expect(renders).toEqual(['0,0'])
  })
})
