import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/server'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel } from '@/lib/db/models'
import { toDigestViewModel } from '@/lib/digest'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectToDatabase()
  const digest = await DigestModel.findOne({ userId: user.id })
    .sort({ digestInstant: -1, createdAt: -1 })
    .lean()

  return NextResponse.json({ digest: digest ? toDigestViewModel(digest) : null })
}
