import type { CollectedArticle } from '@/lib/news'
import { generateWithGemini, type Generate } from './gemini'
import { buildDigestPrompt, PROMPT_VERSION, type PromptContext, type PromptProfile } from './prompt'
import { GEMINI_MODEL } from './schema'
import { validateCitations, type RawDigest } from './validate'

export interface SummariseResult {
  status: 'ready' | 'quiet' | 'degraded'
  digest: RawDigest
  droppedSentences: number
  model: string
  promptVersion: string
  tokensUsed?: number
  error?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function stripFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
}

function quietDigest(message: string): RawDigest {
  return { headline: 'Quiet morning', overview: message, sentiment: 'quiet', narrative: [], claims: [] }
}

/**
 * The fallback that keeps the "never fabricate" promise: when the model cannot
 * be reached, the reader gets the headlines we actually fetched with an explicit
 * label, rather than a summary invented without sources.
 */
function degradedDigest(articles: CollectedArticle[]): RawDigest {
  return {
    headline: 'SUMMARY UNAVAILABLE — headlines only',
    overview: `The summariser could not be reached, so the ${articles.length} most relevant headlines are listed below unsummarised.`,
    sentiment: 'mixed',
    narrative: [],
    claims: [],
  }
}

export async function summarise(
  articles: CollectedArticle[],
  profile: PromptProfile,
  opts: {
    generate?: Generate
    retries?: number
    retryDelayMs?: number
    /** Defaults to now, which is correct for an immediate run. */
    context?: Partial<PromptContext>
  } = {},
): Promise<SummariseResult> {
  const base = { model: GEMINI_MODEL, promptVersion: PROMPT_VERSION, droppedSentences: 0 }

  if (articles.length === 0) {
    return {
      ...base,
      status: 'quiet',
      digest: quietDigest('No news matching your interests was published overnight.'),
    }
  }

  const generate = opts.generate ?? generateWithGemini
  const retries = opts.retries ?? 2
  const retryDelayMs = opts.retryDelayMs ?? 1_500
  const prompt = buildDigestPrompt(articles, profile, {
    digestInstant: opts.context?.digestInstant ?? new Date(),
    sessionDate: opts.context?.sessionDate,
    openLocal: opts.context?.openLocal,
  })

  let lastError = 'unknown error'

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs * attempt)

    try {
      const { text, usage } = await generate({ prompt })
      const parsed = JSON.parse(stripFence(text)) as RawDigest
      const { digest, droppedSentences, degraded } = validateCitations(parsed, articles.length)

      if (digest.sentiment === 'quiet' && digest.narrative.length === 0) {
        return { ...base, status: 'quiet', digest, droppedSentences, tokensUsed: usage }
      }

      return {
        ...base,
        status: degraded ? 'degraded' : 'ready',
        digest,
        droppedSentences,
        tokensUsed: usage,
      }
    } catch (error) {
      lastError = (error as Error).message
    }
  }

  return { ...base, status: 'degraded', digest: degradedDigest(articles), error: lastError }
}
