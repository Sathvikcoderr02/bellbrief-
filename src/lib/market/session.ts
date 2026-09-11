import { DateTime } from 'luxon'
import { DIGEST_LEAD_MINUTES, openInstantFor, type Exchange } from '@/lib/markets'
import type { IntradaySeries, PriceBar } from './yahoo'

export interface SessionSlice {
  symbol: string
  name: string
  currency: string
  zone: string
  sessionDate: string
  /** Bars belonging to that one session, in order. */
  bars: PriceBar[]
  /** Last close of the previous session — what the overnight gap is measured from. */
  previousClose: number
  openIso: string
  /** When the brief for this session was, or would have been, sent. */
  briefIso: string
  /** Move from the previous close to this session's first print, in percent. */
  gapPercent: number
  /** Move from the previous close to the latest print, in percent. */
  changePercent: number
}

const sessionDateOf = (bar: PriceBar, zone: string) =>
  DateTime.fromISO(bar.t, { zone }).toFormat('yyyy-MM-dd')

/**
 * The most recent complete-enough session in a series, with the previous close
 * it gapped from.
 *
 * This is what makes the chart say something about the product: the gap between
 * the previous close and the first print of the session is the overnight news
 * being priced in — and the brief lands an hour before that print.
 *
 * Returns null rather than guessing when the series holds only one session, so
 * there is no previous close to measure a gap against.
 */
export function sliceLatestSession(
  series: IntradaySeries,
  exchange: Exchange,
): SessionSlice | null {
  const zone = exchange.timeZone
  if (series.bars.length === 0) return null

  const latest = sessionDateOf(series.bars[series.bars.length - 1], zone)
  const bars = series.bars.filter((bar) => sessionDateOf(bar, zone) === latest)
  const earlier = series.bars.filter((bar) => sessionDateOf(bar, zone) < latest)

  if (bars.length === 0 || earlier.length === 0) return null

  const previousClose = earlier[earlier.length - 1].c
  if (!previousClose) return null

  const openInstant = openInstantFor(exchange, latest)

  return {
    symbol: series.symbol,
    name: series.name,
    currency: series.currency,
    zone,
    sessionDate: latest,
    bars,
    previousClose,
    openIso: openInstant.toISOString(),
    briefIso: new Date(openInstant.getTime() - DIGEST_LEAD_MINUTES * 60_000).toISOString(),
    gapPercent: ((bars[0].o - previousClose) / previousClose) * 100,
    changePercent: ((bars[bars.length - 1].c - previousClose) / previousClose) * 100,
  }
}
