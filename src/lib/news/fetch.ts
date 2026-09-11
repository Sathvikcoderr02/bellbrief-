import Parser from 'rss-parser'
import type { RawItem } from './normalise'

export type FeedFetcher = (url: string) => Promise<RawItem[]>

const FEED_TIMEOUT_MS = 8_000

/**
 * `source` must be registered as a custom field — rss-parser drops it
 * otherwise, and it is the only place Google News names the real publisher.
 */
const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: { 'User-Agent': 'Bellbrief/1.0 (pre-market news digest)' },
  customFields: { item: [['source', 'sourceRaw']] },
})

interface ParsedItem {
  title?: string
  link?: string
  isoDate?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  sourceRaw?: unknown
}

/**
 * Attribution matters more here than in a normal reader: the source name is
 * rendered as the proof chip beside every claim, so "Reuters" is useful and
 * '"NVDA stock when:1d" - Google News' is worse than useless.
 *
 * Priority is publisher element, then link hostname, then the feed title —
 * the feed title comes last because for a Google News search it is the query
 * and for Yahoo it is the ticker page, neither of which is a publisher.
 */
export function resolveSource(item: ParsedItem, feedTitle: string | undefined, link: string): string {
  const raw = item.sourceRaw
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (raw && typeof raw === 'object') {
    const title = (raw as { title?: string; _?: string }).title ?? (raw as { _?: string })._
    if (typeof title === 'string' && title.trim()) return title.trim()
  }

  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return feedTitle?.trim() || 'unknown'
  }
}

export const fetchFeed: FeedFetcher = async (url) => {
  const feed = await parser.parseURL(url)

  return (feed.items ?? []).flatMap((rawItem) => {
    const item = rawItem as ParsedItem
    if (!item.title || !item.link) return []

    // Some feeds omit a date entirely. Defaulting to now keeps the item, but
    // it must be flagged: the summariser weighs recency, and an undated article
    // would otherwise look like the freshest thing in the corpus.
    const stamp = item.isoDate ?? item.pubDate
    const publishedAt = stamp ? new Date(stamp) : new Date()
    if (Number.isNaN(publishedAt.getTime())) return []

    return [{
      title: item.title.trim(),
      link: item.link,
      source: resolveSource(item, feed.title, item.link),
      publishedAt,
      ...(stamp ? {} : { publishedAtEstimated: true as const }),
      snippet: (item.contentSnippet ?? item.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400),
    }]
  })
}

/** Bounded-parallelism map, so a wide profile cannot open 40 sockets at once. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      out[index] = await fn(items[index])
    }
  })

  await Promise.all(workers)
  return out
}
