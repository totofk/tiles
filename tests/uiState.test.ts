import { describe, expect, it } from 'vitest'
import { DEFAULT_UI, UI_KEY, loadUi, parseUi, saveUi, type UiState } from '../src/app/uiState'
import { createInitialState } from '../src/core/state'
import { loadGame, saveGame } from '../src/save/storage'

function memoryStore() {
  const data = new Map<string, string>()
  const touched = new Set<string>()
  return {
    data,
    touched,
    getItem: (k: string) => (touched.add(k), data.get(k) ?? null),
    setItem: (k: string, v: string) => void (touched.add(k), data.set(k, v)),
  }
}

describe('parseUi', () => {
  it('falls back to defaults for a missing, broken or non-object value', () => {
    for (const raw of [null, '', '{not json', 'null', '42', '"shop"', '[]'])
      expect(parseUi(raw), String(raw)).toEqual(DEFAULT_UI)
  })

  it('keeps valid fields and defaults the invalid ones', () => {
    expect(parseUi(JSON.stringify({ view: 'mine', tab: 'bogus', collapsed: 'yes' }))).toEqual({
      ...DEFAULT_UI,
      view: 'mine',
    })
    expect(parseUi(JSON.stringify({ view: 'garden', tab: 'upgrades', collapsed: true }))).toEqual({
      view: 'farm',
      tab: 'upgrades',
      toolsOpen: true,
      pulledBack: false,
      seen: { shop: [], upgrades: [], farm: [], mine: [] },
      priceShown: {},
    })
  })

  it('batch 38: every old stored shape parses — the Estate stop became a main view, stop and collapsed are ignored', () => {
    // the old 'panel' view (the phone tab bar's panel pages) reads as 'farm'
    expect(parseUi(JSON.stringify({ view: 'panel', tab: 'shop' })).view).toBe('farm')
    // an old `stop: 'estate'` saved while viewing the farm reads as the new 'estate' view
    expect(parseUi(JSON.stringify({ view: 'farm', stop: 'estate' })).view).toBe('estate')
    // `stop: 'home'` (the lot) is the farm view, so the mapping is a no-op
    expect(parseUi(JSON.stringify({ view: 'farm', stop: 'home' })).view).toBe('farm')
    // a stored stop only upgrades a stored 'farm' view: junk and other views are left alone
    expect(parseUi(JSON.stringify({ view: 'panel', stop: 'estate' })).view).toBe('farm')
    expect(parseUi(JSON.stringify({ view: 'mine', stop: 'estate' })).view).toBe('mine')
    expect(parseUi(JSON.stringify({ view: 'estate', stop: 'home' })).view).toBe('estate')
    // `collapsed` (the panel collapse, batch 24) is gone with the panel: stored, never an error
    expect(parseUi(JSON.stringify({ view: 'farm', collapsed: true })).view).toBe('farm')
    expect(parseUi(JSON.stringify({})).view).toBe('farm')
  })

  it('pulledBack defaults to false; a broken value falls back (batch 27)', () => {
    expect(parseUi(JSON.stringify({})).pulledBack).toBe(false)
    expect(parseUi(JSON.stringify({ pulledBack: true })).pulledBack).toBe(true)
    expect(parseUi(JSON.stringify({ pulledBack: 'yes' })).pulledBack).toBe(false)
  })

  it('toolsOpen (batch 24): defaults to open when missing, keeps a stored boolean', () => {
    expect(parseUi(JSON.stringify({})).toolsOpen).toBe(true)
    expect(parseUi(JSON.stringify({ toolsOpen: false })).toolsOpen).toBe(false)
    expect(parseUi(JSON.stringify({ toolsOpen: 'closed' })).toolsOpen).toBe(true)
  })

  it('priceShown keeps the numeric factors per crop and drops everything else (batch 21)', () => {
    expect(parseUi(JSON.stringify({ priceShown: { radish: 0.9, lemon: 1, chilli: 'low', bogus: 0.5 } })).priceShown).toEqual({
      radish: 0.9,
      lemon: 1,
    })
    expect(parseUi(JSON.stringify({ priceShown: 'all' })).priceShown).toEqual({})
  })

  it('a value from before badges (no seen) loads with nothing seen; a broken seen list falls back per tab', () => {
    const none = { shop: [], upgrades: [], farm: [], mine: [] }
    expect(parseUi(JSON.stringify({ view: 'mine', tab: 'bank', collapsed: false })).seen).toEqual(none)
    // batch 31.1: a tiles.ui from before the 🌱 Farm / ⛏️ Mine dots (no farm / mine lists) loads with them empty
    expect(parseUi(JSON.stringify({ seen: { shop: ['tile:9', 3], upgrades: ['energyMax'] } })).seen).toEqual({ ...none, upgrades: ['energyMax'] })
    expect(parseUi(JSON.stringify({ seen: 'all' })).seen).toEqual(none)
  })
})

describe('loadUi / saveUi', () => {
  it('round-trips through tiles.ui', () => {
    const store = memoryStore()
    const ui: UiState = { view: 'estate', tab: 'upgrades', toolsOpen: false, pulledBack: true, seen: { shop: ['tile:9'], upgrades: ['energyMax'], farm: ['orders'], mine: ['pick:copper'] }, priceShown: { radish: 0.95 } }
    saveUi(store, ui)
    expect([...store.data.keys()]).toEqual([UI_KEY])
    expect(loadUi(store)).toEqual(ui)
  })

  it('returns defaults and never throws when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadUi(blocked)).toEqual(DEFAULT_UI)
    expect(() => saveUi(blocked, DEFAULT_UI)).not.toThrow()
  })
})

describe('separation from the game save', () => {
  it('loadGame and saveGame never touch tiles.ui', () => {
    const store = memoryStore()
    saveUi(store, { ...DEFAULT_UI, view: 'mine', tab: 'upgrades' })
    const before = store.data.get(UI_KEY)
    store.touched.clear()
    saveGame(store, createInitialState(), () => 0)
    loadGame(store, () => 1000)
    expect(store.touched.has(UI_KEY)).toBe(false)
    expect(store.data.get(UI_KEY)).toBe(before)
  })
})
