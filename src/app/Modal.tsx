import { useEffect, type ReactNode } from 'react'

/** clipboard write that never throws: false when the API is missing (http, old browser) or refuses */
export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard?.writeText(text).then(
    () => true,
    () => false,
  ) ?? Promise.resolve(false)
}

/** the one shared modal primitive (batch 23): backdrop click and Esc close, body scrolls, nothing overflows */
export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])
  return (
    <div className="modal-backdrop" onClick={close}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button aria-label="Close" onClick={close}>
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
