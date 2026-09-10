import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose'

export type DigestStatus = 'ready' | 'quiet' | 'degraded' | 'failed'
export type Sentiment = 'risk-on' | 'risk-off' | 'mixed' | 'quiet'
export type Agreement = 'corroborated' | 'disputed' | 'single-source' | 'discarded'
export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface NarrativeSentence {
  text: string
  /** Indexes into the digest's own `articles` array. Validated before storage. */
  citations: number[]
}

export interface DigestClaim {
  claim: string
  sources: number[]
  agreement: Agreement
  confidence: number
  note?: string
}

export interface DigestArticleRef {
  index: number
  articleId?: Types.ObjectId
  url: string
  title: string
  source: string
  publishedAt: Date
}

const digestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    exchange: { type: String, required: true },
    /** 'YYYY-MM-DD' in the *exchange's* timezone, never the server's. */
    sessionDate: { type: String, required: true },
    digestInstant: { type: Date },
    generatedAt: { type: Date, default: () => new Date() },
    status: { type: String, enum: ['ready', 'quiet', 'degraded', 'failed'], required: true },
    headline: { type: String, required: true },
    overview: { type: String, default: '' },
    narrative: {
      type: [{ _id: false, text: { type: String, required: true }, citations: { type: [Number], default: [] } }],
      default: [],
    },
    claims: {
      type: [
        {
          _id: false,
          claim: { type: String, required: true },
          sources: { type: [Number], default: [] },
          agreement: { type: String, enum: ['corroborated', 'disputed', 'single-source', 'discarded'], required: true },
          confidence: { type: Number, default: 0 },
          note: { type: String },
        },
      ],
      default: [],
    },
    sentiment: { type: String, enum: ['risk-on', 'risk-off', 'mixed', 'quiet'], default: 'mixed' },
    /**
     * Index -> article map, embedded so a digest renders its own citations with
     * no join and stays readable after the article TTL prunes the sources.
     */
    articles: {
      type: [
        {
          _id: false,
          index: { type: Number, required: true },
          articleId: { type: Schema.Types.ObjectId },
          url: { type: String, required: true },
          title: { type: String, required: true },
          source: { type: String, required: true },
          publishedAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    model: { type: String },
    promptVersion: { type: String },
    tokensUsed: { type: Number },
    /** How many sentences were deleted for citing an article that did not exist. */
    droppedSentences: { type: Number, default: 0 },
    emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    emailError: { type: String },
  },
  { timestamps: true },
)

// Second layer of idempotency: even a repeated job run cannot create two briefs.
digestSchema.index({ userId: 1, exchange: 1, sessionDate: 1 }, { unique: true })

export type DigestDoc = InferSchemaType<typeof digestSchema> & { _id: Types.ObjectId }

export const DigestModel = (models.Digest as Model<DigestDoc>) ?? model<DigestDoc>('Digest', digestSchema)
