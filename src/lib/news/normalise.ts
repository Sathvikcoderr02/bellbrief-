export interface RawItem {
  title: string
  link: string
  source: string
  publishedAt: Date
  /** True when the feed gave no date and `publishedAt` is only "when we saw it". */
  publishedAtEstimated?: boolean
  snippet: string
}

const TRACKING_PARAM = /^(utm_|fbclid|gclid|mc_|ref$|ref_src|igshid|si$|oc$|amp)/i

export function canonicaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key)
    }

    const out = parsed.toString()
    return out.endsWith('/') ? out.slice(0, -1) : out
  } catch {
    return url
  }
}

/**
 * Reduces a headline to a comparison key so the same wire story syndicated by
 * five outlets collapses to one entry. The suffix pattern is deliberately
 * narrow (2-30 chars after a dash, no further dashes) so it strips " — Reuters"
 * without eating a real em-dash clause.
 */
export function normaliseTitle(title: string): string {
  return title
    .replace(/\s+[—–|-]\s+[^—–|-]{2,30}$/u, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function dedupe(items: RawItem[]): RawItem[] {
  const seenUrl = new Set<string>()
  const seenTitle = new Set<string>()
  const out: RawItem[] = []

  for (const item of items) {
    const url = canonicaliseUrl(item.link)
    const title = normaliseTitle(item.title)
    if (!url || !title) continue
    if (seenUrl.has(url) || seenTitle.has(title)) continue

    seenUrl.add(url)
    seenTitle.add(title)
    out.push(item)
  }

  return out
}
