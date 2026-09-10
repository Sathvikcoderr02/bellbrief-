import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))

const { runFor, tick } = await import('../tick')
const { JobRunModel, ProfileModel, UserModel } = await import('@/lib/db/models')

let mem: MongoMemoryServer

// NSE opens 09:15 IST, so the brief fires at 08:15 IST = 02:45Z.
const NSE_DIGEST_INSTANT = new Date('2026-09-10T02:45:00Z')

const ok = () => vi.fn().mockResolvedValue({ digestId: 'd1', status: 'ready', created: true })

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
  await Promise.all([UserModel.deleteMany({}), ProfileModel.deleteMany({}), JobRunModel.deleteMany({})])
  const user = await UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'A', timeZone: 'Asia/Kolkata' })
  await ProfileModel.create({ userId: user._id, exchanges: ['NSE'], tickers: ['INFY'], completedAt: new Date() })
})

describe('tick', () => {
  it('generates a digest for each subscriber of a due exchange', async () => {
    const generate = ok()
    const report = await tick(NSE_DIGEST_INSTANT, { generate })
    expect(report.due).toContain('NSE')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0][0]).toMatchObject({ exchange: 'NSE', sessionDate: '2026-09-10' })
  })

  it('does nothing when no exchange is due', async () => {
    const generate = ok()
    const report = await tick(new Date('2026-09-10T01:00:00Z'), { generate })
    expect(report.due).toEqual([])
    expect(generate).not.toHaveBeenCalled()
  })

  it('IS IDEMPOTENT: two ticks inside the same window generate exactly once', async () => {
    const generate = ok()
    await tick(NSE_DIGEST_INSTANT, { generate })
    await tick(new Date(NSE_DIGEST_INSTANT.getTime() + 30_000), { generate })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(await JobRunModel.countDocuments({ key: 'NSE:2026-09-10' })).toBe(1)
  })

  it('is idempotent even for simultaneous ticks racing each other', async () => {
    const generate = ok()
    await Promise.all([
      tick(NSE_DIGEST_INSTANT, { generate }),
      tick(NSE_DIGEST_INSTANT, { generate }),
      tick(NSE_DIGEST_INSTANT, { generate }),
    ])
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('does not run on a weekend', async () => {
    const generate = ok()
    await tick(new Date('2026-09-12T02:45:00Z'), { generate }) // Saturday
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not run on an exchange holiday', async () => {
    const generate = ok()
    // 2026-12-25 is in the NSE holiday list.
    await tick(new Date('2026-12-25T02:45:00Z'), { generate })
    expect(generate).not.toHaveBeenCalled()
  })

  it('ignores users who have not completed onboarding', async () => {
    await ProfileModel.updateMany({}, { $unset: { completedAt: 1 } })
    const generate = ok()
    await tick(NSE_DIGEST_INSTANT, { generate })
    expect(generate).not.toHaveBeenCalled()
  })

  it('ignores users subscribed to a different exchange', async () => {
    await ProfileModel.updateMany({}, { $set: { exchanges: ['NASDAQ'] } })
    const generate = ok()
    await tick(NSE_DIGEST_INSTANT, { generate })
    expect(generate).not.toHaveBeenCalled()
  })

  it('records failures per user and keeps going for the rest', async () => {
    const other = await UserModel.create({ email: 'b@b.com', passwordHash: 'h', name: 'B', timeZone: 'UTC' })
    await ProfileModel.create({ userId: other._id, exchanges: ['NSE'], completedAt: new Date() })

    const generate = vi.fn()
      .mockRejectedValueOnce(new Error('gemini down'))
      .mockResolvedValueOnce({ digestId: 'd2', status: 'ready', created: true })

    const report = await tick(NSE_DIGEST_INSTANT, { generate })
    expect(report.runs[0].usersProcessed).toBe(2)
    expect(report.runs[0].succeeded).toBe(1)
    expect(report.runs[0].failed).toBe(1)

    const run = await JobRunModel.findOne({ key: 'NSE:2026-09-10' }).lean()
    expect(run!.finishedAt).toBeInstanceOf(Date)
    expect(run!.succeeded).toBe(1)
    expect(run!.failed).toBe(1)
  })

  it('serves several exchanges that are due at the same instant', async () => {
    const user = await UserModel.create({ email: 'c@b.com', passwordHash: 'h', name: 'C', timeZone: 'UTC' })
    await ProfileModel.create({ userId: user._id, exchanges: ['BSE'], completedAt: new Date() })

    const generate = ok()
    // BSE shares NSE's timezone and open, so both are due at 02:45Z.
    const report = await tick(NSE_DIGEST_INSTANT, { generate })
    expect(report.due).toEqual(expect.arrayContaining(['NSE', 'BSE']))
    expect(generate).toHaveBeenCalledTimes(2)
  })

  describe('catch-up', () => {
    it('backfills a window the process slept through', async () => {
      const generate = ok()
      const twoHoursLate = new Date(NSE_DIGEST_INSTANT.getTime() + 2 * 3_600_000)
      const report = await tick(twoHoursLate, { generate, catchUp: true })
      expect(report.due).toContain('NSE')
      expect(generate).toHaveBeenCalledTimes(1)
    })

    it('does not backfill without the catchUp flag', async () => {
      const generate = ok()
      await tick(new Date(NSE_DIGEST_INSTANT.getTime() + 2 * 3_600_000), { generate })
      expect(generate).not.toHaveBeenCalled()
    })

    it('does not double-generate when catch-up follows a completed run', async () => {
      const generate = ok()
      await tick(NSE_DIGEST_INSTANT, { generate })
      await tick(new Date(NSE_DIGEST_INSTANT.getTime() + 2 * 3_600_000), { generate, catchUp: true })
      expect(generate).toHaveBeenCalledTimes(1)
    })
  })
})

describe('runFor', () => {
  it('reports skipped when the session has already been claimed', async () => {
    const generate = ok()
    await runFor('NSE', '2026-09-10', { generate })
    const second = await runFor('NSE', '2026-09-10', { generate })
    expect(second.skipped).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('reports zero users without error when nobody follows the exchange', async () => {
    const report = await runFor('TSX', '2026-09-10', { generate: ok() })
    expect(report.usersProcessed).toBe(0)
    expect(report.failed).toBe(0)
  })
})
