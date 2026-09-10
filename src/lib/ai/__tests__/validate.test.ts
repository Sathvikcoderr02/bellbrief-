import { describe, expect, it } from 'vitest'
import { validateCitations, type RawDigest } from '../validate'

const raw = (over: Partial<RawDigest> = {}): RawDigest => ({
  headline: 'IT majors under pressure',
  overview: 'Guidance cuts weigh on IT services.',
  sentiment: 'risk-off',
  narrative: [{ text: 'Accenture cut guidance.', citations: [0] }],
  claims: [{ claim: 'Accenture cut guidance', sources: [0], agreement: 'corroborated', confidence: 0.9 }],
  ...over,
})

describe('validateCitations', () => {
  it('keeps sentences whose citations all resolve', () => {
    const out = validateCitations(raw(), 3)
    expect(out.digest.narrative).toHaveLength(1)
    expect(out.droppedSentences).toBe(0)
  })

  it('DROPS a sentence citing an article index that does not exist', () => {
    const out = validateCitations(
      raw({ narrative: [
        { text: 'Real claim.', citations: [0] },
        { text: 'Hallucinated claim.', citations: [99] },
      ] }),
      3,
    )
    expect(out.digest.narrative.map((s) => s.text)).toEqual(['Real claim.'])
    expect(out.droppedSentences).toBe(1)
  })

  it('drops a sentence with no citations at all', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Uncited assertion.', citations: [] }] }), 3)
    expect(out.digest.narrative).toHaveLength(0)
    expect(out.droppedSentences).toBe(1)
  })

  it('prunes only the invalid indexes when some resolve', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Mixed.', citations: [0, 99] }] }), 3)
    expect(out.digest.narrative[0].citations).toEqual([0])
    expect(out.droppedSentences).toBe(0)
  })

  it('rejects a negative index', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Negative.', citations: [-1] }] }), 3)
    expect(out.digest.narrative).toHaveLength(0)
  })

  it('rejects a non-integer index', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Fractional.', citations: [1.5] }] }), 3)
    expect(out.digest.narrative).toHaveLength(0)
  })

  it('rejects a string index that slipped past the schema', () => {
    const out = validateCitations(
      raw({ narrative: [{ text: 'Stringy.', citations: ['0' as unknown as number] }] }),
      3,
    )
    expect(out.digest.narrative).toHaveLength(0)
  })

  it('deduplicates repeated citations', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Repeated.', citations: [0, 0, 1] }] }), 3)
    expect(out.digest.narrative[0].citations).toEqual([0, 1])
  })

  it('demotes a claim whose every source is invalid to discarded', () => {
    const out = validateCitations(
      raw({ claims: [{ claim: 'Fabricated', sources: [42], agreement: 'corroborated', confidence: 0.9 }] }),
      3,
    )
    expect(out.digest.claims[0].agreement).toBe('discarded')
    expect(out.digest.claims[0].sources).toEqual([])
  })

  it('downgrades a claim marked corroborated but backed by only one source', () => {
    const out = validateCitations(
      raw({ claims: [{ claim: 'Only one outlet', sources: [1], agreement: 'corroborated', confidence: 0.8 }] }),
      3,
    )
    expect(out.digest.claims[0].agreement).toBe('single-source')
  })

  it('leaves a genuinely corroborated claim alone', () => {
    const out = validateCitations(
      raw({ claims: [{ claim: 'Two outlets', sources: [0, 1], agreement: 'corroborated', confidence: 0.8 }] }),
      3,
    )
    expect(out.digest.claims[0].agreement).toBe('corroborated')
  })

  it('preserves a disputed classification, which must never be smoothed over', () => {
    const out = validateCitations(
      raw({ claims: [{ claim: 'Contested', sources: [0, 1], agreement: 'disputed', confidence: 0.4, note: 'they conflict' }] }),
      3,
    )
    expect(out.digest.claims[0].agreement).toBe('disputed')
    expect(out.digest.claims[0].note).toBe('they conflict')
  })

  it('flags the digest degraded when more than 40% of sentences are dropped', () => {
    const out = validateCitations(
      raw({ narrative: [
        { text: 'ok', citations: [0] },
        { text: 'bad', citations: [99] },
        { text: 'bad', citations: [98] },
      ] }),
      3,
    )
    expect(out.degraded).toBe(true)
  })

  it('does not flag degraded when only a minority are dropped', () => {
    const out = validateCitations(
      raw({ narrative: [
        { text: 'ok', citations: [0] },
        { text: 'ok', citations: [1] },
        { text: 'ok', citations: [2] },
        { text: 'bad', citations: [99] },
      ] }),
      3,
    )
    expect(out.degraded).toBe(false)
  })

  it('clamps confidence into 0..1', () => {
    const out = validateCitations(
      raw({ claims: [
        { claim: 'high', sources: [0, 1], agreement: 'corroborated', confidence: 7 },
        { claim: 'low', sources: [0, 1], agreement: 'corroborated', confidence: -3 },
      ] }),
      3,
    )
    expect(out.digest.claims[0].confidence).toBe(1)
    expect(out.digest.claims[1].confidence).toBe(0)
  })

  it('survives a response missing narrative and claims entirely', () => {
    const out = validateCitations(
      { headline: 'h', overview: '', sentiment: 'quiet' } as unknown as RawDigest,
      3,
    )
    expect(out.digest.narrative).toEqual([])
    expect(out.digest.claims).toEqual([])
    expect(out.degraded).toBe(false)
  })

  it('drops every citation when the article list is empty', () => {
    const out = validateCitations(raw(), 0)
    expect(out.digest.narrative).toHaveLength(0)
  })
})
