'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import type { SessionSlice } from '@/lib/market/session'

/**
 * Drawing box, sized for the hero's right-hand column (~490px at the widest
 * breakpoint) so the SVG renders close to 1:1 and its labels keep their
 * intended size instead of being scaled into illegibility.
 */
const W = 500
const H = 250
const PAD = { top: 14, right: 52, bottom: 26, left: 6 }

const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

/**
 * One real trading session as candles, with the previous close it gapped from
 * and the moment the brief landed.
 *
 * This is the product argument in one picture: the distance between the dashed
 * previous close and the first candle is the overnight news being priced in,
 * and the brief marker sits an hour to the left of it. Nothing here is
 * illustrative — every candle is a real print from Yahoo Finance.
 *
 * Up and down are not the theme's accent and red: on a white surface those two
 * score ΔE 0.7 under deuteranopia, meaning a red-green reader cannot tell the
 * direction of a candle. The tokens used here clear that at 21.1, and the body
 * fill is hollow on down bars so direction survives without colour at all.
 */
export function SessionChart({ slice }: { slice: SessionSlice }) {
  const reduced = useReducedMotion()

  const geometry = useMemo(() => {
    const lows = slice.bars.map((bar) => bar.l)
    const highs = slice.bars.map((bar) => bar.h)
    const low = Math.min(...lows, slice.previousClose)
    const high = Math.max(...highs, slice.previousClose)
    // A flat session would divide by zero; pad it into a visible band.
    const span = high - low || high * 0.001 || 1
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    const y = (price: number) => PAD.top + ((high - price) / span) * plotH
    const step = plotW / slice.bars.length
    const bodyW = Math.max(1.5, Math.min(11, step * 0.62))

    const first = Date.parse(slice.bars[0].t)
    const last = Date.parse(slice.bars[slice.bars.length - 1].t)
    const timeSpan = last - first || 1
    const xAt = (iso: string) =>
      PAD.left + ((Date.parse(iso) - first) / timeSpan) * (plotW - step) + step / 2

    return { low, high, span, y, step, bodyW, xAt, plotW, plotH }
  }, [slice])

  /**
   * Formatted in the exchange's own zone with an explicit locale, not the
   * reader's. Two reasons: a chart of the London session should be labelled on
   * London's clock, and a value derived from the server's zone or locale would
   * not survive hydration.
   */
  const localTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: slice.zone,
    })

  const up = slice.changePercent >= 0
  const ticks = [geometry.high, slice.previousClose, geometry.low]

  return (
    <figure>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <figcaption className="text-[13px] text-bb-text">
          {slice.name}{' '}
          <span className="text-bb-faint">
            · {slice.sessionDate} session · times in {slice.zone}
          </span>
        </figcaption>
        <p className="bb-num text-[13px]">
          <span className="text-bb-muted">gap at the bell </span>
          <span className={slice.gapPercent >= 0 ? 'text-bb-up' : 'text-bb-down'}>
            {pct(slice.gapPercent)}
          </span>
          <span className="text-bb-muted"> · session </span>
          <span className={up ? 'text-bb-up' : 'text-bb-down'}>{pct(slice.changePercent)}</span>
        </p>
      </div>

      <div className="-mx-1 mt-3 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[26rem]"
        role="img"
        aria-label={`${slice.name}, ${slice.sessionDate}: opened ${pct(slice.gapPercent)} against the previous close of ${slice.previousClose}, and stood ${pct(slice.changePercent)} at the latest print. The brief was sent at ${localTime(slice.briefIso)}, one hour before the ${localTime(slice.openIso)} open.`}
      >
        {/* Previous close: the line the overnight gap is measured from. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={geometry.y(slice.previousClose)}
          y2={geometry.y(slice.previousClose)}
          stroke="currentColor"
          className="text-bb-border"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text
          x={W - PAD.right + 6}
          y={geometry.y(slice.previousClose) + 3}
          className="fill-bb-faint font-mono text-[11px]"
        >
          prev {slice.previousClose.toFixed(0)}
        </text>

        {ticks
          .filter((price) => price !== slice.previousClose)
          .map((price) => (
            <text
              key={price}
              x={W - PAD.right + 6}
              y={geometry.y(price) + 3}
              className="fill-bb-faint font-mono text-[11px]"
            >
              {price.toFixed(0)}
            </text>
          ))}

        {slice.bars.map((bar, index) => {
          const x = PAD.left + index * geometry.step + geometry.step / 2
          const rising = bar.c >= bar.o
          const top = geometry.y(Math.max(bar.o, bar.c))
          const bottom = geometry.y(Math.min(bar.o, bar.c))
          const colour = rising ? 'text-bb-up' : 'text-bb-down'

          return (
            <motion.g
              key={bar.t}
              className={colour}
              initial={reduced ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.012, 0.6) }}
              style={{ transformOrigin: `${x}px ${geometry.y(slice.previousClose)}px` }}
            >
              <title>{`${localTime(bar.t)} — O ${bar.o.toFixed(2)} H ${bar.h.toFixed(2)} L ${bar.l.toFixed(2)} C ${bar.c.toFixed(2)}`}</title>
              <line
                x1={x}
                x2={x}
                y1={geometry.y(bar.h)}
                y2={geometry.y(bar.l)}
                stroke="currentColor"
                strokeWidth="1"
              />
              <rect
                x={x - geometry.bodyW / 2}
                y={top}
                width={geometry.bodyW}
                height={Math.max(1, bottom - top)}
                // Hollow on down bars: direction stays readable with no colour
                // at all, which is the candlestick convention for good reason.
                fill={rising ? 'currentColor' : 'var(--bb-panel)'}
                stroke="currentColor"
                strokeWidth="1"
              />
            </motion.g>
          )
        })}

        {/* The brief, then the bell. */}
        {[
          { iso: slice.briefIso, label: 'your brief', accent: true },
          { iso: slice.openIso, label: 'bell', accent: false },
        ].map((marker) => {
          const x = Math.max(PAD.left, Math.min(W - PAD.right, geometry.xAt(marker.iso)))
          return (
            <motion.g
              key={marker.label}
              initial={reduced ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <line
                x1={x}
                x2={x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="currentColor"
                className={marker.accent ? 'text-bb-accent' : 'text-bb-muted'}
                strokeWidth="1"
                strokeDasharray={marker.accent ? undefined : '2 3'}
                opacity={marker.accent ? 0.8 : 0.5}
              />
              <text
                x={x + 4}
                y={H - PAD.bottom + 10}
                className={`font-mono text-[11px] ${marker.accent ? 'fill-bb-accent' : 'fill-bb-muted'}`}
              >
                {marker.label} {localTime(marker.iso)}
              </text>
            </motion.g>
          )
        })}
      </svg>
      </div>

      <table className="sr-only">
        <caption>
          {slice.name} {slice.sessionDate} session, {slice.bars.length} bars
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Open</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">Close</th>
          </tr>
        </thead>
        <tbody>
          {slice.bars.map((bar) => (
            <tr key={bar.t}>
              <th scope="row">{localTime(bar.t)}</th>
              <td>{bar.o}</td>
              <td>{bar.h}</td>
              <td>{bar.l}</td>
              <td>{bar.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
