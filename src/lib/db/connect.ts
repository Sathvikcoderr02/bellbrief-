import mongoose, { type Mongoose } from 'mongoose'
import { getEnv } from '@/lib/env'

/**
 * Next's dev server re-evaluates modules on hot reload. Without a global cache
 * every edit opens a fresh pool and the Atlas connection limit is exhausted
 * within a few minutes of editing.
 */
declare global {
  // eslint-disable-next-line no-var
  var __bellbriefMongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null } | undefined
}

const cache = globalThis.__bellbriefMongoose ?? { conn: null, promise: null }
globalThis.__bellbriefMongoose = cache

export async function connectToDatabase(uri?: string): Promise<Mongoose> {
  if (cache.conn) return cache.conn

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri ?? getEnv().MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        maxPoolSize: 10,
      })
      .catch((error) => {
        // Clear the cached rejection so the next request can retry rather than
        // replaying the same failure forever.
        cache.promise = null
        throw error
      })
  }

  cache.conn = await cache.promise
  return cache.conn
}
