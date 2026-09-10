import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/server'
import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel } from '@/lib/db/models'
import { EXCHANGES } from '@/lib/markets'
import { POPULAR_TICKERS, SECTORS, THEMES } from '@/lib/news'
import { SettingsForm } from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  await connectToDatabase()
  const profile = await ProfileModel.findOne({ userId: user.id }).lean()
  if (!profile) redirect('/onboarding')

  return (
    <AppShell>
      <p className="bb-label">Settings</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-bb-bright">What we watch for you</h1>
      <p className="mt-2 text-sm text-bb-muted">
        Signed in as {user.email} &middot; timezone {user.timeZone}, detected from your browser and used for
        every time shown in the app.
      </p>

      <Panel className="mt-7 p-6 md:p-8">
        <SettingsForm
          initial={{
            exchanges: profile.exchanges,
            sectors: profile.sectors,
            tickers: profile.tickers,
            themes: profile.themes,
            experienceLevel: profile.experienceLevel,
            riskAppetite: profile.riskAppetite,
            horizon: profile.horizon,
            emailOptIn: profile.emailOptIn,
          }}
          options={{
            exchanges: EXCHANGES.map((exchange) => ({
              id: exchange.code,
              label: exchange.label,
              sub: `opens ${exchange.openLocal} ${exchange.timeZone}`,
            })),
            sectors: SECTORS.map((sector) => ({ id: sector.id, label: sector.label })),
            tickers: POPULAR_TICKERS.map((ticker) => ({
              id: ticker.symbol,
              label: ticker.symbol,
              sub: ticker.exchange,
            })),
            themes: THEMES.map((theme) => ({ id: theme.id, label: theme.label })),
          }}
        />
      </Panel>
    </AppShell>
  )
}
