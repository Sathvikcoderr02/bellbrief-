import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ getEnv: () => ({ JWT_SECRET: 'z'.repeat(32) }) }))

const { signSession, verifySession } = await import('../session')
const { hashPassword, verifyPassword } = await import('../password')

describe('session tokens', () => {
  it('round-trips a user id', () => {
    expect(verifySession(signSession('abc123'))?.userId).toBe('abc123')
  })

  it('rejects a tampered token', () => {
    const token = signSession('abc123')
    expect(verifySession(`${token.slice(0, -2)}xy`)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifySession('nonsense')).toBeNull()
  })

  it('rejects an absent token', () => {
    expect(verifySession(undefined)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    // A forged token from an attacker who guessed the algorithm but not the key.
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdHRhY2tlciJ9.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
    expect(verifySession(forged)).toBeNull()
  })
})

describe('password hashing', () => {
  it('does not store the plaintext and verifies correctly', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash).not.toContain('correct')
    expect(await verifyPassword('correct horse battery', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('produces a different hash each time thanks to the salt', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('anything', 'not-a-bcrypt-hash')).toBe(false)
  })
})
