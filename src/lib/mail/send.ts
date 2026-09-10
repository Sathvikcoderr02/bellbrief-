import { getEnv } from '@/lib/env'
import { getExchange } from '@/lib/markets'
import { selectDriver, type MailDriver } from './drivers'
import { renderDigestEmail, type DigestEmailDigest } from './template'

export interface MailRecipient {
  email: string
  name: string
  timeZone: string
  emailOptIn: boolean
}

export async function sendDigestEmail(
  user: MailRecipient,
  digest: DigestEmailDigest,
  opts: { exchange: string; driver?: MailDriver; retries?: number },
): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }> {
  if (!user.emailOptIn) return { status: 'skipped' }

  const env = getEnv()
  const driver = opts.driver ?? selectDriver(env)

  const exchange = (() => {
    try {
      return getExchange(opts.exchange)
    } catch {
      return null
    }
  })()

  const { subject, html, text } = renderDigestEmail({
    name: user.name,
    exchange: opts.exchange,
    sessionDate: digest.sessionDate ?? '',
    openLocal: exchange?.openLocal ?? '',
    timeZone: exchange?.timeZone ?? user.timeZone,
    appUrl: env.APP_URL,
    digest,
  })

  const retries = opts.retries ?? 1
  let lastError = 'unknown error'

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await driver.send({ to: user.email, from: env.MAIL_FROM, subject, html, text })
      return { status: 'sent' }
    } catch (error) {
      lastError = (error as Error).message
    }
  }

  // A failed email never fails the digest — it is still waiting in the app.
  return { status: 'failed', error: lastError }
}
