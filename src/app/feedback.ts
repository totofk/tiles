// Feedback goes to Toon's Google Form (DECISIONS "Feedback form + reset confirm"); every id here is public, no secret.
export const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSd_rX4oEt82dSuZcnVBX1sB-Yp_VP9WgQeiMpGKtR6GUwfTBQ/formResponse'
const ENTRY = { kind: 'entry.247767374', title: 'entry.544014453', details: 'entry.1552861218', contact: 'entry.767920014' }

/** Unicode 6 */
export const FEEDBACK_EMOJI = '💬'
/** the form's exact option strings */
export const FEEDBACK_KINDS = ['Feedback', 'Idea', 'Bug report'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export const TITLE_MAX = 80
export const DETAILS_MAX = 2000
export const COOLDOWN_MS = 30_000

/** website = the honeypot: people never see it, bots fill it */
export type FeedbackDraft = { kind: FeedbackKind; title: string; details: string; contact: string; website: string }
export const EMPTY_DRAFT: FeedbackDraft = { kind: 'Feedback', title: '', details: '', contact: '', website: '' }
/** held by App so the draft and the cooldown survive a tab switch; sentAt = UI clock (ms) of the last send */
export type FeedbackState = { draft: FeedbackDraft; sentAt: number | null }
export const EMPTY_FEEDBACK: FeedbackState = { draft: EMPTY_DRAFT, sentAt: null }

export type FeedbackContext = { build: string; saveVersion: number; screen: string; ua: string; time: string; summary: string }

export const canSend = (d: FeedbackDraft) => d.title.trim() !== '' && d.details.trim() !== ''

/** ms until the next send is allowed (0 = now) */
export const cooldownLeft = (sentAt: number | null, now: number) => (sentAt === null ? 0 : Math.max(0, sentAt + COOLDOWN_MS - now))

export function buildFeedbackBody(d: FeedbackDraft, c: FeedbackContext): URLSearchParams {
  const context = [
    '---',
    `Build: ${c.build}`,
    `Save: v${c.saveVersion}`,
    `Screen: ${c.screen}`,
    `UA: ${c.ua}`,
    `Time: ${c.time}`,
    `Game: ${c.summary}`,
  ].join('\n')
  return new URLSearchParams({
    [ENTRY.kind]: d.kind,
    [ENTRY.title]: d.title.trim(),
    [ENTRY.details]: `${d.details.trim()}\n\n${context}`,
    [ENTRY.contact]: d.contact.trim(),
  })
}

/**
 * no-cors: the reply is opaque, so `sent` means the request left; only a network error is `failed`. A filled
 * honeypot reports `sent` and sends nothing.
 */
export async function sendFeedback(
  d: FeedbackDraft,
  c: FeedbackContext,
  post: typeof fetch = fetch,
): Promise<'sent' | 'failed'> {
  if (d.website.trim()) return 'sent'
  try {
    await post(FORM_URL, { method: 'POST', mode: 'no-cors', body: buildFeedbackBody(d, c) })
    return 'sent'
  } catch {
    return 'failed'
  }
}
