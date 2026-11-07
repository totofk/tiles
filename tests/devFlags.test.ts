import { afterEach, describe, expect, it } from 'vitest'
import { DEV_KEY, ironHidden, readDevFlags, setDevFlags } from '../src/app/devFlags'

function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe('readDevFlags', () => {
  it('?dev=iron turns the switch on and remembers it', () => {
    const s = memory()
    expect([...readDevFlags('?dev=iron', s)]).toEqual(['iron'])
    expect(s.m.get(DEV_KEY)).toBe('iron')
    expect([...readDevFlags('', s)]).toEqual(['iron'])
  })

  it('?dev=off forgets every switch', () => {
    const s = memory({ [DEV_KEY]: 'iron' })
    expect([...readDevFlags('?dev=off', s)]).toEqual([])
    expect(s.m.has(DEV_KEY)).toBe(false)
    expect([...readDevFlags('', s)]).toEqual([])
  })

  it('no param and nothing stored means no switch', () => {
    expect([...readDevFlags('?b=123', memory())]).toEqual([])
  })

  it('a storage that throws falls back to the URL alone', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect([...readDevFlags('?dev=iron', broken)]).toEqual(['iron'])
    expect([...readDevFlags('', broken)]).toEqual([])
    expect([...readDevFlags('', null)]).toEqual([])
  })
})

describe('ironHidden', () => {
  afterEach(() => setDevFlags(['iron']))

  it('hides iron below the first iron vein unless the switch is on', () => {
    setDevFlags([])
    expect(ironHidden(2)).toBe(true)
    expect(ironHidden(3)).toBe(false)
    setDevFlags(['iron'])
    expect(ironHidden(2)).toBe(false)
  })
})
