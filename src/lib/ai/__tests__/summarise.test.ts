import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ getEnv: () => ({ GEMINI_API_KEY: 'test-key' }) }))

const { summarise } = await import('../summarise')
const { PROMPT_VERSION } = await import('../prompt')

const article = (i: number) => ({
  url: `https://x.com/${i}`,
  canonicalUrl: `https://x.com/${i}`,
  title: `Story ${i}`,
  source: 'Reuters',
  publishedAt: new Date('2026-09-10T06:00:00Z'),
  snippet: 'snippet',
  matchedTickers: ['INFY'],
  matchedSectors: [],
  relevance: 100,
})

const profile = {
  experienceLevel: 'beginner' as const,
  sectors: [], themes: [], tickers: ['INFY'], exchanges: ['NSE'],
}

const goodResponse = {
  text: JSON.stringify({
    headline: 'IT under pressure',
    overview: 'Guidance cuts weigh on services names.',
    sentiment: 'risk-off',
    narrative: [{ text: 'Guidance was cut.', citations: [0] }],
    claims: [{ claim: 'Guidance cut', sources: [0, 1], agreement: 'corroborated', confidence: 0.9 }],
  }),
  usage: 900,
}

describe('summarise', () => {
  it('returns quiet without calling the model when there are no articles', async () => {
    const generate = vi.fn()
    const out = await summarise([], profile, { generate })
    expect(out.status).toBe('quiet')
    expect(generate).not.toHaveBeenCalled()
  })

  it('returns a ready digest for a well-formed response', async () => {
    const generate = vi.fn().mockResolvedValue(goodResponse)
    const out = await summarise([article(0), article(1)], profile, { generate })
    expect(out.status).toBe('ready')
    expect(out.digest.narrative).toHaveLength(1)
    expect(out.tokensUsed).toBe(900)
    expect(out.promptVersion).toBe(PROMPT_VERSION)
  })

  it('strips a markdown fence the model was told not to emit', async () => {
    const generate = vi.fn().mockResolvedValue({ text: '```json\n' + goodResponse.text + '\n```' })
    expect((await summarise([article(0), article(1)], profile, { generate })).status).toBe('ready')
  })

  it('NEVER fabricates a summary: after retries it degrades to raw headlines', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('503 unavailable'))
    const out = await summarise([article(0), article(1)], profile, { generate, retries: 1, retryDelayMs: 0 })
    expect(out.status).toBe('degraded')
    expect(out.digest.headline).toMatch(/SUMMARY UNAVAILABLE/)
    expect(out.digest.narrative).toHaveLength(0)
    expect(out.digest.claims).toHaveLength(0)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(out.error).toMatch(/503/)
  })

  it('degrades rather than throwing on unparseable JSON', async () => {
    const generate = vi.fn().mockResolvedValue({ text: 'I am not JSON' })
    expect((await summarise([article(0)], profile, { generate, retries: 0, retryDelayMs: 0 })).status).toBe('degraded')
  })

  it('recovers on a retry after one transient failure', async () => {
    const generate = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(goodResponse)
    const out = await summarise([article(0), article(1)], profile, { generate, retryDelayMs: 0 })
    expect(out.status).toBe('ready')
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('marks the digest degraded when the model hallucinated most of its citations', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        headline: 'h', overview: 'o', sentiment: 'mixed',
        narrative: [
          { text: 'ok', citations: [0] },
          { text: 'invented', citations: [77] },
          { text: 'invented', citations: [88] },
        ],
        claims: [],
      }),
    })
    const out = await summarise([article(0)], profile, { generate })
    expect(out.status).toBe('degraded')
    expect(out.droppedSentences).toBe(2)
  })

  it('passes a quiet verdict through as quiet', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: JSON.stringify({ headline: 'Quiet', overview: 'Nothing material.', sentiment: 'quiet', narrative: [], claims: [] }),
    })
    expect((await summarise([article(0)], profile, { generate })).status).toBe('quiet')
  })

  it('asks for beginner-level language when the profile says beginner', async () => {
    const generate = vi.fn().mockResolvedValue(goodResponse)
    await summarise([article(0)], profile, { generate })
    expect(generate.mock.calls[0][0].prompt).toMatch(/BEGINNER/)
  })

  it('asks for advanced language when the profile says advanced', async () => {
    const generate = vi.fn().mockResolvedValue(goodResponse)
    await summarise([article(0)], { ...profile, experienceLevel: 'advanced' }, { generate })
    expect(generate.mock.calls[0][0].prompt).toMatch(/ADVANCED/)
  })

  it('includes every article, numbered, in the prompt', async () => {
    const generate = vi.fn().mockResolvedValue(goodResponse)
    await summarise([article(0), article(1), article(2)], profile, { generate })
    const prompt = generate.mock.calls[0][0].prompt
    expect(prompt).toContain('[0]')
    expect(prompt).toContain('[2]')
    expect(prompt).toContain('Valid indexes are 0 to 2 inclusive')
  })

  it('forbids investment advice in the prompt', async () => {
    const generate = vi.fn().mockResolvedValue(goodResponse)
    await summarise([article(0)], profile, { generate })
    expect(generate.mock.calls[0][0].prompt).toMatch(/NO ADVICE/)
  })
})
