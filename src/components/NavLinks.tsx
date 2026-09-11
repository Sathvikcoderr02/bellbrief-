'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/archive', label: 'Archive' },
  { href: '/settings', label: 'Settings' },
]

/**
 * Client-side only because it needs the current path: the active link is worth
 * a round trip to the client, since a nav with no current-page indicator is the
 * single most common way an app feels unfinished on a phone.
 *
 * Every target is at least 44px tall, which is the smallest reliable touch
 * target; on a phone this row sits on its own line under the logo.
 */
export function NavLinks({ className = '' }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] transition-colors ${
                  active ? 'bg-bb-accent-dim text-bb-accent' : 'text-bb-muted hover:text-bb-text'
                }`}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
