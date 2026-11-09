import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../core/state'
import { SaveCodeError, decodeImport, type DecodeTag, type DecodedImport } from '../save/codec'
import { SAVE_KEY, type ImportResult } from '../save/storage'
import { SAVE_VERSION, type Save } from '../save/serialize'
import { DangerZone } from './DangerZone'
import { copyText } from './Modal'

export type DataModalProps = {
  state: GameState
  /** serialises the LIVE run as a TILES1 code (Date.now lives here, in src/app — the codec stays pure) */
  exportCode: () => string
  /** backs the live run up, writes the migrated save and reloads */
  applyImport: (save: Save) => ImportResult
  reset: () => void
}

const DECODE_ERROR: Record<DecodeTag, string> = {
  'not-tiles': 'That is not a tiles save — nothing changed',
  truncated: 'The code looks cut off — copy the whole thing again',
  corrupt: 'The code is damaged (checksum failed) — nothing changed',
  'newer-version': 'From a newer game version — update the game, then try again',
}

/** "saved 3 days ago" for the confirm card; Date.now is fine here, this is src/app */
export function savedAgo(savedAtMs: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - savedAtMs) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** 💾 Data: export the live save (code + file + save ID), import behind a confirm card, reset in the danger zone */
export function DataModal({ state, exportCode, applyImport, reset }: DataModalProps) {
  const [exported, setExported] = useState<{ code: string; copied: boolean } | null>(null)
  const [paste, setPaste] = useState('')
  const [incoming, setIncoming] = useState<DecodedImport | null>(null)
  const [error, setError] = useState<DecodeTag | 'STORAGE' | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (exported) box.current?.select()
  }, [exported])

  const doExport = async () => {
    const code = exportCode()
    setExported({ code, copied: await copyText(code) })
  }
  const copy = async () => {
    if (exported && (await copyText(exported.code))) setExported({ ...exported, copied: true })
  }
  const download = () => {
    if (!exported) return
    const id = exported.code.slice(exported.code.lastIndexOf('.') + 1)
    const url = URL.createObjectURL(new Blob([exported.code], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `tiles-save-${id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const check = () => {
    try {
      setIncoming(decodeImport(paste))
      setError(null)
    } catch (e) {
      setIncoming(null)
      setError(e instanceof SaveCodeError ? e.tag : 'corrupt')
    }
  }
  const confirm = () => {
    if (!incoming) return
    const r = applyImport(incoming.save)
    if (!r.ok) setError('STORAGE')
  }

  // this device's side of the confirm card: the stored save's savedAtMs (the live run IS "now")
  const [currentSavedAt] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as { savedAtMs?: number } | null)?.savedAtMs
    } catch {
      return undefined
    }
  })

  return (
    <>
      <section className="shop data-export">
        <h3>Export</h3>
        <button onClick={doExport}>Export this save</button>
        {exported && (
          <>
            <p role="status">
              {exported.copied ? 'Copied — keep it somewhere safe' : 'Copy it from the box below, or download the file'}
            </p>
            <p>
              Save ID: <code>{exported.code.slice(exported.code.lastIndexOf('.') + 1)}</code>
            </p>
            <textarea readOnly rows={4} aria-label="Exported save" ref={box} value={exported.code} onFocus={(e) => e.currentTarget.select()} />
            <div className="data-row">
              <button onClick={copy}>Copy</button>
              <button onClick={download}>Download .txt</button>
            </div>
          </>
        )}
      </section>
      <section className="shop data-import">
        <h3>Import</h3>
        <label>
          <span>Paste an exported save</span>
          <textarea
            rows={3}
            value={paste}
            placeholder="Paste an exported save"
            onChange={(e) => {
              setPaste(e.target.value)
              setIncoming(null)
              setError(null)
            }}
          />
        </label>
        <button disabled={!paste.trim()} onClick={check}>
          Check save
        </button>
        {error && (
          <p role="alert">
            {error === 'STORAGE' ? 'Could not write the save (storage full or blocked) — nothing changed' : DECODE_ERROR[error]}
          </p>
        )}
        {incoming && (
          <div className="import-compare">
            <table>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">This device</th>
                  <th scope="col">Incoming</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Deeds</th>
                  <td>{state.meta.deeds}</td>
                  <td>{incoming.save.state.meta.deeds}</td>
                </tr>
                <tr>
                  <th scope="row">Prestige sales</th>
                  <td>{state.meta.prestigeCount}</td>
                  <td>{incoming.save.state.meta.prestigeCount}</td>
                </tr>
                <tr>
                  <th scope="row">Tiles</th>
                  <td>{state.run.tiles.length}</td>
                  <td>{incoming.save.state.run.tiles.length}</td>
                </tr>
                <tr>
                  <th scope="row">Saved</th>
                  <td>{currentSavedAt === undefined ? 'not saved yet' : savedAgo(currentSavedAt)}</td>
                  <td>{savedAgo(incoming.save.savedAtMs)}</td>
                </tr>
              </tbody>
            </table>
            {incoming.fromVersion < SAVE_VERSION && (
              <p>
                Will migrate v{incoming.fromVersion} → v{SAVE_VERSION}
              </p>
            )}
            <button className="import-confirm" onClick={confirm}>
              Replace this save
            </button>
            <p className="import-note">The current save is kept as a backup slot, then the game reloads.</p>
          </div>
        )}
      </section>
      <DangerZone reset={reset} />
    </>
  )
}
