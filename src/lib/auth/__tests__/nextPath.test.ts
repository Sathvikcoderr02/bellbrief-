import { describe, expect, it } from 'vitest'
import { safeNextPath } from '../nextPath'

describe('safeNextPath', () => {
  it('keeps a same-origin path', () => {
    expect(safeNextPath('/archive')).toBe('/archive')
    expect(safeNextPath('/digest/abc?tab=proof')).toBe('/digest/abc?tab=proof')
  })

  it('falls back when nothing was requested', () => {
    expect(safeNextPath(undefined)).toBe('/dashboard')
    expect(safeNextPath(null)).toBe('/dashboard')
    expect(safeNextPath('')).toBe('/dashboard')
  })

  it('refuses to send the browser to another origin', () => {
    expect(safeNextPath('https://example.com/phish')).toBe('/dashboard')
    expect(safeNextPath('//example.com/phish')).toBe('/dashboard')
    expect(safeNextPath('/\\example.com')).toBe('/dashboard')
    expect(safeNextPath('javascript:alert(1)')).toBe('/dashboard')
  })

  it('honours a caller-supplied fallback', () => {
    expect(safeNextPath(undefined, '/onboarding')).toBe('/onboarding')
  })
})
