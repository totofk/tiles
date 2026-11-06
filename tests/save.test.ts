import { describe, expect, it } from 'vitest'
import { OFFLINE_CAP_TICKS } from '../src/core/balance'
import { createInitialState } from '../src/core/state'
import { step } from '../src/core/step'
import { awayText, catchUp, deserialize, offlineTicks, serialize } from '../src/save/serialize'
import { BAD_SAVE_KEY, SAVE_KEY, loadGame, saveGame, type KeyValueStore } from '../src/save/storage'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const HOUR = 3600 * 1000

describe('serialize / deserialize', () => {
  it('round-trips state and savedAtMs', () => {
    const state = step(createInitialState(), 42)
    const save = deserialize(serialize(state, 1234))
    expect(save).toEqual({ version: 1, savedAtMs: 1234, state })
  })

  it('migration switch accepts v1 and rejects unknown, missing or future versions', () => {
    const v1 = JSON.parse(serialize(createInitialState(), 0))
    expect(deserialize(JSON.stringify(v1))?.version).toBe(1)
    expect(deserialize(JSON.stringify({ ...v1, version: 2 }))).toBeNull()
    expect(deserialize(JSON.stringify({ ...v1, version: undefined }))).toBeNull()
  })

  it('rejects corrupt text and wrong shapes', () => {
    expect(deserialize('{not json')).toBeNull()
    expect(deserialize('null')).toBeNull()
    expect(deserialize(JSON.stringify({ version: 1, savedAtMs: 0, state: {} }))).toBeNull()
  })
})

describe('catch-up', () => {
  it('simulates 0 ticks when away less than 1 s, or when the clock went backwards', () => {
    const s = createInitialState()
    expect(offlineTicks(999)).toBe(0)
    expect(offlineTicks(-5000)).toBe(0)
    expect(catchUp(s, 999)).toBe(s)
  })

  it('simulates whole seconds only', () => {
    expect(catchUp(createInitialState(), 2500).run.tick).toBe(2)
  })

  it('caps at 8 hours', () => {
    expect(OFFLINE_CAP_TICKS).toBe(8 * 3600)
    expect(offlineTicks(9 * HOUR)).toBe(8 * 3600)
    expect(catchUp(createInitialState(), 9 * HOUR).run.tick).toBe(8 * 3600)
  })

  it('banner text', () => {
    expect(awayText(12 * 60_000)).toBe('Away for 12m — 720 ticks simulated')
    expect(awayText(5_400)).toBe('Away for 5s — 5 ticks simulated')
    expect(awayText(9 * HOUR)).toBe('Away for 9h 0m — 28800 ticks simulated (capped at 8h)')
  })
})

describe('loadGame / saveGame with an injected clock', () => {
  it('saves with the clock time and catches up on load', () => {
    const store = memoryStore()
    const state = step(createInitialState(), 10)
    saveGame(store, state, () => 1_000_000)
    const loaded = loadGame(store, () => 1_000_000 + 65_400)
    expect(loaded.ticks).toBe(65)
    expect(loaded.awayMs).toBe(65_400)
    expect(loaded.state.run.tick).toBe(75)
  })

  it('starts fresh with no save', () => {
    const loaded = loadGame(memoryStore(), () => 0)
    expect(loaded).toEqual({ state: createInitialState(), awayMs: 0, ticks: 0 })
  })

  it('keeps an unreadable save aside instead of losing it', () => {
    const store = memoryStore()
    store.setItem(SAVE_KEY, '{"version":99}')
    expect(loadGame(store, () => 0).ticks).toBe(0)
    expect(store.data.get(BAD_SAVE_KEY)).toBe('{"version":99}')
  })

  it('a throwing storage does not crash saveGame', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => saveGame(store, createInitialState(), () => 0)).not.toThrow()
  })
})
