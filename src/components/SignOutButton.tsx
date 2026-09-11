'use client'

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
      }}
      className="bb-label inline-flex min-h-11 items-center rounded-lg px-2 transition-colors hover:text-bb-red"
    >
      SIGN OUT
    </button>
  )
}
