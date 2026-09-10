import type { RawItem } from './normalise'
import { sectorById, themeById } from './taxonomy'

export interface ScoringProfile {
  tickers?: string[]
  sectors?: string[]
  themes?: string[]
  exchanges?: string[]
}

// Weights are ordered so a named ticker always outranks a sector, which always
// outranks a theme. The recency bonus is capped at 12 so it can break ties but
// never promote a merely-fresh article over a directly relevant one.
const TICKER_WEIGHT = 100
const SECTOR_WEIGHT = 40
const THEME_WEIGHT = 15
const MAX_RECENCY_BONUS = 12

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function scoreArticle(item: RawItem, profile: ScoringProfile) {
  const haystack = ` ${item.title} ${item.snippet} `.toLowerCase()
  const matchedTickers: string[] = []
  const matchedSectors: string[] = []
  let relevance = 0

  for (const ticker of profile.tickers ?? []) {
    // The word boundary stops "INFY" matching inside "Infymatic".
    if (new RegExp(`\\b${escapeRegex(ticker.toLowerCase())}\\b`).test(haystack)) {
      matchedTickers.push(ticker)
      relevance += TICKER_WEIGHT
    }
  }

  for (const id of profile.sectors ?? []) {
    if (sectorById.get(id)?.keywords.some((keyword) => haystack.includes(keyword))) {
      matchedSectors.push(id)
      relevance += SECTOR_WEIGHT
    }
  }

  for (const id of profile.themes ?? []) {
    if (themeById.get(id)?.keywords.some((keyword) => haystack.includes(keyword))) {
      relevance += THEME_WEIGHT
    }
  }

  if (relevance > 0) {
    const ageHours = (Date.now() - item.publishedAt.getTime()) / 3_600_000
    relevance += Math.max(0, MAX_RECENCY_BONUS - ageHours)
  }

  return { relevance, matchedTickers, matchedSectors }
}
