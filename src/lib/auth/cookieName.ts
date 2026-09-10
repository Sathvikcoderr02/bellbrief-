/**
 * Isolated from `session.ts` on purpose: middleware runs on the Edge runtime,
 * and importing the cookie name from a module that also imports `jsonwebtoken`
 * drags a Node-only crypto library into the edge bundle.
 */
export const SESSION_COOKIE = 'bb_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7
