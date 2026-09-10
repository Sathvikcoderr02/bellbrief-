'use client'

import { useEffect, useState } from 'react'

const pad = (value: number) => String(Math.max(0, Math.floor(value))).padStart(2, '0')

export function Countdown({
  targetIso,
  label,
  sublabel,
}: {
  targetIso: string
  label: string
  sublabel?: string
}) {
  // Null until mounted so the server never renders a time-dependent value.
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setRemaining(new Date(targetIso).getTime() - Date.now())
    update()
    const timer = setInterval(update, 1_000)
    return () => clearInterval(timer)
  }, [targetIso])

  const done = remaining !== null && remaining <= 0

  return (
    <div>
      <p className="bb-label">{label}</p>
      <p
        className={`bb-num mt-2 text-4xl tracking-tight md:text-5xl ${done ? 'text-bb-muted' : 'text-bb-accent'}`}
        suppressHydrationWarning
      >
        {remaining === null
          ? '--:--:--'
          : done
            ? '00:00:00'
            : `${pad(remaining / 3_600_000)}:${pad((remaining % 3_600_000) / 60_000)}:${pad((remaining % 60_000) / 1_000)}`}
      </p>
      {sublabel ? <p className="mt-2.5 text-xs leading-relaxed text-bb-muted">{sublabel}</p> : null}
    </div>
  )
}
