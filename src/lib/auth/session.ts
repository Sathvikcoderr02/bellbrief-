import jwt from 'jsonwebtoken'
import { getEnv } from '@/lib/env'
import { SESSION_MAX_AGE } from './cookieName'

export { SESSION_COOKIE, SESSION_MAX_AGE } from './cookieName'

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, getEnv().JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: SESSION_MAX_AGE,
  })
}

export function verifySession(token: string | undefined): { userId: string } | null {
  if (!token) return null
  try {
    // Pinning `algorithms` prevents an attacker downgrading to alg:none.
    const payload = jwt.verify(token, getEnv().JWT_SECRET, { algorithms: ['HS256'] })
    const subject = typeof payload === 'object' && payload ? (payload as jwt.JwtPayload).sub : undefined
    return typeof subject === 'string' ? { userId: subject } : null
  } catch {
    return null
  }
}
