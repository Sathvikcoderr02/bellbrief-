import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/server'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel } from '@/lib/db/models'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, string> = {
  ready: 'text-bb-accent',
  quiet: 'text-bb-muted',
  degraded: 'text-bb-amber',
  failed: 'text-bb-red',
}

export default async function ArchivePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  await connectToDatabase()
  const digests = await DigestModel.find({ userId: user.id })
    .sort({ digestInstant: -1, createdAt: -1 })
    .limit(60)
    .select('exchange sessionDate status headline claims emailStatus')
    .lean()

  return (
    <AppShell>
      <p className="bb-label">Archive · {digests.length} briefs</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-bb-bright">
        Every brief we have sent you
      </h1>

      <div className="mt-7 space-y-2.5">
        {digests.length === 0 ? (
          <Panel className="p-10 text-center text-sm text-bb-muted">
            Nothing archived yet — your first brief is still ahead of you.
          </Panel>
        ) : (
          digests.map((digest) => (
            <Link key={String(digest._id)} href={`/digest/${digest._id}`} className="block">
              <Panel className="p-5 transition-colors hover:border-bb-accent">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="bb-label">
                    {digest.exchange} &middot; {digest.sessionDate}
                  </span>
                  <span className={`bb-label ${STATUS_TONE[digest.status] ?? 'text-bb-muted'}`}>
                    {digest.status}
                    {digest.emailStatus === 'failed' ? ' · email failed' : ''}
                  </span>
                </div>
                <p className="mt-2.5 text-[15px] font-medium leading-snug text-bb-text">{digest.headline}</p>
                <p className="mt-1.5 text-xs text-bb-faint">
                  {digest.claims?.length ?? 0} claims in the ledger
                </p>
              </Panel>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  )
}
