import { z } from 'zod'
import { isSupportedExchange } from '@/lib/markets'
import { SECTORS, THEMES } from '@/lib/news'

const sectorIds = SECTORS.map((sector) => sector.id) as [string, ...string[]]
const themeIds = THEMES.map((theme) => theme.id) as [string, ...string[]]

/**
 * Shared by onboarding and settings so the two can never validate differently.
 */
export const profileInputSchema = z
  .object({
    exchanges: z
      .array(z.string())
      .min(1, 'Pick at least one exchange')
      .max(4, 'Four exchanges is the maximum')
      .refine((codes) => codes.every(isSupportedExchange), 'That exchange is not supported'),
    sectors: z.array(z.enum(sectorIds)).max(SECTORS.length).default([]),
    tickers: z.array(z.string().min(1).max(20)).max(25).default([]),
    themes: z.array(z.enum(themeIds)).max(THEMES.length).default([]),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    riskAppetite: z.enum(['conservative', 'balanced', 'aggressive']),
    horizon: z.enum(['intraday', 'swing', 'long-term']),
    emailOptIn: z.boolean().default(true),
  })
  .refine((data) => data.sectors.length + data.tickers.length + data.themes.length >= 2, {
    message: 'Pick at least two interests so we know what to look for',
  })

export type ProfileInput = z.infer<typeof profileInputSchema>

/** Tickers are matched case-sensitively downstream, so normalise on the way in. */
export function normaliseTickers(tickers: string[]): string[] {
  return [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))]
}
