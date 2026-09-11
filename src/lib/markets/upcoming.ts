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
  return nextBellGroups(now)
    .slice(0, limit)
    .map((group) => ({ ...group.members[0], sessionDate: group.sessionDate, openIso: group.openIso, briefIso: group.briefIso }))
}

export interface BellMember {
  code: string
  label: string
  zone: string
  openLocal: string
}

export interface BellGroup {
  /** Absolute instant every member of this group opens at. */
  openIso: string
  /** Absolute instant the brief is sent for this bell. */
  briefIso: string
  sessionDate: string
  /** Every exchange ringing at this instant, in registry order. */
  members: BellMember[]
}

/**
 * Every exchange's next open, grouped by the instant it happens, soonest first.
 *
 * Grouping rather than discarding matters for the timeline: NASDAQ, NYSE and
 * Toronto all ring together, and a reader wants to see all three named on the
 * one mark rather than have two of them silently dropped.
 */
export function nextBellGroups(now: Date = new Date()): BellGroup[] {
  const groups = new Map<number, BellGroup>()

  for (const exchange of EXCHANGES) {
    const { sessionDate, openInstant } = nextSessionOpen(exchange, now)
    const key = openInstant.getTime()

    const group =
      groups.get(key) ??
      {
        openIso: openInstant.toISOString(),
        briefIso: new Date(key - DIGEST_LEAD_MINUTES * 60_000).toISOString(),
        sessionDate,
        members: [],
      }

    group.members.push({
      code: exchange.code,
      label: exchange.label,
      zone: exchange.timeZone,
      openLocal: exchange.openLocal,
    })
    groups.set(key, group)
  }

  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group)
}
