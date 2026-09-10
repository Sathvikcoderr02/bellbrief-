'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/Panel'

interface Market {
  code: string
  city: string
  zone: string
  open: string
}

const MARKETS: Market[] = [
  { code: 'NASDAQ', city: 'New York', zone: 'America/New_York', open: '09:30' },
  { code: 'NSE', city: 'Mumbai', zone: 'Asia/Kolkata', open: '09:15' },
  { code: 'LSE', city: 'London', zone: 'Europe/London', open: '08:00' },
]

/**
 * Milliseconds until the next occurrence of a local wall-clock time in an
 * arbitrary IANA zone. Computed by comparing that zone's clock against itself,
 * so the viewer's own offset never enters the arithmetic.
 */
function msUntilNextOpen(zone: string, open: string): number {
  const [hour, minute] = open.split(':').map(Number)
  const nowInZone = new Date(new Date().toLocaleString('en-US', { timeZone: zone }))
  const target = new Date(nowInZone)
  target.setHours(hour, minute, 0, 0)
  if (target <= nowInZone) target.setDate(target.getDate() + 1)
  return target.getTime() - nowInZone.getTime()
}

const pad = (value: number) => String(Math.floor(value)).padStart(2, '0')

function format(ms: number): string {
  return `${pad(ms / 3_600_000)}:${pad((ms % 3_600_000) / 60_000)}:${pad((ms % 60_000) / 1_000)}`
}

export function LandingCountdown() {
  // Null until mounted: any time-dependent value rendered on the server would
  // mismatch on hydration.
  const [remaining, setRemaining] = useState<number[] | null>(null)

  useEffect(() => {
    const update = () => setRemaining(MARKETS.map((m) => msUntilNextOpen(m.zone, m.open)))
    update()
    const timer = setInterval(update, 1_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Panel className="p-5">
      <p className="bb-label mb-4">Next opens &middot; your brief lands 60 minutes earlier</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {MARKETS.map((market, index) => (
          <div key={market.code} className="rounded-lg bg-bb-panel-2 px-4 py-3.5">
            <p className="text-[11px] text-bb-muted">
              {market.city} &middot; {market.code}
            </p>
            <p className="bb-num mt-1.5 text-xl text-bb-accent" suppressHydrationWarning>
              {remaining ? format(remaining[index]) : '--:--:--'}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
