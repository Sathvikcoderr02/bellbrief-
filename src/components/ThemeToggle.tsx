'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === 'light')
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    if (next) document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem('bb-theme', next ? 'light' : 'dark')
    } catch {
      // Private browsing: the toggle still works for this page view.
    }
  }

  return (
    <button
      onClick={toggle}
      className="bb-label transition-colors hover:text-bb-accent"
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      {light ? 'DARK' : 'LIGHT'}
    </button>
  )
}
