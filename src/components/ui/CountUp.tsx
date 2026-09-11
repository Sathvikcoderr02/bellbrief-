'use client'

import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/**
 * Counts to a real figure when scrolled into view. `animate()` is not covered
 * by the stylesheet's reduced-motion rule the way CSS transitions are, so the
 * preference is honoured explicitly here: the final value renders immediately.
 */
export function CountUp({ to, className = '' }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setValue(to)
      return
    }
    const controls = animate(0, to, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (next) => setValue(Math.round(next)),
    })
    return () => controls.stop()
  }, [inView, reduced, to])

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
