import { useEffect, useState } from 'react'
import { SaveCodeError, decodeImport, type DecodeTag } from '../save/codec'
import App from './App'
import { replayCodeFromHash, withoutHash, type Replay } from './replay'

const REPLAY_ERROR: Record<DecodeTag, string> = {
  'not-tiles': 'That is not a tiles save.',
  truncated: 'The save code is cut off.',
  corrupt: 'The save code is damaged (checksum or inflate failed).',
  'newer-version': 'The save comes from a newer game version than this build.',
  unsupported: 'This browser cannot open compressed saves.',
}

type ReplayBoot = { kind: 'off' } | { kind: 'loading' } | { kind: 'ready'; replay: Replay } | { kind: 'failed'; tag: DecodeTag }

/**
 * Boot switch (batch 39): the player's own game, or — when the URL hash holds `#replay=<code>` — the async
 * TILES2 decode first, then App in replay mode. The hash is read once at boot; a change needs a reload.
 */
export function Root({ hash = window.location.hash }: { hash?: string }) {
  const [code] = useState(() => replayCodeFromHash(hash))
  const [boot, setBoot] = useState<ReplayBoot>(() => (code === null ? { kind: 'off' } : { kind: 'loading' }))
  useEffect(() => {
    if (code === null) return
    let live = true
    decodeImport(code).then(
      (replay) => live && setBoot({ kind: 'ready', replay }),
      (e: unknown) => live && setBoot({ kind: 'failed', tag: e instanceof SaveCodeError ? e.tag : 'corrupt' }),
    )
    return () => {
      live = false
    }
  }, [code])

  switch (boot.kind) {
    case 'off':
      return <App />
    case 'ready':
      return <App replay={boot.replay} />
    case 'loading':
      return (
        <main className="app replay-boot">
          <p role="status">🔁 Opening the replay…</p>
        </main>
      )
    case 'failed':
      return (
        <main className="app replay-boot">
          <p role="alert">🔁 Could not open the replay: {REPLAY_ERROR[boot.tag]} Nothing was changed.</p>
          <button onClick={() => window.location.assign(withoutHash(window.location.href))}>Back to my game</button>
        </main>
      )
  }
}
