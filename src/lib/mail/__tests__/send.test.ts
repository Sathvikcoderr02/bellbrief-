import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  getEnv: () => ({ APP_URL: 'http://localhost:3000', MAIL_FROM: 'Bellbrief <a@b.c>', RESEND_API_KEY: undefined }),
}))

const { selectDriver } = await import('../drivers')
const { sendDigestEmail } = await import('../send')

const digest = {
  _id: 'd1', status: 'ready', headline: 'h', overview: 'o', sentiment: 'mixed',
  narrative: [], claims: [], articles: [], sessionDate: '2026-09-10',
}

const user = { email: 'a@b.com', name: 'A', timeZone: 'UTC', emailOptIn: true }

describe('selectDriver', () => {
  it('uses the file driver when no Resend key is configured', () => {
    expect(selectDriver({ RESEND_API_KEY: undefined, MAIL_FROM: 'a@b.c' }).name).toBe('file')
  })

  it('uses the resend driver when a key is configured', () => {
    expect(selectDriver({ RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.c' }).name).toBe('resend')
  })
})

describe('sendDigestEmail', () => {
  it('sends through the injected driver with the configured from address', async () => {
    const driver = { name: 'test', send: vi.fn().mockResolvedValue(undefined) }
    const out = await sendDigestEmail(user, digest, { driver, exchange: 'NSE' })
    expect(out.status).toBe('sent')
    expect(driver.send.mock.calls[0][0]).toMatchObject({ to: 'a@b.com', from: 'Bellbrief <a@b.c>' })
  })

  it('skips without sending when the user has opted out', async () => {
    const driver = { name: 'test', send: vi.fn() }
    const out = await sendDigestEmail({ ...user, emailOptIn: false }, digest, { driver, exchange: 'NSE' })
    expect(out.status).toBe('skipped')
    expect(driver.send).not.toHaveBeenCalled()
  })

  it('reports failure without throwing when the driver rejects', async () => {
    const driver = { name: 'test', send: vi.fn().mockRejectedValue(new Error('403 domain not verified')) }
    const out = await sendDigestEmail(user, digest, { driver, exchange: 'NSE', retries: 0 })
    expect(out.status).toBe('failed')
    expect(out.error).toMatch(/403/)
  })

  it('retries once before giving up', async () => {
    const driver = { name: 'test', send: vi.fn().mockRejectedValue(new Error('network')) }
    await sendDigestEmail(user, digest, { driver, exchange: 'NSE' })
    expect(driver.send).toHaveBeenCalledTimes(2)
  })

  it('succeeds on the retry after one transient failure', async () => {
    const driver = {
      name: 'test',
      send: vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined),
    }
    expect((await sendDigestEmail(user, digest, { driver, exchange: 'NSE' })).status).toBe('sent')
  })

  it('still renders for an unknown exchange code rather than throwing', async () => {
    const driver = { name: 'test', send: vi.fn().mockResolvedValue(undefined) }
    expect((await sendDigestEmail(user, digest, { driver, exchange: 'MOONEX' })).status).toBe('sent')
  })
})
