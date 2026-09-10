import { Schema, model, models, type InferSchemaType, type Model, type Types } from 'mongoose'

/**
 * One document per (exchange, session). The unique index on `key` is the lock
 * that makes the minute-tick scheduler safe to run in more than one process.
 */
const jobRunSchema = new Schema({
  key: { type: String, required: true, unique: true },
  exchange: { type: String, required: true },
  sessionDate: { type: String, required: true },
  startedAt: { type: Date, default: () => new Date() },
  finishedAt: { type: Date },
  usersProcessed: { type: Number, default: 0 },
  succeeded: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  error: { type: String },
})

export type JobRunDoc = InferSchemaType<typeof jobRunSchema> & { _id: Types.ObjectId }

export const JobRunModel = (models.JobRun as Model<JobRunDoc>) ?? model<JobRunDoc>('JobRun', jobRunSchema)
