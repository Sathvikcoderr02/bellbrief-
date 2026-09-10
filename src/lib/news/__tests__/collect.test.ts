import { describe, expect, it, vi } from 'vitest'
import { collectArticles, MAX_ARTICLES } from '../collect'
import { buildFeedUrls } from '../feeds'
import type { RawItem } from '../normalise'

const profile = {
  tickers: ['INFY'], sectors: ['technology'], themes: [], exchanges: ['NSE'],
}

const story = (title: string, link: string, publishedAt = new Date()): RawItem => ({
  title, link, source: 'Reuters', publishedAt, snippet: '',
})

describe('buildFeedUrls', () => {
  it('builds a Yahoo and a Google feed per ticker', () => {
    const specs = buildFeedUrls({ tickers: ['INFY'] }, ['in'])
    expect(specs.some((s) => s.url.includes('feeds.finance.yahoo.com') && s.url.includes('INFY'))).toBe(true)
    expect(specs.some((s) => s.url.includes('news.google.com'))).toBe(true)
  })

  it('uses the Indian locale for an Indian exchange', () => {
    expect(buildFeedUrls({ sectors: ['technology'] }, ['in']).some((s) => s.url.includes('gl=IN'))).toBe(true)
  })

  it('includes regional publisher feeds', () => {
    expect(buildFeedUrls({}, ['in']).some((s) => s.kind === 'publisher')).toBe(true)
  })

  it('never emits the same URL twice', () => {
    const urls = buildFeedUrls({ tickers: ['INFY', 'TCS'], sectors: ['technology'] }, ['in', 'in']).map((s) => s.url)
    expect(urls.length).toBe(new Set(urls).size)
  })

  it('caps ticker feeds so a maximalist profile cannot fan out unbounded', () => {
    const many = Array.from({ length: 40 }, (_, i) => `T${i}`)
    expect(buildFeedUrls({ tickers: many }, ['us']).filter((s) => s.kind === 'ticker').length).toBeLessThanOrEqual(24)
  })
})

describe('collectArticles', () => {
  it('returns scored, deduped articles and drops irrelevant ones', async () => {
    const items = [
      story('Local bakery opens', 'https://a.com/1'),
      story('INFY cuts guidance', 'https://b.com/2'),
      story('INFY cuts guidance', 'https://b.com/2?utm_source=x'),
    ]
    const out = await collectArticles(profile, { fetcher: async () => items })
    expect(out.map((a) => a.title)).toEqual(['INFY cuts guidance'])
    expect(out[0].matchedTickers).toEqual(['INFY'])
    expect(out[0].canonicalUrl).toBe('https://b.com/2')
  })

  it('sorts by relevance, most relevant first', async () => {
    const out = await collectArticles(profile, {
      fetcher: async () => [story('Software stocks slip', 'https://a.com/1'), story('INFY cuts guidance', 'https://b.com/2')],
    })
    expect(out[0].title).toBe('INFY cuts guidance')
  })

  it('survives a feed that throws, using whatever the others returned', async () => {
    const out = await collectArticles(profile, {
      fetcher: async (url) => {
        if (url.includes('news.google')) throw new Error('feed down')
        return [story('INFY cuts guidance', 'https://b.com/2')]
      },
    })
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns an empty list rather than throwing when every feed is down', async () => {
    const out = await collectArticles(profile, { fetcher: async () => { throw new Error('all down') } })
    expect(out).toEqual([])
  })

  it('excludes articles published before the since date', async () => {
    const out = await collectArticles(profile, {
      since: new Date('2026-09-09T00:00:00Z'),
      fetcher: async () => [story('INFY old news', 'https://b.com/old', new Date('2020-01-01'))],
    })
    expect(out).toHaveLength(0)
  })

  it('caps the result set to bound token cost', async () => {
    const many = Array.from({ length: 200 }, (_, i) => story(`INFY story ${i}`, `https://b.com/${i}`))
    const out = await collectArticles(profile, { fetcher: async () => many })
    expect(out.length).toBeLessThanOrEqual(MAX_ARTICLES)
  })

  it('resolves the feed region from the exchange, not a hardcoded default', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    await collectArticles({ ...profile, exchanges: ['NSE'] }, { fetcher })
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('livemint'))).toBe(true)
  })

  it('falls back to the US region for an unrecognised exchange code', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    await collectArticles({ ...profile, exchanges: ['MOONEX'] }, { fetcher })
    expect(fetcher).toHaveBeenCalled()
  })
})
