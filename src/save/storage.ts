import { createInitialState, type GameState } from '../core/state'
import { catchUp, deserialize, offlineTicks, serialize } from './serialize'

export const SAVE_KEY = 'tiles.save'
/** an unreadable save is moved here instead of being overwritten */
export const BAD_SAVE_KEY = 'tiles.save.bad'

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>
export type Clock = () => number

/** the only wall clock in the game; core sees time only as ticks */
export const wallClock: Clock = () => Date.now()

export type Loaded = { state: GameState; awayMs: number; ticks: number }

export function loadGame(storage: KeyValueStore, now: Clock = wallClock): Loaded {
  const raw = storage.getItem(SAVE_KEY)
  const save = raw === null ? null : deserialize(raw)
  if (!save) {
    if (raw !== null) storage.setItem(BAD_SAVE_KEY, raw)
    return { state: createInitialState(), awayMs: 0, ticks: 0 }
  }
  const awayMs = now() - save.savedAtMs
  return { state: catchUp(save.state, awayMs), awayMs, ticks: offlineTicks(awayMs) }
}

export function saveGame(storage: KeyValueStore, state: GameState, now: Clock = wallClock): void {
  try {
    storage.setItem(SAVE_KEY, serialize(state, now()))
  } catch {
    // quota full or storage blocked: keep playing, the next save retries
  }
}
