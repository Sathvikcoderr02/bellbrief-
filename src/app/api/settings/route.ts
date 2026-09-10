import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/server'
import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel } from '@/lib/db/models'
import { normaliseTickers, profileInputSchema } from '@/app/api/onboarding/schema'

/** Reuses the onboarding schema so the two can never validate differently. */
export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = profileInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  await connectToDatabase()
  await ProfileModel.updateOne(
    { userId: user.id },
    { $set: { ...parsed.data, tickers: normaliseTickers(parsed.data.tickers) } },
  )

  return NextResponse.json({ ok: true })
}
