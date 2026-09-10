import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  DIGEST_LEAD_MINUTES,
  digestInstantFor,
  getExchange,
  isDue,
  isTradingDay,
  missedWindows,
  nextSessionOpen,
} from '..'

const nasdaq = getExchange('NASDAQ')
const nse = getExchange('NSE')
const at = (iso: string) => new Date(iso)

describe('getExchange', () => {
  it('throws on an unknown code rather than guessing', () => {
    expect(() => getExchange('MOONEX')).toThrow(/unknown exchange/i)
  })
})

describe('nextSessionOpen', () => {
  it('returns the same-day open when now is before it', () => {
    const { sessionDate, openInstant } = nextSessionOpen(nasdaq, at('2026-09-10T04:00:00Z'))
    expect(sessionDate).toBe('2026-09-10')
    expect(openInstant.toISOString()).toBe('2026-09-10T13:30:00.000Z') // 09:30 EDT
  })

  it('rolls to the next trading day once the open has passed', () => {
    expect(nextSessionOpen(nasdaq, at('2026-09-10T20:00:00Z')).sessionDate).toBe('2026-09-11')
  })

  it('skips the weekend', () => {
    // Friday 2026-09-11 after the close -> Monday 2026-09-14
    expect(nextSessionOpen(nasdaq, at('2026-09-11T21:00:00Z')).sessionDate).toBe('2026-09-14')
  })

  it('skips a listed holiday', () => {
    // 2027-01-01 is a Friday and a holiday -> Monday 2027-01-04
    expect(nextSessionOpen(nasdaq, at('2026-12-31T23:00:00Z')).sessionDate).toBe('2027-01-04')
  })
})

describe('DST correctness', () => {
  it('uses EST (UTC-5) in January', () => {
    expect(nextSessionOpen(nasdaq, at('2027-01-05T04:00:00Z')).openInstant.toISOString())
      .toBe('2027-01-05T14:30:00.000Z')
  })

  it('uses EDT (UTC-4) in July', () => {
    expect(nextSessionOpen(nasdaq, at('2026-07-07T04:00:00Z')).openInstant.toISOString())
      .toBe('2026-07-07T13:30:00.000Z')
  })

  it('keeps IST fixed year round because India has no DST', () => {
    expect(nextSessionOpen(nse, at('2027-01-05T00:00:00Z')).openInstant.toISOString())
      .toBe('2027-01-05T03:45:00.000Z') // 09:15 IST
    expect(nextSessionOpen(nse, at('2026-07-07T00:00:00Z')).openInstant.toISOString())
      .toBe('2026-07-07T03:45:00.000Z')
  })

  it('produces a different UTC instant for the same local open across the DST boundary', () => {
    const winter = nextSessionOpen(nasdaq, at('2027-01-05T04:00:00Z')).openInstant.getUTCHours()
    const summer = nextSessionOpen(nasdaq, at('2026-07-07T04:00:00Z')).openInstant.getUTCHours()
    expect(winter).not.toBe(summer)
  })
})

describe('digestInstantFor', () => {
  it('is exactly the lead time before the open', () => {
    const { openInstant } = nextSessionOpen(nasdaq, at('2026-09-10T04:00:00Z'))
    const digest = digestInstantFor(nasdaq, '2026-09-10')
    expect(openInstant.getTime() - digest.getTime()).toBe(DIGEST_LEAD_MINUTES * 60_000)
    expect(digest.toISOString()).toBe('2026-09-10T12:30:00.000Z') // 08:30 EDT
  })

  it('is one instant worldwide, rendered differently per viewer timezone', () => {
    // This is the governing rule: the trigger is anchored to the exchange,
    // the clock face belongs to the viewer.
    const instant = digestInstantFor(nasdaq, '2026-09-10')
    expect(DateTime.fromJSDate(instant).setZone('America/New_York').toFormat('HH:mm')).toBe('08:30')
    expect(DateTime.fromJSDate(instant).setZone('Europe/Berlin').toFormat('HH:mm')).toBe('14:30')
    expect(DateTime.fromJSDate(instant).setZone('Asia/Kolkata').toFormat('HH:mm')).toBe('18:00')
    expect(DateTime.fromJSDate(instant).setZone('Australia/Sydney').toFormat('HH:mm')).toBe('22:30')
  })

  it('places the NSE brief at 08:15 IST', () => {
    expect(digestInstantFor(nse, '2026-09-10').toISOString()).toBe('2026-09-10T02:45:00.000Z')
  })
})

describe('isTradingDay', () => {
  it('is false on a Saturday', () => expect(isTradingDay(nasdaq, '2026-09-12')).toBe(false))
  it('is false on a listed holiday', () => expect(isTradingDay(nasdaq, '2026-12-25')).toBe(false))
  it('is true on an ordinary Thursday', () => expect(isTradingDay(nasdaq, '2026-09-10')).toBe(true))
})

describe('isDue', () => {
  it('is due exactly at the digest instant', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:30:00Z')).due).toBe(true)
  })

  it('tolerates 90 seconds of tick jitter', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:31:30Z')).due).toBe(true)
  })

  it('is not due a minute early', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:29:00Z')).due).toBe(false)
  })

  it('is not due once the window has passed', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:33:00Z')).due).toBe(false)
  })

  it('is never due on a weekend', () => {
    expect(isDue(nasdaq, at('2026-09-12T12:30:00Z')).due).toBe(false)
  })

  it('reports the session date in the exchange timezone, not the server one', () => {
    // 02:45Z on the 10th is already 08:15 on the 10th in Mumbai.
    expect(isDue(nse, at('2026-09-10T02:45:00Z'))).toEqual({ due: true, sessionDate: '2026-09-10' })
  })
})

describe('missedWindows', () => {
  it('reports a window that passed within the lookback so a sleeping server backfills', () => {
    // NSE digest instant is 02:45Z; two hours later it is still catchable.
    expect(missedWindows(nse, at('2026-09-10T04:45:00Z'))).toContain('2026-09-10')
  })

  it('reports nothing when the window is older than the lookback', () => {
    expect(missedWindows(nse, at('2026-09-10T09:00:00Z'))).toEqual([])
  })

  it('reports nothing before the window has arrived', () => {
    expect(missedWindows(nse, at('2026-09-10T01:00:00Z'))).toEqual([])
  })
})
