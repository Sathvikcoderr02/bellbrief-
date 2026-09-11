'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { safeNextPath } from '@/lib/auth/nextPath'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Logo } from '@/components/ui/Logo'
import { Panel } from '@/components/ui/Panel'

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const payload: Record<string, string> = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }

    if (isRegister) {
      payload.name = String(form.get('name') ?? '')
      // The browser is the only place that knows the user's real timezone,
      // which is what every timestamp in the app is rendered in.
      payload.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }

    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))

    setBusy(false)
    if (!response.ok) {
      setError(body.error ?? 'Something went wrong. Try again.')
      return
    }
    router.push(isRegister ? '/onboarding' : safeNextPath(next))
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5 py-10 sm:px-6 sm:py-12">
      <div className="bb-grid-bg pointer-events-none absolute inset-0" aria-hidden />

      <Panel className="relative w-full max-w-md p-6 sm:p-8">
        <Link href="/" className="inline-flex min-h-11 items-center">
          <Logo />
        </Link>

        <h1 className="mt-7 text-2xl font-semibold tracking-tight text-bb-bright">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-bb-muted">
          {isRegister
            ? 'Five questions and your first brief is scheduled.'
            : 'Sign in to read this morning’s brief.'}
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          {isRegister ? <Field label="Name" name="name" required autoComplete="name" placeholder="Your name" /> : null}
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 10 : undefined}
            placeholder={isRegister ? 'At least 10 characters' : '••••••••'}
          />

          {error ? (
            <p role="alert" className="rounded-lg border border-bb-red/40 bg-bb-red/10 px-3 py-2 text-xs text-bb-red">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy} className="min-h-12 w-full">
            {busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-bb-muted">
          {isRegister ? 'Already have an account? ' : 'No account yet? '}
          <Link
            href={isRegister ? '/login' : '/register'}
            className="text-bb-accent hover:underline"
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </Link>
        </p>
      </Panel>
    </main>
  )
}
