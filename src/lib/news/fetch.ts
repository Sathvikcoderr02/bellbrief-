import Parser from 'rss-parser'
import type { RawItem } from './normalise'

export type FeedFetcher = (url: string) => Promise<RawItem[]>

const FEED_TIMEOUT_MS = 8_000

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: { 'User-Agent': 'Bellbrief/1.0 (pre-market news digest)' },
})

type ParsedItem = {
  title?: string
  link?: string
  isoDate?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  source?: unknown
}

function resolveSource(item: ParsedItem, feedTitle: string | undefined, link: string): string {
  const raw = item.source
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (raw && typeof raw === 'object') {
    const title = (raw as { title?: string }).title
    if (title) return title
  }
  if (feedTitle) return feedTitle
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}

export const fetchFeed: FeedFetcher = async (url) => {
  const feed = await parser.parseURL(url)

  return (feed.items ?? []).flatMap((raw) => {
    const item = raw as ParsedItem
    if (!item.title || !item.link) return []

    const stamp = item.isoDate ?? item.pubDate
    const publishedAt = stamp ? new Date(stamp) : new Date()
    if (Number.isNaN(publishedAt.getTime())) return []

    return [{
      title: item.title.trim(),
      link: item.link,
      source: resolveSource(item, feed.title, item.link),
      publishedAt,
      snippet: (item.contentSnippet ?? item.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400),
    }]
  })
}

/** Bounded-parallelism map. Keeps a wide profile from opening 40 sockets at once. */
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
