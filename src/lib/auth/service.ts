import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel, UserModel } from '@/lib/db/models'
import { hashPassword, verifyPassword } from './password'

/** One message for both failure modes, so registered emails cannot be enumerated. */
const BAD_CREDENTIALS = 'Email or password is incorrect'

/** A valid-shaped bcrypt hash that matches nothing, used to keep login timing flat. */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.9Q4Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q'

export async function registerUser(input: {
  email: string
  password: string
  name: string
  timeZone: string
}): Promise<{ userId: string }> {
  await connectToDatabase()

  const email = input.email.trim().toLowerCase()
  if (await UserModel.exists({ email })) {
    throw new Error('That email is already registered')
  }

  const user = await UserModel.create({
    email,
    name: input.name.trim(),
    timeZone: input.timeZone,
    passwordHash: await hashPassword(input.password),
  })

  // Every user gets a profile immediately; onboarding fills it in and stamps completedAt.
  await ProfileModel.create({ userId: user._id })

  return { userId: String(user._id) }
}

export async function loginUser(input: { email: string; password: string }): Promise<{ userId: string }> {
  await connectToDatabase()

  const user = await UserModel.findOne({ email: input.email.trim().toLowerCase() })

  // Always run a comparison, even with no user, so response time does not
  // reveal whether the address exists.
  const matches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !matches) throw new Error(BAD_CREDENTIALS)

  user.lastLoginAt = new Date()
  await user.save()

  return { userId: String(user._id) }
}
