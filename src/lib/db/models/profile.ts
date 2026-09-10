import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type RiskAppetite = 'conservative' | 'balanced' | 'aggressive'
export type Horizon = 'intraday' | 'swing' | 'long-term'

/**
 * Kept separate from `users` so Phase 2 can add holdings and cost basis
 * without touching anything in the auth path.
 */
const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    exchanges: { type: [String], default: [] },
    sectors: { type: [String], default: [] },
    tickers: { type: [String], default: [] },
    themes: { type: [String], default: [] },
    experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    riskAppetite: { type: String, enum: ['conservative', 'balanced', 'aggressive'], default: 'balanced' },
    horizon: { type: String, enum: ['intraday', 'swing', 'long-term'], default: 'long-term' },
    emailOptIn: { type: Boolean, default: true },
    /** Unset until onboarding finishes. The scheduler ignores profiles without it. */
    completedAt: { type: Date },
  },
  { timestamps: true },
)

export type ProfileDoc = InferSchemaType<typeof profileSchema> & { _id: Types.ObjectId }

export const ProfileModel = (models.Profile as Model<ProfileDoc>) ?? model<ProfileDoc>('Profile', profileSchema)
