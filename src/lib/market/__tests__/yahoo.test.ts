import { describe, expect, it } from 'vitest'
import { fetchIntraday } from '../yahoo'

const payload = (over: Record<string, unknown> = {}) => ({
  chart: {
    result: [
      {
        meta: {
          symbol: '^NSEI',
          currency: 'INR',
          exchangeTimezoneName: 'Asia/Kolkata',
          shortName: 'NIFTY 50',
        },
        timestamp: [1_757_000_000, 1_757_000_900, 1_757_001_800],
        indicators: {
          quote: [
            { open: [100, 101, 102], high: [103, 104, 105], low: [99, 100, 101], close: [101, 102, 103] },
          ],
        },
        ...over,
      },
    ],
  },
})

const fetcher = (body: unknown) => async () => body

describe('fetchIntraday', () => {
  it('normalises the payload into absolute-instant bars', async () => {
    const series = await fetchIntraday('^NSEI', { fetcher: fetcher(payload()) })
    expect(series.symbol).toBe('^NSEI')
    expect(series.name).toBe('NIFTY 50')
    expect(series.currency).toBe('INR')
    expect(series.zone).toBe('Asia/Kolkata')
    expect(series.bars).toHaveLength(3)
    expect(series.bars[0]).toEqual({ t: '2025-09-04T15:33:20.000Z', o: 100, h: 103, l: 99, c: 101 })
  })

  it('drops a bar missing any leg rather than inventing a candle', async () => {
    const series = await fetchIntraday('^NSEI', {
      fetcher: fetcher(
        payload({
          indicators: {
            quote: [
              { open: [100, null, 102], high: [103, 104, 105], low: [99, 100, 101], close: [101, 102, 103] },
            ],
          },
        }),
      ),
    })
    expect(series.bars).toHaveLength(2)
    expect(series.bars.map((bar) => bar.o)).toEqual([100, 102])
  })

  it('throws on an unrecognised payload instead of charting undefined', async () => {
    await expect(fetchIntraday('^NSEI', { fetcher: fetcher({ chart: { result: [] } }) })).rejects.toThrow(
      /Unexpected Yahoo payload/,
    )
  })

  it('throws when every bar is unusable', async () => {
    await expect(
      fetchIntraday('^NSEI', {
        fetcher: fetcher(
          payload({
            indicators: {
              quote: [{ open: [null], high: [null], low: [null], close: [null] }],
            },
            timestamp: [1_757_000_000],
          }),
        ),
      }),
    ).rejects.toThrow(/No usable bars/)
  })

  it('requests the symbol, range and interval it was asked for', async () => {
    let seen = ''
    await fetchIntraday('^GSPC', {
      range: '1d',
      interval: '5m',
      fetcher: async (url) => {
        seen = url
        return payload()
      },
    })
    expect(seen).toContain('%5EGSPC')
    expect(seen).toContain('range=1d')
    expect(seen).toContain('interval=5m')
  })
})
