import { useState } from 'react'
import type { ImportResult } from '../save/storage'
import { useTwoPress } from './DangerZone'

/** clipboard write that never throws: false when the API is missing (http, old browser) or refuses */
export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard?.writeText(text).then(
    () => true,
    () => false,
  ) ?? Promise.resolve(false)
}

const IMPORT_ERROR: Record<Extract<ImportResult, { ok: false }>['error'], string> = {
  BAD_SAVE: 'That is not a tiles save — nothing changed',
  STORAGE: 'Could not write the save (storage full or blocked) — nothing changed',
}

export type SaveTransferProps = { exportCode: () => string | null; importCode: (text: string) => ImportResult }

/**
 * 📊 Stats "Save": Export copies the save as base64 and shows it in a read-only box (phones may block the clipboard);
 * Import takes a pasted export behind the same two-press confirm as Reset.
 */
export function SaveTransfer({ exportCode, importCode }: SaveTransferProps) {
  const [exported, setExported] = useState<{ code: string | null; copied: boolean } | null>(null)
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [armed, press] = useTwoPress(() => {
    const r = importCode(paste)
    setResult(r)
    if (r.ok) setPaste('')
  })
  const doExport = async () => {
    const code = exportCode()
    setExported({ code, copied: code !== null && (await copyText(code)) })
  }
  return (
    <section className="shop feedback save-transfer">
      <h2>Save</h2>
      <button onClick={doExport}>Export save</button>
      {exported?.code === null && <p role="alert">Could not read the save</p>}
      {exported?.code != null && (
        <>
          <p role="status">{exported.copied ? 'Copied — keep it somewhere safe' : 'Copy it from the box below'}</p>
          <textarea readOnly rows={3} aria-label="Exported save" value={exported.code} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
      <label>
        <span>Import save</span>
        <textarea
          rows={3}
          value={paste}
          placeholder="Paste an exported save"
          onChange={(e) => {
            setPaste(e.target.value)
            setResult(null)
          }}
        />
      </label>
      <button className={armed ? 'armed' : undefined} disabled={!paste.trim()} onClick={press}>
        {armed ? 'Press again to replace this save' : 'Import save'}
      </button>
      {result?.ok === true && <p role="status">Save imported — the old one is kept as a backup</p>}
      {result?.ok === false && <p role="alert">{IMPORT_ERROR[result.error]}</p>}
    </section>
  )
}
