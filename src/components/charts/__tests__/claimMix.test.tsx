// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DigestClaim } from '@/lib/db/models'
import { ClaimMix } from '../ClaimMix'

const claim = (agreement: string, sources: number[] = [0]): DigestClaim =>
  ({ claim: 'a claim', agreement, sources, confidence: 0.5 }) as DigestClaim

describe('ClaimMix', () => {
  it('renders nothing for an empty ledger rather than an empty bar', () => {
    const { container } = render(<ClaimMix claims={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names every class in the legend, so identity never depends on colour', () => {
    render(<ClaimMix claims={[claim('corroborated'), claim('disputed')]} />)
    // Scoped to the legend: the same labels also appear in the table view.
    const legend = within(screen.getByRole('list'))
    for (const label of ['Corroborated', 'Single source', 'Disputed', 'Discarded']) {
      expect(legend.getByText(label)).toBeInTheDocument()
    }
  })

  it('states the total and marks the classes as the model’s own', () => {
    render(<ClaimMix claims={[claim('corroborated'), claim('discarded')]} />)
    expect(screen.getByText(/2 claims/)).toBeInTheDocument()
    expect(screen.getByText(/classified by the model/i)).toBeInTheDocument()
  })

  it('describes the distribution for assistive technology', () => {
    render(<ClaimMix claims={[claim('corroborated'), claim('corroborated'), claim('disputed')]} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Corroborated 2 of 3/)
  })

  it('ships a table view of the same numbers', () => {
    render(<ClaimMix claims={[claim('corroborated')]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Corroborated' })).toBeInTheDocument()
  })

  it('counts distinct sources per kept claim, excluding discarded', () => {
    render(<ClaimMix claims={[claim('corroborated', [0, 1]), claim('discarded', [0, 1, 2])]} />)
    expect(screen.getByRole('rowheader', { name: /2 sources/ })).toBeInTheDocument()
    // The discarded claim's three sources must not appear in the 3+ bucket.
    const threePlus = screen.getByRole('rowheader', { name: /3\+ sources/ }).closest('tr')
    expect(threePlus!.querySelectorAll('td')[0].textContent).toBe('0')
  })

  it('survives a single class filling the whole bar', () => {
    render(<ClaimMix claims={[claim('corroborated'), claim('corroborated')]} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Corroborated 2 of 2')
  })
})
