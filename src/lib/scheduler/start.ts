import cron from 'node-cron'
import { tick } from './tick'

let started = false

export function startScheduler(): void {
  if (started) return
  started = true

  // Catch up before scheduling: a laptop asleep at T-60 should still deliver
  // the morning's brief when it wakes, rather than silently skipping the day.
  tick(new Date(), { catchUp: true })
    .then((report) => {
      if (report.runs.length > 0) console.log('[bellbrief] catch-up:', JSON.stringify(report.runs))
    })
    .catch((error) => console.error('[bellbrief] catch-up failed:', (error as Error).message))

  cron.schedule('* * * * *', async () => {
    try {
      const report = await tick(new Date())
      if (report.runs.length > 0) console.log('[bellbrief] tick:', JSON.stringify(report.runs))
    } catch (error) {
      console.error('[bellbrief] tick failed:', (error as Error).message)
    }
  })

  console.log('[bellbrief] scheduler started — checking every minute')
}
