import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/ui/Logo'
import { Panel } from '@/components/ui/Panel'
import { Reveal } from '@/components/ui/Reveal'
import { EXCHANGES } from '@/lib/markets'
import { LandingCountdown } from '@/components/LandingCountdown'

const STEPS = [
  {
    n: '01',
    title: 'Tell us what you follow',
    body: 'Five questions. Pick your exchanges, sectors, tickers and themes from a grid — nothing to type, nothing to fill in.',
  },
  {
    n: '02',
    title: 'We read the morning for you',
    body: 'Every trading day we sweep news feeds across your interests, collapse duplicate wire copy, and rank what actually touches your names.',
  },
  {
    n: '03',
    title: 'It lands an hour before the bell',
    body: 'Summarised, cited, and timed to your exchange — 08:30 in New York, 08:15 in Mumbai — shown in whatever timezone you are sitting in.',
  },
]

const LEDGER_SAMPLE = [
  { claim: 'Accenture cut its FY guidance', label: '3 sources agree', tone: 'accent' as const },
  { claim: 'Indian IT ADRs fell 2–3% overnight', label: '2 sources agree', tone: 'accent' as const },
  { claim: 'The weakness is structural, not cyclical', label: 'sources disagree', tone: 'amber' as const },
  { claim: '“INFY to crash 20%”', label: 'discarded — unsourced blog', tone: 'faint' as const },
]

const TONE_BORDER = { accent: 'border-bb-accent', amber: 'border-bb-amber', faint: 'border-bb-border' }
const TONE_TEXT = { accent: 'text-bb-accent', amber: 'text-bb-amber', faint: 'text-bb-faint' }

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-6">
          <ThemeToggle />
          <Link href="/login" className="text-sm text-bb-muted transition-colors hover:text-bb-text">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-bb-accent px-4 py-2 text-sm font-semibold text-bb-bg transition-all hover:brightness-110"
          >
            Create account
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-14 md:pt-24">
        <Reveal>
          <p className="bb-label mb-5">Pre-market intelligence &middot; {EXCHANGES.length} exchanges</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-bb-bright md:text-6xl">
            Your market brief,
            <br />
            <span className="text-bb-accent">an hour before the bell.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-bb-muted md:text-lg">
            Bellbrief reads the overnight news for the stocks and sectors you actually follow, summarises
            it, and shows you the source behind every sentence — sixty minutes before your exchange opens,
            in your timezone.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-bb-accent px-6 py-3 text-sm font-semibold text-bb-bg transition-all hover:brightness-110"
            >
              Get your first brief
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-bb-border px-6 py-3 text-sm text-bb-text transition-colors hover:border-bb-accent hover:text-bb-accent"
            >
              I already have an account
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="mt-14">
          <LandingCountdown />
        </Reveal>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={index * 0.08}>
              <Panel className="h-full p-6">
                <span className="bb-num text-2xl text-bb-accent">{step.n}</span>
                <h3 className="mt-4 text-base font-semibold text-bb-bright">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-bb-muted">{step.body}</p>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <Panel className="overflow-hidden p-0">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-bb-border p-8 md:border-b-0 md:border-r">
                <p className="bb-label">Why the receipts matter</p>
                <h2 className="mt-4 text-2xl font-semibold leading-tight text-bb-bright">
                  Most summaries hide their sources. Ours are checked.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-bb-muted">
                  Language models cite things that do not exist. So Bellbrief verifies every citation
                  against the articles it actually fetched, and any sentence whose source cannot be
                  resolved is deleted before you ever see it. When outlets disagree, the brief says so
                  instead of blending them into one confident paragraph.
                </p>
              </div>
              <div className="bg-bb-panel-2 p-8">
                <p className="bb-label mb-4">Claim ledger &middot; sample</p>
                <div className="space-y-2.5">
                  {LEDGER_SAMPLE.map((row) => (
                    <div
                      key={row.claim}
                      className={`rounded-lg border-l-2 bg-bb-panel p-3 ${TONE_BORDER[row.tone]}`}
                    >
                      <p
                        className={`text-[13px] leading-snug ${
                          row.tone === 'faint' ? 'text-bb-faint line-through' : 'text-bb-text'
                        }`}
                      >
                        {row.claim}
                      </p>
                      <p className={`bb-label mt-1.5 ${TONE_TEXT[row.tone]}`}>{row.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      <footer className="relative border-t border-bb-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-bb-faint md:flex-row md:items-center md:justify-between">
          <Logo size="sm" />
          <p>
            Bellbrief summarises published news and links every claim to its source. Not investment
            advice.
          </p>
        </div>
      </footer>
    </main>
  )
}
