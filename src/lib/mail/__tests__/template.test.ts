import { describe, expect, it } from 'vitest'
import { renderDigestEmail, type DigestEmailInput } from '../template'

const input: DigestEmailInput = {
  name: 'Sathvik',
  exchange: 'NSE',
  sessionDate: '2026-09-10',
  openLocal: '09:15',
  timeZone: 'Asia/Kolkata',
  appUrl: 'http://localhost:3000',
  digest: {
    _id: 'abc123',
    status: 'ready',
    headline: 'IT majors under pressure',
    overview: 'Guidance cuts weigh on services names.',
    sentiment: 'risk-off',
    narrative: [{ text: 'Accenture cut guidance.', citations: [0] }],
    claims: [
      { claim: 'Guidance cut', sources: [0], agreement: 'single-source', confidence: 0.7 },
      { claim: 'Structural decline', sources: [0, 1], agreement: 'disputed', confidence: 0.4, note: 'outlets conflict' },
      { claim: 'INFY to crash', sources: [], agreement: 'discarded', confidence: 0, note: 'unsourced blog' },
    ],
    articles: [
      { index: 0, url: 'https://reuters.com/a', title: 'Accenture trims forecast', source: 'Reuters', publishedAt: new Date('2026-09-10T02:00:00Z') },
      { index: 1, url: 'https://livemint.com/b', title: 'IT ADRs slip', source: 'Mint', publishedAt: new Date('2026-09-10T03:00:00Z') },
    ],
    sessionDate: '2026-09-10',
  },
}

describe('renderDigestEmail', () => {
  it('puts the exchange, open time and headline in the subject', () => {
    const { subject } = renderDigestEmail(input)
    expect(subject).toContain('NSE')
    expect(subject).toContain('09:15')
    expect(subject).toContain('IT majors under pressure')
  })

  it('renders every citation as a real link to its source', () => {
    expect(renderDigestEmail(input).html).toContain('https://reuters.com/a')
  })

  it('lists all sources with their outlet names', () => {
    const { html } = renderDigestEmail(input)
    expect(html).toContain('Accenture trims forecast')
    expect(html).toContain('Reuters')
    expect(html).toContain('Mint')
  })

  it('shows a disputed claim as disagreeing and includes the note', () => {
    const { html } = renderDigestEmail(input)
    expect(html).toContain('sources disagree')
    expect(html).toContain('outlets conflict')
  })

  it('omits discarded claims from the email body', () => {
    expect(renderDigestEmail(input).html).not.toContain('INFY to crash')
  })

  it('includes the no-advice disclaimer', () => {
    expect(renderDigestEmail(input).html.toLowerCase()).toContain('not investment advice')
  })

  it('provides a plain-text alternative containing the narrative and source URLs', () => {
    const { text } = renderDigestEmail(input)
    expect(text).toContain('Accenture cut guidance.')
    expect(text).toContain('https://reuters.com/a')
    expect(text.toLowerCase()).toContain('not investment advice')
  })

  it('links to the proof view for this digest', () => {
    expect(renderDigestEmail(input).html).toContain('http://localhost:3000/digest/abc123')
  })

  it('uses no pink or purple', () => {
    const html = renderDigestEmail(input).html.toLowerCase()
    for (const banned of ['pink', 'purple', 'magenta', 'violet', 'fuchsia', '#ff00ff', '#e91e63', '#9c27b0']) {
      expect(html).not.toContain(banned)
    }
  })

  it('escapes HTML in model-generated text so a headline cannot inject markup', () => {
    const hostile = {
      ...input,
      digest: { ...input.digest, headline: '<script>alert(1)</script>' },
    }
    const { html } = renderDigestEmail(hostile)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('labels a degraded digest in the subject and warns in the body', () => {
    const degraded = {
      ...input,
      digest: { ...input.digest, status: 'degraded', headline: 'SUMMARY UNAVAILABLE — headlines only', narrative: [] },
    }
    const { subject, html } = renderDigestEmail(degraded)
    expect(subject).toMatch(/unavailable/i)
    expect(html).toMatch(/could not be generated/i)
  })

  it('falls back to the overview when there is no narrative', () => {
    const quiet = { ...input, digest: { ...input.digest, narrative: [], overview: 'Nothing material overnight.' } }
    expect(renderDigestEmail(quiet).html).toContain('Nothing material overnight.')
  })
})
