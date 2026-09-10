import { describe, expect, it } from 'vitest'
import type { RawItem } from '../normalise'
import { scoreArticle } from '../score'

const profile = { tickers: ['INFY'], sectors: ['technology'], themes: ['earnings'], exchanges: ['NSE'] }

const item = (title: string): RawItem => ({
  title, link: 'https://x.com/a', source: 'Reuters', publishedAt: new Date(), snippet: '',
})

describe('scoreArticle', () => {
  it('scores an exact ticker match above a sector match', () => {
    expect(scoreArticle(item('INFY cuts guidance'), profile).relevance)
      .toBeGreaterThan(scoreArticle(item('Technology stocks slip'), profile).relevance)
  })

  it('scores a sector match above a theme-only match', () => {
    expect(scoreArticle(item('Technology stocks slip'), profile).relevance)
      .toBeGreaterThan(scoreArticle(item('Earnings season begins'), profile).relevance)
  })

  it('records which ticker matched', () => {
    expect(scoreArticle(item('INFY cuts guidance'), profile).matchedTickers).toEqual(['INFY'])
  })

  it('does not match a ticker inside a longer word', () => {
    expect(scoreArticle(item('Infymatic Ltd rallies'), profile).matchedTickers).toEqual([])
  })

  it('records which sector matched', () => {
    expect(scoreArticle(item('Software stocks slip'), profile).matchedSectors).toEqual(['technology'])
  })

  it('scores an unrelated article zero', () => {
    expect(scoreArticle(item('Local bakery opens'), profile).relevance).toBe(0)
  })

  it('gives a fresh article a higher score than an old one, all else equal', () => {
    const fresh = scoreArticle({ ...item('INFY cuts guidance'), publishedAt: new Date() }, profile).relevance
    const old = scoreArticle(
      { ...item('INFY cuts guidance'), publishedAt: new Date(Date.now() - 20 * 3_600_000) },
      profile,
    ).relevance
    expect(fresh).toBeGreaterThan(old)
  })

  it('never lets recency outweigh a ticker match', () => {
    const staleTicker = scoreArticle(
      { ...item('INFY cuts guidance'), publishedAt: new Date(Date.now() - 23 * 3_600_000) },
      profile,
    ).relevance
    const freshSector = scoreArticle({ ...item('Technology stocks slip'), publishedAt: new Date() }, profile).relevance
    expect(staleTicker).toBeGreaterThan(freshSector)
  })

  it('matches the snippet as well as the title', () => {
    expect(scoreArticle({ ...item('Morning wrap'), snippet: 'INFY fell 3%' }, profile).matchedTickers)
      .toEqual(['INFY'])
  })

  it('handles a ticker containing regex metacharacters without throwing', () => {
    expect(() => scoreArticle(item('BRK.B rises'), { ...profile, tickers: ['BRK.B'] })).not.toThrow()
  })
})
