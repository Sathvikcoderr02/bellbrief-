'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TileGrid, type TileOption } from '@/components/ui/TileGrid'
import { EXPERIENCE_OPTIONS, HORIZON_OPTIONS, RISK_OPTIONS } from './onboardingQuestions'

export interface SettingsInitial {
  exchanges: string[]
  sectors: string[]
  tickers: string[]
  themes: string[]
  experienceLevel: string
  riskAppetite: string
  horizon: string
  emailOptIn: boolean
}

export interface SettingsOptions {
  exchanges: TileOption[]
  sectors: TileOption[]
  tickers: TileOption[]
  themes: TileOption[]
}

export function SettingsForm({
  initial,
  options,
}: {
  initial: SettingsInitial
  options: SettingsOptions
}) {
  const [exchanges, setExchanges] = useState(initial.exchanges)
  const [sectors, setSectors] = useState(initial.sectors)
  const [tickers, setTickers] = useState(initial.tickers)
  const [themes, setThemes] = useState(initial.themes)
  const [experienceLevel, setExperienceLevel] = useState(initial.experienceLevel)
  const [riskAppetite, setRiskAppetite] = useState(initial.riskAppetite)
  const [horizon, setHorizon] = useState(initial.horizon)
  const [emailOptIn, setEmailOptIn] = useState(initial.emailOptIn)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const toggleIn = (list: string[], set: (value: string[]) => void) => (id: string) => {
    setStatus('idle')
    set(list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id])
  }

  // Keep any ticker the user already follows visible even if they narrow their
  // exchanges, so saving cannot silently drop a selection they cannot see.
  const tickerOptions = useMemo(
    () =>
      options.tickers.filter(
        (ticker) =>
          exchanges.length === 0 ||
          exchanges.includes(String(ticker.sub ?? '')) ||
          tickers.includes(ticker.id),
      ),
    [options.tickers, exchanges, tickers],
  )

  async function save() {
    setStatus('saving')
    setError(null)

    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exchanges, sectors, tickers, themes,
        experienceLevel, riskAppetite, horizon, emailOptIn,
      }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus('idle')
      setError(payload.error ?? 'Could not save your changes.')
      return
    }
    setStatus('saved')
  }

  return (
    <div className="space-y-9">
      <section>
        <p className="bb-label mb-2.5">Exchanges</p>
        <TileGrid options={options.exchanges} selected={exchanges} onToggle={toggleIn(exchanges, setExchanges)} columns={3} />
      </section>

      <section>
        <p className="bb-label mb-2.5">Sectors</p>
        <TileGrid options={options.sectors} selected={sectors} onToggle={toggleIn(sectors, setSectors)} columns={3} />
      </section>

      <section>
        <p className="bb-label mb-2.5">Tickers</p>
        {tickerOptions.length > 0 ? (
          <TileGrid options={tickerOptions} selected={tickers} onToggle={toggleIn(tickers, setTickers)} columns={4} />
        ) : (
          <p className="text-sm text-bb-muted">No starter tickers for your selected exchanges.</p>
        )}
      </section>

      <section>
        <p className="bb-label mb-2.5">Themes</p>
        <TileGrid options={options.themes} selected={themes} onToggle={toggleIn(themes, setThemes)} columns={3} />
      </section>

      <section>
        <p className="bb-label mb-2.5">Experience</p>
        <TileGrid options={EXPERIENCE_OPTIONS} selected={[experienceLevel]} onToggle={setExperienceLevel} columns={3} />
      </section>

      <section>
        <p className="bb-label mb-2.5">Risk appetite</p>
        <TileGrid options={RISK_OPTIONS} selected={[riskAppetite]} onToggle={setRiskAppetite} columns={3} />
      </section>

      <section>
        <p className="bb-label mb-2.5">Holding horizon</p>
        <TileGrid options={HORIZON_OPTIONS} selected={[horizon]} onToggle={setHorizon} columns={3} />
      </section>

      <section>
        <p className="bb-label mb-2.5">Email</p>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-bb-border bg-bb-panel-2 px-4 py-3.5">
          <input
            type="checkbox"
            checked={emailOptIn}
            onChange={(event) => {
              setStatus('idle')
              setEmailOptIn(event.target.checked)
            }}
            className="h-4 w-4 accent-bb-accent"
          />
          <span className="text-sm text-bb-text">Email me the brief as well as showing it here</span>
        </label>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-bb-red/40 bg-bb-red/10 px-3 py-2 text-xs text-bb-red">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4 border-t border-bb-border pt-6">
        <Button onClick={save} disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </Button>
        {status === 'saved' ? <span className="bb-label text-bb-accent">SAVED</span> : null}
      </div>
    </div>
  )
}
