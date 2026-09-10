'use client'

import { motion } from 'framer-motion'

export interface TileOption {
  id: string
  label: string
  sub?: string
}

/**
 * The Spotify-style pick-what-you-like grid. Rendered as ARIA checkboxes rather
 * than buttons so a screen reader announces selection state, and keyboard users
 * get the same toggle semantics as the mouse.
 */
export function TileGrid({
  options,
  selected,
  onToggle,
  columns = 3,
}: {
  options: TileOption[]
  selected: string[]
  onToggle: (id: string) => void
  columns?: 2 | 3 | 4
}) {
  const grid = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  }[columns]

  return (
    <div className={`grid grid-cols-1 gap-2.5 ${grid}`}>
      {options.map((option, index) => {
        const active = selected.includes(option.id)
        return (
          <motion.button
            key={option.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => onToggle(option.id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(index * 0.022, 0.4) }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex flex-col items-start gap-1 rounded-xl border px-4 py-3.5 pr-9 text-left transition-colors ${
              active ? 'border-bb-accent bg-bb-accent-dim' : 'border-bb-border bg-bb-panel hover:border-bb-muted'
            }`}
          >
            <span className={`text-sm font-medium ${active ? 'text-bb-accent' : 'text-bb-text'}`}>
              {option.label}
            </span>
            {option.sub ? <span className="text-[11px] leading-tight text-bb-faint">{option.sub}</span> : null}
            <span
              aria-hidden
              className={`absolute right-3.5 top-3.5 grid h-4 w-4 place-items-center rounded-[5px] border text-[10px] leading-none transition-colors ${
                active ? 'border-bb-accent bg-bb-accent text-bb-bg' : 'border-bb-border text-transparent'
              }`}
            >
              &#10003;
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
