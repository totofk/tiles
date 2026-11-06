import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionError, ActionResult } from '../core/actions'
import { createInitialState, type GameState } from '../core/state'
import { step } from '../core/step'

const ERROR_TEXT: Record<ActionError, string> = {
  NO_ENERGY: 'Not enough energy',
  BAD_TILE: 'No such tile',
  NOT_UNTILLED: 'Already tilled',
  NOT_TILLED: 'Till the soil first',
  NOT_PLANTED: 'Nothing planted',
  NOT_MATURE: 'Not ready yet',
  NO_LICENSE: 'Buy the license first',
  NO_CASH: 'Not enough cash',
  MAX_LEVEL: 'Already at max level',
  TILE_CAP: 'No more tiles to buy',
  ALREADY_OWNED: 'Already owned',
}

const TOAST_MS = 2000
const LOOP_MS = 250

export type Act = (fn: (s: GameState) => ActionResult | null, idleText?: string) => void

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState)
  // single source of truth for ticks, taps and saves, so a tap never overwrites a queued tick
  const stateRef = useRef(state)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const showToast = useCallback((text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  const act: Act = useCallback(
    (fn, idleText) => {
      const r = fn(stateRef.current)
      if (!r) {
        if (idleText) showToast(idleText)
      } else if (r.ok) commit(r.state)
      else showToast(ERROR_TEXT[r.error])
    },
    [commit, showToast],
  )

  const reset = useCallback(() => commit(createInitialState()), [commit])

  // one step() per whole elapsed second; the fractional rest carries over. Paused while hidden.
  useEffect(() => {
    let last = performance.now()
    let acc = 0
    const id = window.setInterval(() => {
      const now = performance.now()
      if (document.hidden) {
        last = now
        return
      }
      acc += now - last
      last = now
      const ticks = Math.floor(acc / 1000)
      if (ticks < 1) return
      acc -= ticks * 1000
      commit(step(stateRef.current, ticks))
    }, LOOP_MS)
    return () => window.clearInterval(id)
  }, [commit])

  return { state, act, reset, toast }
}
