import { describe, expect, it } from 'vitest'
import { parseEnv } from '../env'

const base = {
  MONGODB_URI: 'mongodb+srv://u:p@h/bellbrief',
  GEMINI_API_KEY: 'k',
  JWT_SECRET: 'x'.repeat(32),
  CRON_SECRET: 'y'.repeat(24),
  APP_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  it('defaults SCHEDULER_ENABLED to false when unset', () => {
    expect(parseEnv(base).SCHEDULER_ENABLED).toBe(false)
  })

  it('coerces SCHEDULER_ENABLED="true" to boolean true', () => {
    expect(parseEnv({ ...base, SCHEDULER_ENABLED: 'true' }).SCHEDULER_ENABLED).toBe(true)
  })

  it('throws a named error when JWT_SECRET is too short', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/)
  })

  it('rejects a MONGODB_URI whose database is not bellbrief', () => {
    expect(() => parseEnv({ ...base, MONGODB_URI: 'mongodb+srv://u:p@h/other' })).toThrow(/bellbrief/)
  })

  it('accepts a MONGODB_URI with query parameters after the database name', () => {
    expect(parseEnv({ ...base, MONGODB_URI: 'mongodb+srv://u:p@h/bellbrief?retryWrites=true' }).MONGODB_URI)
      .toContain('bellbrief')
  })

  it('defaults MAIL_FROM when unset', () => {
    expect(parseEnv(base).MAIL_FROM).toContain('@')
  })

  it('treats an empty RESEND_API_KEY as absent so the file driver is chosen', () => {
    expect(parseEnv({ ...base, RESEND_API_KEY: '' }).RESEND_API_KEY).toBeUndefined()
  })
})
