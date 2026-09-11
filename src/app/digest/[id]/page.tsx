import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { DigestView } from '@/components/DigestView'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/server'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel } from '@/lib/db/models'
import { toDigestViewModel } from '@/lib/digest'

export const dynamic = 'force-dynamic'

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params

  await connectToDatabase()
  // Scoped by userId as well as id, so an id belonging to another account
  // cannot be read by guessing it.
  const digest = await DigestModel.findOne({ _id: id, userId: user.id })
    .lean()
    .catch(() => null)
  if (!digest) notFound()

  return (
    <AppShell>
      <Panel className="p-5 sm:p-6 md:p-8">
        <DigestView digest={toDigestViewModel(digest)} />
      </Panel>
    </AppShell>
  )
}
