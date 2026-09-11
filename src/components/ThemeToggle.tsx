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

    // Keep the phone's address bar in step with the page.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next ? '#f7f8f7' : '#0a0c0b')

    try {
      localStorage.setItem('bb-theme', next ? 'light' : 'dark')
    } catch {
      // Private browsing: the toggle still works for this page view.
    }
  }

  return (
    <button
      onClick={toggle}
      className="bb-label inline-flex min-h-11 items-center rounded-lg px-2 transition-colors hover:text-bb-accent"
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      {light ? 'DARK' : 'LIGHT'}
    </button>
  )
}
