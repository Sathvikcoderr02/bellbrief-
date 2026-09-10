import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  getEnv: () => ({ APP_URL: 'http://localhost:3000', MAIL_FROM: 'a@b.c', RESEND_API_KEY: undefined }),
}))
vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))

const { generateDigest } = await import('../generate')
const { ArticleModel, DigestModel, ProfileModel, UserModel } = await import('@/lib/db/models')

let mem: MongoMemoryServer
let userId: string

const article = (i: number) => ({
  url: `https://x.com/${i}`,
  canonicalUrl: `https://x.com/${i}`,
  title: `Story ${i}`,
  source: 'Reuters',
  publishedAt: new Date('2026-09-10T02:00:00Z'),
  snippet: 'snippet',
  matchedTickers: ['INFY'],
  matchedSectors: [],
  relevance: 100,
})

const deps = (over: Record<string, unknown> = {}) => ({
  collect: vi.fn().mockResolvedValue([article(0), article(1)]),
  summarise: vi.fn().mockResolvedValue({
    status: 'ready',
    droppedSentences: 0,
    model: 'gemini-2.5-flash',
    promptVersion: 'p1',
    tokensUsed: 6509,
    digest: {
      headline: 'IT under pressure',
      overview: 'Guidance cuts weigh.',
      sentiment: 'risk-off',
      narrative: [{ text: 'Guidance was cut.', citations: [0] }],
      claims: [{ claim: 'Guidance cut', sources: [0, 1], agreement: 'corroborated', confidence: 0.9 }],
    },
  }),
  sendEmail: vi.fn().mockResolvedValue({ status: 'sent' }),
  ...over,
})

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}), ProfileModel.deleteMany({}),
    DigestModel.deleteMany({}), ArticleModel.deleteMany({}),
  ])
  const user = await UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'A', timeZone: 'Asia/Kolkata' })
  userId = String(user._id)
  await ProfileModel.create({
    userId: user._id, exchanges: ['NSE'], tickers: ['INFY'], sectors: ['technology'],
    themes: ['earnings'], experienceLevel: 'beginner', emailOptIn: true, completedAt: new Date(),
  })
})

describe('generateDigest', () => {
  it('persists a digest whose every citation resolves to an embedded article', async () => {
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() })
    expect(out.status).toBe('ready')
    expect(out.created).toBe(true)

    const saved = await DigestModel.findById(out.digestId).lean()
    expect(saved!.articles).toHaveLength(2)
    expect(saved!.articles[0].index).toBe(0)
    for (const sentence of saved!.narrative) {
      for (const citation of sentence.citations) {
        expect(saved!.articles.some((a) => a.index === citation)).toBe(true)
      }
    }
  })

  it('stores the model, prompt version and token count for later attribution', async () => {
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() })
    const saved = await DigestModel.findById(out.digestId).lean()
    expect(saved!.model).toBe('gemini-2.5-flash')
    expect(saved!.promptVersion).toBe('p1')
    expect(saved!.tokensUsed).toBe(6509)
  })

  it('anchors digestInstant to the exchange, one hour before its open', async () => {
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() })
    const saved = await DigestModel.findById(out.digestId).lean()
    // 09:15 IST open -> 08:15 IST brief -> 02:45Z
    expect(saved!.digestInstant!.toISOString()).toBe('2026-09-10T02:45:00.000Z')
  })

  it('passes the experience level through to the summariser', async () => {
    const d = deps()
    await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect(d.summarise.mock.calls[0][1].experienceLevel).toBe('beginner')
  })

  it('asks the collector only for news since the previous 24 hours', async () => {
    const d = deps()
    await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    const since = d.collect.mock.calls[0][1].since as Date
    expect(since.toISOString()).toBe('2026-09-09T02:45:00.000Z')
  })

  it('is idempotent: a second call returns the existing digest and does not re-summarise', async () => {
    const first = deps()
    const a = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: first })

    const second = deps()
    const b = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: second })

    expect(b.digestId).toBe(a.digestId)
    expect(b.created).toBe(false)
    expect(second.summarise).not.toHaveBeenCalled()
    expect(await DigestModel.countDocuments({ userId })).toBe(1)
  })

  it('stores a quiet digest when no articles are found', async () => {
    const d = deps({
      collect: vi.fn().mockResolvedValue([]),
      summarise: vi.fn().mockResolvedValue({
        status: 'quiet', droppedSentences: 0, model: 'm', promptVersion: 'p1',
        digest: { headline: 'Quiet morning', overview: 'Nothing material.', sentiment: 'quiet', narrative: [], claims: [] },
      }),
    })
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect(out.status).toBe('quiet')
    const saved = await DigestModel.findById(out.digestId).lean()
    expect(saved!.articles).toHaveLength(0)
  })

  it('stores a degraded digest with its headlines when the model failed', async () => {
    const d = deps({
      summarise: vi.fn().mockResolvedValue({
        status: 'degraded', droppedSentences: 0, model: 'm', promptVersion: 'p1', error: '503',
        digest: { headline: 'SUMMARY UNAVAILABLE — headlines only', overview: 'o', sentiment: 'mixed', narrative: [], claims: [] },
      }),
    })
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect(out.status).toBe('degraded')
    const saved = await DigestModel.findById(out.digestId).lean()
    // The headlines must still be there for the reader to see.
    expect(saved!.articles).toHaveLength(2)
    expect(saved!.narrative).toHaveLength(0)
  })

  it('upserts fetched articles so a second user reuses them', async () => {
    await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() })
    expect(await ArticleModel.countDocuments({})).toBe(2)

    const other = await UserModel.create({ email: 'b@b.com', passwordHash: 'h', name: 'B', timeZone: 'UTC' })
    await ProfileModel.create({ userId: other._id, exchanges: ['NSE'], completedAt: new Date() })
    await generateDigest({ userId: String(other._id), exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() })

    expect(await ArticleModel.countDocuments({})).toBe(2)
  })

  it('records an email failure on the digest without failing the digest', async () => {
    const d = deps({ sendEmail: vi.fn().mockResolvedValue({ status: 'failed', error: '403 not verified' }) })
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    const saved = await DigestModel.findById(out.digestId).lean()
    expect(out.status).toBe('ready')
    expect(saved!.emailStatus).toBe('failed')
    expect(saved!.emailError).toMatch(/403/)
  })

  it('marks the email skipped when the user opted out', async () => {
    await ProfileModel.updateOne({ userId }, { $set: { emailOptIn: false } })
    const d = deps({ sendEmail: vi.fn().mockResolvedValue({ status: 'skipped' }) })
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect((await DigestModel.findById(out.digestId).lean())!.emailStatus).toBe('skipped')
  })

  it('throws a clear error when the profile is missing', async () => {
    await ProfileModel.deleteMany({})
    await expect(
      generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() }),
    ).rejects.toThrow(/profile/i)
  })

  it('throws a clear error for an unknown exchange', async () => {
    await expect(
      generateDigest({ userId, exchange: 'MOONEX', sessionDate: '2026-09-10', deps: deps() }),
    ).rejects.toThrow(/unknown exchange/i)
  })
})
