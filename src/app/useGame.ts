import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionError, ActionResult } from '../core/actions'
import { upgradeUnlocked } from '../core/balance'
import { UPGRADES, UPGRADE_IDS } from '../core/data/upgrades'
import { createInitialState, type GameState } from '../core/state'
import { step } from '../core/step'
import { awayText, catchUp, offlineTicks } from '../save/serialize'
import { loadGame, saveGame, wallClock } from '../save/storage'

export const ERROR_TEXT: Record<ActionError, string> = {
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
  LOCKED: 'Not unlocked yet',
  NO_MINE_LICENSE: 'Buy the mine license first',
  NO_PICKAXE: 'No pickaxe',
  NOT_BLUNT: 'Pickaxe is not blunt yet',
  BAG_FULL: 'Storage is full — sell something',
  NOT_ENOUGH_ITEMS: 'Not enough items',
  BAD_AMOUNT: 'Invalid amount',
  LOAN_ACTIVE: 'Repay the current loan first',
  NO_LOAN: 'No loan to repay',
  NOT_ENOUGH_CASH: 'Not enough cash',
  NO_SEEDS: 'No seeds — buy some or turn on auto-buy',
  NOTHING_TO_DO: 'Nothing to do',
  NOT_SELLABLE: 'Cannot be sold',
  NO_FURNACE: 'Build the furnace first',
  FULL: 'Furnace is full',
  NO_ORE: 'No copper ore in storage',
  NO_FUEL: 'No fuel in storage',
  NO_CERTIFICATE: 'Buy the certificate first',
  POOL_FULL: 'No more workers to hire',
  NO_FREE_WORKER: 'No free worker — hire one or unassign',
}

/** the welcome-back banner: the catch-up summary, plus the furnace tray when bars wait in it and the workers' wages */
export function bannerText(awayMs: number, s: GameState, wagesPaid: number): string {
  const n = s.run.furnace.ready
  return (
    awayText(awayMs) + (n > 0 ? ` · 🔥 ${n} bar${n === 1 ? '' : 's'} ready` : '') + (wagesPaid > 0 ? ` · wages paid 💰${wagesPaid}` : '')
  )
}

const TOAST_MS = 2000
const LOOP_MS = 250
const SAVE_DEBOUNCE_MS = 1000

/** okToast: text to show when the action succeeds (null = no toast) */
export type Act = (fn: (s: GameState) => ActionResult, okToast?: (prev: GameState, next: GameState) => string | null) => void

export function useGame() {
  const [boot] = useState(() => loadGame(localStorage))
  const [state, setState] = useState<GameState>(boot.state)
  // single source of truth for ticks, taps and saves, so a tap never overwrites a queued tick
  const stateRef = useRef(state)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [banner, setBanner] = useState<string | null>(boot.ticks > 0 ? bannerText(boot.awayMs, boot.state, boot.wagesPaid) : null)
  const loop = useRef({ last: 0, acc: 0 })
  const saveTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  // counters only grow inside a run, so a locked → unlocked transition toasts exactly once
  const commit = useCallback(
    (s: GameState) => {
      const prev = stateRef.current.run.counters
      const fresh = UPGRADE_IDS.filter((id) => upgradeUnlocked(id, s.run.counters) && !upgradeUnlocked(id, prev))
      stateRef.current = s
      setState(s)
      if (fresh.length) showToast(`New upgrade: ${fresh.map((id) => UPGRADES[id].name).join(', ')}`)
    },
    [showToast],
  )

  const act: Act = useCallback(
    (fn, okToast) => {
      const prev = stateRef.current
      const r = fn(prev)
      if (!r.ok) return showToast(ERROR_TEXT[r.error])
      const text = okToast?.(prev, r.state)
      if (text) showToast(text)
      commit(r.state)
    },
    [commit, showToast],
  )

  const reset = useCallback(() => {
    const fresh = createInitialState()
    commit(fresh)
    saveGame(localStorage, fresh)
    setBanner(null)
  }, [commit])

  // one step() per whole elapsed second; the fractional rest carries over. Paused while hidden.
  useEffect(() => {
    loop.current = { last: performance.now(), acc: 0 }
    const id = window.setInterval(() => {
      const l = loop.current
      const now = performance.now()
      if (document.hidden) {
        l.last = now
        return
      }
      l.acc += now - l.last
      l.last = now
      const ticks = Math.floor(l.acc / 1000)
      if (ticks < 1) return
      l.acc -= ticks * 1000
      commit(step(stateRef.current, ticks))
    }, LOOP_MS)
    return () => window.clearInterval(id)
  }, [commit])

  // save at most once per second after a change (ticks change state every second, so a resetting debounce would never fire)
  useEffect(() => {
    if (saveTimer.current !== undefined) return
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined
      saveGame(localStorage, stateRef.current)
    }, SAVE_DEBOUNCE_MS)
  }, [state])

  // save on hide/close; on return, catch up the hidden time by wall clock (same path and cap as a reload)
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.hidden) {
        saveGame(localStorage, stateRef.current)
        hiddenAt = wallClock()
        return
      }
      if (hiddenAt === null) return
      const awayMs = wallClock() - hiddenAt
      hiddenAt = null
      loop.current = { last: performance.now(), acc: 0 }
      if (offlineTicks(awayMs) < 1) return
      const before = stateRef.current
      const caught = catchUp(before, awayMs)
      commit(caught)
      setBanner(bannerText(awayMs, caught, caught.run.lifetime.wagesPaid - before.run.lifetime.wagesPaid))
    }
    const onPageHide = () => saveGame(localStorage, stateRef.current)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
  }, [commit])

  return { state, act, reset, toast, banner, dismissBanner: () => setBanner(null) }
}
