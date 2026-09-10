import { NextResponse } from 'next/server'
import { getEnv } from '@/lib/env'
import { runNow, tick } from '@/lib/scheduler'

export const maxDuration = 300

/**
 * External trigger for the digest job: used by Vercel Cron or any scheduler in
 * a serverless deployment, and by scripts/trigger-digest.mjs during testing.
 */
export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${getEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const exchange = url.searchParams.get('exchange')

  try {
    const result = exchange
      ? { forced: await runNow(exchange) }
      : await tick(new Date(), { catchUp: url.searchParams.get('catchUp') === 'true' })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
