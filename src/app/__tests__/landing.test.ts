import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')

/**
 * The landing page may only show things that are true. It used to carry an
 * invented claim ledger and its own copy of three exchanges' opening times,
 * which would silently drift from the registry the product actually runs on.
 * Both are enforced mechanically so neither can come back.
 */
describe('landing page shows only real data', () => {
  const page = read('app/(marketing)/page.tsx')
  const countdown = read('components/LandingCountdown.tsx')

  it('takes its markets from the exchange registry and the session clock', () => {
    expect(page).toContain('nextDistinctBells')
  })

  it('keeps no wall-clock time of its own in the countdown component', () => {
    expect(countdown).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('keeps no wall-clock time of its own in the page copy', () => {
    expect(page.replace(/\bopenLocal\b/g, '')).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('carries no fabricated claims or headlines', () => {
    for (const invented of [/LEDGER_SAMPLE/, /sources agree/i, /unsourced blog/i, /\bsample\b/i]) {
      expect(page).not.toMatch(invented)
    }
  })

  it('counts its figures from the real taxonomies', () => {
    expect(page).toContain('EXCHANGES.length')
    expect(page).toContain('SECTORS.length')
    expect(page).toContain('THEMES.length')
  })
})
