'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { TileGrid, type TileOption } from '@/components/ui/TileGrid'
import { EXPERIENCE_OPTIONS, HORIZON_OPTIONS, RISK_OPTIONS } from './onboardingQuestions'

export interface WizardOptions {
  exchanges: TileOption[]
  sectors: TileOption[]
  /** `sub` carries the exchange code, which is also the filter key in step 3. */
  tickers: TileOption[]
  themes: TileOption[]
}

const TOTAL_STEPS = 5

export function OnboardingWizard({ options }: { options: WizardOptions }) {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [exchanges, setExchanges] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [tickers, setTickers] = useState<string[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [experienceLevel, setExperienceLevel] = useState('intermediate')
  const [riskAppetite, setRiskAppetite] = useState('balanced')
  const [horizon, setHorizon] = useState('long-term')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggleIn = (list: string[], set: (value: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id])

  // Only offer tickers listed on an exchange the user actually picked, so a
  // user who chose NSE is not asked about Toyota.
  const tickerOptions = useMemo(
    () =>
      options.tickers.filter((ticker) => exchanges.length === 0 || exchanges.includes(String(ticker.sub ?? ''))),
    [options.tickers, exchanges],
  )

  const interestCount = sectors.length + tickers.length + themes.length

  const steps = [
    {
      title: 'Which markets do you watch?',
      hint: 'Your brief arrives 60 minutes before these open, in your own timezone.',
      body: (
        <TileGrid
          options={options.exchanges}
          selected={exchanges}
          onToggle={toggleIn(exchanges, setExchanges)}
          columns={3}
        />
      ),
      valid: exchanges.length > 0,
      invalidMessage: 'Pick at least one exchange to continue',
    },
    {
      title: 'What sectors interest you?',
      hint: 'Pick as many as you like — this shapes what we sweep for every morning.',
      body: (
        <TileGrid options={options.sectors} selected={sectors} onToggle={toggleIn(sectors, setSectors)} columns={3} />
      ),
      valid: true,
    },
    {
      title: 'Any specific stocks?',
      hint: 'Named tickers get the highest priority in your brief. Skip if you would rather stay broad.',
      body:
        tickerOptions.length > 0 ? (
          <TileGrid options={tickerOptions} selected={tickers} onToggle={toggleIn(tickers, setTickers)} columns={4} />
        ) : (
          <p className="text-sm text-bb-muted">
            We do not have a starter list for those exchanges yet — your sectors and themes will drive the brief.
          </p>
        ),
      valid: true,
    },
    {
      title: 'What kind of news matters to you?',
      hint: 'Earnings, deals, policy — whatever you actually act on.',
      body: <TileGrid options={options.themes} selected={themes} onToggle={toggleIn(themes, setThemes)} columns={3} />,
      valid: interestCount >= 2,
      invalidMessage: `Pick at least two interests across the last three questions (you have ${interestCount})`,
    },
    {
      title: 'How should we write it?',
      hint: 'This sets the reading level and tone of every brief we send you.',
      body: (
        <div className="space-y-7">
          <div>
            <p className="bb-label mb-2.5">Experience</p>
            <TileGrid options={EXPERIENCE_OPTIONS} selected={[experienceLevel]} onToggle={setExperienceLevel} columns={3} />
          </div>
          <div>
            <p className="bb-label mb-2.5">Risk appetite</p>
            <TileGrid options={RISK_OPTIONS} selected={[riskAppetite]} onToggle={setRiskAppetite} columns={3} />
          </div>
          <div>
            <p className="bb-label mb-2.5">Holding horizon</p>
            <TileGrid options={HORIZON_OPTIONS} selected={[horizon]} onToggle={setHorizon} columns={3} />
          </div>
        </div>
      ),
      valid: true,
    },
  ]

  const current = steps[step]
  const isLast = step === TOTAL_STEPS - 1

  async function finish() {
    setBusy(true)
    setError(null)

    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exchanges, sectors, tickers, themes,
        experienceLevel, riskAppetite, horizon, emailOptIn: true,
      }),
    })
    const payload = await response.json().catch(() => ({}))

    setBusy(false)
    if (!response.ok) {
      setError(payload.error ?? 'Could not save your answers. Try again.')
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="relative min-h-dvh">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-25" aria-hidden />

      <div className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="bb-num text-xs text-bb-faint">
            {String(step + 1).padStart(2, '0')} / {String(TOTAL_STEPS).padStart(2, '0')}
          </span>
        </div>

        <div
          className="mt-6 flex gap-1.5"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label="Onboarding progress"
        >
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-0.5 flex-1 rounded-full transition-colors ${index <= step ? 'bg-bb-accent' : 'bg-bb-border'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-bb-bright md:text-3xl">{current.title}</h1>
            <p className="mt-2 text-sm text-bb-muted">{current.hint}</p>
            <div className="mt-7">{current.body}</div>
          </motion.div>
        </AnimatePresence>

        {error ? (
          <p role="alert" className="mt-6 rounded-lg border border-bb-red/40 bg-bb-red/10 px-3 py-2 text-xs text-bb-red">
            {error}
          </p>
        ) : null}

        {!current.valid && current.invalidMessage ? (
          <p className="mt-6 text-xs text-bb-amber">{current.invalidMessage}</p>
        ) : null}

        <div className="mt-9 flex items-center justify-between border-t border-bb-border pt-6">
          <Button variant="quiet" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
            Back
          </Button>
          {isLast ? (
            <Button onClick={finish} disabled={busy || !current.valid}>
              {busy ? 'Saving…' : 'Schedule my first brief'}
            </Button>
          ) : (
            <Button onClick={() => setStep((value) => value + 1)} disabled={!current.valid}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
