import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const session = { userId: '' }

vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))
vi.mock('@/lib/auth/server', () => ({
  getSessionUser: async () => (session.userId ? { id: session.userId } : null),
}))

const { POST } = await import('../route')
const { ProfileModel, UserModel } = await import('@/lib/db/models')

let mem: MongoMemoryServer

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

const valid = {
  exchanges: ['NSE'],
  sectors: ['technology', 'banking'],
  tickers: ['INFY'],
  themes: ['earnings'],
  experienceLevel: 'beginner',
  riskAppetite: 'balanced',
  horizon: 'long-term',
  emailOptIn: true,
}

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ProfileModel.deleteMany({})])
  const user = await UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'A', timeZone: 'UTC' })
  session.userId = String(user._id)
  await ProfileModel.create({ userId: user._id })
})

describe('POST /api/onboarding', () => {
  it('saves the profile and stamps completedAt so the scheduler picks the user up', async () => {
    expect((await post(valid)).status).toBe(200)
    const profile = await ProfileModel.findOne({ userId: session.userId }).lean()
    expect(profile!.sectors).toEqual(['technology', 'banking'])
    expect(profile!.experienceLevel).toBe('beginner')
    expect(profile!.completedAt).toBeInstanceOf(Date)
  })

  it('requires at least one exchange', async () => {
    expect((await post({ ...valid, exchanges: [] })).status).toBe(400)
  })

  it('rejects an unsupported exchange code', async () => {
    const response = await post({ ...valid, exchanges: ['MOONEX'] })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/not supported/i)
  })

  it('requires at least two interests across sectors, tickers and themes', async () => {
    const response = await post({ ...valid, sectors: [], tickers: [], themes: [] })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/at least two interests/i)
  })

  it('accepts two interests spread across different dimensions', async () => {
    expect((await post({ ...valid, sectors: ['technology'], tickers: [], themes: ['earnings'] })).status).toBe(200)
  })

  it('uppercases and deduplicates tickers', async () => {
    await post({ ...valid, tickers: ['infy', 'INFY', ' tcs '] })
    expect((await ProfileModel.findOne({ userId: session.userId }).lean())!.tickers).toEqual(['INFY', 'TCS'])
  })

  it('rejects an unknown sector id', async () => {
    expect((await post({ ...valid, sectors: ['crypto-moon'] })).status).toBe(400)
  })

  it('rejects an unknown experience level', async () => {
    expect((await post({ ...valid, experienceLevel: 'wizard' })).status).toBe(400)
  })

  it('caps the number of exchanges', async () => {
    expect((await post({ ...valid, exchanges: ['NSE', 'BSE', 'NASDAQ', 'NYSE', 'LSE'] })).status).toBe(400)
  })

  it('rejects an unauthenticated request', async () => {
    session.userId = ''
    expect((await post(valid)).status).toBe(401)
  })

  it('rejects a malformed body without throwing', async () => {
    const response = await POST(
      new Request('http://localhost/api/onboarding', { method: 'POST', body: 'not json' }),
    )
    expect(response.status).toBe(400)
  })

  it('is re-runnable, so settings can reuse it', async () => {
    await post(valid)
    expect((await post({ ...valid, sectors: ['energy'], experienceLevel: 'advanced' })).status).toBe(200)
    const profile = await ProfileModel.findOne({ userId: session.userId }).lean()
    expect(profile!.sectors).toEqual(['energy'])
    expect(profile!.experienceLevel).toBe('advanced')
  })
})
