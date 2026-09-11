// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DigestView, type DigestViewModel } from '../DigestView'

const digest: DigestViewModel = {
  _id: 'd1',
  status: 'ready',
  exchange: 'NSE',
  sessionDate: '2026-09-10',
  headline: 'IT majors under pressure',
  overview: 'Guidance cuts weigh on services names.',
  sentiment: 'risk-off',
  narrative: [
    { text: 'Accenture cut its full-year guidance.', citations: [0] },
    { text: 'Indian IT ADRs fell overnight.', citations: [0, 1] },
  ],
  claims: [
    { claim: 'Accenture cut guidance', sources: [0, 1], agreement: 'corroborated', confidence: 0.92 },
    {
      claim: 'The weakness is structural',
      sources: [1],
      agreement: 'disputed',
      confidence: 0.4,
      note: 'ET says structural, CNBC says cyclical',
    },
    { claim: 'INFY to crash 20%', sources: [], agreement: 'discarded', confidence: 0, note: 'unsourced blog' },
  ],
  articles: [
    { index: 0, url: 'https://reuters.com/a', title: 'Accenture trims forecast', source: 'Reuters', publishedAt: '2026-09-10T02:00:00Z' },
    { index: 1, url: 'https://livemint.com/b', title: 'IT ADRs slip', source: 'Mint', publishedAt: '2026-09-10T03:00:00Z' },
  ],
  droppedSentences: 0,
}

describe('DigestView', () => {
  it('shows the narrative by default', () => {
    render(<DigestView digest={digest} />)
    expect(screen.getByText(/Accenture cut its full-year guidance/)).toBeInTheDocument()
  })

  it('renders each citation as a link to the real source URL', () => {
    render(<DigestView digest={digest} />)
    expect(screen.getAllByRole('link', { name: '[1]' })[0]).toHaveAttribute('href', 'https://reuters.com/a')
    expect(screen.getByRole('link', { name: '[2]' })).toHaveAttribute('href', 'https://livemint.com/b')
  })

  it('lists every source with its outlet name', () => {
    render(<DigestView digest={digest} />)
    expect(screen.getByRole('link', { name: 'Accenture trims forecast' })).toBeInTheDocument()
    expect(screen.getByText(/— Mint/)).toBeInTheDocument()
  })

  it('silently omits a citation marker whose article is missing rather than rendering a dead link', () => {
    const broken = { ...digest, narrative: [{ text: 'Orphaned.', citations: [0, 99] }] }
    render(<DigestView digest={broken} />)
    expect(screen.queryByRole('link', { name: '[100]' })).not.toBeInTheDocument()
    expect(screen.getByText(/Orphaned/)).toBeInTheDocument()
  })

  it('switches to the Proof tab and shows the claim ledger', async () => {
    render(<DigestView digest={digest} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    // AnimatePresence mode="wait" holds the outgoing panel until its exit
    // animation resolves, so the ledger appears a frame later.
    await waitFor(() => expect(screen.getByText('Accenture cut guidance')).toBeInTheDocument())
    expect(screen.getByText(/2 sources agree/i)).toBeInTheDocument()
  })

  it('counts the claims on the Proof tab label', () => {
    render(<DigestView digest={digest} />)
    expect(screen.getByRole('tab', { name: 'Proof (3)' })).toBeInTheDocument()
  })

  it('labels a disputed claim as disputed and shows the disagreement note', async () => {
    render(<DigestView digest={digest} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    await waitFor(() => expect(screen.getByText(/sources disagree/i)).toBeInTheDocument())
    expect(screen.getByText(/ET says structural/)).toBeInTheDocument()
  })

  it('shows a discarded claim as discarded rather than hiding it', async () => {
    render(<DigestView digest={digest} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    await waitFor(() => expect(screen.getByText('INFY to crash 20%')).toBeInTheDocument())
    // Struck through in the ledger rather than merely labelled somewhere: the
    // claim-mix chart above also names the class, so a loose text query would
    // now pass without the rejected claim being shown at all.
    expect(screen.getByText('INFY to crash 20%')).toHaveClass('line-through')
    expect(screen.getByText('unsourced blog')).toBeInTheDocument()
  })

  it('renders proof source chips as links to the article', async () => {
    render(<DigestView digest={digest} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'Reuters' })[0]).toHaveAttribute('href', 'https://reuters.com/a'),
    )
  })

  it('always shows the no-advice disclaimer', () => {
    render(<DigestView digest={digest} />)
    expect(screen.getByText(/not.*investment advice/i)).toBeInTheDocument()
  })

  it('warns prominently when the digest is degraded', () => {
    render(<DigestView digest={{ ...digest, status: 'degraded', narrative: [] }} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be generated/i)
  })

  it('handles a quiet digest with no narrative and no articles', () => {
    render(
      <DigestView
        digest={{ ...digest, status: 'quiet', sentiment: 'quiet', narrative: [], claims: [], articles: [] }}
      />,
    )
    expect(screen.getByText(/No summarised narrative/i)).toBeInTheDocument()
  })

  it('reports how many sentences were dropped for unresolvable citations', () => {
    render(<DigestView digest={{ ...digest, droppedSentences: 2 }} />)
    expect(screen.getByText(/2 this session/)).toBeInTheDocument()
  })
})
