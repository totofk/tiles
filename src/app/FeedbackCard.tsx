import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { GameState } from '../core/state'
import { feedbackSummary, timelineLines } from '../core/stats'
import { SAVE_VERSION } from '../save/serialize'
import {
  DETAILS_MAX,
  EMPTY_FEEDBACK,
  FEEDBACK_EMOJI,
  FEEDBACK_KINDS,
  TITLE_MAX,
  canSend,
  cooldownLeft,
  sendFeedback,
  type FeedbackContext,
  type FeedbackDraft,
  type FeedbackState,
} from './feedback'

export type FeedbackProps = { state: GameState; feedback: FeedbackState; setFeedback: Dispatch<SetStateAction<FeedbackState>> }

function context(state: GameState): FeedbackContext {
  return {
    build: __BUILD__,
    saveVersion: SAVE_VERSION,
    screen: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`,
    ua: navigator.userAgent,
    time: new Date().toISOString(),
    summary: feedbackSummary(state),
    timeline: timelineLines(state.run),
  }
}

/** 💬 Feedback card at the end of 📊 Stats; the draft lives in App (props) so a tab switch keeps it */
export function FeedbackCard({ state, feedback, setFeedback }: FeedbackProps) {
  const { draft, sentAt } = feedback
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  // the UI clock for the send cooldown, read once a second
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const wait = cooldownLeft(sentAt, now)
  const edit = (patch: Partial<FeedbackDraft>) => {
    setFeedback((f) => ({ ...f, draft: { ...f.draft, ...patch } }))
    if (status === 'sent') setStatus('idle')
  }
  const send = async () => {
    setStatus('sending')
    const result = await sendFeedback(draft, context(state))
    if (result === 'sent') {
      const at = Date.now()
      setFeedback({ ...EMPTY_FEEDBACK, sentAt: at })
      setNow(at)
    }
    setStatus(result)
  }
  const label =
    status === 'sending' ? 'Sending…' : wait > 0 ? `Send (wait ${Math.ceil(wait / 1000)} s)` : status === 'failed' ? 'Retry' : 'Send'

  return (
    <section className="shop feedback">
      <h2>{FEEDBACK_EMOJI} Feedback</h2>
      <div className="feedback-kinds" role="group" aria-label="Kind">
        {FEEDBACK_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => edit({ kind: k })}>
            {k}
          </button>
        ))}
      </div>
      <label>
        <span>
          Title <small>{draft.title.length}/{TITLE_MAX}</small>
        </span>
        <input value={draft.title} maxLength={TITLE_MAX} onChange={(e) => edit({ title: e.target.value })} />
      </label>
      <label>
        <span>
          Details <small>{draft.details.length}/{DETAILS_MAX}</small>
        </span>
        <textarea rows={4} value={draft.details} maxLength={DETAILS_MAX} onChange={(e) => edit({ details: e.target.value })} />
      </label>
      <label>
        <span>
          Contact <small>(optional)</small>
        </span>
        <input
          value={draft.contact}
          placeholder="name or email if you want a reply"
          onChange={(e) => edit({ contact: e.target.value })}
        />
      </label>
      {/* honeypot: off-screen (not display:none, which some bots skip), out of the tab order */}
      <label className="feedback-hp" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={(e) => edit({ website: e.target.value })} />
      </label>
      <button className="feedback-send" disabled={!canSend(draft) || wait > 0 || status === 'sending'} onClick={send}>
        {label}
      </button>
      {status === 'sent' && <p role="status">Sent — thank you</p>}
      {status === 'failed' && <p role="alert">Could not send — check your connection</p>}
    </section>
  )
}
