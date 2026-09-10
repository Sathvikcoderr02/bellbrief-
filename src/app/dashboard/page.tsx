import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DateTime } from 'luxon'
import { AppShell } from '@/components/AppShell'
import { Countdown } from '@/components/Countdown'
import { DigestView } from '@/components/DigestView'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/server'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel, ProfileModel } from '@/lib/db/models'
import { toDigestViewModel } from '@/lib/digest'
import { DIGEST_LEAD_MINUTES, getExchange, nextSessionOpen } from '@/lib/markets'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  await connectToDatabase()
  const profile = await ProfileModel.findOne({ userId: user.id }).lean()
  if (!profile?.completedAt) redirect('/onboarding')

  const primary = getExchange(profile.exchanges[0] ?? 'NASDAQ')
  const { sessionDate, openInstant } = nextSessionOpen(primary, new Date())
  const digestInstant = new Date(openInstant.getTime() - DIGEST_LEAD_MINUTES * 60_000)

  const latest = await DigestModel.findOne({ userId: user.id })
    .sort({ digestInstant: -1, createdAt: -1 })
    .lean()

  // The same instant, rendered twice: once on the reader's clock, once on the
  // exchange's. That contrast is the whole product promise made visible.
  const inUserZone = (date: Date) => DateTime.fromJSDate(date).setZone(user.timeZone).toFormat('HH:mm')
  const inExchangeZone = (date: Date) => DateTime.fromJSDate(date).setZone(primary.timeZone).toFormat('HH:mm')

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <Panel className="p-6">
          <Countdown
            targetIso={digestInstant.toISOString()}
            label={`Next brief · ${primary.code}`}
            sublabel={`Lands ${inUserZone(digestInstant)} your time (${user.timeZone}) — that is ${inExchangeZone(digestInstant)} in ${primary.timeZone}, one hour before the ${inExchangeZone(openInstant)} open on ${sessionDate}.`}
          />
        </Panel>

        <Panel className="p-6">
          <p className="bb-label">Your profile</p>
          <dl className="mt-4 space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-bb-muted">Exchanges</dt>
              <dd className="text-right text-bb-text">{profile.exchanges.join(', ')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-bb-muted">Tickers</dt>
              <dd className="text-right text-bb-text">
                {profile.tickers.length > 0 ? profile.tickers.join(', ') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-bb-muted">Sectors</dt>
              <dd className="text-right text-bb-text">{profile.sectors.length || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-bb-muted">Themes</dt>
              <dd className="text-right text-bb-text">{profile.themes.length || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-bb-muted">Written for</dt>
              <dd className="text-right text-bb-text">{profile.experienceLevel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-bb-muted">Email</dt>
              <dd className="text-right text-bb-text">{profile.emailOptIn ? 'on' : 'off'}</dd>
            </div>
          </dl>
          <Link href="/settings" className="bb-label mt-5 inline-block transition-colors hover:text-bb-accent">
            EDIT →
          </Link>
        </Panel>
      </div>

      <Panel className="mt-4 p-6 md:p-8">
        {latest ? (
          <DigestView digest={toDigestViewModel(latest)} />
        ) : (
          <div className="py-10 text-center">
            <p className="bb-label">No brief yet</p>
            <h2 className="mt-3 text-xl font-semibold text-bb-bright">Your first brief is scheduled</h2>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-bb-muted">
              It will appear here at {inUserZone(digestInstant)} your time on {sessionDate}, one hour before{' '}
              {primary.code} opens{profile.emailOptIn ? ', and we will email it to you at the same moment' : ''}.
            </p>
          </div>
        )}
      </Panel>
    </AppShell>
  )
}
