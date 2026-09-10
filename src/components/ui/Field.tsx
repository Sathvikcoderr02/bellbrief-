import type { InputHTMLAttributes } from 'react'

export function Field({
  label,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="bb-label mb-2 block">{label}</span>
      <input
        {...rest}
        className="w-full rounded-lg border border-bb-border bg-bb-panel-2 px-3.5 py-2.5 text-sm text-bb-text outline-none transition-colors placeholder:text-bb-faint focus:border-bb-accent"
      />
      {error ? <span className="mt-1.5 block text-xs text-bb-red">{error}</span> : null}
    </label>
  )
}
