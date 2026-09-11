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
import {
  DIGEST_LEAD_MINUTES,
  displayZone,
  getExchange,
  isSameZone,
  nextSessionOpen,
} from '@/lib/markets'

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
  // exchange's. That contrast is the whole product promise made visible — but
  // only when the two actually differ.
  const inUserZone = (date: Date) => DateTime.fromJSDate(date).setZone(user.timeZone).toFormat('HH:mm')
  const inExchangeZone = (date: Date) =>
    DateTime.fromJSDate(date).setZone(primary.timeZone).toFormat('HH:mm')

  const userZone = displayZone(user.timeZone)
  const openAt = `one hour before the ${inExchangeZone(openInstant)} open on ${sessionDate}`
  const sublabel = isSameZone(user.timeZone, primary.timeZone)
    ? `Lands ${inUserZone(digestInstant)} (${userZone}), ${openAt}.`
    : `Lands ${inUserZone(digestInstant)} your time (${userZone}) — that is ${inExchangeZone(digestInstant)} in ${displayZone(primary.timeZone)}, ${openAt}.`

  const rows: [string, string][] = [
    ['Exchanges', profile.exchanges.join(', ')],
    ['Tickers', profile.tickers.length > 0 ? profile.tickers.join(', ') : '—'],
    ['Sectors', String(profile.sectors.length || '—')],
    ['Themes', String(profile.themes.length || '—')],
    ['Written for', profile.experienceLevel],
    ['Email', profile.emailOptIn ? 'on' : 'off'],
  ]

  return (
    <AppShell>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-[1.15fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <Countdown
            targetIso={digestInstant.toISOString()}
            label={`Next brief · ${primary.code}`}
            sublabel={sublabel}
          />
        </Panel>

        <Panel className="p-5 sm:p-6">
          <p className="bb-label">Your profile</p>
          <dl className="mt-4 space-y-3 text-[13px] sm:space-y-2.5">
            {rows.map(([label, value]) => (
              // Stacked on a phone: a long exchange list squeezes the label to
              // nothing when the two share a row.
              <div
                key={label}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <dt className="text-bb-muted">{label}</dt>
                <dd className="break-words text-bb-text sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/settings"
            className="bb-label mt-5 inline-flex min-h-11 items-center transition-colors hover:text-bb-accent"
          >
            EDIT →
          </Link>
        </Panel>
      </div>

      <Panel className="mt-3 p-5 sm:mt-4 sm:p-6 md:p-8">
        {latest ? (
          <DigestView digest={toDigestViewModel(latest)} />
        ) : (
          <div className="py-10 text-center">
            <p className="bb-label">No brief yet</p>
            <h2 className="mt-3 text-lg font-semibold text-bb-bright sm:text-xl">
              Your first brief is scheduled
            </h2>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-bb-muted">
              It will appear here at {inUserZone(digestInstant)} your time on {sessionDate}, one hour
              before {primary.code} opens
              {profile.emailOptIn ? ', and we will email it to you at the same moment' : ''}.
            </p>
          </div>
        )}
      </Panel>
    </AppShell>
  )
}
