// Pure: no DOM, no wall clock. The caller passes savedAtMs and elapsedMs in.
import { OFFLINE_CAP_TICKS, START_TILES, energyMax } from '../core/balance'
import { createInitialState, createTile, type GameState, type RunState } from '../core/state'
import { step } from '../core/step'

export const SAVE_VERSION = 4

// Past shapes are frozen here, never derived from the live RunState, so a later field cannot leak into them.
type RunV1 = Pick<RunState, 'cash' | 'energy' | 'tiles' | 'licenses' | 'tick'> & {
  upgrades: { energyMax: number; energyRegen: number }
}
type RunV3 = Omit<RunState, 'counters' | 'seeds' | 'autoBuySeeds' | 'tools' | 'toolN'> & {
  /** digs = mine actions (renamed `mines` in v4) */
  counters: { harvests: number; sales: number; digs: number }
}
type RunV2 = Omit<RunV3, 'loan'>
type SaveV1 = { version: 1; savedAtMs: number; state: { meta: GameState['meta']; run: RunV1 } }
type SaveV2 = { version: 2; savedAtMs: number; state: { meta: GameState['meta']; run: RunV2 } }
type SaveV3 = { version: 3; savedAtMs: number; state: { meta: GameState['meta']; run: RunV3 } }
type SaveV4 = { version: 4; savedAtMs: number; state: GameState }
export type Save = SaveV4

export function serialize(state: GameState, savedAtMs: number): string {
  const save: Save = { version: SAVE_VERSION, savedAtMs, state }
  return JSON.stringify(save)
}

// v1 → v2: fields v1 lacks take a new run's defaults (new upgrades 0, counters 0, empty bag, no pickaxe,
// no mine license, vein 0, INITIAL_RNG_SEED). Start grew to START_TILES tiles (pad with untilled) and
// energy max dropped, so current energy is clamped to the new max.
function migrateV1(save: SaveV1): SaveV2 {
  const { meta, run } = save.state
  // later fields in `fresh` (loan, seeds, …) are overwritten by the later migrations
  const fresh = createInitialState().run
  const upgrades = { ...fresh.upgrades, ...run.upgrades }
  const tiles = [...run.tiles, ...Array.from({ length: Math.max(0, START_TILES - run.tiles.length) }, createTile)]
  return {
    version: 2,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...fresh,
        ...run,
        energy: Math.min(run.energy, energyMax(upgrades.energyMax, meta)),
        tiles,
        upgrades,
        // the v2 counter shape, not a new run's v4 one
        counters: { harvests: 0, sales: 0, digs: 0 },
      },
    },
  }
}

// v2 → v3: the bank arrived; a v2 run never had a loan.
function migrateV2(save: SaveV2): SaveV3 {
  const { meta, run } = save.state
  return { version: 3, savedAtMs: save.savedAtMs, state: { meta, run: { ...run, loan: null } } }
}

// v3 → v4: old `digs` counted mine actions, so it moves to `mines`; soil `digs` (new), `waters` and `plants`
// start at 0. Empty seed pouch, auto-buy on, so planting costs what it did before. No farm tools yet.
function migrateV3(save: SaveV3): SaveV4 {
  const { meta, run } = save.state
  const { harvests, sales, digs } = run.counters
  const { tools, toolN } = createInitialState().run
  return {
    version: 4,
    savedAtMs: save.savedAtMs,
    state: {
      meta,
      run: {
        ...run,
        counters: { harvests, sales, mines: digs, digs: 0, waters: 0, plants: 0 },
        seeds: {},
        autoBuySeeds: true,
        tools,
        toolN,
      },
    },
  }
}

/** brings any known version up to the current Save; null for unknown or future versions */
function migrate(data: { version?: unknown; savedAtMs?: unknown; state?: { meta?: unknown; run?: { tiles?: unknown } } }): Save | null {
  // shape every version shares, checked before migrating so a migration never reads a missing field
  if (typeof data.savedAtMs !== 'number' || !data.state?.meta || !Array.isArray(data.state.run?.tiles)) return null
  switch (data.version) {
    case 1:
      return migrateV3(migrateV2(migrateV1(data as SaveV1)))
    case 2:
      return migrateV3(migrateV2(data as SaveV2))
    case 3:
      return migrateV3(data as SaveV3)
    case 4:
      return data as SaveV4
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
  return migrate(data)
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
