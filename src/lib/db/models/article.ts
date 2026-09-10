import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose'

export const ARTICLE_TTL_SECONDS = 60 * 60 * 24 * 14

/**
 * Articles are shared across users, so N users following the same exchange
 * cost one fetch rather than N.
 */
const articleSchema = new Schema({
  url: { type: String, required: true, unique: true },
  canonicalUrl: { type: String, required: true, index: true },
  title: { type: String, required: true },
  source: { type: String, required: true },
  publishedAt: { type: Date, required: true, index: true },
  snippet: { type: String, default: '' },
  matchedTickers: { type: [String], default: [] },
  matchedSectors: { type: [String], default: [] },
  relevance: { type: Number, default: 0 },
  /** `expires` creates the TTL index that self-prunes the collection. */
  fetchedAt: { type: Date, default: () => new Date(), expires: ARTICLE_TTL_SECONDS },
})

export type ArticleDoc = InferSchemaType<typeof articleSchema> & { _id: Types.ObjectId }

export const ArticleModel = (models.Article as Model<ArticleDoc>) ?? model<ArticleDoc>('Article', articleSchema)
