import jwt from 'jsonwebtoken'
import { getEnv } from '@/lib/env'

export const SESSION_COOKIE = 'bb_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

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
