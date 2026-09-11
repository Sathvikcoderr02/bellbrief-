/**
 * Forces the T-60 job immediately, bypassing the clock, so the pipeline can be
 * exercised without waiting for the real pre-market window.
 *
 *   node --env-file=.env scripts/trigger-digest.mjs NSE
 */
const exchange = process.argv[2] ?? 'NASDAQ'
const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

const response = await fetch(`${appUrl}/api/cron/run?exchange=${encodeURIComponent(exchange)}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
})

console.log(response.status, JSON.stringify(await response.json(), null, 2))
