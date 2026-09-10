# Bellbrief — Design Spec (Phase 1)

**Date:** 2026-09-10
**Status:** Approved for implementation
**Scope:** Phase 1 — interest profiles, news pipeline, AI digest, timezone-anchored scheduling, email delivery, UI.

---

## 1. Product

Bellbrief delivers one AI-summarised, source-cited news brief to each user **60 minutes before their exchange opens**, every trading day.

A user signs up, answers five questions about what they follow and how experienced they are, and from the next trading session onward finds a brief waiting on their dashboard — and in their inbox — an hour before the bell. Every sentence in that brief carries a citation resolving to a real article, and a Proof tab shows which claims the sources agree on and which they dispute.

**Name origin:** *bell* (the opening bell the product is timed against) + *brief*.

### Out of scope for Phase 1

Holdings, quantities, P&L, and live quote prices. Phase 1 captures *interests* only. Phase 2 adds a `holdings` collection and a market-data provider; the schema is designed so this requires no change to auth or profiles.

### Non-negotiable product constraints

- **Never fabricate a summary.** If Gemini fails, the digest ships as raw headlines labelled `SUMMARY UNAVAILABLE`.
- **Never show an unverifiable citation.** Citations are validated in code against the real article set; unresolvable ones cause the sentence to be dropped.
- **No investment advice.** The digest reports what sources said. It does not recommend actions. Enforced in the prompt and surfaced as a UI disclaimer.

---

## 2. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Stack | Next.js 15 App Router, TypeScript, Tailwind, Framer Motion | One deploy unit; SSR makes the dashboard instant; API routes co-located |
| Database | MongoDB Atlas via Mongoose, database `bellbrief` | Supplied by user |
| Auth | Own email + password, bcrypt + JWT in httpOnly cookie | No third-party dependency, full control of the user record |
| News source | Free RSS (Google News, Yahoo Finance, publisher feeds) | No extra API key; full control of the article set we feed the model |
| AI | Gemini `gemini-2.5-flash`, structured JSON output | Fast and cheap enough to run per-user daily |
| Markets | Global — user selects exchanges from a registry | Requirement: "works in any time zone" |
| Delivery | In-app dashboard + email via Resend | Chosen by user |
| Hosting | Local now with in-process minute scheduler, Vercel-ready | No hosting signup required today |
| Theme | "Terminal Noir" dark default, light toggle | Selected visually during brainstorming |
| Proofs | Footnoted narrative (default view) + claim-ledger Proof tab | Both rendered from one structured Gemini response |
| Onboarding | ≤5 questions, Spotify-style multi-select tile grids | Measures interests + experience level |

---

## 3. Architecture

Business logic lives in `lib/` as plain modules. API routes are thin wrappers over them. The pipeline is therefore testable without HTTP, and portable to a standalone worker or Vercel Cron without rewriting.

```
app/
  (marketing)/page.tsx          landing
  (auth)/login, /register
  onboarding/                   5-step wizard
  dashboard/                    countdown + latest digest
  digest/[id]/                  Narrative | Proof tabs
  archive/, settings/
  api/
    auth/{register,login,logout,me}
    onboarding/
    digest/{latest,[id]}
    cron/run                    secured manual/external trigger
lib/
  db/           mongoose singleton + models
  auth/         hashing, JWT, session helpers
  markets/      exchange registry + session clock       (pure)
  news/         feed resolver, fetcher, parser, dedupe, scorer
  ai/           gemini client, prompts, schema, citation validator
  digest/       orchestrator
  mail/         provider-agnostic mailer + templates
  scheduler/    minute tick, due detection, locking
```

### Module contracts

| Module | Does | Public surface | Depends on |
|---|---|---|---|
| `markets` | Knows every supported exchange's timezone, open time, trading days and holidays; computes the next session open and the T‑60 instant in UTC | `getExchange`, `nextSessionOpen`, `digestInstantFor`, `isDue` | nothing (pure) |
| `news` | Turns a profile into feed URLs, fetches them concurrently, parses, dedupes, scores relevance, caps the set | `collectArticles(profile, since)` | `markets` |
| `ai` | Builds the prompt, calls Gemini with a response schema, validates every citation | `summarise(articles, profile)` | nothing (HTTP mocked in tests) |
| `digest` | Orchestrates profile → articles → summary → persisted Digest | `generateDigest(userId, exchange, sessionDate)` | `news`, `ai`, `db` |
| `scheduler` | Every minute, finds exchanges at T‑60 and enqueues digests for their users, exactly once | `tick(now)`, `start()` | `markets`, `digest` |
| `mail` | Sends the digest email through a swappable driver | `sendDigestEmail(user, digest)` | nothing |
| `auth` | Registration, login, session read | `register`, `login`, `getSession` | `db` |

`markets` and the `ai` citation validator are pure functions and carry the heaviest test coverage — they are the two places where a bug would be silent rather than loud.

---

## 4. The timezone core

**The governing rule:**

> The trigger is anchored to the **exchange**. The display is rendered in the **user's** timezone.

A user in Berlin following NASDAQ receives their brief at 08:30 `America/New_York`, which their UI renders as 14:30 `Europe/Berlin`. It is the same instant for every NASDAQ user on earth; only the clock face differs. Firing instead at 08:30 in each user's own local zone would deliver briefs at arbitrary, meaningless moments — this is the single most important thing to get right.

### Exchange registry

Each entry stores:

```ts
{
  code: 'NASDAQ',
  label: 'NASDAQ (US)',
  timeZone: 'America/New_York',   // IANA — DST handled for us
  openLocal: '09:30',
  tradingDays: [1,2,3,4,5],       // Mon–Fri
  holidays: ['2026-01-01', ...],  // YYYY-MM-DD in exchange-local terms
}
```

Storing **IANA zone names rather than fixed UTC offsets** is what makes DST correct automatically — including the weeks each spring and autumn when the US and India drift relative to each other. Phase 1 registry: NASDAQ, NYSE, NSE, BSE, LSE, TSE, HKEX, Euronext Paris, Frankfurt (XETRA), ASX, TSX.

### Session clock

`nextSessionOpen(exchange, from)` walks forward from `from`, skipping non-trading weekdays and holidays, and returns the next open as a UTC instant. `digestInstantFor(exchange, sessionDate)` returns that open minus 60 minutes.

### Scheduler

A `node-cron` minute tick calls `tick(now)`:

1. For each exchange, compute the current session's digest instant.
2. If `now` falls in `[instant, instant + 2min)`, the exchange is due.
3. Claim a lock: `jobRuns.insertOne({ key: 'EXCHANGE:2026-09-10', ... })` where `key` is uniquely indexed. A duplicate-key error means another tick already claimed it — return.
4. Find users whose profile includes that exchange and who have opted in; generate digests with bounded concurrency.

**Idempotency is enforced at two levels:** the `jobRuns` unique key stops duplicate *runs*, and a unique index on `digests (userId, exchange, sessionDate)` stops duplicate *digests* even if a run is somehow repeated. A double-fire cannot produce two briefs.

**Catch-up:** on process start, `tick` is run for any digest instant that fell within the previous 3 hours, so a laptop that was asleep still backfills the morning's brief instead of silently skipping it.

A 2-minute detection window (rather than exact equality) tolerates tick jitter and brief process pauses. Combined with locking, a wider window costs nothing.

---

## 5. Data model — database `bellbrief`

**users**
`_id, email (unique, lowercased), passwordHash, name, timeZone (IANA), createdAt, lastLoginAt`

**profiles**
`_id, userId (unique ref), exchanges[], sectors[], tickers[], themes[], experienceLevel ('beginner'|'intermediate'|'advanced'), riskAppetite, horizon, emailOptIn, completedAt`

Separate from `users` so Phase 2 can add `holdings` without touching auth.

**articles**
`_id, url (unique), canonicalUrl, title, source, publishedAt, snippet, matchedTickers[], matchedSectors[], relevance, fetchedAt`
TTL index on `fetchedAt` (14 days). Articles are shared across users, so 500 NASDAQ users cost one fetch, not 500.

**digests**
```
_id, userId, exchange, sessionDate ('YYYY-MM-DD', exchange-local)
generatedAt, digestInstant, status: 'ready'|'quiet'|'degraded'|'failed'
headline, overview
narrative: [{ text, citations: [articleIndex] }]
claims:    [{ claim, sources: [articleIndex], agreement: 'corroborated'|'disputed'|'single-source'|'discarded', confidence: 0..1, note }]
sentiment: 'risk-on'|'risk-off'|'mixed'|'quiet'
articles:  [{ index, articleId, url, title, source, publishedAt }]
model, promptVersion, tokensUsed
emailStatus: 'pending'|'sent'|'failed'|'skipped', emailError
```
Unique index `(userId, exchange, sessionDate)`.

`articles` is embedded as an index→article map so a digest renders its own citations without a join, and stays readable after the TTL prunes the source documents.

**jobRuns**
`_id, key (unique), exchange, sessionDate, startedAt, finishedAt, usersProcessed, succeeded, failed, error`

---

## 6. News pipeline

**Feed resolution** — a profile becomes a set of feed URLs:

- per ticker: Yahoo Finance headline RSS
- per sector/theme: Google News RSS search, scoped by exchange region and recency
- per exchange: a curated publisher feed list (Reuters/WSJ/CNBC for US; Mint/Economic Times/Business Standard for India; and so on)

**Fetch** — concurrent with a cap of 6, an 8-second per-feed timeout, one retry on network failure. A dead feed is logged and skipped; it never fails the digest.

**Window** — articles published since the previous session's close, capped at 24 hours.

**Dedupe** — by canonical URL (query/tracking params stripped), then by normalised-title similarity, so the same wire story from five outlets collapses to one entry that records all five as sources.

**Score & cap** — exact ticker match outranks sector keyword, which outranks theme; recency breaks ties. Truncated to the top 35 articles, which bounds both token cost and the model's tendency to pad.

---

## 7. AI layer

### Why prompting alone is insufficient

Language models cite sources that do not exist. A prompt asking for citations produces *plausible-looking* citations. So "proofs" is enforced in two layers, and the second one is the guarantee:

**Layer 1 — the prompt.** Constraints, not suggestions:
- Use **only** the numbered articles supplied. No outside knowledge, no memory of these companies.
- Every narrative sentence must carry at least one citation index.
- Every claim must be classified `corroborated` (2+ independent sources), `disputed` (sources conflict — say so, do not average), `single-source`, or `discarded` (opinion, promotion, unsourced speculation).
- Adapt register to `experienceLevel`: define jargon for `beginner`, use it freely for `advanced`.
- Report what sources said. Never recommend buying, selling or holding.
- If the articles contain nothing material, return `quiet` rather than inflating trivia.

**Layer 2 — code validation.** Gemini is called with `responseMimeType: application/json` and an explicit `responseSchema`, so we parse typed data rather than regex prose. Then every citation index is resolved against the real article array:

- unresolvable index in a narrative sentence → **the sentence is dropped**
- claim left with no resolvable source → **demoted to `discarded`**
- more than 40% of sentences dropped → digest marked `degraded`

This is why the Proof tab can be trusted: it renders only citations that provably resolve to fetched articles.

`promptVersion` is stored on every digest so prompt changes are attributable after the fact.

---

## 8. Delivery

**In-app** — the dashboard shows a live countdown to the user's next exchange open and the latest digest. Narrative view by default; a Proof tab renders the claim ledger.

**Email** — Resend, behind a driver interface:
- `resend` driver when `RESEND_API_KEY` is set
- `file` driver otherwise, writing rendered HTML to `.mail/` for local preview

Emails are HTML with a plain-text alternative, inline styles (no external CSS), and citations as real links. Failure marks `emailStatus: 'failed'` with one retry; the in-app digest is unaffected.

**Known Resend constraint:** an unverified Resend account may only send from `onboarding@resend.dev`, and only to the account owner's address. `MAIL_FROM` defaults accordingly and becomes a one-line change once a domain is verified.

---

## 9. Auth & security

bcrypt cost 12. JWT HS256, 7-day expiry, in an `httpOnly` `sameSite=lax` cookie (`secure` in production). Zod validation on every route. Rate limiting on register and login. Middleware guards `/dashboard`, `/onboarding`, `/digest`, `/archive`, `/settings`. Password hashes never leave the server; no secret is referenced in client components.

All three secrets live in a gitignored `.env`. **They were transmitted in plaintext chat and must be rotated**: the MongoDB password (currently weak), the Gemini key, and the Resend key. Atlas IP allowlisting is recommended.

---

## 10. UI

"Terminal Noir": near-black `#0A0C0B`, panel `#111614`, lime accent `#A8FF60`, amber `#FFC24B` for caution, red `#FF5C5C` for negative, monospace for all numerics. Light theme available via toggle. **No pink or purple anywhere**, including charts, states and gradients.

Pages: landing, register, login, 5-step onboarding, dashboard, digest detail, archive, settings.

Interaction: a live T‑minus countdown, staggered reveal on onboarding tiles, hover-preview on citation markers, animated tab transition between Narrative and Proof.

Accessibility: visible focus rings, WCAG AA contrast (lime on near-black passes), `prefers-reduced-motion` respected, keyboard-navigable tile grids, semantic headings.

---

## 11. Error handling

| Failure | Behaviour |
|---|---|
| Gemini unavailable / malformed | Retry with backoff ×2, then `degraded` digest of raw headlines labelled `SUMMARY UNAVAILABLE`. Never a fabricated summary. |
| Some feeds dead | Log and continue with what returned |
| No relevant articles | `quiet` digest stating nothing material was found |
| Email send fails | Digest still in-app; `emailStatus: 'failed'`, one retry |
| Mongo unreachable at tick | Job aborts, logged; next tick's catch-up window retries |
| Process was down at T‑60 | Boot-time catch-up covers the last 3 hours |
| Duplicate tick | `jobRuns` unique key + digest unique index make it a no-op |

Every external call is timeout-bounded. No unbounded retry loop.

---

## 12. Testing

Vitest. External I/O is mocked; a single opt-in live smoke test verifies the Gemini key.

**Unit** — session clock across DST boundaries in both hemispheres, holidays, weekends, year rollover; T‑60 correctness for a user whose local zone differs from the exchange's; relevance scorer; URL/title dedupe; **citation validator** (a hallucinated index must cause the sentence to disappear); mail driver selection.

**Integration** — register → login → onboard → profile persisted; `generateDigest` against mocked RSS and Gemini; scheduler idempotency (two ticks in the same window produce exactly one digest); degraded path when Gemini throws.

---

## 13. Environment

```
MONGODB_URI=       # …mongodb.net/bellbrief
GEMINI_API_KEY=
RESEND_API_KEY=
MAIL_FROM=onboarding@resend.dev
JWT_SECRET=        # generated locally, 32+ bytes
CRON_SECRET=       # guards /api/cron/run
APP_URL=http://localhost:3000
SCHEDULER_ENABLED=true
```

---

## 14. Phase 2 (not built here)

Holdings with quantity and cost basis, live quotes from a market-data provider, portfolio P&L, and price chips on digest tickers. The `holdings` collection and a `lib/quotes` module slot in beside the existing modules; `profiles`, `auth`, and the digest pipeline are unchanged.
