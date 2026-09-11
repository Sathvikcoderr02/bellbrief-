'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import type { DigestClaim } from '@/lib/db/models'
import { claimMix, corroborationDepth, type ClaimClass } from '@/lib/charts/claimMix'

const FILL: Record<ClaimClass, string> = {
  corroborated: 'bg-bb-claim-corroborated',
  'single-source': 'bg-bb-claim-single',
  disputed: 'bg-bb-claim-disputed',
  discarded: 'bg-bb-claim-discarded',
}

const LABEL: Record<ClaimClass, string> = {
  corroborated: 'Corroborated',
  'single-source': 'Single source',
  disputed: 'Disputed',
  discarded: 'Discarded',
}

const pct = (share: number) => `${Math.round(share * 100)}%`

/**
 * The ledger's shape at a glance: what proportion of this brief's claims more
 * than one outlet actually agreed on.
 *
 * Two encodings, deliberately different in kind. The stacked bar shows the
 * model's own classification, labelled as such. The depth bars below count
 * distinct cited sources, which `validate.ts` checks mechanically against the
 * fetched article set — so it is fact rather than self-report. `confidence` is
 * charted nowhere: it is a number the model assigns to itself, and drawing it
 * as a distribution would lend it a precision it has not earned.
 */
export function ClaimMix({ claims }: { claims: readonly DigestClaim[] }) {
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState<ClaimClass | null>(null)

  const mix = claimMix(claims)
  const total = mix.reduce((sum, slice) => sum + slice.count, 0)
  if (total === 0) return null

  const present = mix.filter((slice) => slice.count > 0)
  const depth = corroborationDepth(claims)
  const deepest = Math.max(...depth.map((bucket) => bucket.count), 1)

  return (
    <figure className="mb-7">
      <figcaption className="bb-label mb-3">
        Claim ledger &middot; {total} claims &middot; classified by the model
      </figcaption>

      {/* 2px gaps in the surface colour do the separating, per the mark spec —
          no strokes, which would add ink that is not data. */}
      <div
        className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded"
        role="img"
        aria-label={present
          .map((slice) => `${LABEL[slice.agreement]} ${slice.count} of ${total}`)
          .join(', ')}
      >
        {present.map((slice, index) => (
          <motion.div
            key={slice.agreement}
            className={`${FILL[slice.agreement]} ${index === 0 ? 'rounded-l' : ''} ${
              index === present.length - 1 ? 'rounded-r' : ''
            } transition-opacity`}
            style={{ opacity: hovered && hovered !== slice.agreement ? 0.45 : 1 }}
            initial={reduced ? false : { flexGrow: 0 }}
            animate={{ flexGrow: slice.share }}
            transition={{ duration: 0.7, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHovered(slice.agreement)}
            onMouseLeave={() => setHovered(null)}
            title={`${LABEL[slice.agreement]}: ${slice.count} of ${total} (${pct(slice.share)})`}
          />
        ))}
      </div>

      {/* Legend carries identity in text, so nothing depends on colour alone —
          and its visible counts are the relief the light-mode discarded fill
          requires, sitting below 3:1 on white. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {mix.map((slice) => (
          <li
            key={slice.agreement}
            className="flex items-center gap-2 text-[12px] text-bb-muted"
            onMouseEnter={() => setHovered(slice.agreement)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-sm ${FILL[slice.agreement]} ${
                slice.count === 0 ? 'opacity-30' : ''
              }`}
            />
            <span>{LABEL[slice.agreement]}</span>
            <span className="bb-num text-bb-text">{slice.count}</span>
            <span className="bb-num text-bb-faint">{pct(slice.share)}</span>
          </li>
        ))}
      </ul>

      <p className="bb-label mt-6 mb-2.5">Distinct sources per kept claim &middot; counted, not classified</p>
      <div className="space-y-1.5">
        {depth.map((bucket, index) => (
          <div key={bucket.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[11px] text-bb-muted">{bucket.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-bb-panel-2">
              <motion.div
                // Ordinal buckets: one hue, stepped in lightness, so the order
                // is visible in the colour rather than encoded arbitrarily.
                className="h-full rounded-sm bg-bb-accent"
                style={{ opacity: 0.45 + index * 0.275 }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${(bucket.count / deepest) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="bb-num w-6 shrink-0 text-right text-[11px] text-bb-text">
              {bucket.count}
            </span>
          </div>
        ))}
      </div>

      {/* The table view, for screen readers and as the documented fallback
          wherever a fill's contrast is relieved by labels. */}
      <table className="sr-only">
        <caption>Claim ledger breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Claims</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {mix.map((slice) => (
            <tr key={slice.agreement}>
              <th scope="row">{LABEL[slice.agreement]}</th>
              <td>{slice.count}</td>
              <td>{pct(slice.share)}</td>
            </tr>
          ))}
          {depth.map((bucket) => (
            <tr key={bucket.label}>
              <th scope="row">Claims backed by {bucket.label}</th>
              <td>{bucket.count}</td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
