// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BellGroup } from '@/lib/markets'
import { BellTimeline } from '../BellTimeline'

const group = (openIso: string, codes: string[]): BellGroup => ({
  openIso,
  briefIso: new Date(Date.parse(openIso) - 3_600_000).toISOString(),
  sessionDate: openIso.slice(0, 10),
  members: codes.map((code) => ({ code, label: code, zone: 'UTC', openLocal: '09:30' })),
})

describe('BellTimeline', () => {
  it('names every exchange that shares a bell on one row', () => {
    render(<BellTimeline groups={[group('2026-09-14T13:30:00Z', ['NASDAQ', 'NYSE', 'TSX'])]} />)
    expect(screen.getByText('NASDAQ · NYSE · TSX')).toBeInTheDocument()
  })

  it('renders one row per bell group', () => {
    render(
      <BellTimeline
        groups={[
          group('2026-09-14T13:30:00Z', ['NASDAQ']),
          group('2026-09-15T03:45:00Z', ['NSE', 'BSE']),
        ]}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows both the brief time and the open time for each bell', () => {
    render(<BellTimeline groups={[group('2026-09-14T13:30:00Z', ['NASDAQ'])]} />)
    // Rendered in the test runner's local zone, so assert the shape not the value.
    const times = screen.getAllByText(/^\d{2}:\d{2}$/)
    expect(times.length).toBeGreaterThanOrEqual(2)
  })

  it('says it is showing local time, since that is the whole point', () => {
    render(<BellTimeline groups={[group('2026-09-14T13:30:00Z', ['NASDAQ'])]} />)
    expect(screen.getByText(/your local time/i)).toBeInTheDocument()
  })

  it('renders without throwing for no bells at all', () => {
    expect(() => render(<BellTimeline groups={[]} />)).not.toThrow()
  })
})
