import { connectToDatabase } from '@/lib/db/connect'
import { JobRunModel, ProfileModel } from '@/lib/db/models'
import { generateDigest } from '@/lib/digest'
import { EXCHANGES, getExchange, isDue, missedWindows } from '@/lib/markets'

export interface RunReport {
  exchange: string
  sessionDate: string
  usersProcessed: number
  succeeded: number
  failed: number
  skipped?: true
}

export interface TickReport {
  due: string[]
  runs: RunReport[]
}

type Generate = typeof generateDigest

const USER_CONCURRENCY = 4

/**
 * Generates the brief for every subscriber of one exchange session, exactly once.
 *
 * The `jobRuns` unique index is the lock: whichever process inserts the key
 * first owns the run, and every other caller returns immediately. This is what
 * makes the minute tick safe to run in more than one process, and safe to
 * combine with the boot-time catch-up.
 */
export async function runFor(
  exchange: string,
  sessionDate: string,
  opts: { generate?: Generate } = {},
): Promise<RunReport> {
  const generate = opts.generate ?? generateDigest
  await connectToDatabase()

  const key = `${exchange}:${sessionDate}`

  try {
    await JobRunModel.create({ key, exchange, sessionDate })
  } catch {
    return { exchange, sessionDate, usersProcessed: 0, succeeded: 0, failed: 0, skipped: true }
  }

  const profiles = await ProfileModel.find({
    exchanges: exchange,
    completedAt: { $ne: null },
  })
    .select('userId')
    .lean()

  let succeeded = 0
  let failed = 0
  let cursor = 0

  const workers = Array.from({ length: Math.min(USER_CONCURRENCY, profiles.length) }, async () => {
    while (cursor < profiles.length) {
      const profile = profiles[cursor++]
      try {
        await generate({ userId: String(profile.userId), exchange, sessionDate })
        succeeded++
      } catch (error) {
        // One user's failure must never stop the others' briefs.
        failed++
        console.error(`[bellbrief] digest failed for ${profile.userId} ${key}: ${(error as Error).message}`)
      }
    }
  })

  await Promise.all(workers)

  await JobRunModel.updateOne(
    { key },
    { $set: { finishedAt: new Date(), usersProcessed: profiles.length, succeeded, failed } },
  )

  return { exchange, sessionDate, usersProcessed: profiles.length, succeeded, failed }
}

export async function tick(
  now: Date,
  opts: { generate?: Generate; catchUp?: boolean } = {},
): Promise<TickReport> {
  const due: string[] = []
  const runs: RunReport[] = []

  for (const exchange of EXCHANGES) {
    const sessions = new Set<string>()

    const { due: dueNow, sessionDate } = isDue(exchange, now)
    if (dueNow) sessions.add(sessionDate)

    if (opts.catchUp) {
      for (const missed of missedWindows(exchange, now)) sessions.add(missed)
    }

    for (const session of sessions) {
      due.push(exchange.code)
      runs.push(await runFor(exchange.code, session, opts))
    }
  }

  return { due, runs }
}

/** Forces the current session's run for one exchange, ignoring the clock. */
export async function runNow(exchangeCode: string, opts: { generate?: Generate } = {}): Promise<RunReport> {
  const exchange = getExchange(exchangeCode)
  const { sessionDate } = isDue(exchange, new Date())
  return runFor(exchange.code, sessionDate, opts)
}
