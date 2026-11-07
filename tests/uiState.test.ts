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
      collapsed: true,
    })
  })
})

describe('loadUi / saveUi', () => {
  it('round-trips through tiles.ui', () => {
    const store = memoryStore()
    const ui: UiState = { view: 'panel', tab: 'upgrades', collapsed: true }
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
    saveUi(store, { view: 'mine', tab: 'upgrades', collapsed: true })
    const before = store.data.get(UI_KEY)
    store.touched.clear()
    saveGame(store, createInitialState(), () => 0)
    loadGame(store, () => 1000)
    expect(store.touched.has(UI_KEY)).toBe(false)
    expect(store.data.get(UI_KEY)).toBe(before)
  })
})
