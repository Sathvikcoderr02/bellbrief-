import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose'

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    /** IANA zone, detected in the browser at registration. Display only. */
    timeZone: { type: String, required: true, default: 'UTC' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId }

// The `models.X ?? model(...)` guard is required: re-registering a model on
// Next's hot reload throws OverwriteModelError.
export const UserModel = (models.User as Model<UserDoc>) ?? model<UserDoc>('User', userSchema)
