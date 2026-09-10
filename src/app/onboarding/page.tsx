import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/server'
import { EXCHANGES } from '@/lib/markets'
import { POPULAR_TICKERS, SECTORS, THEMES } from '@/lib/news'
import { OnboardingWizard } from '@/components/OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <OnboardingWizard
      options={{
        exchanges: EXCHANGES.map((exchange) => ({
          id: exchange.code,
          label: exchange.label,
          sub: `opens ${exchange.openLocal} ${exchange.timeZone}`,
        })),
        sectors: SECTORS.map((sector) => ({ id: sector.id, label: sector.label })),
        // `sub` is the exchange code: the wizard filters tickers by it.
        tickers: POPULAR_TICKERS.map((ticker) => ({
          id: ticker.symbol,
          label: ticker.symbol,
          sub: ticker.exchange,
        })),
        themes: THEMES.map((theme) => ({ id: theme.id, label: theme.label })),
      }}
    />
  )
}
