import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionError, ActionResult } from '../core/actions'
import { fireUnitTicks, upgradeUnlocked, workerActionTicks } from '../core/balance'
import { ITEMS } from '../core/data/items'
import { STAR_EMOJI } from '../core/data/orders'
import { UPGRADES, UPGRADE_IDS } from '../core/data/upgrades'
import { createInitialState, type GameState } from '../core/state'
import { sellFarm } from '../core/prestige'
import { step } from '../core/step'
import { ticksUntilWorkers, workerActivity, type WorkerTarget, type WorkTouch } from '../core/workers'
import { SAVE_KEY, PRESTIGE_BACKUP_KEY, RESET_BACKUP_KEY, commitImport, loadGame, saveGame, wallClock, type ImportResult } from '../save/storage'
import { encodeSave } from '../save/codec'
import { SAVE_VERSION, type Save, awayText, catchUp, offlineTicks, serialize } from '../save/serialize'
import { onForeignSaveEvent } from './crossTab'
import { marketMoves } from './marketText'

export const ERROR_TEXT: Record<ActionError, string> = {
  NO_ENERGY: 'Not enough energy',
  BAD_TILE: 'No such tile',
  NOT_UNTILLED: 'Already tilled',
  NOT_TILLED: 'Till the soil first',
  NOT_PLANTED: 'Nothing planted',
  IRRIGATED: 'This bed has a sprinkler — no watering needed',
  NOT_MATURE: 'Not ready yet',
  NO_LICENSE: 'Buy the license first',
  NO_CASH: 'Not enough cash',
  MAX_LEVEL: 'Already at max level',
  TILE_CAP: 'No more tiles to buy',
  ALREADY_OWNED: 'Already owned',
  LOCKED: 'Not unlocked yet',
  NO_MINE_LICENSE: 'Buy the mine license first',
  NO_PICKAXE: 'No pickaxe',
  NO_IRON_PICKAXE: 'Needs the iron pickaxe',
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
  NO_WORKSHOP: 'Build the workshop first',
  FULL: 'Furnace is full',
  NO_ORE: 'No ore of the picked kind in storage',
  NO_FUEL: 'No fuel in storage',
  NOT_EMPTY: 'Collect the tray bars first',
  NO_CERTIFICATE: 'Buy the certificate first',
  POOL_FULL: 'No more workers to hire',
  NO_FREE_WORKER: 'No free worker — hire one or unassign',
  BAD_SLOT: 'No order in that slot',
  NO_STARS: `Not enough ${STAR_EMOJI}`,
  NO_DEEDS: 'Not enough deeds',
  NO_GAIN: 'No deeds to gain yet — play on',
}

export const FIRE_EMOJI = '🔥'
/** the plant worker's icon (Workers row, tile pop, away banner) */
export const PLANT_EMOJI = '🌱'
/** the mine worker's icon (Workers row, Mine button pop, away banner; Unicode 5.2) */
export const MINE_EMOJI = '⛏️'
/**
 * The welcome-back banner: the catch-up summary, then what changed between the state before and after it (crops the
 * planters planted, miners' presses, fire burnt, copper and iron bars smelted, workers' wages; each only when non-zero)
 * the bars waiting in the tray and the crops whose market moved.
 */
export function bannerText(awayMs: number, before: GameState, after: GameState): string {
  const was = before.run.lifetime
  const now = after.run.lifetime
  const planted = now.workerPlants - was.workerPlants
  const burnt = Math.ceil((now.fireBurnt - was.fireBurnt) / fireUnitTicks())
  const smelted = now.barsSmelted - was.barsSmelted
  const ironSmelted = now.ironBarsSmelted - was.ironBarsSmelted
  const mined = now.workerMines - was.workerMines
  const ready = after.run.furnace.ready
  const wages = now.wagesPaid - was.wagesPaid
  return [
    awayText(awayMs),
    planted > 0 && `${PLANT_EMOJI} ${planted} planted`,
    mined > 0 && `${MINE_EMOJI} ${mined} mined`,
    burnt > 0 && `${FIRE_EMOJI} fire burnt ${burnt}`,
    smelted > 0 && `${ITEMS.copperBar.emoji} ${smelted} smelted`,
    ironSmelted > 0 && `${ITEMS.ironBar.emoji} ${ironSmelted} smelted`,
    ready > 0 && `${ready} bar${ready === 1 ? '' : 's'} ready`,
    wages > 0 && `wages paid 💰${wages}`,
    marketMoves(before, after),
  ]
    .filter(Boolean)
    .join(' · ')
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
  const [banner, setBanner] = useState<string | null>(boot.ticks > 0 ? bannerText(boot.awayMs, boot.before, boot.state) : null)
  // another tab rewrote the save: the loop, autosave and hide-saves all stop, so they cannot clobber it back
  const [frozen, setFrozen] = useState(false)
  const frozenRef = useRef(false)
  const freeze = useCallback(() => {
    frozenRef.current = true
    setFrozen(true)
  }, [])
  const loop = useRef({ last: 0, acc: 0 })
  const [acted, setActed] = useState<WorkerTarget[]>([])
  // task 132: every job that acted on the round (worker dots, off-farm flashes), kept alongside the tile touches
  const [worked, setWorked] = useState<WorkTouch[]>([])
  const [minerActed, setMinerActed] = useState(false)
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
    try {
      localStorage.setItem(RESET_BACKUP_KEY, serialize(stateRef.current, wallClock()))
    } catch {
      // storage blocked: the reset still goes ahead, as it did before the backup existed
    }
    const fresh = createInitialState()
    commit(fresh)
    saveGame(localStorage, fresh)
    setBanner(null)
  }, [commit])

  // "Sell the farm": the pre-sale run is backed up like a reset, then the sale's fresh run goes in
  const sell = useCallback(() => {
    const r = sellFarm(stateRef.current)
    if (!r.ok) return showToast(ERROR_TEXT[r.error])
    try {
      localStorage.setItem(PRESTIGE_BACKUP_KEY, serialize(stateRef.current, wallClock()))
    } catch {
      // storage blocked: the sale still goes ahead, as with the reset backup
    }
    commit(r.state)
    saveGame(localStorage, r.state)
    setBanner(null)
  }, [commit, showToast])

  // 💾 Data export: the LIVE run as a TILES1 code (the stored save lags by up to a second, so it is written too)
  const exportCode = useCallback(() => {
    const save: Save = { version: SAVE_VERSION, savedAtMs: wallClock(), state: stateRef.current }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save))
    } catch {
      // storage blocked: the code still carries the live run
    }
    return encodeSave(save)
  }, [])

  // 💾 Data import: the codec already migrated the pasted save in memory; back the live run up, freeze every
  // autosave of this tab (pagehide, hidden visibilitychange, debounce — not freeze(), which shows the other-tab
  // banner), write, reload — boot then applies the same offline catch-up (and its cap) as any restart
  const applyImport = useCallback(
    (save: Save): ImportResult => {
      saveGame(localStorage, stateRef.current)
      frozenRef.current = true
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
      const r = commitImport(localStorage, save)
      if (r.ok) window.location.reload()
      else frozenRef.current = false // nothing was written: the game keeps running and saving
      return r
    },
    [],
  )

  // one step() per whole elapsed second; the fractional rest carries over. Paused while hidden or frozen.
  useEffect(() => {
    loop.current = { last: performance.now(), acc: 0 }
    const id = window.setInterval(() => {
      if (frozenRef.current) return
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
      const before = stateRef.current
      const after = step(before, ticks)
      // the ringed tiles (and the Mine button, when a miner pressed it) flash when this step runs the workers' action
      // tick; the sprinklers water on the same clock, so their tiles get the 💧 badge; a longer jump just moves on.
      // One stepped round gives both the tile touches (the flash) and every job (dots, off-farm flashes)
      const crossed = ticks > ticksUntilWorkers(before) && ticks <= workerActionTicks(before.meta)
      const touches = crossed ? workerActivity(before) : []
      setActed(touches.filter((t): t is WorkerTarget => t.tile !== undefined))
      setWorked(touches)
      setMinerActed(crossed && after.run.lifetime.workerMines > before.run.lifetime.workerMines)
      commit(after)
    }, LOOP_MS)
    return () => window.clearInterval(id)
  }, [commit])

  // save at most once per second after a change (ticks change state every second, so a resetting debounce would never fire)
  useEffect(() => {
    if (saveTimer.current !== undefined) return
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined
      if (!frozenRef.current) saveGame(localStorage, stateRef.current)
    }, SAVE_DEBOUNCE_MS)
  }, [state])

  // another tab rewrote the save: stop everything and let App show the reload banner (task 117)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => onForeignSaveEvent(e, freeze)
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [freeze])

  // save on hide/close; on return, catch up the hidden time by wall clock (same path and cap as a reload)
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (frozenRef.current) return
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
      setActed([])
      setWorked([])
      setMinerActed(false)
      commit(caught)
      setBanner(bannerText(awayMs, before, caught))
    }
    const onPageHide = () => {
      if (!frozenRef.current) saveGame(localStorage, stateRef.current)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
  }, [commit])

  return { state, act, reset, sell, exportCode, applyImport, toast, banner, dismissBanner: () => setBanner(null), acted, worked, minerActed, frozen }
}
