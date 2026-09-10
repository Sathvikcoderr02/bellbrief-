export function Panel({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return <Tag className={`rounded-xl border border-bb-border bg-bb-panel ${className}`}>{children}</Tag>
}
