'use client'

import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-bb-accent text-bb-bg font-semibold hover:brightness-110',
  ghost: 'border border-bb-border text-bb-text hover:border-bb-accent hover:text-bb-accent',
  quiet: 'text-bb-muted hover:text-bb-text',
}

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  )
}
