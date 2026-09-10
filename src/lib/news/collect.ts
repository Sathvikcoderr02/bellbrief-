import { getExchange } from '@/lib/markets'
import { buildFeedUrls } from './feeds'
import { fetchFeed, mapWithConcurrency, type FeedFetcher } from './fetch'
import { canonicaliseUrl, dedupe, type RawItem } from './normalise'
import { scoreArticle, type ScoringProfile } from './score'

/** Caps the corpus handed to the model. Bounds both token cost and padding. */
export const MAX_ARTICLES = 35

const FEED_CONCURRENCY = 6
const DEFAULT_WINDOW_HOURS = 24

export interface CollectedArticle {
  url: string
  canonicalUrl: string
  title: string
  source: string
  publishedAt: Date
  snippet: string
  matchedTickers: string[]
  matchedSectors: string[]
  relevance: number
}

export async function collectArticles(
  profile: ScoringProfile,
  opts: { since?: Date; limit?: number; fetcher?: FeedFetcher } = {},
): Promise<CollectedArticle[]> {
  const fetcher = opts.fetcher ?? fetchFeed
  const since = opts.since ?? new Date(Date.now() - DEFAULT_WINDOW_HOURS * 3_600_000)
  const limit = opts.limit ?? MAX_ARTICLES

  const regions = [
    ...new Set(
      (profile.exchanges ?? []).map((code) => {
        try {
          return getExchange(code).region
        } catch {
          return 'us'
        }
      }),
    ),
  ]

  const specs = buildFeedUrls(profile, regions.length > 0 ? regions : ['us'])

  // A dead feed must never fail the digest, so each fetch swallows its own error.
  const batches = await mapWithConcurrency(specs, FEED_CONCURRENCY, async (spec) => {
    try {
      return await fetcher(spec.url)
    } catch {
      return [] as RawItem[]
    }
  })

  const fresh = batches.flat().filter((item) => item.publishedAt.getTime() >= since.getTime())

  return dedupe(fresh)
    .map((item) => {
      const { relevance, matchedTickers, matchedSectors } = scoreArticle(item, profile)
      return {
        url: item.link,
        canonicalUrl: canonicaliseUrl(item.link),
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
        snippet: item.snippet,
        matchedTickers,
        matchedSectors,
        relevance,
      }
    })
    .filter((article) => article.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit)
}
