import { z } from 'zod'

/** One OHLC bar. `t` is an absolute instant so the client can localise it. */
export interface PriceBar {
  t: string
  o: number
  h: number
  l: number
  c: number
}

export interface IntradaySeries {
  symbol: string
  name: string
  currency: string
  /** The exchange's own IANA zone, as reported by the source. */
  zone: string
  bars: PriceBar[]
}

/**
 * Yahoo's chart endpoint is not a documented API, so the response is validated
 * rather than trusted: a shape change should fail loudly here instead of
 * putting undefined prices on a chart. Quote arrays carry nulls for gaps and
 * halts, hence the nullable numbers.
 */
const responseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            symbol: z.string(),
            currency: z.string().optional(),
            exchangeTimezoneName: z.string().optional(),
            shortName: z.string().optional(),
            longName: z.string().optional(),
          }),
          timestamp: z.array(z.number()).optional(),
          indicators: z.object({
            quote: z.array(
              z.object({
                open: z.array(z.number().nullable()).optional(),
                high: z.array(z.number().nullable()).optional(),
                low: z.array(z.number().nullable()).optional(),
                close: z.array(z.number().nullable()).optional(),
              }),
            ),
          }),
        }),
      )
      .min(1),
  }),
})

export type Fetcher = (url: string) => Promise<unknown>

const defaultFetcher: Fetcher = async (url) => {
  const response = await fetch(url, {
    // Yahoo returns 403 to an unidentified client.
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Bellbrief/1.0)' },
    next: { revalidate: 900 },
  })
  if (!response.ok) throw new Error(`Yahoo responded ${response.status}`)
  return response.json()
}

export async function fetchIntraday(
  symbol: string,
  opts: { range?: string; interval?: string; fetcher?: Fetcher } = {},
): Promise<IntradaySeries> {
  const range = opts.range ?? '5d'
  const interval = opts.interval ?? '15m'
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}`

  const parsed = responseSchema.safeParse(await (opts.fetcher ?? defaultFetcher)(url))
  if (!parsed.success) throw new Error(`Unexpected Yahoo payload for ${symbol}`)

  const result = parsed.data.chart.result[0]
  const quote = result.indicators.quote[0]
  const stamps = result.timestamp ?? []

  const bars: PriceBar[] = []
  for (let i = 0; i < stamps.length; i++) {
    const o = quote.open?.[i]
    const h = quote.high?.[i]
    const l = quote.low?.[i]
    const c = quote.close?.[i]
    // A bar missing any leg cannot be drawn, so it is dropped rather than
    // filled in — an invented candle is worse than a gap.
    if (o == null || h == null || l == null || c == null) continue
    bars.push({ t: new Date(stamps[i] * 1_000).toISOString(), o, h, l, c })
  }

  if (bars.length === 0) throw new Error(`No usable bars for ${symbol}`)

  return {
    symbol: result.meta.symbol,
    name: result.meta.shortName ?? result.meta.longName ?? result.meta.symbol,
    currency: result.meta.currency ?? '',
    zone: result.meta.exchangeTimezoneName ?? 'UTC',
    bars,
  }
}
