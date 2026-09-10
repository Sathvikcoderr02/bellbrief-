import { z } from 'zod'

/**
 * Every secret this app needs, validated once at first use.
 *
 * The MONGODB_URI refinement is deliberate: the supplied Atlas cluster
 * originally pointed at a database named after an abandoned product name, and
 * silently writing to the wrong database is the kind of mistake that is only
 * discovered weeks later.
 */
const schema = z.object({
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must be a mongodb:// or mongodb+srv:// URI')
    .refine((uri) => /\/bellbrief(\?|$)/.test(uri), {
      message: 'MONGODB_URI must point at the "bellbrief" database',
    }),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).default('Bellbrief <onboarding@resend.dev>'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  APP_URL: z.string().url('APP_URL must be an absolute URL'),
  SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(raw: Record<string, string | undefined>): Env {
  // An empty string in a .env file means "not configured", not "configured as empty".
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value !== ''),
  )

  const result = schema.safeParse(cleaned)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment — ${detail}`)
  }
  return result.data
}

let cached: Env | null = null

export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env as Record<string, string | undefined>)
  return cached
}
