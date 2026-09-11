import type { ExperienceLevel } from '@/lib/db/models'
import type { CollectedArticle } from '@/lib/news'

/** Stored on every digest so a prompt change is attributable after the fact. */
export const PROMPT_VERSION = 'p2'

const REGISTER: Record<ExperienceLevel, string> = {
  beginner:
    'The reader is a BEGINNER. The first time you use any market term (guidance, ADR, basis points, dilution, short interest, market cap), add a four-to-eight word plain-English gloss in parentheses. Prefer short sentences.',
  intermediate:
    'The reader is an INTERMEDIATE investor. Standard market vocabulary is fine. Do not explain common terms.',
  advanced:
    'The reader is ADVANCED. Use precise market vocabulary with no explanation. Be terse and quantitative; lead with numbers.',
}

/** When the brief is being written, and for which session. */
export interface PromptContext {
  /** The instant the brief is sent — the "now" the model reasons from. */
  digestInstant: Date
  /** The trading session the brief is for, 'YYYY-MM-DD'. */
  sessionDate?: string
  /** Opening time in the exchange's own zone, 'HH:mm'. */
  openLocal?: string
}

export interface PromptProfile {
  experienceLevel: ExperienceLevel
  tickers?: string[]
  sectors?: string[]
  themes?: string[]
  exchanges?: string[]
  riskAppetite?: string
  horizon?: string
}

/**
 * How old an article was when the brief went out. Models reason about "2h ago"
 * far more reliably than about the difference between two ISO timestamps, and
 * getting overnight news ahead of yesterday's depends on that arithmetic.
 */
function ageLabel(article: CollectedArticle, digestInstant: Date): string {
  if (article.publishedAtEstimated) return 'timing unknown — the feed gave no date'
  const minutes = Math.max(
    0,
    Math.round((digestInstant.getTime() - article.publishedAt.getTime()) / 60_000),
  )
  if (minutes < 60) return `${minutes}m before this brief`
  return `${Math.round(minutes / 60)}h before this brief`
}

/**
 * Every rule below exists because of a specific failure mode, and each is
 * written as a constraint rather than a request. The mechanical citation check
 * in `validate.ts` is what actually enforces rule 2; this prompt exists to make
 * the model comply in the first place rather than lose half its sentences.
 */
export function buildDigestPrompt(
  articles: CollectedArticle[],
  profile: PromptProfile,
  context: PromptContext,
): string {
  const corpus = articles
    .map(
      (article, index) =>
        `[${index}] SOURCE: ${article.source}\n    PUBLISHED: ${article.publishedAt.toISOString()} (${ageLabel(article, context.digestInstant)})\n    TITLE: ${article.title}\n    SUMMARY: ${article.snippet || '(headline only)'}`,
    )
    .join('\n\n')

  const lastIndex = articles.length - 1

  const session = context.sessionDate ? ` for the ${context.sessionDate} session` : ''
  const opens = context.openLocal ? `, which opens at ${context.openLocal} local time` : ''

  return `You are the research desk for Bellbrief, a pre-market briefing service. You are writing the brief that one reader will see sixty minutes before ${(profile.exchanges ?? ['their exchange']).join(' and ')} opens${session}${opens}.

It is now ${context.digestInstant.toISOString()}. Every age below is measured from that instant.

## Reader
Follows these tickers: ${(profile.tickers ?? []).join(', ') || 'none specified'}
Follows these sectors: ${(profile.sectors ?? []).join(', ') || 'none specified'}
Follows these themes: ${(profile.themes ?? []).join(', ') || 'none specified'}
Risk appetite: ${profile.riskAppetite ?? 'balanced'}. Holding horizon: ${profile.horizon ?? 'long-term'}.
${REGISTER[profile.experienceLevel]}

## Source material — ${articles.length} articles, each with a numbered index
The articles are ordered by relevance to this reader, NOT by time. Use the age on each one to reason about chronology; do not assume [0] is the newest.
${corpus}

## Absolute rules

1. GROUNDING. Use ONLY the numbered articles above. You have no other knowledge of these companies, prices, or events. If a fact is not in the text above, it does not exist for this task. Never supply a figure, date, percentage, or quotation that does not appear above.

2. CITATION. Every sentence in \`narrative\` MUST carry at least one index in its \`citations\` array, and every index MUST be one that appears above. A sentence you cannot cite is a sentence you must not write. Indexes are integers, never strings, never ranges.

3. NO INVENTED INDEXES. Valid indexes are 0 to ${lastIndex} inclusive. Citations are checked mechanically after you respond and any sentence with an unresolvable index is deleted outright, so an uncitable sentence is strictly worse than no sentence.

4. CLAIM CLASSIFICATION. In \`claims\`, decompose the story into individual factual assertions and classify each honestly:
   - "corroborated" — asserted by TWO OR MORE independent sources. List every supporting index.
   - "disputed" — the sources CONFLICT. State the disagreement in \`note\`. Do NOT average the positions, pick a winner, or smooth it over. A reader is far better served by "these two outlets disagree" than by a confident blend.
   - "single-source" — only one source asserts it. Still list that source.
   - "discarded" — opinion presented as fact, promotional content, price-target speculation, or unsourced rumour. Include it with agreement "discarded" and a one-line reason in \`note\`, so the reader can see what you rejected and why.

5. NO ADVICE. Report what the sources reported. Never recommend buying, selling, holding, entering, exiting, or sizing anything. Never forecast a price. Never write "investors should".

6. RELEVANCE. Lead with what actually moves this reader's stated interests. A major story unrelated to those interests belongs at the end, or not at all.

7. RECENCY. This is a pre-market brief, so the overnight window matters most. Lead with what broke since the previous close and treat older items as background. Where two articles conflict on the same fact, the MORE RECENT one is authoritative — say that it supersedes the earlier figure rather than reporting both as equally true, and never present a number that a later article has already corrected. If the freshest thing available on a story is more than twelve hours old, say so in the sentence rather than implying it is news. An article marked "timing unknown" carries no date at all, so it can NEVER be treated as the more recent source in a conflict and must never be described as breaking or overnight.

8. QUIET DAYS. If the articles contain nothing materially new for this reader, set \`sentiment\` to "quiet", write a one-sentence \`overview\` saying so, and leave \`narrative\` empty. Never inflate trivia into a headline. A short honest brief is a success, not a failure.

9. FORM. \`headline\`: at most 60 characters, no ticker soup, no exclamation marks. \`overview\`: exactly one sentence. \`narrative\`: 3 to 6 sentences that read as continuous prose, not bullet fragments. Plain declarative English. No emoji, no markdown.

Respond with JSON matching the provided schema exactly. No markdown fence, no commentary.`
}
