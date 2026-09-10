import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/ui/Logo'
import { SignOutButton } from './SignOutButton'

const LINKS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/archive', label: 'Archive' },
  { href: '/settings', label: 'Settings' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-20" aria-hidden />

      <header className="relative border-b border-bb-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <nav className="flex gap-5">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] text-bb-muted transition-colors hover:text-bb-text"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-5">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 py-9">{children}</main>
    </div>
  )
}
