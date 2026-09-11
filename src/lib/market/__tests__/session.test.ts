import { describe, expect, it } from 'vitest'
import { getExchange } from '@/lib/markets'
import { sliceLatestSession } from '../session'
import type { IntradaySeries } from '../yahoo'

const nse = getExchange('NSE')

/** 09:15 IST on the given date is 03:45Z; bars every 15 minutes after that. */
const bar = (date: string, hhmmZ: string, close: number) => ({
  t: `${date}T${hhmmZ}:00.000Z`,
  o: close - 1,
  h: close + 2,
  l: close - 2,
  c: close,
})

const series = (bars: IntradaySeries['bars']): IntradaySeries => ({
  symbol: '^NSEI',
  name: 'NIFTY 50',
  currency: 'INR',
  zone: 'Asia/Kolkata',
  bars,
})

describe('sliceLatestSession', () => {
  it('keeps only the most recent session and measures the gap from the prior close', () => {
    const slice = sliceLatestSession(
      series([
        bar('2026-09-10', '03:45', 100),
        bar('2026-09-10', '09:45', 110), // previous session's last print
        bar('2026-09-11', '03:45', 120),
        bar('2026-09-11', '04:00', 125),
      ]),
      nse,
    )!

    expect(slice.sessionDate).toBe('2026-09-11')
    expect(slice.bars).toHaveLength(2)
    expect(slice.previousClose).toBe(110)
    // First print of the session opened at 119 against a 110 close.
    expect(slice.gapPercent).toBeCloseTo(((119 - 110) / 110) * 100, 5)
    expect(slice.changePercent).toBeCloseTo(((125 - 110) / 110) * 100, 5)
  })

  it('reports the session open and the brief an hour before it', () => {
    const slice = sliceLatestSession(
      series([bar('2026-09-10', '09:45', 110), bar('2026-09-11', '03:45', 120)]),
      nse,
    )!
    // NSE opens 09:15 Asia/Kolkata = 03:45Z.
    expect(slice.openIso).toBe('2026-09-11T03:45:00.000Z')
    expect(Date.parse(slice.openIso) - Date.parse(slice.briefIso)).toBe(60 * 60_000)
  })

  it('returns null with only one session, since no gap can be measured', () => {
    expect(sliceLatestSession(series([bar('2026-09-11', '03:45', 120)]), nse)).toBeNull()
  })

  it('returns null for an empty series', () => {
    expect(sliceLatestSession(series([]), nse)).toBeNull()
  })

  it('groups sessions in the exchange zone, not UTC', () => {
    // 23:30Z on the 10th is 05:00 IST on the 11th — the same Indian session as
    // a bar at 04:00Z on the 11th, though a UTC split would separate them.
    const slice = sliceLatestSession(
      series([bar('2026-09-09', '09:45', 90), bar('2026-09-10', '23:30', 100), bar('2026-09-11', '04:00', 105)]),
      nse,
    )!
    expect(slice.sessionDate).toBe('2026-09-11')
    expect(slice.bars).toHaveLength(2)
  })
})
