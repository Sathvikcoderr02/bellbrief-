'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { DigestClaim, NarrativeSentence } from '@/lib/db/models'
import { ClaimLedger } from './ClaimLedger'

export interface DigestViewArticle {
  index: number
  url: string
  title: string
  source: string
  publishedAt: string | Date
}

export interface DigestViewModel {
  _id: string
  status: 'ready' | 'quiet' | 'degraded' | 'failed'
  exchange: string
  sessionDate: string
  headline: string
  overview: string
  sentiment: string
  narrative: NarrativeSentence[]
  claims: DigestClaim[]
  articles: DigestViewArticle[]
  droppedSentences?: number
}

const SENTIMENT_TONE: Record<string, string> = {
  'risk-on': 'text-bb-accent',
  'risk-off': 'text-bb-red',
  mixed: 'text-bb-amber',
  quiet: 'text-bb-muted',
}

export function DigestView({ digest }: { digest: DigestViewModel }) {
  const [tab, setTab] = useState<'narrative' | 'proof'>('narrative')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="bb-label">
          {digest.exchange} &middot; session {digest.sessionDate}
        </span>
        <span className={`bb-label ${SENTIMENT_TONE[digest.sentiment] ?? 'text-bb-muted'}`}>{digest.sentiment}</span>
      </div>

      <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-bb-bright md:text-3xl">
        {digest.headline}
      </h1>
      {digest.overview ? <p className="mt-3 text-sm leading-relaxed text-bb-muted">{digest.overview}</p> : null}

      {digest.status === 'degraded' ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-bb-amber/40 bg-bb-amber/10 px-4 py-3 text-xs leading-relaxed text-bb-amber"
        >
          The summary could not be generated for this session, so only the raw headlines are shown below.
          Nothing here has been paraphrased or inferred.
        </p>
      ) : null}

      <div role="tablist" aria-label="Digest views" className="mt-7 flex gap-1 border-b border-bb-border">
        {(
          [
            ['narrative', 'Narrative'],
            ['proof', `Proof (${digest.claims.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative px-4 py-2.5 text-[13px] transition-colors ${
              tab === id ? 'text-bb-accent' : 'text-bb-muted hover:text-bb-text'
            }`}
          >
            {label}
            {tab === id ? (
              <motion.span layoutId="digest-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-bb-accent" />
            ) : null}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          {tab === 'narrative' ? (
            <div>
              {digest.narrative.length > 0 ? (
                <p className="text-[15px] leading-[1.9] text-bb-text">
                  {digest.narrative.map((sentence, sentenceIndex) => (
                    <span key={sentenceIndex}>
                      {sentence.text}{' '}
                      {sentence.citations.map((citation) => {
                        const article = digest.articles.find((candidate) => candidate.index === citation)
                        if (!article) return null
                        return (
                          <a
                            key={citation}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${article.title} — ${article.source}`}
                            className="align-super font-mono text-[10px] text-bb-accent hover:underline"
                          >
                            [{citation + 1}]
                          </a>
                        )
                      })}{' '}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-sm text-bb-muted">No summarised narrative for this session.</p>
              )}

              {digest.articles.length > 0 ? (
                <div className="mt-9">
                  <p className="bb-label mb-3">Sources</p>
                  <ol className="space-y-2">
                    {digest.articles.map((article) => (
                      <li key={article.index} className="text-[13px] leading-relaxed">
                        <span className="font-mono text-[11px] text-bb-accent">[{article.index + 1}]</span>{' '}
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-bb-text hover:text-bb-accent hover:underline"
                        >
                          {article.title}
                        </a>
                        <span className="text-bb-faint"> — {article.source}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : (
            <ClaimLedger claims={digest.claims} articles={digest.articles} />
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-10 border-t border-bb-border pt-5 text-[11px] leading-relaxed text-bb-faint">
        Bellbrief summarises published news and links every claim to its source. Citations are verified
        against the articles actually fetched; any sentence whose source could not be resolved was removed
        {digest.droppedSentences ? ` (${digest.droppedSentences} this session)` : ''}. This is not
        investment advice.
      </p>
    </div>
  )
}
