export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = { sm: 'text-[11px]', md: 'text-[13px]', lg: 'text-[15px]' }[size]
  return <span className={`font-mono font-medium tracking-[0.26em] text-bb-accent ${scale}`}>BELLBRIEF</span>
}
