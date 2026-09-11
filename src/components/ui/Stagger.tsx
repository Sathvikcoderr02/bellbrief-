'use client'

import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Entrance animation for content that is already on screen at load — the hero.
 * `Reveal` waits for the element to scroll into view, which never happens above
 * the fold, so it would sit at opacity 0 until the user scrolled.
 */
export function Stagger({
  children,
  className = '',
  delay = 0,
  gap = 0.08,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  gap?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}
