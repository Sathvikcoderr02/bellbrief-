import { connectToDatabase } from '@/lib/db/connect'
import { ArticleModel, DigestModel, ProfileModel, UserModel } from '@/lib/db/models'
import { digestInstantFor, getExchange } from '@/lib/markets'
import { collectArticles, type CollectedArticle } from '@/lib/news'
import { summarise as summariseWithGemini } from '@/lib/ai'
import { sendDigestEmail } from '@/lib/mail'

/** Injection points, so the orchestrator is testable without network or model. */
export interface DigestDeps {
  collect?: typeof collectArticles
  summarise?: typeof summariseWithGemini
  sendEmail?: typeof sendDigestEmail
}

export interface GenerateDigestResult {
  digestId: string
  status: string
  created: boolean
}

export async function generateDigest(input: {
  userId: string
  exchange: string
  sessionDate: string
  deps?: DigestDeps
}): Promise<GenerateDigestResult> {
  const { userId, exchange, sessionDate } = input
  const collect = input.deps?.collect ?? collectArticles
  const summarise = input.deps?.summarise ?? summariseWithGemini
  const sendEmail = input.deps?.sendEmail ?? sendDigestEmail

  await connectToDatabase()

  // First idempotency check. The unique index is the real guarantee, but this
  // avoids paying for a Gemini call before hitting it.
  const existing = await DigestModel.findOne({ userId, exchange, sessionDate }).lean()
  if (existing) {
    return { digestId: String(existing._id), status: existing.status, created: false }
  }

  const [user, profile] = await Promise.all([
    UserModel.findById(userId).lean(),
    ProfileModel.findOne({ userId }).lean(),
  ])
  if (!user) throw new Error(`No user ${userId}`)
  if (!profile) throw new Error(`No profile for user ${userId}`)

  const exchangeInfo = getExchange(exchange)
  const digestInstant = digestInstantFor(exchangeInfo, sessionDate)
  const since = new Date(digestInstant.getTime() - 24 * 3_600_000)

  const articles: CollectedArticle[] = await collect(
    {
      tickers: profile.tickers,
      sectors: profile.sectors,
      themes: profile.themes,
      exchanges: [exchange],
    },
    { since },
  )

  const result = await summarise(
    articles,
    {
      experienceLevel: profile.experienceLevel,
      tickers: profile.tickers,
      sectors: profile.sectors,
      themes: profile.themes,
      exchanges: [exchange],
      riskAppetite: profile.riskAppetite,
      horizon: profile.horizon,
    },
    { context: { digestInstant, sessionDate, openLocal: exchangeInfo.openLocal } },
  )

  // Persist articles for reuse across users, then build the index -> article map
  // the digest renders its citations from.
  const articleRefs = await Promise.all(
    articles.map(async (article, index) => {
      let articleId: unknown
      try {
        const doc = await ArticleModel.findOneAndUpdate(
          { url: article.url },
          { $set: { ...article, fetchedAt: new Date() } },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).lean()
        articleId = doc?._id
      } catch {
        // A duplicate-key race between two users is harmless: the digest keeps
        // its own embedded copy regardless.
      }
      return {
        index,
        articleId,
        url: article.url,
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
      }
    }),
  )

  let created
  try {
    created = await DigestModel.create({
      userId,
      exchange,
      sessionDate,
      digestInstant,
      status: result.status,
      headline: result.digest.headline,
      overview: result.digest.overview,
      narrative: result.digest.narrative,
      claims: result.digest.claims,
      sentiment: result.digest.sentiment,
      articles: articleRefs,
      model: result.model,
      promptVersion: result.promptVersion,
      tokensUsed: result.tokensUsed,
      droppedSentences: result.droppedSentences,
      emailStatus: 'pending',
    })
  } catch (error) {
    // Lost a race with a concurrent run: the unique index did its job.
    const raced = await DigestModel.findOne({ userId, exchange, sessionDate }).lean()
    if (raced) return { digestId: String(raced._id), status: raced.status, created: false }
    throw error
  }

  const mail = await sendEmail(
    { email: user.email, name: user.name, timeZone: user.timeZone, emailOptIn: profile.emailOptIn },
    {
      _id: String(created._id),
      status: created.status,
      headline: created.headline,
      overview: created.overview,
      // Mongoose subdocuments type optional fields as `string | null`, while the
      // mail layer works in plain `string | undefined`. Normalise at the seam
      // rather than loosening the interface for everyone downstream.
      narrative: created.narrative.map((sentence) => ({
        text: sentence.text,
        citations: [...sentence.citations],
      })),
      claims: created.claims.map((claim) => ({
        claim: claim.claim,
        sources: [...claim.sources],
        agreement: claim.agreement,
        confidence: claim.confidence,
        note: claim.note ?? undefined,
      })),
      articles: created.articles.map((article) => ({
        index: article.index,
        articleId: article.articleId ?? undefined,
        url: article.url,
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
      })),
      sentiment: created.sentiment,
      sessionDate,
    },
    { exchange },
  )

  created.emailStatus = mail.status
  created.emailError = mail.error
  await created.save()

  return { digestId: String(created._id), status: created.status, created: true }
}
