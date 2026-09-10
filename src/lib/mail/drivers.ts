import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Resend } from 'resend'
import type { Env } from '@/lib/env'

export interface MailMessage {
  to: string
  from: string
  subject: string
  html: string
  text: string
}

export interface MailDriver {
  name: string
  send(message: MailMessage): Promise<void>
}

/** Writes the rendered email to .mail/ so it can be previewed with no provider. */
export const fileDriver: MailDriver = {
  name: 'file',
  async send(message) {
    const dir = path.join(process.cwd(), '.mail')
    await mkdir(dir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeRecipient = message.to.replace(/[^a-z0-9]/gi, '_')
    const base = path.join(dir, `${stamp}-${safeRecipient}`)

    await writeFile(`${base}.html`, message.html, 'utf8')
    await writeFile(`${base}.txt`, `To: ${message.to}\nFrom: ${message.from}\nSubject: ${message.subject}\n\n${message.text}`, 'utf8')
  },
}

export function resendDriver(apiKey: string): MailDriver {
  const client = new Resend(apiKey)
  return {
    name: 'resend',
    async send(message) {
      const { error } = await client.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
      // The Resend SDK reports failures in the payload rather than by throwing.
      if (error) throw new Error(`${error.name ?? 'resend_error'}: ${error.message}`)
    },
  }
}

export function selectDriver(env: Pick<Env, 'RESEND_API_KEY' | 'MAIL_FROM'>): MailDriver {
  return env.RESEND_API_KEY ? resendDriver(env.RESEND_API_KEY) : fileDriver
}
