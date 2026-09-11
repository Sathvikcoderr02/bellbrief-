'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/Panel'

export interface UpcomingMarket {
  code: string
  label: string
  /** IANA zone, for display alongside the exchange's own wall-clock open. */
  zone: string
  /** Opening time in the exchange's own zone, 'HH:mm'. */
  openLocal: string
  /** Absolute instant the brief is sent — 60 minutes before the bell. */
  briefIso: string
}

const pad = (value: number) => String(Math.max(0, Math.floor(value))).padStart(2, '0')

/**
 * Every value here is computed on the server from the same exchange registry
 * and session clock the scheduler runs on, then handed down as absolute
 * instants. This component only counts, so it cannot disagree with the product
 * about when a market opens or when a brief lands.
 */
export function LandingCountdown({ markets }: { markets: UpcomingMarket[] }) {
  // Null until mounted: a time-dependent value rendered on the server would
  // mismatch on hydration.
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Panel className="p-4 sm:p-5">
      <p className="bb-label mb-3 sm:mb-4">Next briefs &middot; one hour before each bell</p>

      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {markets.map((market) => {
          const remaining = now === null ? null : new Date(market.briefIso).getTime() - now
          const hh = remaining === null ? '--' : pad(remaining / 3_600_000)
          const mm = remaining === null ? '--' : pad((remaining % 3_600_000) / 60_000)
          const ss = remaining === null ? '--' : pad((remaining % 60_000) / 1_000)

          return (
            <div key={market.code} className="rounded-lg bg-bb-panel-2 px-3.5 py-3 sm:px-4 sm:py-3.5">
              <p className="bb-num text-[11px] text-bb-muted">{market.code}</p>
              <p className="bb-num mt-1.5 text-lg text-bb-accent sm:text-xl" suppressHydrationWarning>
                {hh}:{mm}:
                {/* Re-keying remounts the span, so its entrance animation
                    replays on each tick without a presence wrapper. */}
                <motion.span
                  key={ss}
                  initial={{ opacity: 0.35, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="inline-block"
                >
                  {ss}
                </motion.span>
              </p>
              <p className="mt-1 text-[11px] leading-tight text-bb-faint">
                opens {market.openLocal} {market.zone}
              </p>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
