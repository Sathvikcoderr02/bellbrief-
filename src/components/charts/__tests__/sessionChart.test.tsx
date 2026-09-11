// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionSlice } from '@/lib/market/session'
import { SessionChart } from '../SessionChart'

const bar = (t: string, o: number, c: number) => ({ t, o, c, h: Math.max(o, c) + 2, l: Math.min(o, c) - 2 })

const slice = (over: Partial<SessionSlice> = {}): SessionSlice => ({
  symbol: '^NSEI',
  name: 'NIFTY 50',
  currency: 'INR',
  zone: 'Asia/Kolkata',
  sessionDate: '2026-09-11',
  bars: [
    bar('2026-09-11T03:45:00.000Z', 110, 112),
    bar('2026-09-11T04:00:00.000Z', 112, 111),
    bar('2026-09-11T04:15:00.000Z', 111, 115),
  ],
  previousClose: 100,
  openIso: '2026-09-11T03:45:00.000Z',
  briefIso: '2026-09-11T02:45:00.000Z',
  gapPercent: 10,
  changePercent: 15,
  ...over,
})

describe('SessionChart', () => {
  it('draws one candle group per bar', () => {
    const { container } = render(<SessionChart slice={slice()} />)
    expect(container.querySelectorAll('rect')).toHaveLength(3)
  })

  it('fills rising bodies and leaves falling ones hollow, so colour is not the only cue', () => {
    const { container } = render(<SessionChart slice={slice()} />)
    const fills = [...container.querySelectorAll('rect')].map((r) => r.getAttribute('fill'))
    expect(fills[0]).toBe('currentColor')
    expect(fills[1]).toBe('var(--bb-panel)')
    expect(fills[2]).toBe('currentColor')
  })

  it('draws a line for the brief and one for the bell', () => {
    const { container } = render(<SessionChart slice={slice()} />)
    expect(container.querySelector('[data-marker="brief"]')).toBeTruthy()
    expect(container.querySelector('[data-marker="bell"]')).toBeTruthy()
  })

  it('leaves the brief line unlabelled, since the caption explains it', () => {
    render(<SessionChart slice={slice()} />)
    expect(screen.queryByText(/your brief/)).toBeNull()
    expect(screen.getByText(/^bell/)).toBeInTheDocument()
  })

  it('shows the gap and the session move as signed percentages', () => {
    render(<SessionChart slice={slice()} />)
    expect(screen.getByText('+10.00%')).toBeInTheDocument()
    expect(screen.getByText('+15.00%')).toBeInTheDocument()
  })

  it('signs a negative gap correctly', () => {
    render(<SessionChart slice={slice({ gapPercent: -2.5, changePercent: -1.25 })} />)
    expect(screen.getByText('-2.50%')).toBeInTheDocument()
  })

  it('labels the previous close the gap is measured from', () => {
    render(<SessionChart slice={slice()} />)
    expect(screen.getByText(/prev 100/)).toBeInTheDocument()
  })

  it('describes the whole session for assistive technology', () => {
    render(<SessionChart slice={slice()} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/NIFTY 50.*opened \+10\.00%/)
  })

  it('ships the bars as a table as well as a picture', () => {
    render(<SessionChart slice={slice()} />)
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 3 bars
  })

  it('places the brief strictly left of the opening bell and the first candle', () => {
    // The regression this guards: bars were laid out by array index while the
    // markers were laid out by timestamp, so the brief — an hour before the
    // first bar — clamped to the left edge and sat on top of the bell label.
    const { container } = render(<SessionChart slice={slice()} />)
    const xOf = (name: string) =>
      Number(container.querySelector(`[data-marker="${name}"] line`)!.getAttribute('x1'))
    const firstCandle = Number(container.querySelector('rect')!.getAttribute('x'))

    expect(xOf('brief')).toBeLessThan(xOf('bell'))
    expect(xOf('brief')).toBeLessThan(firstCandle)
  })

  it('anchors a right-hand marker to the end so its label stays inside the box', () => {
    // A brief close to the end of the plotted range must not run off the edge.
    const late = slice({ openIso: '2026-09-11T04:15:00.000Z' })
    const { container } = render(<SessionChart slice={late} />)
    const node = [...container.querySelectorAll('text')].find((n) =>
      n.textContent?.startsWith('bell'),
    )!
    expect(node.getAttribute('text-anchor')).toBe('end')
  })

  it('spaces candles by their real sampling interval, not by array position', () => {
    const { container } = render(<SessionChart slice={slice()} />)
    const xs = [...container.querySelectorAll('rect')].map((r) => Number(r.getAttribute('x')))
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    // 15-minute bars are evenly sampled, so their spacing must be even too.
    expect(Math.abs(gaps[0] - gaps[1])).toBeLessThan(0.01)
  })

  it('survives a dead-flat session without dividing by zero', () => {
    const flat = slice({
      bars: [bar('2026-09-11T03:45:00.000Z', 100, 100)],
      previousClose: 100,
      gapPercent: 0,
      changePercent: 0,
    })
    flat.bars = [{ t: '2026-09-11T03:45:00.000Z', o: 100, h: 100, l: 100, c: 100 }]
    const { container } = render(<SessionChart slice={flat} />)
    const rect = container.querySelector('rect')!
    expect(Number(rect.getAttribute('y'))).not.toBeNaN()
    expect(Number(rect.getAttribute('height'))).toBeGreaterThan(0)
  })
})
