import { sectorById, themeById } from './taxonomy'

export interface FeedSpec {
  url: string
  kind: 'ticker' | 'topic' | 'publisher'
  hint?: string
}

/** Region-appropriate market wires, keyed by the exchange registry's `region`. */
const PUBLISHERS: Record<string, string[]> = {
  us: [
    'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  ],
  in: [
    'https://www.livemint.com/rss/markets',
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'https://www.business-standard.com/rss/markets-106.rss',
  ],
  uk: ['https://www.cnbc.com/id/19794221/device/rss/rss.html'],
  eu: ['https://www.cnbc.com/id/19794221/device/rss/rss.html'],
  jp: ['https://www.cnbc.com/id/19832390/device/rss/rss.html'],
  hk: ['https://www.cnbc.com/id/19832390/device/rss/rss.html'],
  au: ['https://www.cnbc.com/id/19794221/device/rss/rss.html'],
  ca: ['https://www.cnbc.com/id/100003114/device/rss/rss.html'],
}

const LOCALES: Record<string, string> = {
  in: 'hl=en-IN&gl=IN&ceid=IN:en',
  uk: 'hl=en-GB&gl=GB&ceid=GB:en',
  au: 'hl=en-AU&gl=AU&ceid=AU:en',
  ca: 'hl=en-CA&gl=CA&ceid=CA:en',
}

function googleNews(query: string, region: string): string {
  const locale = LOCALES[region] ?? 'hl=en-US&gl=US&ceid=US:en'
  // `when:1d` keeps the feed to the last day, which is the window we summarise.
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&${locale}`
}

/**
 * Turns a profile into the set of feeds worth fetching. Per-dimension caps keep
 * a maximalist profile from issuing eighty requests every morning.
 */
export function buildFeedUrls(
  profile: { tickers?: string[]; sectors?: string[]; themes?: string[] },
  regions: string[] = ['us'],
): FeedSpec[] {
  const specs: FeedSpec[] = []
  const primary = regions[0] ?? 'us'

  for (const ticker of (profile.tickers ?? []).slice(0, 12)) {
    specs.push({
      url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
      kind: 'ticker',
      hint: ticker,
    })
    specs.push({ url: googleNews(`${ticker} stock`, primary), kind: 'ticker', hint: ticker })
  }

  for (const id of (profile.sectors ?? []).slice(0, 8)) {
    const entry = sectorById.get(id)
    if (entry) specs.push({ url: googleNews(`${entry.label} stocks`, primary), kind: 'topic', hint: id })
  }

  for (const id of (profile.themes ?? []).slice(0, 6)) {
    const entry = themeById.get(id)
    if (entry) specs.push({ url: googleNews(entry.label, primary), kind: 'topic', hint: id })
  }

  for (const region of new Set(regions)) {
    for (const url of PUBLISHERS[region] ?? []) specs.push({ url, kind: 'publisher' })
  }

  // Two feeds can coincide across dimensions; fetch each URL only once.
  const seen = new Set<string>()
  return specs.filter((spec) => (seen.has(spec.url) ? false : (seen.add(spec.url), true)))
}
