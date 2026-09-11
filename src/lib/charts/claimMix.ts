import type { Agreement } from '@/lib/db/models'

/**
 * Fixed order, and it is load-bearing rather than cosmetic: it runs strongest
 * evidence to weakest, and it keeps the lime and amber fills apart. Putting
 * them adjacent fails deuteranopia separation in dark mode (ΔE 5.9 against a
 * floor of 6), which the grey between them resolves.
 */
export const CLAIM_CLASSES = [
  'corroborated',
  'single-source',
  'disputed',
  'discarded',
] as const satisfies readonly Agreement[]

export type ClaimClass = (typeof CLAIM_CLASSES)[number]

export interface ClaimMixSlice {
  agreement: ClaimClass
  count: number
  /** Fraction of the whole ledger, 0 when the ledger is empty. */
  share: number
}

const isClaimClass = (value: string): value is ClaimClass =>
  (CLAIM_CLASSES as readonly string[]).includes(value)

/** Counts a ledger into the four classes, in the documented order. */
export function claimMix(claims: readonly { agreement: string }[]): ClaimMixSlice[] {
  const counts = new Map<ClaimClass, number>(CLAIM_CLASSES.map((name) => [name, 0]))

  for (const claim of claims) {
    // An unrecognised value is dropped rather than bucketed: a mystery class
    // would silently distort every share on the bar.
    if (isClaimClass(claim.agreement)) {
      counts.set(claim.agreement, counts.get(claim.agreement)! + 1)
    }
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)

  return CLAIM_CLASSES.map((agreement) => {
    const count = counts.get(agreement)!
    return { agreement, count, share: total === 0 ? 0 : count / total }
  })
}

export interface DepthBucket {
  label: '1 source' | '2 sources' | '3+ sources'
  count: number
}

/**
 * How many distinct sources back each kept claim. Unlike `agreement` and
 * `confidence` — both assigned by the model — this is countable: the indexes
 * are validated against the fetched article set before storage.
 *
 * Discarded claims are excluded: their sources were rejected, so counting them
 * would credit evidence the brief explicitly threw away.
 */
export function corroborationDepth(
  claims: readonly { agreement: string; sources: readonly number[] }[],
): DepthBucket[] {
  const buckets: DepthBucket[] = [
    { label: '1 source', count: 0 },
    { label: '2 sources', count: 0 },
    { label: '3+ sources', count: 0 },
  ]

  for (const claim of claims) {
    if (claim.agreement === 'discarded') continue
    const distinct = new Set(claim.sources).size
    if (distinct <= 0) continue
    buckets[Math.min(distinct, 3) - 1].count++
  }

  return buckets
}
