import { describe, expect, it } from 'vitest'
import { collectArticles } from '@/lib/news'
import { summarise } from '../summarise'

/**
 * Opt-in live test. Hits real RSS feeds and the real Gemini API, so it is
 * skipped unless BELLBRIEF_LIVE=1. Run it after changing the prompt:
 *   BELLBRIEF_LIVE=1 GEMINI_API_KEY=… npx vitest run src/lib/ai/__tests__/live.test.ts
 */
describe.skipIf(process.env.BELLBRIEF_LIVE !== '1')('live pipeline', () => {
  it('collects real articles and summarises them with resolvable citations', async () => {
    const profile = {
      tickers: ['NVDA', 'AAPL'],
      sectors: ['semiconductors', 'technology'],
      themes: ['earnings', 'analyst'],
      exchanges: ['NASDAQ'],
    }

    const articles = await collectArticles(profile)
    console.log(`\ncollected ${articles.length} articles`)
    for (const a of articles.slice(0, 5)) console.log(`  - [${a.source}] ${a.title.slice(0, 70)}`)
    expect(articles.length).toBeGreaterThan(0)

    const result = await summarise(articles, { ...profile, experienceLevel: 'intermediate' })

    console.log(`\nstatus: ${result.status}  dropped: ${result.droppedSentences}  tokens: ${result.tokensUsed}`)
    if (result.error) console.log(`ERROR: ${result.error}`)
    console.log(`headline: ${result.digest.headline}`)
    console.log(`overview: ${result.digest.overview}\n`)
    for (const s of result.digest.narrative) {
      console.log(`  ${s.text} [${s.citations.map((c) => c + 1).join(',')}]`)
    }
    console.log('\nclaims:')
    for (const c of result.digest.claims) {
      console.log(`  (${c.agreement}, ${c.confidence}) ${c.claim}${c.note ? ` — ${c.note}` : ''}`)
    }

    expect(result.status).toBe('ready')
    expect(result.digest.narrative.length).toBeGreaterThan(0)

    // The contract that matters: every surviving citation resolves to a real article.
    for (const sentence of result.digest.narrative) {
      expect(sentence.citations.length).toBeGreaterThan(0)
      for (const index of sentence.citations) {
        expect(articles[index]).toBeDefined()
      }
    }

    // And the model must not be recommending trades.
    const prose = [result.digest.overview, ...result.digest.narrative.map((s) => s.text)].join(' ').toLowerCase()
    expect(prose).not.toMatch(/investors should|we recommend|you should buy|you should sell/)
  }, 180_000)
})
