/**
 * Next runs `register` once per server process.
 *
 * This deliberately imports neither the scheduler nor the database. Next
 * compiles instrumentation for the edge runtime as well as Node, and webpack
 * statically follows even a dynamic import — which pulls mongoose (and
 * MongoDB's optional encryption dependencies) into a bundle that has no Node
 * built-ins. node-cron has the same problem: it needs `child_process`.
 *
 * So this file holds only a timer that drives the app's own secured cron
 * endpoint, which runs in the Node runtime where mongoose is external. All the
 * scheduling logic lives in lib/scheduler and is unit-tested there; this is
 * just the trigger, and it is the same trigger Vercel Cron would use.
 *
 * A plain interval is sufficient rather than a cron expression: the due window
 * is two minutes wide and claiming a run is idempotent, so timer drift cannot
 * cause a missed or duplicated brief.
 */
const MINUTE = 60_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  if (process.env.SCHEDULER_ENABLED !== 'true') {
    console.log('[bellbrief] scheduler disabled (SCHEDULER_ENABLED is not "true")')
    return
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[bellbrief] CRON_SECRET is not set — scheduler not started')
    return
  }

  const trigger = async (catchUp = false) => {
    try {
      const response = await fetch(`${appUrl}/api/cron/run${catchUp ? '?catchUp=true' : ''}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
      })
      const body = (await response.json()) as { runs?: unknown[]; error?: string }
      if (body.error) {
        console.error('[bellbrief] job error:', body.error)
      } else if (body.runs && body.runs.length > 0) {
        console.log('[bellbrief]', catchUp ? 'catch-up:' : 'tick:', JSON.stringify(body.runs))
      }
    } catch (error) {
      console.error('[bellbrief] trigger failed:', (error as Error).message)
    }
  }

  // Align the first tick to the top of the next minute, then run every minute.
  const msToNextMinute = MINUTE - (Date.now() % MINUTE)
  setTimeout(() => {
    void trigger()
    setInterval(() => void trigger(), MINUTE).unref?.()
  }, msToNextMinute).unref?.()

  // Give the server a moment to start listening, then backfill any window the
  // process slept through.
  setTimeout(() => void trigger(true), 8_000).unref?.()

  console.log('[bellbrief] scheduler started — checking every minute')
}
