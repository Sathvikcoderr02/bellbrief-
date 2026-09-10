'use client'

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
      }}
      className="bb-label transition-colors hover:text-bb-red"
    >
      SIGN OUT
    </button>
  )
}
