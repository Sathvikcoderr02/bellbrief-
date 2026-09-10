import type { DigestArticleRef, DigestClaim, NarrativeSentence } from '@/lib/db/models'

export interface DigestEmailDigest {
  _id: string
  status: string
  headline: string
  overview: string
  narrative: NarrativeSentence[]
  claims: DigestClaim[]
  articles: DigestArticleRef[]
  sentiment: string
  sessionDate?: string
}

export interface DigestEmailInput {
  name: string
  exchange: string
  sessionDate: string
  openLocal: string
  timeZone: string
  appUrl: string
  digest: DigestEmailDigest
}

// Terminal Noir, inlined. Email clients strip <style> blocks and ignore flexbox,
// so everything here is table layout plus inline styles.
const C = {
  bg: '#0A0C0B',
  panel: '#111614',
  border: '#1B2320',
  text: '#E6EDE9',
  bright: '#ffffff',
  muted: '#8D9A93',
  faint: '#5C6B64',
  accent: '#A8FF60',
  amber: '#FFC24B',
}

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderDigestEmail(input: DigestEmailInput): { subject: string; html: string; text: string } {
  const { digest } = input

  const subject =
    digest.status === 'degraded'
      ? `${input.exchange} opens ${input.openLocal} — summary unavailable, headlines inside`
      : `${input.exchange} opens ${input.openLocal} — ${digest.headline}`

  const renderSentence = (sentence: NarrativeSentence) => {
    const markers = sentence.citations
      .map((index) => {
        const article = digest.articles.find((candidate) => candidate.index === index)
        if (!article) return ''
        return `<a href="${escapeHtml(article.url)}" style="color:${C.accent};text-decoration:none;font-family:${MONO};font-size:11px">[${index + 1}]</a>`
      })
      .join('')
    return `${escapeHtml(sentence.text)} ${markers}`
  }

  const narrative =
    digest.narrative.length > 0
      ? `<p style="margin:0 0 16px;color:${C.text};font-size:15px;line-height:1.8">${digest.narrative.map(renderSentence).join(' ')}</p>`
      : `<p style="margin:0 0 16px;color:${C.muted};font-size:14px;line-height:1.7">${escapeHtml(digest.overview)}</p>`

  const visibleClaims = digest.claims.filter((claim) => claim.agreement !== 'discarded')

  const claims =
    visibleClaims.length > 0
      ? `<p style="margin:24px 0 10px;color:${C.faint};font-family:${MONO};font-size:10px;letter-spacing:1.6px;text-transform:uppercase">Claim ledger</p>` +
        visibleClaims
          .map((claim) => {
            const colour = claim.agreement === 'disputed' ? C.amber : C.accent
            const label =
              claim.agreement === 'corroborated'
                ? `${claim.sources.length} sources agree`
                : claim.agreement === 'disputed'
                  ? 'sources disagree'
                  : 'single source'
            return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="background:${C.panel};border-left:3px solid ${colour};border-radius:6px;padding:12px 14px">
<div style="color:${C.text};font-size:13px;line-height:1.5">${escapeHtml(claim.claim)}</div>
<div style="color:${colour};font-family:${MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-top:6px">${label}${claim.note ? ` — ${escapeHtml(claim.note)}` : ''}</div>
</td></tr></table>`
          })
          .join('')
      : ''

  const sources =
    digest.articles.length > 0
      ? `<p style="margin:24px 0 10px;color:${C.faint};font-family:${MONO};font-size:10px;letter-spacing:1.6px;text-transform:uppercase">Sources</p>` +
        digest.articles
          .map(
            (article) =>
              `<div style="margin:0 0 7px;font-size:12px;line-height:1.5"><span style="color:${C.accent};font-family:${MONO}">[${article.index + 1}]</span> <a href="${escapeHtml(article.url)}" style="color:${C.text};text-decoration:none">${escapeHtml(article.title)}</a> <span style="color:${C.faint}">— ${escapeHtml(article.source)}</span></div>`,
          )
          .join('')
      : ''

  const degradedNotice =
    digest.status === 'degraded'
      ? `<p style="margin:0 0 18px;padding:12px 14px;border:1px solid ${C.amber};border-radius:8px;color:${C.amber};font-size:12px;line-height:1.6">The summary could not be generated for this session, so only the raw headlines are listed. Nothing here has been paraphrased or inferred.</p>`
      : ''

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid ${C.border};border-radius:14px;padding:26px;font-family:${SANS}">
<tr><td>
<div style="color:${C.accent};font-family:${MONO};font-size:12px;letter-spacing:3.4px">BELLBRIEF</div>
<div style="color:${C.muted};font-family:${MONO};font-size:11px;margin-top:7px">${escapeHtml(input.exchange)} &middot; SESSION ${escapeHtml(input.sessionDate)} &middot; OPENS ${escapeHtml(input.openLocal)} ${escapeHtml(input.timeZone)}</div>
<h1 style="color:${C.bright};font-size:23px;line-height:1.25;margin:20px 0 10px;letter-spacing:-0.4px">${escapeHtml(digest.headline)}</h1>
<p style="color:${C.muted};font-size:13px;line-height:1.6;margin:0 0 18px">${escapeHtml(digest.overview)}</p>
${degradedNotice}${narrative}${claims}${sources}
<table role="presentation" width="100%" style="margin:26px 0 0"><tr><td align="center">
<a href="${escapeHtml(input.appUrl)}/digest/${escapeHtml(String(digest._id))}" style="display:inline-block;background:${C.accent};color:${C.bg};font-size:13px;font-weight:600;padding:12px 22px;border-radius:8px;text-decoration:none">Open the proof view</a>
</td></tr></table>
<p style="color:${C.faint};font-size:10.5px;line-height:1.6;margin:24px 0 0;border-top:1px solid ${C.border};padding-top:14px">
Bellbrief summarises published news and links every claim to its source. Citations are verified against the articles actually fetched. This is not investment advice.
<a href="${escapeHtml(input.appUrl)}/settings" style="color:${C.muted}">Manage emails</a>.
</p>
</td></tr></table>
</td></tr></table>
</body></html>`

  const text = [
    `BELLBRIEF — ${input.exchange} opens ${input.openLocal} ${input.timeZone}`,
    `Session ${input.sessionDate}`,
    '',
    digest.headline,
    digest.overview,
    '',
    ...digest.narrative.map((sentence) => `${sentence.text} [${sentence.citations.map((i) => i + 1).join(',')}]`),
    '',
    'SOURCES',
    ...digest.articles.map((article) => `[${article.index + 1}] ${article.title} — ${article.source} — ${article.url}`),
    '',
    'Bellbrief summarises published news and links every claim to its source. This is not investment advice.',
    `${input.appUrl}/digest/${digest._id}`,
  ].join('\n')

  return { subject, html, text }
}
