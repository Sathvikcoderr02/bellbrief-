import { DateTime } from 'luxon'
import type { Exchange } from './exchanges'

/** The brief lands this many minutes before the opening bell. */
export const DIGEST_LEAD_MINUTES = 60

/**
 * A tick landing anywhere in this window counts as due. Wider than one minute
 * so cron jitter or a brief process pause cannot skip a session; combined with
 * the job lock, a wider window costs nothing.
 */
const DUE_WINDOW_MINUTES = 2

/** How far back a restarting process looks for a window it slept through. */
const CATCH_UP_HOURS = 3

function openOn(exchange: Exchange, sessionDate: string): DateTime {
  const [hour, minute] = exchange.openLocal.split(':').map(Number)
  return DateTime.fromISO(sessionDate, { zone: exchange.timeZone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  })
}

export function isTradingDay(exchange: Exchange, sessionDate: string): boolean {
  const day = DateTime.fromISO(sessionDate, { zone: exchange.timeZone })
  if (!day.isValid) return false
  return exchange.tradingDays.includes(day.weekday) && !exchange.holidays.includes(sessionDate)
}

export function nextSessionOpen(
  exchange: Exchange,
  from: Date,
): { sessionDate: string; openInstant: Date } {
  let cursor = DateTime.fromJSDate(from, { zone: exchange.timeZone })

  for (let i = 0; i < 400; i++) {
    const sessionDate = cursor.toFormat('yyyy-MM-dd')
    if (isTradingDay(exchange, sessionDate)) {
      const open = openOn(exchange, sessionDate)
      if (open.toMillis() > from.getTime()) {
        return { sessionDate, openInstant: open.toJSDate() }
      }
    }
    cursor = cursor.plus({ days: 1 }).startOf('day')
  }

  throw new Error(`No trading day found for ${exchange.code} within 400 days`)
}

/** The opening bell for one named session, as an absolute instant. */
export function openInstantFor(exchange: Exchange, sessionDate: string): Date {
  return openOn(exchange, sessionDate).toJSDate()
}

export function digestInstantFor(exchange: Exchange, sessionDate: string): Date {
  return openOn(exchange, sessionDate).minus({ minutes: DIGEST_LEAD_MINUTES }).toJSDate()
}

export function currentSessionWindow(exchange: Exchange, now: Date) {
  // The session date is resolved in the *exchange's* zone, so a server in UTC
  // and a server in Sydney agree on which session is being processed.
  const sessionDate = DateTime.fromJSDate(now, { zone: exchange.timeZone }).toFormat('yyyy-MM-dd')
  return {
    sessionDate,
    openInstant: openOn(exchange, sessionDate).toJSDate(),
    digestInstant: digestInstantFor(exchange, sessionDate),
  }
}

export function isDue(
  exchange: Exchange,
  now: Date,
  windowMinutes = DUE_WINDOW_MINUTES,
): { due: boolean; sessionDate: string } {
  const { sessionDate, digestInstant } = currentSessionWindow(exchange, now)
  if (!isTradingDay(exchange, sessionDate)) return { due: false, sessionDate }

  const elapsed = now.getTime() - digestInstant.getTime()
  return { due: elapsed >= 0 && elapsed < windowMinutes * 60_000, sessionDate }
}

/**
 * Sessions whose digest instant has already passed but is recent enough to
 * still be worth generating — so a laptop asleep at 08:30 still delivers the
 * morning's brief when it wakes up.
 */
export function missedWindows(exchange: Exchange, now: Date, lookbackHours = CATCH_UP_HOURS): string[] {
  const found: string[] = []

  for (const dayOffset of [0, -1]) {
    const sessionDate = DateTime.fromJSDate(now, { zone: exchange.timeZone })
      .plus({ days: dayOffset })
      .toFormat('yyyy-MM-dd')

    if (!isTradingDay(exchange, sessionDate)) continue

    const elapsed = now.getTime() - digestInstantFor(exchange, sessionDate).getTime()
    if (elapsed > 0 && elapsed <= lookbackHours * 3_600_000) found.push(sessionDate)
  }

  return found
}
