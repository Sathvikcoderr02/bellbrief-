'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { BellGroup } from '@/lib/markets'

/** Position on a 24-hour day-clock, as a percentage of the axis. */
function dayFraction(iso: string): number {
  const date = new Date(iso)
  return ((date.getHours() + date.getMinutes() / 60) / 24) * 100
}

const localTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

const HOUR_TICKS = [0, 6, 12, 18, 24]

interface Plotted {
  group: BellGroup
  codes: string
  openAt: number
  briefAt: number
  /** False when the bell already rang today and the next one is tomorrow. */
  aheadToday: boolean
}

/**
 * Every exchange's opening bell on one 24-hour day-clock, in the viewer's own
 * timezone, with the brief that precedes each one by an hour.
 *
 * The server cannot know the viewer's zone, so it passes absolute instants and
 * the positions are computed here after mount — which also avoids rendering a
 * time-dependent value on the server.
 *
 * Identity lives in the list rather than on the axis: five marks across a
 * shared axis cannot carry text labels without collisions, and the spec is that
 * a label which does not fit is not drawn at all rather than clipped. The axis
 * carries position; the list carries names and times, and hovering links them.
 */
export function BellTimeline({ groups }: { groups: BellGroup[] }) {
  const reduced = useReducedMotion()
  const [plotted, setPlotted] = useState<Plotted[] | null>(null)
  const [nowAt, setNowAt] = useState<number | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date().toDateString()

    setPlotted(
      groups.map((group) => ({
        group,
        codes: group.members.map((member) => member.code).join(' · '),
        openAt: dayFraction(group.openIso),
        briefAt: dayFraction(group.briefIso),
        aheadToday: new Date(group.openIso).toDateString() === today,
      })),
    )

    const tick = () => setNowAt(dayFraction(new Date().toISOString()))
    tick()
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [groups])

  return (
    <figure>
      <figcaption className="bb-label mb-5">
        Opening bells &middot; your local time &middot; brief lands one hour earlier
      </figcaption>

      {/* The axis carries marks only — no text rides it — so it stays legible
          at 375px and needs no separate mobile treatment. */}
      <div className="relative mb-6 h-20" aria-hidden>
        <div className="absolute inset-x-0 top-10 h-px bg-bb-border" />

        {HOUR_TICKS.map((hour) => (
          <div key={hour} className="absolute top-10" style={{ left: `${(hour / 24) * 100}%` }}>
            <div className="h-1.5 w-px bg-bb-border" />
            <span className="bb-num absolute left-0 top-3 -translate-x-1/2 text-[10px] text-bb-faint">
              {String(hour).padStart(2, '0')}
            </span>
          </div>
        ))}

        {nowAt !== null ? (
          <motion.div
            className="absolute top-4 h-12 w-px bg-bb-text/40"
            animate={{ left: `${nowAt}%` }}
            transition={{ duration: reduced ? 0 : 0.8, ease: 'easeOut' }}
          >
            <span className="bb-label absolute -top-4 left-0 -translate-x-1/2 whitespace-nowrap text-bb-muted">
              NOW
            </span>
          </motion.div>
        ) : null}

        {(plotted ?? []).map((entry) => (
          <div
            key={`brief-${entry.group.openIso}`}
            className="absolute top-[2.1rem] h-2 w-px bg-bb-accent/40"
            style={{ left: `${entry.briefAt}%` }}
          />
        ))}

        {(plotted ?? []).map((entry, index) => (
          <motion.div
            key={entry.group.openIso}
            className="absolute top-10"
            style={{ left: `${entry.openAt}%` }}
            initial={reduced ? false : { opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`absolute -left-1 -top-1 h-2 w-2 rounded-full ring-2 ring-bb-panel ${
                entry.aheadToday ? 'bg-bb-accent' : 'bg-bb-faint'
              } ${hovered && hovered !== entry.group.openIso ? 'opacity-40' : ''}`}
            />
          </motion.div>
        ))}
      </div>

      {plotted === null ? (
        <p className="bb-label">Resolving your timezone…</p>
      ) : (
        <ul className="space-y-1.5">
          {plotted.map((entry, index) => (
            <motion.li
              key={entry.group.openIso}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-bb-panel-2"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              onMouseEnter={() => setHovered(entry.group.openIso)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  entry.aheadToday ? 'bg-bb-accent' : 'bg-bb-faint'
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-bb-text">{entry.codes}</span>

              <span className="bb-num shrink-0 text-[12px] text-bb-faint">
                {localTime(entry.group.briefIso)}
              </span>
              <span aria-hidden className="text-bb-faint">
                →
              </span>
              <span className="bb-num shrink-0 text-[12px] text-bb-accent">
                {localTime(entry.group.openIso)}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </figure>
  )
}
