import type { Agreement, DigestClaim, NarrativeSentence, Sentiment } from '@/lib/db/models'

export interface RawDigest {
  headline: string
  overview: string
  sentiment: Sentiment
  narrative: NarrativeSentence[]
  claims: DigestClaim[]
}

/** Above this share of dropped sentences the brief is no longer trustworthy prose. */
const DEGRADED_DROP_RATIO = 0.4

/**
 * The guarantee behind "summaries with proofs".
 *
 * Prompting a model for citations yields plausible-looking citations, not
 * correct ones — models routinely cite sources that do not exist. So every
 * index the model returned is resolved against the article list that was
 * actually fetched, and anything unresolvable is removed before storage.
 * A sentence we cannot prove is a sentence the reader never sees.
 */
export function validateCitations(raw: RawDigest, articleCount: number) {
  const isValidIndex = (index: unknown): index is number =>
    typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < articleCount

  let droppedSentences = 0
  const narrative: NarrativeSentence[] = []

  for (const sentence of raw.narrative ?? []) {
    const citations = [...new Set((sentence.citations ?? []).filter(isValidIndex))]
    if (citations.length === 0) {
      droppedSentences++
      continue
    }
    narrative.push({ text: sentence.text, citations })
  }

  const claims: DigestClaim[] = (raw.claims ?? []).map((claim) => {
    const sources = [...new Set((claim.sources ?? []).filter(isValidIndex))]

    let agreement: Agreement = claim.agreement
    if (sources.length === 0) {
      // Nothing backs it, whatever the model asserted.
      agreement = 'discarded'
    } else if (agreement === 'corroborated' && sources.length < 2) {
      // "Corroborated" means two or more independent sources, by definition.
      agreement = 'single-source'
    }

    return {
      claim: claim.claim,
      sources,
      agreement,
      confidence: Math.min(1, Math.max(0, Number(claim.confidence) || 0)),
      note: claim.note,
    }
  })

  const total = (raw.narrative ?? []).length
  const degraded = total > 0 && droppedSentences / total > DEGRADED_DROP_RATIO

  return {
    digest: {
      headline: raw.headline ?? '',
      overview: raw.overview ?? '',
      sentiment: raw.sentiment ?? 'mixed',
      narrative,
      claims,
    } satisfies RawDigest,
    droppedSentences,
    degraded,
  }
}
