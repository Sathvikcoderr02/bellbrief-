/**
 * `next` arrives from the query string, so it is attacker-controlled: without
 * this, `/login?next=https://example.com` would hand the browser straight to
 * another origin after a successful sign-in. Only same-origin paths survive,
 * and `//host` is rejected because a protocol-relative URL leaves the origin
 * while still starting with a slash.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
