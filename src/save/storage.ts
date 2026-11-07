import { createInitialState, type GameState } from '../core/state'
import { SAVE_VERSION, catchUp, deserialize, offlineTicks, serialize } from './serialize'

export const SAVE_KEY = 'tiles.save'
/** an unreadable save is moved here instead of being overwritten */
export const BAD_SAVE_KEY = 'tiles.save.bad'
/** the raw save of an older version, kept before migrating so a buggy migration can be repaired later */
export const backupKey = (version: number) => `${SAVE_KEY}.backup.v${version}`

function rawVersion(raw: string): unknown {
  try {
    return (JSON.parse(raw) as { version?: unknown } | null)?.version
  } catch {
    return undefined
  }
}

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>
export type Clock = () => number

/** the only wall clock in the game; core sees time only as ticks */
export const wallClock: Clock = () => Date.now()

/** wagesPaid: what workers were paid during the catch-up, for the welcome-back banner */
export type Loaded = { state: GameState; awayMs: number; ticks: number; wagesPaid: number }

export function loadGame(storage: KeyValueStore, now: Clock = wallClock): Loaded {
  const raw = storage.getItem(SAVE_KEY)
  const version = raw === null ? undefined : rawVersion(raw)
  if (typeof version === 'number' && version < SAVE_VERSION) storage.setItem(backupKey(version), raw!)
  const save = raw === null ? null : deserialize(raw)
  if (!save) {
    if (raw !== null) storage.setItem(BAD_SAVE_KEY, raw)
    return { state: createInitialState(), awayMs: 0, ticks: 0, wagesPaid: 0 }
  }
  const awayMs = now() - save.savedAtMs
  const state = catchUp(save.state, awayMs)
  return { state, awayMs, ticks: offlineTicks(awayMs), wagesPaid: state.run.lifetime.wagesPaid - save.state.run.lifetime.wagesPaid }
}

export function saveGame(storage: KeyValueStore, state: GameState, now: Clock = wallClock): void {
  try {
    storage.setItem(SAVE_KEY, serialize(state, now()))
  } catch {
    // quota full or storage blocked: keep playing, the next save retries
  }
}
