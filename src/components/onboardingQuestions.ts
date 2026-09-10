import type { TileOption } from '@/components/ui/TileGrid'

export const EXPERIENCE_OPTIONS: TileOption[] = [
  { id: 'beginner', label: 'New to this', sub: 'Explain the jargon as you go' },
  { id: 'intermediate', label: 'Comfortable', sub: 'Standard market language is fine' },
  { id: 'advanced', label: 'Experienced', sub: 'Terse and quantitative, no hand-holding' },
]

export const RISK_OPTIONS: TileOption[] = [
  { id: 'conservative', label: 'Conservative', sub: 'Capital preservation first' },
  { id: 'balanced', label: 'Balanced', sub: 'Growth with guardrails' },
  { id: 'aggressive', label: 'Aggressive', sub: 'Happy with volatility' },
]

export const HORIZON_OPTIONS: TileOption[] = [
  { id: 'intraday', label: 'Intraday', sub: 'In and out the same day' },
  { id: 'swing', label: 'Weeks to months', sub: 'Riding a move' },
  { id: 'long-term', label: 'Years', sub: 'Buy and hold' },
]
