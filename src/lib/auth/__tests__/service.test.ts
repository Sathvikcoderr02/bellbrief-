import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ getEnv: () => ({ JWT_SECRET: 'z'.repeat(32) }) }))
vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))

const { loginUser, registerUser } = await import('../service')
const { ProfileModel, UserModel } = await import('@/lib/db/models')

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

describe('registerUser', () => {
  it('creates a user and an empty, incomplete profile', async () => {
    const { userId } = await registerUser({
      email: 'a@b.com', password: 'longenough1', name: 'A', timeZone: 'Asia/Kolkata',
    })
    expect(userId).toBeTruthy()

    const user = await UserModel.findById(userId).lean()
    expect(user!.timeZone).toBe('Asia/Kolkata')
    expect(user!.passwordHash).not.toContain('longenough1')

    const profile = await ProfileModel.findOne({ userId }).lean()
    expect(profile).not.toBeNull()
    expect(profile!.completedAt).toBeUndefined()
  })

  it('rejects a duplicate email case-insensitively', async () => {
    await expect(
      registerUser({ email: 'A@B.com', password: 'longenough1', name: 'A', timeZone: 'UTC' }),
    ).rejects.toThrow(/already registered/i)
  })
})

describe('loginUser', () => {
  it('accepts the right password and stamps lastLoginAt', async () => {
    const { userId } = await loginUser({ email: 'a@b.com', password: 'longenough1' })
    expect(userId).toBeTruthy()
    expect((await UserModel.findById(userId).lean())!.lastLoginAt).toBeInstanceOf(Date)
  })

  it('accepts a differently-cased email', async () => {
    await expect(loginUser({ email: '  A@B.COM ', password: 'longenough1' })).resolves.toBeTruthy()
  })

  it('gives an identical error for a wrong password and an unknown email', async () => {
    // Distinguishable errors would let an attacker enumerate registered emails.
    const wrongPassword = await loginUser({ email: 'a@b.com', password: 'nope' }).catch((e) => e.message)
    const unknownEmail = await loginUser({ email: 'ghost@b.com', password: 'nope' }).catch((e) => e.message)
    expect(wrongPassword).toBe(unknownEmail)
  })
})
