import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env } from 'node:process'
import type { ActionResult } from '../src/core/actions'
import { batchBars, furnaceTrayCap, type Price } from '../src/core/balance'
import { ORE_IDS, type ItemId } from '../src/core/data/items'
import { cycleOre, moldSmelting } from '../src/core/furnace'
import type { GameState } from '../src/core/state'

// Batch 34 (task 181): a per-run diagnosis log for the ladder bot. Only with SIM_LOG=1; reads state, never changes it.

export const SIM_LOG_DIR = 'sim-logs'
const HELD: ItemId[] = ['copperBar', 'ironBar', 'goldBar', 'copperOre', 'ironOre', 'goldOre', 'coal', 'stone']
type Amounts = Partial<Record<keyof Price, number>>
type Attempt = { tick: number; minute: number; item: string; result: string; gatedBy?: Amounts; spent?: Amounts }
type Snapshot = ReturnType<typeof snapshotOf>

const minuteOf = (tick: number) => Math.floor(tick / 60)
const held = (s: GameState, id: keyof Price) => (id === 'cash' ? s.run.cash : id === 'stars' ? s.run.stars : (s.run.inventory[id as ItemId] ?? 0))

/** the part of `price` the state cannot pay yet */
function gatedBy(s: GameState, price: Price): Amounts {
  const out: Amounts = {}
  for (const [id, n] of Object.entries(price) as [keyof Price, number][]) if (n > held(s, id)) out[id] = n - held(s, id)
  return out
}

/** what an ok action took: every cash / ⭐ / item that went down */
function spentBy(before: GameState, after: GameState): Amounts {
  const out: Amounts = {}
  for (const id of ['cash', 'stars', ...Object.keys(before.run.inventory)] as (keyof Price)[]) {
    const d = held(before, id) - held(after, id)
    if (d > 0) out[id] = d
  }
  return out
}

function snapshotOf(s: GameState, events: string[], next?: string) {
  const { run } = s
  const f = run.furnace
  const plots = run.fields.list.flatMap((field) => field.plots)
  return {
    tick: run.tick,
    minute: minuteOf(run.tick),
    events,
    next,
    cash: Math.round(run.cash),
    stars: run.stars,
    held: Object.fromEntries(HELD.map((id) => [id, run.inventory[id] ?? 0])),
    molds: Object.fromEntries(Object.entries(f.molds).map(([ore, m]) => [ore, { ore: m.ore, ready: m.ready, progress: Math.round(m.progress * 100) / 100 }])),
    fire: f.fire,
    homePlanted: run.tiles.reduce<Record<string, number>>((n, t) => (t.cropId ? { ...n, [t.cropId]: (n[t.cropId] ?? 0) + 1 } : n), {}),
    estateSown: plots.filter((p) => p.crop !== null).length,
    estatePlots: plots.length,
    assigned: run.workers.assigned,
  }
}

/** why a mold does not progress this tick ('smelting' when it does) */
function moldState(s: GameState, ore: (typeof ORE_IDS)[number]): string {
  const f = s.run.furnace
  const m = f.molds[ore]!
  if (moldSmelting(f, ore)) return 'smelting'
  if (m.ore < cycleOre(f)) return 'noOre'
  if (m.ready + batchBars(f.levels.batch) > furnaceTrayCap(f.levels.tray)) return 'trayFull'
  return 'noFire'
}

export type SimLog = {
  /** one buy attempt, logged before the bot applies it (`price` = what the item costs, for gatedBy) */
  attempt: (s: GameState, item: string, r: ActionResult, price?: Price) => void
  /** after every step: snapshots on new marks, furnace minutes */
  tick: (s: GameState, events: string[], next?: string) => void
  /** writes the file */
  finish: (s: GameState) => void
}

/** the log for one run, or null without SIM_LOG=1; the file is `<describe>-<it>-<scenario>.json` (overwritten) */
export function simLog(testName: string | undefined, scenario: string): SimLog | null {
  if (env.SIM_LOG !== '1') return null
  const attempts: Attempt[] = []
  const seen = new Set<string>()
  const snapshots: Snapshot[] = []
  const furnaceTicks: Record<string, Record<string, number>> = {}
  return {
    attempt(s, item, r, price) {
      const result = r.ok ? 'ok' : r.error
      const key = `${minuteOf(s.run.tick)}|${item}|${result}`
      if (!r.ok && seen.has(key)) return
      seen.add(key)
      attempts.push({
        tick: s.run.tick,
        minute: minuteOf(s.run.tick),
        item,
        result,
        ...(price && !r.ok ? { gatedBy: gatedBy(s, price) } : {}),
        ...(r.ok ? { spent: spentBy(s, r.state) } : {}),
      })
    },
    tick(s, events, next) {
      if (events.length > 0) snapshots.push(snapshotOf(s, events, next))
      if (!s.run.furnace.built) return
      for (const ore of ORE_IDS) {
        if (!s.run.furnace.molds[ore]) continue
        const kind = (furnaceTicks[ore] ??= {})
        const st = moldState(s, ore)
        kind[st] = (kind[st] ?? 0) + 1
      }
    },
    finish(s) {
      const marks = [{ tick: 0, events: ['start'], next: snapshots[0]?.next }, ...snapshots]
      let longest = { from: marks[0]!, to: marks[0]!, gap: 0 }
      marks.slice(1).forEach((m, i) => {
        if (m.tick - marks[i]!.tick > longest.gap) longest = { from: marks[i]!, to: m, gap: m.tick - marks[i]!.tick }
      })
      const inGap = attempts.filter((a) => a.tick >= longest.from.tick && a.tick <= longest.to.tick)
      const wanted = longest.from.next
      const tries = inGap.filter((a) => a.item === wanted && a.result !== 'ok')
      const scarce = new Set(tries.flatMap((a) => Object.keys(a.gatedBy ?? {})))
      const lastFail = new Map<string, string>()
      for (const a of inGap) if (a.result === 'ok') lastFail.delete(a.item)
      else lastFail.set(a.item, a.result)
      const file = {
        snapshots: [...snapshots, snapshotOf(s, ['end'])],
        attempts,
        furnaceMinutes: Object.fromEntries(
          Object.entries(furnaceTicks).map(([ore, by]) => [ore, Object.fromEntries(Object.entries(by).map(([k, n]) => [k, Math.round((n / 60) * 10) / 10]))]),
        ),
        longestGap: {
          fromTick: longest.from.tick,
          toTick: longest.to.tick,
          gapMinutes: Math.round((longest.gap / 60) * 10) / 10,
          after: longest.from.events,
          closedBy: longest.to.events,
          nextWanted: wanted ?? null,
          gatedByAtStart: tries[0]?.gatedBy ?? null,
          gatedByAtEnd: tries.at(-1)?.gatedBy ?? null,
          unlockedUnbought: [...lastFail].filter(([item, reason]) => item !== wanted && reason !== 'LOCKED').map(([item, reason]) => ({ item, reason })),
          consumedScarce: inGap.filter((a) => a.result === 'ok' && Object.keys(a.spent ?? {}).some((k) => scarce.has(k))).map((a) => ({ tick: a.tick, item: a.item, spent: a.spent })),
        },
      }
      mkdirSync(SIM_LOG_DIR, { recursive: true })
      writeFileSync(simLogPath(testName, scenario), JSON.stringify(file))
    },
  }
}

/** vitest's "describe > it" test name (undefined while collecting) plus the scenario, as a safe file name */
export function simLogPath(testName: string | undefined, scenario: string): string {
  return join(SIM_LOG_DIR, `${`${testName ?? 'collect'}-${scenario}`.replace(/[^\w.-]+/g, '_').slice(0, 180)}.json`)
}
