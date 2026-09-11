import { describe, expect, it } from 'vitest'
import { DIGEST_LEAD_MINUTES } from '../clock'
import { EXCHANGES } from '../exchanges'
import { nextBellGroups, nextDistinctBells } from '../upcoming'

// A Monday, mid-morning UTC, so several bells are still ahead of it.
const MONDAY = new Date('2026-09-14T12:00:00Z')

describe('nextDistinctBells', () => {
  it('returns the requested number of bells', () => {
    expect(nextDistinctBells(3, MONDAY)).toHaveLength(3)
  })

  it('orders them soonest first', () => {
    const times = nextDistinctBells(6, MONDAY).map((bell) => Date.parse(bell.briefIso))
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('never lists two exchanges that ring at the same moment', () => {
    const bells = nextDistinctBells(EXCHANGES.length, MONDAY)
    const instants = bells.map((bell) => bell.openIso)
    expect(new Set(instants).size).toBe(instants.length)
  })

  it('puts the brief exactly one lead time before the bell', () => {
    for (const bell of nextDistinctBells(4, MONDAY)) {
      expect(Date.parse(bell.openIso) - Date.parse(bell.briefIso)).toBe(DIGEST_LEAD_MINUTES * 60_000)
    }
  })

  it('reports each bell against a real trading session', () => {
    for (const bell of nextDistinctBells(4, MONDAY)) {
      expect(bell.sessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Date.parse(bell.openIso)).toBeGreaterThan(MONDAY.getTime())
    }
  })

  it('carries the exchange registry values rather than its own copy', () => {
    for (const bell of nextDistinctBells(5, MONDAY)) {
      const exchange = EXCHANGES.find((candidate) => candidate.code === bell.code)
      expect(exchange).toBeDefined()
      expect(bell.openLocal).toBe(exchange!.openLocal)
      expect(bell.zone).toBe(exchange!.timeZone)
    }
  })
})

describe('nextBellGroups', () => {
  it('groups exchanges that ring at the same instant', () => {
    const groups = nextBellGroups(MONDAY)
    const withNy = groups.find((group) => group.members.some((m) => m.code === 'NASDAQ'))
    expect(withNy!.members.map((m) => m.code).sort()).toEqual(['NASDAQ', 'NYSE', 'TSX'])
  })

  it('groups the Indian exchanges together', () => {
    const groups = nextBellGroups(MONDAY)
    const india = groups.find((group) => group.members.some((m) => m.code === 'NSE'))
    expect(india!.members.map((m) => m.code).sort()).toEqual(['BSE', 'NSE'])
  })

  it('accounts for every exchange exactly once', () => {
    const codes = nextBellGroups(MONDAY).flatMap((group) => group.members.map((m) => m.code))
    expect(codes.sort()).toEqual(EXCHANGES.map((e) => e.code).sort())
  })

  it('orders groups soonest first', () => {
    const times = nextBellGroups(MONDAY).map((group) => Date.parse(group.openIso))
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('puts the brief one lead time before each grouped bell', () => {
    for (const group of nextBellGroups(MONDAY)) {
      expect(Date.parse(group.openIso) - Date.parse(group.briefIso)).toBe(DIGEST_LEAD_MINUTES * 60_000)
    }
  })
})
