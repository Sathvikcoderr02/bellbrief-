import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/ui/Logo'
import { NavLinks } from './NavLinks'
import { SignOutButton } from './SignOutButton'

/**
 * One wrapping flex row rather than a media query: on a phone the nav is given
 * `w-full` and pushed to `order-3`, so it drops onto its own line beneath the
 * logo and the account controls. From `sm` up it takes its natural width and
 * sits back between them.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="bb-grid-bg pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative border-b border-bb-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center px-5 py-2.5 sm:px-6 sm:py-3">
          <Link href="/dashboard" className="order-1 flex min-h-11 items-center">
            <Logo />
          </Link>

          <NavLinks className="order-3 w-full border-t border-bb-border pt-1 sm:order-2 sm:ml-7 sm:w-auto sm:border-0 sm:pt-0" />

          <div className="order-2 ml-auto flex items-center gap-1 sm:order-3">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 py-7 sm:px-6 sm:py-9">{children}</main>
    </div>
  )
}
