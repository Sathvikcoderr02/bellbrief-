import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel, UserModel } from '@/lib/db/models'
import { SESSION_COOKIE, verifySession } from './session'

export interface SessionUser {
  id: string
  email: string
  name: string
  timeZone: string
  hasProfile: boolean
}

/**
 * Server-only. Kept apart from `service.ts` because `next/headers` cannot be
 * imported outside a request scope, which would make the service untestable.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return null

  await connectToDatabase()
  const user = await UserModel.findById(session.userId).lean()
  if (!user) return null

  const profile = await ProfileModel.findOne({ userId: user._id }).select('completedAt').lean()

  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    timeZone: user.timeZone,
    hasProfile: Boolean(profile?.completedAt),
  }
}
