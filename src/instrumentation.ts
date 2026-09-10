/** Next runs `register` once per server process, which is where the scheduler belongs. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { getEnv } = await import('@/lib/env')
  if (!getEnv().SCHEDULER_ENABLED) {
    console.log('[bellbrief] scheduler disabled (SCHEDULER_ENABLED is not "true")')
    return
  }

  const { startScheduler } = await import('@/lib/scheduler/start')
  startScheduler()
}
