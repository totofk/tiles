import { veinDrops } from '../core/balance'

/** dev switches live under their own key, outside the game save (src/save never reads or writes it) */
export const DEV_KEY = 'tiles.dev'

type DevStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * `?dev=iron` turns a switch on and remembers it, `?dev=off` forgets every switch; no `dev` param keeps what is
 * stored. Several switches: `?dev=iron,gold`. Storage failures (private mode) fall back to the URL alone.
 */
export function readDevFlags(search: string, storage: DevStorage | null): ReadonlySet<string> {
  const param = new URLSearchParams(search).get('dev')
  const parse = (v: string | null) => (v ?? '').split(',').map((s) => s.trim()).filter((s) => s && s !== 'off')
  try {
    if (param === 'off') storage?.removeItem(DEV_KEY)
    else if (param !== null) storage?.setItem(DEV_KEY, parse(param).join(','))
    return new Set(param === 'off' ? [] : parse(param ?? storage?.getItem(DEV_KEY) ?? null))
  } catch {
    return new Set(param === 'off' ? [] : parse(param))
  }
}

const storage = (): DevStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

let flags: ReadonlySet<string> = readDevFlags(typeof location === 'undefined' ? '' : location.search, storage())

/** tests only: replace the switches read at start-up */
export function setDevFlags(next: Iterable<string>): void {
  flags = new Set(next)
}

/** the vein at this level drops iron ore */
export const ironVein = (level: number) => (veinDrops(level).ironOre ?? 0) > 0

/**
 * Iron is gated off on the live site until it is ready: the upgrade to the first iron vein, the iron-rock hint,
 * the locked mine-worker row and the zero iron stats hide unless `?dev=iron` is on. A player already on an iron
 * vein (reached with the switch on) keeps seeing everything; nothing in core or the save changes.
 */
export function ironHidden(veinLevel: number): boolean {
  return !flags.has('iron') && !ironVein(veinLevel)
}
