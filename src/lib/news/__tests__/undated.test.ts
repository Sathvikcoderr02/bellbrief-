import { describe, expect, it } from 'vitest'
import { collectArticles } from '../collect'
import type { RawItem } from '../normalise'

function item(overrides: Partial<RawItem> = {}): RawItem {
  return {
    title: 'HDFC Bank posts higher quarterly profit',
    link: 'https://example.com/hdfc',
    source: 'Mint',
    publishedAt: new Date(),
    snippet: 'banking earnings',
    ...overrides,
  }
}

const profile = { tickers: ['HDFCBANK'], sectors: ['banking'], themes: ['earnings'], exchanges: ['NSE'] }

describe('undated feed items', () => {
  it('carries the estimated flag through collection', async () => {
    const articles = await collectArticles(profile, {
      fetcher: async () => [item({ publishedAtEstimated: true })],
    })
    expect(articles).toHaveLength(1)
    expect(articles[0].publishedAtEstimated).toBe(true)
  })

  it('leaves a properly dated article unflagged', async () => {
    const articles = await collectArticles(profile, {
      fetcher: async () => [item({ publishedAt: new Date(Date.now() - 3_600_000) })],
    })
    expect(articles).toHaveLength(1)
    expect(articles[0].publishedAtEstimated).toBeUndefined()
  })
})
