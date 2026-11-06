// Pure: no DOM, no wall clock. The caller passes savedAtMs and elapsedMs in.
import { OFFLINE_CAP_TICKS } from '../core/balance'
import type { GameState } from '../core/state'
import { step } from '../core/step'

export const SAVE_VERSION = 1

type SaveV1 = { version: 1; savedAtMs: number; state: GameState }
export type Save = SaveV1

export function serialize(state: GameState, savedAtMs: number): string {
  const save: Save = { version: SAVE_VERSION, savedAtMs, state }
  return JSON.stringify(save)
}

/** brings any known version up to the current Save; null for unknown or future versions */
function migrate(data: { version?: unknown }): Save | null {
  switch (data.version) {
    case 1:
      return data as SaveV1
    default:
      return null
  }
}

/** null when the text is not a save this build can read */
export function deserialize(json: string): Save | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const save = migrate(data)
  if (!save || typeof save.savedAtMs !== 'number' || !save.state?.meta || !Array.isArray(save.state.run?.tiles)) {
    return null
  }
  return save
}

/** whole seconds away, never negative, capped at OFFLINE_CAP_TICKS */
export function offlineTicks(elapsedMs: number): number {
  return Math.min(Math.max(0, Math.floor(elapsedMs / 1000)), OFFLINE_CAP_TICKS)
}

export function catchUp(state: GameState, elapsedMs: number): GameState {
  return step(state, offlineTicks(elapsedMs))
}

/** "Away for 12m — 720 ticks simulated" */
export function awayText(elapsedMs: number): string {
  const ticks = offlineTicks(elapsedMs)
  const min = Math.floor(elapsedMs / 60_000)
  const away = min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : min >= 1 ? `${min}m` : `${Math.floor(elapsedMs / 1000)}s`
  const capped = ticks === OFFLINE_CAP_TICKS && elapsedMs >= (OFFLINE_CAP_TICKS + 1) * 1000 ? ' (capped at 8h)' : ''
  return `Away for ${away} — ${ticks} ticks simulated${capped}`
}
