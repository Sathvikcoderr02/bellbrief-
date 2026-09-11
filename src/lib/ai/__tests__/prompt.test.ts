import { describe, expect, it } from 'vitest'
import type { CollectedArticle } from '@/lib/news'
import { buildDigestPrompt, PROMPT_VERSION } from '../prompt'

const BRIEF_AT = new Date('2026-09-11T02:45:00Z')

function article(overrides: Partial<CollectedArticle> = {}): CollectedArticle {
  return {
    url: 'https://example.com/a',
    canonicalUrl: 'https://example.com/a',
    title: 'HDFC Bank posts higher quarterly profit',
    source: 'Mint',
    publishedAt: new Date('2026-09-11T00:45:00Z'), // 2h before the brief
    snippet: 'Net profit rose.',
    matchedTickers: ['HDFCBANK'],
    matchedSectors: ['banking'],
    relevance: 9,
    ...overrides,
  }
}

const profile = {
  experienceLevel: 'beginner' as const,
  tickers: ['HDFCBANK'],
  sectors: ['banking'],
  themes: ['earnings'],
  exchanges: ['NSE'],
}

const context = { digestInstant: BRIEF_AT, sessionDate: '2026-09-11', openLocal: '09:15' }

describe('buildDigestPrompt', () => {
  it('tells the model when the brief is being written', () => {
    const prompt = buildDigestPrompt([article()], profile, context)
    // Without an anchor instant the model has nothing to subtract the article
    // timestamps from, so it cannot tell overnight news from yesterday's.
    expect(prompt).toContain(BRIEF_AT.toISOString())
    expect(prompt).toContain('2026-09-11')
  })

  it('labels each article with its age at the moment of the brief', () => {
    const prompt = buildDigestPrompt(
      [
        article({ publishedAt: new Date('2026-09-11T00:45:00Z') }), // 2h
        article({ publishedAt: new Date('2026-09-10T07:45:00Z') }), // 19h
      ],
      profile,
      context,
    )
    expect(prompt).toContain('2h before this brief')
    expect(prompt).toContain('19h before this brief')
  })

  it('reports sub-hour articles in minutes rather than rounding to zero', () => {
    const prompt = buildDigestPrompt(
      [article({ publishedAt: new Date('2026-09-11T02:20:00Z') })],
      profile,
      context,
    )
    expect(prompt).toContain('25m before this brief')
  })

  it('marks an article whose timing is only an estimate', () => {
    // fetch.ts falls back to "now" when a feed omits a date. Labelling that as
    // 0m old would make the freshest-wins rule promote undated content.
    const prompt = buildDigestPrompt(
      [article({ publishedAtEstimated: true })],
      profile,
      context,
    )
    expect(prompt).toMatch(/timing unknown/i)
    expect(prompt).not.toContain('0m before this brief')
  })

  it('tells the model that unknown timing never wins a conflict', () => {
    expect(buildDigestPrompt([article()], profile, context)).toMatch(/timing unknown.*never/is)
  })

  it('states that the corpus is ordered by relevance, not by time', () => {
    // Reordering by time is not an option: validate.ts resolves citations by
    // array position, so the indexes must match the articles array exactly.
    expect(buildDigestPrompt([article()], profile, context)).toMatch(/not.*by time/i)
  })

  it('carries a recency rule covering superseded facts', () => {
    const prompt = buildDigestPrompt([article()], profile, context)
    expect(prompt).toMatch(/RECENCY/)
    expect(prompt).toMatch(/supersede/i)
  })

  it('still numbers articles from zero so citations resolve', () => {
    const prompt = buildDigestPrompt([article(), article()], profile, context)
    expect(prompt).toContain('[0]')
    expect(prompt).toContain('[1]')
    expect(prompt).toContain('Valid indexes are 0 to 1 inclusive')
  })

  it('keeps the grounding and citation rules', () => {
    const prompt = buildDigestPrompt([article()], profile, context)
    expect(prompt).toMatch(/GROUNDING/)
    expect(prompt).toMatch(/CITATION/)
    expect(prompt).toMatch(/NO ADVICE/)
  })

  it('is a new prompt version, so existing digests stay attributable', () => {
    expect(PROMPT_VERSION).not.toBe('p1')
  })
})
