import { describe, expect, it } from 'vitest'
import { canonicaliseUrl, dedupe, normaliseTitle, type RawItem } from '../normalise'

describe('canonicaliseUrl', () => {
  it('strips tracking parameters and the fragment', () => {
    expect(canonicaliseUrl('https://reuters.com/a/b?utm_source=x&utm_medium=y&id=7#top'))
      .toBe('https://reuters.com/a/b?id=7')
  })

  it('drops a trailing slash and lowercases the host', () => {
    expect(canonicaliseUrl('https://Reuters.COM/a/b/')).toBe('https://reuters.com/a/b')
  })

  it('drops a www prefix so the same story from two shapes collapses', () => {
    expect(canonicaliseUrl('https://www.reuters.com/a')).toBe(canonicaliseUrl('https://reuters.com/a'))
  })

  it('returns the input unchanged when it is not a URL', () => {
    expect(canonicaliseUrl('not a url')).toBe('not a url')
  })
})

describe('normaliseTitle', () => {
  it('removes a trailing publisher suffix and punctuation', () => {
    expect(normaliseTitle('Infosys cuts guidance — Reuters')).toBe('infosys cuts guidance')
  })

  it('collapses whitespace and case', () => {
    expect(normaliseTitle('  Infosys   CUTS  Guidance!  ')).toBe('infosys cuts guidance')
  })

  it('keeps a long title with a dash that is not a publisher suffix', () => {
    expect(normaliseTitle('Oil rises — the biggest single-day move since the pandemic began in 2020'))
      .toContain('biggest single')
  })
})

const item = (title: string, link: string): RawItem => ({
  title, link, source: 's', publishedAt: new Date('2026-09-10T06:00:00Z'), snippet: '',
})

describe('dedupe', () => {
  it('collapses the same story published under different tracking URLs', () => {
    expect(dedupe([
      item('Infosys cuts guidance', 'https://x.com/a?utm_source=g'),
      item('Infosys cuts guidance', 'https://x.com/a'),
    ])).toHaveLength(1)
  })

  it('collapses the same wire story from different outlets by title', () => {
    expect(dedupe([
      item('Infosys cuts FY guidance', 'https://reuters.com/a'),
      item('Infosys cuts FY guidance!', 'https://mint.com/b'),
    ])).toHaveLength(1)
  })

  it('keeps genuinely different stories', () => {
    expect(dedupe([
      item('Infosys cuts guidance', 'https://a.com/1'),
      item('TCS wins a deal', 'https://b.com/2'),
    ])).toHaveLength(2)
  })

  it('keeps the first occurrence, which is the highest-ranked feed', () => {
    const out = dedupe([
      item('Infosys cuts guidance', 'https://reuters.com/first'),
      item('Infosys cuts guidance', 'https://aggregator.com/second'),
    ])
    expect(out[0].link).toBe('https://reuters.com/first')
  })

  it('drops items with an empty title', () => {
    expect(dedupe([item('', 'https://a.com/1')])).toHaveLength(0)
  })
})
