import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.join(process.cwd(), 'src')

/**
 * The no-pink-or-purple constraint is a hard product requirement, so it is
 * enforced mechanically rather than remembered. Same for the abandoned name.
 */
const BANNED_COLOURS = [
  /\bpink-\d/, /\bpurple-\d/, /\bfuchsia-\d/, /\bviolet-\d/,
  /#ff00ff/i, /#e91e63/i, /#9c27b0/i, /#673ab7/i, /#8b5cf6/i, /#a855f7/i,
  /\bmagenta\b/i, /rebeccapurple/i,
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : sourceFiles(full)
    return /\.(tsx?|css)$/.test(entry) && !full.includes('__tests__') ? [full] : []
  })
}

describe('brand constraints', () => {
  it('uses no pink or purple anywhere in src/', () => {
    const offences: string[] = []
    for (const file of sourceFiles(SRC)) {
      const content = readFileSync(file, 'utf8')
      for (const pattern of BANNED_COLOURS) {
        if (pattern.test(content)) offences.push(`${path.relative(SRC, file)} matches ${pattern}`)
      }
    }
    expect(offences).toEqual([])
  })

  it('never mentions the abandoned Nexora name', () => {
    const offences = sourceFiles(SRC)
      .filter((file) => /nexora/i.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file))
    expect(offences).toEqual([])
  })

  it('defines every Terminal Noir token', () => {
    const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
    for (const token of [
      '--bb-bg', '--bb-panel', '--bb-border', '--bb-text', '--bb-bright',
      '--bb-muted', '--bb-faint', '--bb-accent', '--bb-amber', '--bb-red',
    ]) {
      expect(css).toContain(token)
    }
  })

  it('defines a light theme override', () => {
    expect(readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')).toContain("[data-theme='light']")
  })

  it('ships a logo for each theme, and references both', () => {
    for (const file of ['logo-light.png', 'logo-dark.png']) {
      expect(existsSync(path.join(process.cwd(), 'public', file))).toBe(true)
    }
    const logo = readFileSync(path.join(SRC, 'components/ui/Logo.tsx'), 'utf8')
    expect(logo).toContain('/logo-light.png')
    expect(logo).toContain('/logo-dark.png')
  })

  it('ships the favicon set Next resolves by convention', () => {
    for (const file of ['favicon.ico', 'icon.png', 'apple-icon.png']) {
      expect(existsSync(path.join(SRC, 'app', file))).toBe(true)
    }
  })

  it('swaps the logo in CSS, so the right one is painted first time', () => {
    const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
    expect(css).toContain('.bb-logo-light')
    expect(css).toContain('.bb-logo-dark')
  })

  it('respects prefers-reduced-motion', () => {
    expect(readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')).toContain('prefers-reduced-motion')
  })
})
