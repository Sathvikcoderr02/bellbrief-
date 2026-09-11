import { describe, expect, it } from 'vitest'
import { CLAIM_CLASSES, claimMix, corroborationDepth } from '../claimMix'

const claim = (agreement: string, sources: number[] = [0]) => ({ agreement, sources })

describe('claimMix', () => {
  it('keeps the documented class order regardless of input order', () => {
    const mix = claimMix([claim('discarded'), claim('corroborated'), claim('disputed')])
    expect(mix.map((slice) => slice.agreement)).toEqual([...CLAIM_CLASSES])
  })

  it('counts each class and reports its share of the whole', () => {
    const mix = claimMix([
      claim('corroborated'),
      claim('corroborated'),
      claim('disputed'),
      claim('discarded'),
    ])
    const by = Object.fromEntries(mix.map((slice) => [slice.agreement, slice]))
    expect(by.corroborated.count).toBe(2)
    expect(by.corroborated.share).toBeCloseTo(0.5)
    expect(by.disputed.share).toBeCloseTo(0.25)
    expect(by['single-source'].count).toBe(0)
  })

  it('shares sum to one so the bar always fills', () => {
    const mix = claimMix([claim('corroborated'), claim('disputed'), claim('single-source')])
    expect(mix.reduce((total, slice) => total + slice.share, 0)).toBeCloseTo(1)
  })

  it('returns every class at zero for an empty ledger, with no NaN share', () => {
    const mix = claimMix([])
    expect(mix).toHaveLength(4)
    for (const slice of mix) {
      expect(slice.count).toBe(0)
      expect(slice.share).toBe(0)
    }
  })

  it('ignores an agreement value outside the documented set', () => {
    const mix = claimMix([claim('corroborated'), claim('who-knows')])
    expect(mix.reduce((total, slice) => total + slice.count, 0)).toBe(1)
  })
})

describe('corroborationDepth', () => {
  it('buckets kept claims by how many distinct sources back them', () => {
    const depth = corroborationDepth([
      claim('corroborated', [0, 1, 2]),
      claim('corroborated', [0, 1]),
      claim('single-source', [3]),
      claim('disputed', [0, 4]),
    ])
    expect(depth).toEqual([
      { label: '1 source', count: 1 },
      { label: '2 sources', count: 2 },
      { label: '3+ sources', count: 1 },
    ])
  })

  it('excludes discarded claims, whose sources were rejected', () => {
    const depth = corroborationDepth([claim('discarded', [0, 1]), claim('corroborated', [0, 1])])
    expect(depth.find((bucket) => bucket.label === '2 sources')!.count).toBe(1)
  })

  it('counts a repeated index once, since depth means distinct sources', () => {
    const depth = corroborationDepth([claim('corroborated', [2, 2, 2])])
    expect(depth.find((bucket) => bucket.label === '1 source')!.count).toBe(1)
  })

  it('returns all buckets at zero for an empty ledger', () => {
    expect(corroborationDepth([]).every((bucket) => bucket.count === 0)).toBe(true)
  })
})
