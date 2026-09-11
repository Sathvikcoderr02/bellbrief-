import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CountUp } from '@/components/ui/CountUp'
import { Logo } from '@/components/ui/Logo'
import { Panel } from '@/components/ui/Panel'
import { Reveal } from '@/components/ui/Reveal'
import { Stagger, StaggerItem } from '@/components/ui/Stagger'
import { EXCHANGES, getExchange, nextDistinctBells } from '@/lib/markets'
import { SECTORS, THEMES } from '@/lib/news'
import { LandingCountdown } from '@/components/LandingCountdown'

/**
 * The countdown targets are absolute instants, so a cached page still counts
 * down correctly; revalidating bounds how stale the *choice* of next markets
 * can get.
 */
export const revalidate = 60

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
    body: `Summarised, cited, and timed to your exchange — ${getExchange('NYSE').openLocal} in New York, ${getExchange('NSE').openLocal} in Mumbai — shown in whatever timezone you are sitting in.`,
  },
]

/** The four stages the digest pipeline actually runs, in order. */
const PIPELINE = [
  {
    n: '01',
    title: 'Sweep',
    body: 'Publisher wires plus targeted searches for every ticker, sector and theme on your list.',
  },
  {
    n: '02',
    title: 'Collapse',
    body: 'Near-identical wire copy is merged, so one story counts once rather than five times.',
  },
  {
    n: '03',
    title: 'Summarise',
    body: 'The model writes the brief and tags each sentence with the index of the article it drew on.',
  },
  {
    n: '04',
    title: 'Verify',
    body: 'Every index is resolved against the articles actually fetched. Anything unresolvable is deleted before you see it.',
  },
]

export default function LandingPage() {
  const markets = nextDistinctBells(3)

  return (
    <main className="relative overflow-hidden">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      {/* A single slow scanline over the grid, on the compositor. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] overflow-hidden" aria-hidden>
        <div className="bb-scan h-24 w-full bg-gradient-to-b from-transparent via-bb-accent to-transparent opacity-[0.07]" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-4">
          <ThemeToggle />
          {/* Below sm this would crowd the row; the hero's second button is the
              same destination, so nothing is lost. */}
          <Link
            href="/login"
            className="hidden min-h-11 items-center px-2 text-sm text-bb-muted transition-colors hover:text-bb-text sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center rounded-lg bg-bb-accent px-3.5 text-[13px] font-semibold text-bb-bg transition-all hover:brightness-110 sm:px-4 sm:text-sm"
          >
            Create account
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-24">
        <Stagger>
          <StaggerItem>
            <p className="bb-label mb-4 sm:mb-5">
              Pre-market intelligence &middot; {EXCHANGES.length} exchanges
            </p>
          </StaggerItem>
          <StaggerItem>
            <h1 className="max-w-3xl text-[2rem] font-semibold leading-[1.1] tracking-tight text-bb-bright sm:text-4xl md:text-6xl">
              Your market brief,
              <br />
              <span className="text-bb-accent">
                an hour before the bell.
                <span className="bb-caret ml-1.5 inline-block h-[0.78em] w-[0.5ch] translate-y-[0.06em] bg-bb-accent align-baseline" />
              </span>
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-bb-muted sm:mt-6 sm:text-base md:text-lg">
              Bellbrief reads the overnight news for the stocks and sectors you actually follow,
              summarises it, and shows you the source behind every sentence — sixty minutes before your
              exchange opens, in your timezone.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-bb-accent px-6 text-sm font-semibold text-bb-bg transition-all hover:brightness-110"
              >
                Get your first brief
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-bb-border px-6 text-sm text-bb-text transition-colors hover:border-bb-accent hover:text-bb-accent"
              >
                I already have an account
              </Link>
            </div>
          </StaggerItem>
        </Stagger>

        <Reveal delay={0.28} className="mt-10 sm:mt-14">
          <LandingCountdown markets={markets} />
        </Reveal>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 sm:px-6 md:pb-20">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={index * 0.08}>
              <Panel className="h-full p-5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6">
                <span className="bb-num text-2xl text-bb-accent">{step.n}</span>
                <h3 className="mt-4 text-base font-semibold text-bb-bright">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-bb-muted">{step.body}</p>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-6 md:pb-24">
        <Reveal>
          <Panel className="overflow-hidden p-0">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-bb-border p-6 sm:p-8 md:border-b-0 md:border-r">
                <p className="bb-label">Why the receipts matter</p>
                <h2 className="mt-4 text-xl font-semibold leading-tight text-bb-bright sm:text-2xl">
                  Most summaries hide their sources. Ours are checked.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-bb-muted">
                  Language models cite things that do not exist. So Bellbrief verifies every citation
                  against the articles it actually fetched, and any sentence whose source cannot be
                  resolved is deleted before you ever see it. When outlets disagree, the brief says so
                  instead of blending them into one confident paragraph.
                </p>

                <dl className="mt-7 grid grid-cols-3 gap-3 border-t border-bb-border pt-6">
                  {[
                    { value: EXCHANGES.length, label: 'exchanges' },
                    { value: SECTORS.length, label: 'sectors' },
                    { value: THEMES.length, label: 'themes' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <dd className="bb-num text-2xl text-bb-accent sm:text-3xl">
                        <CountUp to={stat.value} />
                      </dd>
                      <dt className="bb-label mt-1">{stat.label}</dt>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="bg-bb-panel-2 p-6 sm:p-8">
                <p className="bb-label mb-4">What runs every morning</p>
                <ol className="space-y-2.5">
                  {PIPELINE.map((stage) => (
                    <li key={stage.n} className="rounded-lg border-l-2 border-bb-accent bg-bb-panel p-3">
                      <p className="text-[13px] font-medium leading-snug text-bb-text">
                        <span className="bb-num mr-2 text-bb-accent">{stage.n}</span>
                        {stage.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-bb-faint">{stage.body}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      <footer className="relative border-t border-bb-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 text-xs text-bb-faint sm:px-6 sm:py-8 md:flex-row md:items-center md:justify-between">
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
