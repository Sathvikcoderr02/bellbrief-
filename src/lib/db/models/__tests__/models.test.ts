import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ArticleModel, DigestModel, JobRunModel, ProfileModel, UserModel } from '..'

let mem: MongoMemoryServer

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

describe('UserModel', () => {
  it('lowercases email and rejects duplicates', async () => {
    const user = await UserModel.create({ email: 'A@B.com', passwordHash: 'h', name: 'A', timeZone: 'UTC' })
    expect(user.email).toBe('a@b.com')
    await expect(
      UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'B', timeZone: 'UTC' }),
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('ProfileModel', () => {
  it('defaults to an empty, incomplete profile', async () => {
    const profile = await ProfileModel.create({ userId: new mongoose.Types.ObjectId() })
    expect(profile.exchanges).toEqual([])
    expect(profile.experienceLevel).toBe('intermediate')
    expect(profile.emailOptIn).toBe(true)
    expect(profile.completedAt).toBeUndefined()
  })

  it('permits only one profile per user', async () => {
    const userId = new mongoose.Types.ObjectId()
    await ProfileModel.create({ userId })
    await expect(ProfileModel.create({ userId })).rejects.toThrow(/duplicate key/)
  })
})

describe('ArticleModel', () => {
  it('permits only one article per url', async () => {
    const base = { url: 'https://x.com/a', canonicalUrl: 'https://x.com/a', title: 't', source: 's', publishedAt: new Date() }
    await ArticleModel.create(base)
    await expect(ArticleModel.create(base)).rejects.toThrow(/duplicate key/)
  })

  it('has a TTL index on fetchedAt so articles self-prune', async () => {
    const indexes = await ArticleModel.collection.indexes()
    const ttl = indexes.find((index) => 'expireAfterSeconds' in index)
    expect(ttl?.expireAfterSeconds).toBe(60 * 60 * 24 * 14)
  })
})

describe('DigestModel', () => {
  it('permits only one digest per (user, exchange, sessionDate)', async () => {
    const userId = new mongoose.Types.ObjectId()
    const base = { userId, exchange: 'NASDAQ', sessionDate: '2026-09-10', status: 'ready' as const, headline: 'h' }
    await DigestModel.create(base)
    await expect(DigestModel.create(base)).rejects.toThrow(/duplicate key/)
  })

  it('allows the same user a digest on a different exchange for the same session', async () => {
    const userId = new mongoose.Types.ObjectId()
    await DigestModel.create({ userId, exchange: 'NSE', sessionDate: '2026-09-11', status: 'ready', headline: 'h' })
    const other = await DigestModel.create({ userId, exchange: 'NASDAQ', sessionDate: '2026-09-11', status: 'ready', headline: 'h' })
    expect(other._id).toBeDefined()
  })

  it('round-trips narrative citations and claim agreement', async () => {
    const created = await DigestModel.create({
      userId: new mongoose.Types.ObjectId(),
      exchange: 'NSE',
      sessionDate: '2026-09-12',
      status: 'ready',
      headline: 'h',
      narrative: [{ text: 'Guidance was cut.', citations: [0, 2] }],
      claims: [{ claim: 'Guidance cut', sources: [0, 2], agreement: 'corroborated', confidence: 0.9 }],
      articles: [{ index: 0, url: 'https://x.com/1', title: 't', source: 'Reuters', publishedAt: new Date() }],
    })
    const found = await DigestModel.findById(created._id).lean()
    expect(found!.narrative[0].citations).toEqual([0, 2])
    expect(found!.claims[0].agreement).toBe('corroborated')
    expect(found!.emailStatus).toBe('pending')
  })

  it('rejects an unknown status', async () => {
    await expect(
      DigestModel.create({ userId: new mongoose.Types.ObjectId(), exchange: 'NSE', sessionDate: '2026-09-13', status: 'bogus', headline: 'h' }),
    ).rejects.toThrow(/validation/i)
  })
})

describe('JobRunModel', () => {
  it('permits only one run per key, which is what makes the scheduler idempotent', async () => {
    await JobRunModel.create({ key: 'NASDAQ:2026-09-10', exchange: 'NASDAQ', sessionDate: '2026-09-10' })
    await expect(
      JobRunModel.create({ key: 'NASDAQ:2026-09-10', exchange: 'NASDAQ', sessionDate: '2026-09-10' }),
    ).rejects.toThrow(/duplicate key/)
  })
})
