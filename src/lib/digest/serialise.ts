import type { DigestDoc } from '@/lib/db/models'
import type { DigestViewModel } from '@/components/DigestView'

/**
 * Server components may only hand plain, serialisable values to client
 * components — Mongoose documents carry ObjectIds and Dates that would throw.
 */
export function toDigestViewModel(digest: DigestDoc): DigestViewModel {
  return {
    _id: String(digest._id),
    status: digest.status as DigestViewModel['status'],
    exchange: digest.exchange,
    sessionDate: digest.sessionDate,
    headline: digest.headline,
    overview: digest.overview ?? '',
    sentiment: digest.sentiment ?? 'mixed',
    narrative: digest.narrative.map((sentence) => ({
      text: sentence.text,
      citations: [...sentence.citations],
    })),
    claims: digest.claims.map((claim) => ({
      claim: claim.claim,
      sources: [...claim.sources],
      agreement: claim.agreement,
      confidence: claim.confidence,
      note: claim.note ?? undefined,
    })),
    articles: digest.articles.map((article) => ({
      index: article.index,
      url: article.url,
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt.toISOString(),
    })),
    droppedSentences: digest.droppedSentences ?? 0,
  }
}
