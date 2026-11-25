// Replay mode (batch 39, docs/DECISIONS.md "Batch 39 refined"): `#replay=<code>` opens a
// save code — typically the "Save code:" line of a 💬 Feedback report — as a sandboxed run. It goes through the
// same decodeImport → deserialize migration chain as 💾 Data import, but the run lives in a memoryStore: no
// offline catch-up from the report's savedAtMs, no write to localStorage, no cross-tab freeze. The hash (not a
// query) keeps the code out of server logs and the Pages cache key.
import type { DecodedImport } from '../save/codec'

export const REPLAY_KEY = 'replay'

/** the code in `#replay=<code>`, or null when the hash holds none */
export function replayCodeFromHash(hash: string): string | null {
  // not URLSearchParams: it turns '+' into a space, and a legacy plain-base64 code carries '+'
  const match = new RegExp(`(?:^#?|&)${REPLAY_KEY}=([^&]*)`).exec(hash)
  if (!match) return null
  let code: string
  try {
    code = decodeURIComponent(match[1]!)
  } catch {
    code = match[1]!
  }
  code = code.trim()
  return code ? code : null
}

/** `href` with its hash replaced by `#replay=<code>` (codes are base64url + '.', so no escaping is needed) */
export function replayUrl(href: string, code: string): string {
  const hash = href.indexOf('#')
  return `${hash === -1 ? href : href.slice(0, hash)}#${REPLAY_KEY}=${code}`
}

/** `href` with the hash dropped: the Exit replay target */
export function withoutHash(href: string): string {
  const hash = href.indexOf('#')
  return hash === -1 ? href : href.slice(0, hash)
}

/** what App and useGame receive in replay mode: the decoded, migrated save and the version it was reported at */
export type Replay = DecodedImport
