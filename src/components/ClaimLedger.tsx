import type { DigestClaim } from '@/lib/db/models'

interface ArticleLike {
  index: number
  url: string
  title: string
  source: string
}

const TONE: Record<
  string,
  { border: string; text: string; label: (claim: DigestClaim) => string }
> = {
  corroborated: {
    border: 'border-bb-accent',
    text: 'text-bb-accent',
    label: (claim) => `${claim.sources.length} sources agree`,
  },
  'single-source': { border: 'border-bb-border', text: 'text-bb-muted', label: () => 'single source' },
  disputed: { border: 'border-bb-amber', text: 'text-bb-amber', label: () => 'sources disagree' },
  discarded: { border: 'border-bb-border', text: 'text-bb-faint', label: () => 'discarded' },
}

/**
 * The Proof view. Discarded claims are shown rather than hidden — seeing what
 * was rejected, and why, is a large part of trusting what was kept.
 */
export function ClaimLedger({ claims, articles }: { claims: DigestClaim[]; articles: ArticleLike[] }) {
  if (claims.length === 0) {
    return <p className="text-sm text-bb-muted">No claims were extracted for this session.</p>
  }

  return (
    <div className="space-y-2.5">
      {claims.map((claim, index) => {
        const tone = TONE[claim.agreement] ?? TONE['single-source']
        return (
          <div key={index} className={`rounded-lg border-l-2 bg-bb-panel-2 p-4 ${tone.border}`}>
            <p
              className={`text-sm leading-snug ${
                claim.agreement === 'discarded' ? 'text-bb-faint line-through' : 'text-bb-text'
              }`}
            >
              {claim.claim}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {claim.sources.map((sourceIndex) => {
                const article = articles.find((candidate) => candidate.index === sourceIndex)
                if (!article) return null
                return (
                  <a
                    key={sourceIndex}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={article.title}
                    className="rounded border border-bb-border px-2 py-0.5 font-mono text-[10px] text-bb-accent transition-colors hover:border-bb-accent"
                  >
                    {article.source}
                  </a>
                )
              })}
              <span className={`bb-label ${tone.text}`}>{tone.label(claim)}</span>
            </div>

            {claim.note ? <p className="mt-2 text-[11px] leading-relaxed text-bb-faint">{claim.note}</p> : null}

            {claim.agreement !== 'discarded' ? (
              <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-bb-border">
                <div
                  className={claim.agreement === 'disputed' ? 'h-full bg-bb-amber' : 'h-full bg-bb-accent'}
                  style={{ width: `${Math.round(claim.confidence * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
