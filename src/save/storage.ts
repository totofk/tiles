import { createInitialState, type GameState } from '../core/state'
import { SAVE_VERSION, catchUp, deserialize, offlineTicks, serialize, type Save } from './serialize'

export const SAVE_KEY = 'tiles.save'
/** an unreadable save is moved here instead of being overwritten */
export const BAD_SAVE_KEY = 'tiles.save.bad'
/** the raw save of an older version, kept before migrating so a buggy migration can be repaired later */
export const backupKey = (version: number) => `${SAVE_KEY}.backup.v${version}`
/** the run as it was just before the 📊 Stats reset (overwritten by the next reset) */
export const RESET_BACKUP_KEY = `${SAVE_KEY}.backup.reset`
/** the run as it was just before a 🏆 Legacy "Sell the farm" (overwritten by the next sale) */
export const PRESTIGE_BACKUP_KEY = `${SAVE_KEY}.backup.prestige`

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

/** before: the saved state before the catch-up, so the welcome-back banner can diff it (wages, fire burnt, bars) */
export type Loaded = { state: GameState; awayMs: number; ticks: number; before: GameState }

export function loadGame(storage: KeyValueStore, now: Clock = wallClock): Loaded {
  const raw = storage.getItem(SAVE_KEY)
  const version = raw === null ? undefined : rawVersion(raw)
  if (typeof version === 'number' && version < SAVE_VERSION) storage.setItem(backupKey(version), raw!)
  const save = raw === null ? null : deserialize(raw)
  if (!save) {
    if (raw !== null) storage.setItem(BAD_SAVE_KEY, raw)
    const fresh = createInitialState()
    return { state: fresh, awayMs: 0, ticks: 0, before: fresh }
  }
  const awayMs = now() - save.savedAtMs
  return { state: catchUp(save.state, awayMs), awayMs, ticks: offlineTicks(awayMs), before: save.state }
}

/** the run as it was just before a 💾 Data "Import save" (overwritten by the next import) */
export const IMPORT_BACKUP_KEY = `${SAVE_KEY}.backup.import`

export type ImportResult = { ok: true } | { ok: false; error: 'STORAGE' }

/**
 * Writes an already-decoded, already-migrated Save (the codec ran the boot deserialize chain — there is no
 * second validator), after copying the current one to IMPORT_BACKUP_KEY. The caller then reloads, so boot loads
 * it with the same offline catch-up and cap as any restart.
 */
export function commitImport(storage: KeyValueStore, save: Save): ImportResult {
  try {
    const current = storage.getItem(SAVE_KEY)
    if (current !== null) storage.setItem(IMPORT_BACKUP_KEY, current)
    storage.setItem(SAVE_KEY, serialize(save.state, save.savedAtMs))
  } catch {
    // quota full or storage blocked: the save itself is untouched (it is written last)
    return { ok: false, error: 'STORAGE' }
  }
  return { ok: true }
}

export function saveGame(storage: KeyValueStore, state: GameState, now: Clock = wallClock): void {
  try {
    storage.setItem(SAVE_KEY, serialize(state, now()))
  } catch {
    // quota full or storage blocked: keep playing, the next save retries
  }
}
