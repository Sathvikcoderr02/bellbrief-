import { describe, expect, it } from 'vitest'
import { displayZone, isSameZone } from '../zones'

describe('displayZone', () => {
  it('canonicalises the legacy alias browsers still report', () => {
    expect(displayZone('Asia/Calcutta')).toBe('Asia/Kolkata')
    expect(displayZone('Europe/Kiev')).toBe('Europe/Kyiv')
    expect(displayZone('US/Eastern')).toBe('America/New_York')
  })

  it('passes a canonical zone straight through', () => {
    expect(displayZone('Asia/Kolkata')).toBe('Asia/Kolkata')
    expect(displayZone('America/New_York')).toBe('America/New_York')
  })

  it('passes an unknown zone through rather than guessing', () => {
    expect(displayZone('Mars/Olympus_Mons')).toBe('Mars/Olympus_Mons')
  })
})

describe('isSameZone', () => {
  it('sees through an alias, so the dashboard does not claim a difference', () => {
    expect(isSameZone('Asia/Calcutta', 'Asia/Kolkata')).toBe(true)
  })

  it('still distinguishes genuinely different zones', () => {
    expect(isSameZone('Asia/Kolkata', 'America/New_York')).toBe(false)
  })
})
