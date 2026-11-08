import { createInitialState, type GameState } from '../core/state'
import { SAVE_VERSION, catchUp, deserialize, offlineTicks, serialize } from './serialize'

export const SAVE_KEY = 'tiles.save'
/** an unreadable save is moved here instead of being overwritten */
export const BAD_SAVE_KEY = 'tiles.save.bad'
/** the raw save of an older version, kept before migrating so a buggy migration can be repaired later */
export const backupKey = (version: number) => `${SAVE_KEY}.backup.v${version}`
/** the run as it was just before the 📊 Stats reset (overwritten by the next reset) */
export const RESET_BACKUP_KEY = `${SAVE_KEY}.backup.reset`

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

/** the run as it was just before a 📊 Stats "Import save" (overwritten by the next import) */
export const IMPORT_BACKUP_KEY = `${SAVE_KEY}.backup.import`

/** the stored save as base64 of its UTF-8 JSON, for 📊 Stats "Export save"; null when nothing is saved */
export function exportSave(storage: KeyValueStore): string | null {
  const raw = storage.getItem(SAVE_KEY)
  return raw === null ? null : btoa(Array.from(new TextEncoder().encode(raw), (b) => String.fromCharCode(b)).join(''))
}

export type ImportResult = { ok: true } | { ok: false; error: 'BAD_SAVE' | 'STORAGE' }

/**
 * Writes a pasted export as the save, after copying the current one to IMPORT_BACKUP_KEY. The caller loads it
 * through loadGame (backup of an older version, migration, offline catch-up). Anything deserialize rejects (not
 * base64, not UTF-8, not a save, a future version) is BAD_SAVE and nothing is written.
 */
export function importSave(storage: KeyValueStore, text: string): ImportResult {
  let raw: string
  try {
    const bytes = Uint8Array.from(atob(text.replace(/\s/g, '')), (c) => c.charCodeAt(0))
    raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { ok: false, error: 'BAD_SAVE' }
  }
  if (!deserialize(raw)) return { ok: false, error: 'BAD_SAVE' }
  try {
    const current = storage.getItem(SAVE_KEY)
    if (current !== null) storage.setItem(IMPORT_BACKUP_KEY, current)
    storage.setItem(SAVE_KEY, raw)
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
