// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TileGrid } from '../TileGrid'

const options = [
  { id: 'technology', label: 'Technology' },
  { id: 'banking', label: 'Banking & Finance', sub: 'lenders and insurers' },
]

describe('TileGrid', () => {
  it('reports the toggled id', () => {
    const onToggle = vi.fn()
    render(<TileGrid options={options} selected={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Technology' }))
    expect(onToggle).toHaveBeenCalledWith('technology')
  })

  it('exposes selection state to assistive technology', () => {
    render(<TileGrid options={options} selected={['technology']} onToggle={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Technology' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Banking & Finance' })).toHaveAttribute('aria-checked', 'false')
  })

  it('renders the sub label when given', () => {
    render(<TileGrid options={options} selected={[]} onToggle={vi.fn()} />)
    expect(screen.getByText('lenders and insurers')).toBeInTheDocument()
  })

  it('renders nothing but the container for an empty option list', () => {
    render(<TileGrid options={[]} selected={[]} onToggle={vi.fn()} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('starts at two columns, so a long option list is not an endless phone scroll', () => {
    const { container } = render(
      <TileGrid options={options} selected={[]} onToggle={vi.fn()} columns={3} />,
    )
    expect(container.firstChild).toHaveClass('grid-cols-2')
  })

  it('gives every tile a touch-sized target', () => {
    render(<TileGrid options={options} selected={[]} onToggle={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Technology' })).toHaveClass('min-h-16')
  })

  it('allows deselecting an active tile', () => {
    const onToggle = vi.fn()
    render(<TileGrid options={options} selected={['technology']} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Technology' }))
    expect(onToggle).toHaveBeenCalledWith('technology')
  })
})
