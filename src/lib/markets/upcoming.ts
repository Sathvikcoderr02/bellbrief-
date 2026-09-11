import { DIGEST_LEAD_MINUTES, nextSessionOpen } from './clock'
import { EXCHANGES } from './exchanges'

export interface UpcomingBell {
  code: string
  label: string
  /** IANA zone of the exchange. */
  zone: string
  /** Opening time in the exchange's own zone, 'HH:mm'. */
  openLocal: string
  sessionDate: string
  /** Absolute instant of the opening bell. */
  openIso: string
  /** Absolute instant the brief is sent, one lead time earlier. */
  briefIso: string
}

/**
 * The next `limit` opening bells, soonest first, counting each bell once.
 *
 * Several exchanges ring together — NSE and BSE both open 09:15 Asia/Kolkata,
 * NASDAQ and NYSE both 09:30 America/New_York, and Toronto tracks New York's
 * offset exactly — so listing exchanges would show the same countdown two or
 * three times over. The key is the absolute instant, which is what a reader is
 * actually looking at, rather than the zone name.
 */
export function nextDistinctBells(limit: number, now: Date = new Date()): UpcomingBell[] {
  const seen = new Set<number>()

  return EXCHANGES.map((exchange) => ({ exchange, ...nextSessionOpen(exchange, now) }))
    .sort((a, b) => a.openInstant.getTime() - b.openInstant.getTime())
    .filter(({ openInstant }) => {
      const bell = openInstant.getTime()
      if (seen.has(bell)) return false
      seen.add(bell)
      return true
    })
    .slice(0, limit)
    .map(({ exchange, sessionDate, openInstant }) => ({
      code: exchange.code,
      label: exchange.label,
      zone: exchange.timeZone,
      openLocal: exchange.openLocal,
      sessionDate,
      openIso: openInstant.toISOString(),
      briefIso: new Date(openInstant.getTime() - DIGEST_LEAD_MINUTES * 60_000).toISOString(),
    }))
}
