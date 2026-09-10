import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

/**
 * Middleware runs on the Edge runtime, where `jsonwebtoken` is unavailable, so
 * it only checks that a session cookie is *present*. The signature is verified
 * in `getSessionUser`, which every protected page and route calls.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next()

  const login = new URL('/login', request.url)
  login.searchParams.set('next', request.nextUrl.pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/digest/:path*', '/archive/:path*', '/settings/:path*'],
}
