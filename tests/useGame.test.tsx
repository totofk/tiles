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
