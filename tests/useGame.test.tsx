// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../src/app/useGame'
import { createInitialState } from '../src/core/state'
import { IMPORT_BACKUP_KEY, SAVE_KEY } from '../src/save/storage'
import { SAVE_VERSION, deserialize, type Save } from '../src/save/serialize'

const reload = vi.fn()

/** task 122: the imported run must survive every autosave path this tab can fire during the reload */
describe('useGame applyImport (task 122)', () => {
  beforeEach(() => {
    localStorage.clear()
    reload.mockReset()
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('an import sticks past pagehide, a hidden visibilitychange and the save debounce', () => {
    const imported = createInitialState()
    imported.run.cash = 123456
    const save: Save = { version: SAVE_VERSION, savedAtMs: 0, state: imported }

    const { result } = renderHook(() => useGame())
    expect(result.current.state.run.cash).toBe(20)

    act(() => {
      result.current.applyImport(save)
    })
    expect(reload).toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const stored = deserialize(localStorage.getItem(SAVE_KEY)!)
    expect(stored?.state.run.cash).toBe(123456)
    expect(stored?.state.run.tiles).toHaveLength(imported.run.tiles.length)
    const backup = deserialize(localStorage.getItem(IMPORT_BACKUP_KEY)!)
    expect(backup?.state.run.cash).toBe(20)
  })
})

/** batch 39: a #replay save is sandboxed — no catch-up from its savedAtMs, no write to localStorage */
describe('useGame replay mode (batch 39)', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('boots the report state as saved, plays on, and never touches localStorage on any save path', () => {
    const own = createInitialState()
    own.run.cash = 777
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAtMs: 1, state: own }))
    const before = localStorage.getItem(SAVE_KEY)
    const reported = createInitialState()
    reported.run.cash = 4242
    // saved a year ago: a normal boot would run the capped offline catch-up and show the welcome-back banner
    const replay = { save: { version: SAVE_VERSION, savedAtMs: 0, state: reported } as Save, fromVersion: 30 }

    const { result } = renderHook(() => useGame(replay))
    expect(result.current.state).toBe(reported)
    expect(result.current.banner).toBeNull()

    act(() => {
      vi.advanceTimersByTime(3000) // the loop steps and the autosave debounce fires
    })
    expect(result.current.state.run.tick).toBeGreaterThan(reported.run.tick)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
      result.current.reset()
    })
    expect(localStorage.getItem(SAVE_KEY)).toBe(before)
    expect(Object.keys(localStorage)).toEqual([SAVE_KEY])
  })

  it('another tab writing the real save does not freeze a replay; a Data import replaces the replayed run in memory', () => {
    const replay = { save: { version: SAVE_VERSION, savedAtMs: 0, state: createInitialState() } as Save, fromVersion: SAVE_VERSION }
    const { result } = renderHook(() => useGame(replay))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY }))
    })
    expect(result.current.frozen).toBe(false)
    const other = createInitialState()
    other.run.cash = 99
    act(() => {
      expect(result.current.applyImport({ version: SAVE_VERSION, savedAtMs: 0, state: other })).toEqual({ ok: true })
    })
    expect(result.current.state.run.cash).toBe(99)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })
})
