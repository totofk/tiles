// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TANK_UNITS_PER_COAL, pivotCost, pumpCost, pumpFieldCap, tankCapCoal } from '../src/core/balance'
import { CROPS } from '../src/core/data/crops'
import { ITEMS } from '../src/core/data/items'
import { fieldsOverview, fieldsPlantable, nextReapTarget, nextSowTarget, pivotsOwned } from '../src/core/fields'
import { createInitialState, createMachines, type Field, type GameState, type Plot } from '../src/core/state'
import { Estate, EstateBar } from '../src/app/Estate'
import { EstateMap } from '../src/app/EstateMap'
import { CROP_EMOJI } from '../src/app/FarmGrid'
import { cropOptionText, estateCropIncomePerHour, fleetTilesPerHour } from '../src/app/estateText'
import { approx } from '../src/app/fmt'
import { priceTag } from '../src/app/marketText'
import { priceText } from '../src/app/Mine'
import type { UiState } from '../src/app/uiState'
import { ERROR_TEXT, type Act } from '../src/app/useGame'
import { deserialize } from '../src/save/serialize'
import v19 from './fixtures/save-v19.json?raw'
import v20 from './fixtures/save-v20.json?raw'
import v26 from './fixtures/save-v26.json?raw'

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
const ui: UiState = { view: 'farm', tab: 'farm', collapsed: false, toolsOpen: true, stop: 'estate', pulledBack: true, seen: { shop: [], upgrades: [], farm: [], mine: [] }, priceShown: {} }

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
// no machines and (batch 32.2: the 🚜 next marker counts them too) no Fields planters / harvesters
const withFields = (list: Field[], run: Partial<GameState['run']> = {}): GameState => ({
  ...base,
  run: {
    ...base.run,
    workers: { ...base.run.workers, assigned: { ...base.run.workers.assigned, plant: 0, harvest: 0 } },
    ...run,
    fields: { ...base.run.fields, machines: createMachines(), ...run.fields, list },
  },
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
    // task 154a: native buttons in row order, no roving tab index
    expect(container.querySelectorAll('.map-rows [tabindex]')).toHaveLength(0)
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

  it('a ready-cell tap is the hand reap: it completes an accepted contract and counts contractsByHand', () => {
    const crop = base.run.fields.list[0].crop! // a fields-plantable crop, so its order is a contract
    const offers = [{ good: crop, count: 1, done: 0, tier: 1, accepted: true, stars: 2 }]
    const t = tick(withFields([field([plot(crop, 5)], true, crop)], { energy: 50, orders: { ...base.run.orders, unlocked: true, slots: 1, offers } }))
    const before = t.cur.run.counters.contractsByHand
    fireEvent.click(cell(`Field 1 plot 1 · ${CROPS[crop].name} ready — reap ⚡10`))
    expect([t.cur.run.counters.contractsByHand, t.cur.run.energy]).toEqual([before + 1, 40])
  })

  it('the ghost cell buys a plot; without the cash it keeps its look and the tap toasts the error', () => {
    const list = [field([plot(null), plot(null), plot(null)])]
    const rich = setup(withFields(list, { cash: 1e9 }))
    const ghost = cell(/^Buy plot 4 of Field 1 · 💰[\d,]+ · 10 tiles$/)
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

describe('task 153: the field chip and its sheet', () => {
  const chip = (name: string | RegExp) => screen.getByRole('button', { name })
  const sheet = () => screen.getByRole('dialog')

  it('chip label, emoji and badge: pivot + crop, pinned, no crop, no pivot', () => {
    const pinned = { ...field([plot(null)]), pinned: true }
    setup(withFields([field([plot(null)]), pinned, field([plot(null)], true, null), field([plot(null)], false, null)]))
    const c1 = chip(`Field 1 · ${CROPS.radish.name} — open`)
    expect([c1.className, c1.textContent]).toEqual(['map-chip', `${CROP_EMOJI.radish}F1⛲`])
    expect(c1.querySelector('.map-badge-pivot')!.getAttribute('aria-hidden')).toBe('true')
    expect(chip(`Field 2 · ${CROPS.radish.name} · pinned — open`).textContent).toBe(`${CROP_EMOJI.radish}📌F2⛲`)
    expect(chip('Field 3 · no crop — open').textContent).toBe('—F3⛲')
    const dry = chip('Field 4 · no crop · no pivot — open')
    expect(dry.textContent).toBe('🚱F4＋')
    expect(dry.querySelector('.map-badge-none')).toBeTruthy()
  })

  it('the sheet Build path: builds the pivot and closes; short shows the shortfall; at the pump cap it is disabled with the pump line', () => {
    const dryFirst = [field([plot(null)], false, null), field([plot(null)])]
    const rich = setup(withFields(dryFirst, { cash: 1e9, inventory: { ...base.run.inventory, copperBar: 999, ironBar: 999, goldBar: 999 } }))
    fireEvent.click(chip(/^Field 1 · no crop · no pivot/))
    expect(sheet().getAttribute('aria-label')).toBe('Field 1 · 1/5 plots · 10 tiles')
    expect(within(sheet()).getByText("⛲ Pivot — waters this field's plots forever · Permanent").className).toBe('sheet-line')
    expect(within(sheet()).getByText(priceText(pivotCost(pivotsOwned(rich.cur.run.fields) + 1, base.meta))).className).toBe('sheet-price')
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Build' }))
    expect(rich.cur.run.fields.list[0].pivot).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    const poor = withFields(dryFirst, { cash: 0 })
    setup(poor)
    fireEvent.click(chip(/^Field 1 ·/))
    expect(within(sheet()).getByText(/^needs .+ more$/).className).toBe('sheet-short')
    expect((within(sheet()).getByRole('button', { name: 'Build' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    // pump 0 waters 2 fields and its 2 pivots are in Fields 2 and 3: Field 1 cannot get one
    setup(withFields([field([plot(null)], false, null), field([plot(null)]), field([plot(null)])], { cash: 1e9, fields: { ...base.run.fields, pump: 0 } }))
    fireEvent.click(chip(/^Field 1 ·/))
    expect(within(sheet()).getByText('Pump 0 waters 2 fields — build Pump 1').className).toBe('sheet-short')
    expect((within(sheet()).getByRole('button', { name: 'Build' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('with a pivot the sheet shows the crop income line; every licensed crop is a button with cropOptionText, disabled under the 🏡 gate', () => {
    const s: GameState = { ...base, run: { ...base.run, licenses: [...new Set([...base.run.licenses, 'grape' as const])], lifetime: { ...base.run.lifetime, harvests: { ...base.run.lifetime.harvests, grape: 3 } } } }
    setup(s)
    fireEvent.click(chip(/^Field 1 ·/))
    const crop = s.run.fields.list[0].crop!
    expect(within(sheet()).getByText(`≈💰${approx(estateCropIncomePerHour(s, 0))}/h · ${priceTag(s, crop, undefined)}`)).toBeTruthy()
    expect(within(sheet()).getByText('Crop — applies at the next sowing; standing plots finish as they are')).toBeTruthy()
    const buttons = [...sheet().querySelectorAll<HTMLButtonElement>('.map-crops > button')]
    expect(buttons.map((b) => [b.textContent, b.disabled, b.getAttribute('aria-pressed')])).toEqual([
      ...s.run.licenses.map((c) => [cropOptionText(s, 0, c), !fieldsPlantable(s.run, c), String(c === crop)]),
      ['No crop', false, 'false'],
    ])
    expect(buttons.find((b) => b.textContent!.includes(CROPS.grape.name))!.textContent).toMatch(/· 🏡 3\/50$/)
  })

  it('batch 35: the migrated v26 save — chips Corn / Pumpkin, Corn and Eggplant open on the fields without 🏡 (granted)', () => {
    const s = deserialize(v26)!.state
    setup(s)
    expect([chip(/^Field 1 ·/).textContent, chip(/^Field 2 ·/).textContent]).toEqual([`${CROP_EMOJI.corn}F1⛲`, `${CROP_EMOJI.pumpkin}F2⛲`])
    fireEvent.click(chip(/^Field 1 ·/))
    const buttons = [...sheet().querySelectorAll<HTMLButtonElement>('.map-crops > button')]
    for (const c of ['corn', 'eggplant'] as const) {
      const b = buttons.find((x) => x.textContent!.includes(CROPS[c].name))!
      expect([b.textContent!.includes('🏡'), b.disabled]).toEqual([false, false])
    }
  })

  it('a crop pick goes through setFieldCrop, toasts and closes; it pins the field while a Manager is assigned', () => {
    for (const assigned of [1, 0]) {
      const t = setup(withManager(assigned))
      fireEvent.click(chip(/^Field 1 ·/))
      const other = [...sheet().querySelectorAll<HTMLButtonElement>('.map-crops > button')].find((b) => !b.disabled && b.getAttribute('aria-pressed') === 'false' && b.textContent !== 'No crop')!
      const picked = base.run.licenses.find((c) => other.textContent === cropOptionText(t.cur, 0, c))!
      fireEvent.click(other)
      expect([t.cur.run.fields.list[0].crop, t.cur.run.fields.list[0].pinned]).toEqual([picked, assigned === 1])
      expect(t.toasts.at(-1)).toBe(`Field 1 → ${CROPS[picked].name} at the next sowing`)
      expect(screen.queryByRole('dialog')).toBeNull()
      cleanup()
    }
    const t = setup(base)
    fireEvent.click(chip(/^Field 1 ·/))
    fireEvent.click(within(sheet()).getByRole('button', { name: 'No crop' }))
    expect([t.cur.run.fields.list[0].crop, t.toasts.at(-1)]).toEqual([null, 'Field 1 → no crop at the next sowing'])
  })

  it('the 📌 row only with the Manager certificate; it toggles the pin and the sheet stays open', () => {
    setup(base)
    fireEvent.click(chip(/^Field 1 ·/))
    expect(within(sheet()).queryByRole('button', { name: /📌/ })).toBeNull()
    cleanup()
    const t = setup(withManager(0))
    fireEvent.click(chip(/^Field 1 ·/))
    const pin = within(sheet()).getByRole('button', { name: '📌 Pinned — the 💼 Manager skips this field' })
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(pin)
    expect(t.cur.run.fields.list[0].pinned).toBe(true)
    expect(within(sheet()).getByRole('button', { name: /^📌 Pinned/ }).getAttribute('aria-pressed')).toBe('true')
    expect(chip(/^Field 1 · .+ · pinned — open$/)).toBeTruthy()
  })

  it('Esc and the backdrop close the sheet (Modal)', () => {
    const { container } = render(<Estate state={base} act={() => {}} ui={ui} />)
    fireEvent.click(chip(/^Field 1 ·/))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(chip(/^Field 1 ·/))
    fireEvent.click(container.ownerDocument.querySelector('.modal-backdrop')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the old row controls are gone: no select, no row Sow / Build pivot / Reap / Pin buttons', () => {
    render(<Estate state={withManager(0)} act={() => {}} ui={ui} />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: /^(Sow|Build pivot|Reap ⚡10|Pin Field 1)$/ })).toBeNull()
  })
})

/** the base state with the 💼 Manager certificate and `assigned` Managers at work (batch 29) */
function withManager(assigned: number): GameState {
  return {
    ...base,
    run: {
      ...base.run,
      workers: { ...base.run.workers, pool: Math.max(base.run.workers.pool, 1), assigned: { ...base.run.workers.assigned, manager: assigned }, certificates: [...base.run.workers.certificates, 'manager'] },
    },
  }
}

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
