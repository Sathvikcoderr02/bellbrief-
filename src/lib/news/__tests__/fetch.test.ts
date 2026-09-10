import { describe, expect, it } from 'vitest'
import { mapWithConcurrency, resolveSource } from '../fetch'

const GOOGLE_FEED_TITLE = '"NVDA stock when:1d" - Google News'

describe('resolveSource', () => {
  it('prefers the publisher element, which is where Google News names the outlet', () => {
    expect(resolveSource({ sourceRaw: 'The Motley Fool' }, GOOGLE_FEED_TITLE, 'https://fool.com/a'))
      .toBe('The Motley Fool')
  })

  it('handles the publisher arriving as an object with a title', () => {
    expect(resolveSource({ sourceRaw: { title: 'Reuters' } }, GOOGLE_FEED_TITLE, 'https://reuters.com/a'))
      .toBe('Reuters')
  })

  it('falls back to the hostname rather than the feed title', () => {
    // The feed title for a Google News search is the query, and for Yahoo it is
    // the ticker page. Neither is a publisher, so neither belongs on a proof chip.
    expect(resolveSource({}, GOOGLE_FEED_TITLE, 'https://www.fool.com/investing/x'))
      .toBe('fool.com')
  })

  it('never returns a search query as the attribution', () => {
    expect(resolveSource({}, GOOGLE_FEED_TITLE, 'https://reuters.com/a')).not.toContain('when:1d')
  })

  it('uses the feed title only when the link is unusable', () => {
    expect(resolveSource({}, 'Yahoo Finance', 'not-a-url')).toBe('Yahoo Finance')
  })

  it('returns unknown when nothing is available', () => {
    expect(resolveSource({}, undefined, 'not-a-url')).toBe('unknown')
  })

  it('ignores a blank publisher element', () => {
    expect(resolveSource({ sourceRaw: '   ' }, undefined, 'https://mint.com/a')).toBe('mint.com')
  })
})

describe('mapWithConcurrency', () => {
  it('preserves input order regardless of completion order', async () => {
    const out = await mapWithConcurrency([30, 10, 20, 0], 2, async (ms) => {
      await new Promise((r) => setTimeout(r, ms))
      return ms
    })
    expect(out).toEqual([30, 10, 20, 0])
  })

  it('never exceeds the concurrency limit', async () => {
    let active = 0
    let peak = 0
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
    })
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('handles an empty input', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([])
  })
})
