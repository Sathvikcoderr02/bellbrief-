# Bellbrief Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bellbrief — a web app where users create an account, answer five interest questions, and receive an AI-summarised, source-cited market news brief 60 minutes before their chosen exchange opens.

**Architecture:** Single Next.js 15 App Router app. All business logic lives in pure-as-possible `lib/` modules (`markets`, `news`, `ai`, `digest`, `mail`, `scheduler`); API routes are thin wrappers. An in-process `node-cron` minute tick detects exchanges at T‑60 and generates digests with double-layer idempotency. Citations returned by Gemini are validated in code against the real fetched article set — unresolvable citations are dropped, never displayed.

**Tech Stack:** Next.js 15, TypeScript, Tailwind v4, framer-motion, MongoDB/Mongoose, luxon (IANA timezones), rss-parser, @google/genai, resend, bcryptjs, jsonwebtoken, zod, node-cron, vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-bellbrief-design.md`

## Global Constraints

- Product name is **Bellbrief**. The string `Nexora` must appear nowhere, including the MongoDB database name (`bellbrief`).
- **No pink or purple anywhere** — no `pink-*`/`purple-*`/`fuchsia-*`/`violet-*` Tailwind classes, no magenta hex values, in any state, gradient, or chart.
- Theme is "Terminal Noir": bg `#0A0C0B`, panel `#111614`, border `#1B2320`, text `#E6EDE9`, muted `#8D9A93`, accent lime `#A8FF60`, caution amber `#FFC24B`, negative red `#FF5C5C`. Light theme via toggle. All numerics in monospace.
- **Never fabricate a summary.** Gemini failure ⇒ `degraded` digest of raw headlines labelled `SUMMARY UNAVAILABLE`.
- **Never render an unverifiable citation.** Every citation index must resolve to a fetched article or the carrying sentence is dropped.
- **No investment advice** in generated copy; a disclaimer is visible on every digest surface.
- Trigger is anchored to the **exchange** timezone; the **user's** timezone is used only for display.
- Secrets only in gitignored `.env`; never referenced from client components.
- Gemini model: `gemini-2.5-flash`. Prompt changes bump `PROMPT_VERSION`.
- Every external call is timeout-bounded with a finite retry count.

---

### Task 1: Project scaffold, env, database connection, test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env`, `.env.example`, `src/lib/env.ts`, `src/lib/db/connect.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Test: `src/lib/__tests__/env.test.ts`, `src/lib/db/__tests__/connect.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `env` (typed, validated config object with `MONGODB_URI`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `JWT_SECRET`, `CRON_SECRET`, `APP_URL`, `SCHEDULER_ENABLED: boolean`); `connectToDatabase(): Promise<Mongoose>` — cached singleton safe to call per request.

- [ ] **Step 1: Initialise the project and install dependencies**

```bash
npm init -y
npm i next@15 react react-dom mongoose bcryptjs jsonwebtoken zod luxon rss-parser @google/genai resend node-cron framer-motion
npm i -D typescript @types/react @types/react-dom @types/node @types/bcryptjs @types/jsonwebtoken @types/luxon vitest @vitejs/plugin-react mongodb-memory-server tailwindcss @tailwindcss/postcss
```

- [ ] **Step 2: Write `package.json` scripts**

```json
{
  "name": "bellbrief",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "verify:gemini": "node --env-file=.env scripts/verify-gemini.mjs"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `.env` with the real secrets and `.env.example` without them**

`.env` (already gitignored by the repo root `.gitignore`):

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.example.mongodb.net/bellbrief?retryWrites=true&w=majority
GEMINI_API_KEY=your-gemini-api-key-here
RESEND_API_KEY=your-resend-api-key-here
MAIL_FROM=Bellbrief <onboarding@resend.dev>
JWT_SECRET=<generate with: openssl rand -hex 32>
CRON_SECRET=<generate with: openssl rand -hex 24>
APP_URL=http://localhost:3000
SCHEDULER_ENABLED=true
```

`.env.example` is identical with every value replaced by an empty string.

- [ ] **Step 5: Write the failing test for env validation**

```ts
// src/lib/__tests__/env.test.ts
import { describe, expect, it } from 'vitest'
import { parseEnv } from '../env'

const base = {
  MONGODB_URI: 'mongodb+srv://u:p@h/bellbrief',
  GEMINI_API_KEY: 'k', JWT_SECRET: 'x'.repeat(32),
  CRON_SECRET: 'y'.repeat(24), APP_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  it('defaults SCHEDULER_ENABLED to false when unset', () => {
    expect(parseEnv(base).SCHEDULER_ENABLED).toBe(false)
  })
  it('coerces SCHEDULER_ENABLED="true" to boolean true', () => {
    expect(parseEnv({ ...base, SCHEDULER_ENABLED: 'true' }).SCHEDULER_ENABLED).toBe(true)
  })
  it('throws a named error when JWT_SECRET is too short', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/)
  })
  it('rejects a MONGODB_URI whose database is not bellbrief', () => {
    expect(() => parseEnv({ ...base, MONGODB_URI: 'mongodb+srv://u:p@h/nexora' })).toThrow(/bellbrief/)
  })
})
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: FAIL — cannot resolve `../env`.

- [ ] **Step 7: Implement `src/lib/env.ts`**

```ts
import { z } from 'zod'

const schema = z.object({
  MONGODB_URI: z.string().url().refine((u) => /\/bellbrief(\?|$)/.test(u), {
    message: 'MONGODB_URI must point at the "bellbrief" database',
  }),
  GEMINI_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Bellbrief <onboarding@resend.dev>'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CRON_SECRET: z.string().min(16),
  APP_URL: z.string().url(),
  SCHEDULER_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment: ${detail}`)
  }
  return result.data
}

let cached: Env | null = null
export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env)
  return cached
}
```

Note: `z.string().url()` rejects `mongodb+srv://` in some zod builds — if the test fails on the URI shape, replace `.url()` with `.regex(/^mongodb(\+srv)?:\/\//)`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: 4 passed.

- [ ] **Step 9: Implement the cached Mongoose connection**

```ts
// src/lib/db/connect.ts
import mongoose, { type Mongoose } from 'mongoose'
import { getEnv } from '@/lib/env'

declare global {
  var __bellbriefMongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null } | undefined
}

const cache = globalThis.__bellbriefMongoose ?? { conn: null, promise: null }
globalThis.__bellbriefMongoose = cache

export async function connectToDatabase(uri = getEnv().MONGODB_URI): Promise<Mongoose> {
  if (cache.conn) return cache.conn
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
  }
  cache.conn = await cache.promise
  return cache.conn
}
```

The `globalThis` cache is required because Next dev-mode hot reload re-evaluates modules on every request; without it you exhaust the Atlas connection limit within minutes.

- [ ] **Step 10: Write `vitest.config.ts`, `next.config.ts`, `postcss.config.mjs`**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', globals: true, testTimeout: 20_000 },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { serverExternalPackages: ['mongoose'] }
export default nextConfig
```

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } }
```

- [ ] **Step 11: Verify the app boots and the DB connects**

Run: `npm run dev` then in a second shell `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000`
Expected: `200`.

- [ ] **Step 12: Commit**

```bash
git add -A ':!.env'
git commit -m "feat: scaffold Next.js app, validated env, cached Mongo connection"
```

---

### Task 2: Mongoose models

**Files:**
- Create: `src/lib/db/models/user.ts`, `profile.ts`, `article.ts`, `digest.ts`, `jobRun.ts`, `src/lib/db/models/index.ts`
- Test: `src/lib/db/models/__tests__/models.test.ts`

**Interfaces:**
- Consumes: `connectToDatabase` (Task 1)
- Produces: `UserModel`, `ProfileModel`, `ArticleModel`, `DigestModel`, `JobRunModel`, and the types `UserDoc`, `ProfileDoc`, `ArticleDoc`, `DigestDoc`, `NarrativeSentence { text: string; citations: number[] }`, `DigestClaim { claim: string; sources: number[]; agreement: 'corroborated'|'disputed'|'single-source'|'discarded'; confidence: number; note?: string }`, `DigestArticleRef { index: number; articleId?: string; url: string; title: string; source: string; publishedAt: Date }`, `ExperienceLevel = 'beginner'|'intermediate'|'advanced'`.

- [ ] **Step 1: Write the failing test for the digest uniqueness guarantee**

```ts
// src/lib/db/models/__tests__/models.test.ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DigestModel, JobRunModel, UserModel } from '..'

let mem: MongoMemoryServer

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()))
}, 60_000)

afterAll(async () => { await mongoose.disconnect(); await mem.stop() })

describe('models', () => {
  it('lowercases user email and rejects duplicates', async () => {
    const u = await UserModel.create({ email: 'A@B.com', passwordHash: 'h', name: 'A', timeZone: 'UTC' })
    expect(u.email).toBe('a@b.com')
    await expect(UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'B', timeZone: 'UTC' }))
      .rejects.toThrow(/duplicate key/)
  })

  it('permits only one digest per (user, exchange, sessionDate)', async () => {
    const userId = new mongoose.Types.ObjectId()
    const base = { userId, exchange: 'NASDAQ', sessionDate: '2026-09-10', status: 'ready' as const, headline: 'h' }
    await DigestModel.create(base)
    await expect(DigestModel.create(base)).rejects.toThrow(/duplicate key/)
  })

  it('permits only one job run per key', async () => {
    await JobRunModel.create({ key: 'NASDAQ:2026-09-10', exchange: 'NASDAQ', sessionDate: '2026-09-10' })
    await expect(JobRunModel.create({ key: 'NASDAQ:2026-09-10', exchange: 'NASDAQ', sessionDate: '2026-09-10' }))
      .rejects.toThrow(/duplicate key/)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/db/models`
Expected: FAIL — cannot resolve `..`.

- [ ] **Step 3: Implement `src/lib/db/models/user.ts`**

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose'

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  timeZone: { type: String, required: true, default: 'UTC' },
  lastLoginAt: { type: Date },
}, { timestamps: true })

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId }
export const UserModel = (models.User as Model<UserDoc>) ?? model<UserDoc>('User', userSchema)
```

The `models.X ?? model(...)` guard is mandatory in Next dev mode — re-registering a model throws `OverwriteModelError` on hot reload.

- [ ] **Step 4: Implement `src/lib/db/models/profile.ts`**

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

const profileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  exchanges: { type: [String], default: [] },
  sectors: { type: [String], default: [] },
  tickers: { type: [String], default: [] },
  themes: { type: [String], default: [] },
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  riskAppetite: { type: String, enum: ['conservative', 'balanced', 'aggressive'], default: 'balanced' },
  horizon: { type: String, enum: ['intraday', 'swing', 'long-term'], default: 'long-term' },
  emailOptIn: { type: Boolean, default: true },
  completedAt: { type: Date },
}, { timestamps: true })

export type ProfileDoc = InferSchemaType<typeof profileSchema> & { _id: Schema.Types.ObjectId }
export const ProfileModel = (models.Profile as Model<ProfileDoc>) ?? model<ProfileDoc>('Profile', profileSchema)
```

- [ ] **Step 5: Implement `src/lib/db/models/article.ts`**

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose'

const articleSchema = new Schema({
  url: { type: String, required: true, unique: true },
  canonicalUrl: { type: String, required: true, index: true },
  title: { type: String, required: true },
  source: { type: String, required: true },
  publishedAt: { type: Date, required: true, index: true },
  snippet: { type: String, default: '' },
  matchedTickers: { type: [String], default: [] },
  matchedSectors: { type: [String], default: [] },
  relevance: { type: Number, default: 0 },
  fetchedAt: { type: Date, default: () => new Date(), expires: 60 * 60 * 24 * 14 },
})

export type ArticleDoc = InferSchemaType<typeof articleSchema> & { _id: Schema.Types.ObjectId }
export const ArticleModel = (models.Article as Model<ArticleDoc>) ?? model<ArticleDoc>('Article', articleSchema)
```

`expires` on `fetchedAt` creates the 14-day TTL index. Articles are shared across users, so N users following NASDAQ cost one fetch.

- [ ] **Step 6: Implement `src/lib/db/models/digest.ts`**

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose'

export type Agreement = 'corroborated' | 'disputed' | 'single-source' | 'discarded'
export interface NarrativeSentence { text: string; citations: number[] }
export interface DigestClaim { claim: string; sources: number[]; agreement: Agreement; confidence: number; note?: string }
export interface DigestArticleRef { index: number; articleId?: string; url: string; title: string; source: string; publishedAt: Date }

const digestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exchange: { type: String, required: true },
  sessionDate: { type: String, required: true },
  digestInstant: { type: Date },
  generatedAt: { type: Date, default: () => new Date() },
  status: { type: String, enum: ['ready', 'quiet', 'degraded', 'failed'], required: true },
  headline: { type: String, required: true },
  overview: { type: String, default: '' },
  narrative: { type: [{ text: String, citations: [Number] }], default: [] },
  claims: {
    type: [{
      claim: String, sources: [Number],
      agreement: { type: String, enum: ['corroborated', 'disputed', 'single-source', 'discarded'] },
      confidence: Number, note: String,
    }], default: [],
  },
  sentiment: { type: String, enum: ['risk-on', 'risk-off', 'mixed', 'quiet'], default: 'mixed' },
  articles: {
    type: [{ index: Number, articleId: Schema.Types.ObjectId, url: String, title: String, source: String, publishedAt: Date }],
    default: [],
  },
  model: { type: String },
  promptVersion: { type: String },
  tokensUsed: { type: Number },
  droppedSentences: { type: Number, default: 0 },
  emailStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
  emailError: { type: String },
}, { timestamps: true })

digestSchema.index({ userId: 1, exchange: 1, sessionDate: 1 }, { unique: true })

export type DigestDoc = InferSchemaType<typeof digestSchema> & { _id: Schema.Types.ObjectId }
export const DigestModel = (models.Digest as Model<DigestDoc>) ?? model<DigestDoc>('Digest', digestSchema)
```

The embedded `articles` index→ref map lets a digest render its own citations with no join, and keeps it readable after the TTL prunes source documents.

- [ ] **Step 7: Implement `src/lib/db/models/jobRun.ts` and `index.ts`**

```ts
// jobRun.ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose'

const jobRunSchema = new Schema({
  key: { type: String, required: true, unique: true },
  exchange: { type: String, required: true },
  sessionDate: { type: String, required: true },
  startedAt: { type: Date, default: () => new Date() },
  finishedAt: { type: Date },
  usersProcessed: { type: Number, default: 0 },
  succeeded: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  error: { type: String },
})

export type JobRunDoc = InferSchemaType<typeof jobRunSchema> & { _id: Schema.Types.ObjectId }
export const JobRunModel = (models.JobRun as Model<JobRunDoc>) ?? model<JobRunDoc>('JobRun', jobRunSchema)
```

```ts
// index.ts
export * from './user'; export * from './profile'; export * from './article'
export * from './digest'; export * from './jobRun'
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/db/models`
Expected: 3 passed.

- [ ] **Step 9: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: add Mongoose models with idempotency indexes"
```

---

### Task 3: Market registry and session clock

**Files:**
- Create: `src/lib/markets/exchanges.ts`, `src/lib/markets/clock.ts`, `src/lib/markets/index.ts`
- Test: `src/lib/markets/__tests__/clock.test.ts`

**Interfaces:**
- Consumes: nothing (pure; luxon only)
- Produces:
  - `Exchange { code: string; label: string; region: string; timeZone: string; openLocal: string; tradingDays: number[]; holidays: string[]; currency: string }`
  - `EXCHANGES: Exchange[]`, `getExchange(code: string): Exchange` (throws on unknown)
  - `nextSessionOpen(ex: Exchange, from: Date): { sessionDate: string; openInstant: Date }`
  - `digestInstantFor(ex: Exchange, sessionDate: string): Date` — open minus 60 min
  - `currentSessionWindow(ex: Exchange, now: Date): { sessionDate: string; openInstant: Date; digestInstant: Date }`
  - `isDue(ex: Exchange, now: Date, windowMinutes?: number): { due: boolean; sessionDate: string }`
  - `DIGEST_LEAD_MINUTES = 60`

- [ ] **Step 1: Write the failing tests — this is the highest-risk module, so test it hardest**

```ts
// src/lib/markets/__tests__/clock.test.ts
import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { DIGEST_LEAD_MINUTES, digestInstantFor, getExchange, isDue, nextSessionOpen } from '..'

const nasdaq = getExchange('NASDAQ')
const nse = getExchange('NSE')
const at = (iso: string) => new Date(iso)

describe('nextSessionOpen', () => {
  it('returns the same-day open when now is before it', () => {
    const { sessionDate, openInstant } = nextSessionOpen(nasdaq, at('2026-09-10T04:00:00Z'))
    expect(sessionDate).toBe('2026-09-10')
    expect(openInstant.toISOString()).toBe('2026-09-10T13:30:00.000Z') // 09:30 EDT
  })

  it('rolls to the next trading day once the open has passed', () => {
    expect(nextSessionOpen(nasdaq, at('2026-09-10T20:00:00Z')).sessionDate).toBe('2026-09-11')
  })

  it('skips the weekend', () => {
    // Friday 2026-09-11 after close -> Monday 2026-09-14
    expect(nextSessionOpen(nasdaq, at('2026-09-11T21:00:00Z')).sessionDate).toBe('2026-09-14')
  })

  it('skips a listed holiday', () => {
    // 2027-01-01 is a Friday and a holiday -> Monday 2027-01-04
    expect(nextSessionOpen(nasdaq, at('2026-12-31T23:00:00Z')).sessionDate).toBe('2027-01-04')
  })
})

describe('DST correctness', () => {
  it('uses EST (UTC-5) in January', () => {
    expect(nextSessionOpen(nasdaq, at('2027-01-05T04:00:00Z')).openInstant.toISOString())
      .toBe('2027-01-05T14:30:00.000Z')
  })

  it('uses EDT (UTC-4) in July', () => {
    expect(nextSessionOpen(nasdaq, at('2026-07-07T04:00:00Z')).openInstant.toISOString())
      .toBe('2026-07-07T13:30:00.000Z')
  })

  it('keeps IST fixed at UTC+5:30 year round (India has no DST)', () => {
    const jan = nextSessionOpen(nse, at('2027-01-05T00:00:00Z')).openInstant.toISOString()
    const jul = nextSessionOpen(nse, at('2026-07-07T00:00:00Z')).openInstant.toISOString()
    expect(jan).toBe('2027-01-05T03:45:00.000Z') // 09:15 IST
    expect(jul).toBe('2026-07-07T03:45:00.000Z')
  })
})

describe('digestInstantFor', () => {
  it('is exactly the lead time before the open', () => {
    const open = nextSessionOpen(nasdaq, at('2026-09-10T04:00:00Z')).openInstant
    const digest = digestInstantFor(nasdaq, '2026-09-10')
    expect(open.getTime() - digest.getTime()).toBe(DIGEST_LEAD_MINUTES * 60_000)
    expect(digest.toISOString()).toBe('2026-09-10T12:30:00.000Z') // 08:30 EDT
  })

  it('is the same instant regardless of the viewer timezone', () => {
    // 08:30 New York == 14:30 Berlin == 18:00 Kolkata, one instant
    const d = digestInstantFor(nasdaq, '2026-09-10')
    expect(DateTime.fromJSDate(d).setZone('Europe/Berlin').toFormat('HH:mm')).toBe('14:30')
    expect(DateTime.fromJSDate(d).setZone('Asia/Kolkata').toFormat('HH:mm')).toBe('18:00')
  })
})

describe('isDue', () => {
  it('is due exactly at the digest instant', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:30:00Z')).due).toBe(true)
  })
  it('is due 90 seconds later (tick jitter tolerance)', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:31:30Z')).due).toBe(true)
  })
  it('is not due a minute early', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:29:00Z')).due).toBe(false)
  })
  it('is not due once the window has passed', () => {
    expect(isDue(nasdaq, at('2026-09-10T12:33:00Z')).due).toBe(false)
  })
  it('is never due on a weekend', () => {
    expect(isDue(nasdaq, at('2026-09-12T12:30:00Z')).due).toBe(false) // Saturday
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/markets`
Expected: FAIL — cannot resolve `..`.

- [ ] **Step 3: Implement `src/lib/markets/exchanges.ts`**

Holiday lists cover 2026–2027 for the two primary exchanges; others carry weekend rules only, which is honest and safe (a brief on a holiday is a harmless no-op, a missed brief on a trading day is not).

```ts
export interface Exchange {
  code: string; label: string; region: string; timeZone: string
  openLocal: string; tradingDays: number[]; holidays: string[]; currency: string
}

const MON_FRI = [1, 2, 3, 4, 5]

export const EXCHANGES: Exchange[] = [
  { code: 'NASDAQ', label: 'NASDAQ — United States', region: 'us', timeZone: 'America/New_York', openLocal: '09:30', tradingDays: MON_FRI, currency: 'USD',
    holidays: ['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25','2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24'] },
  { code: 'NYSE', label: 'NYSE — United States', region: 'us', timeZone: 'America/New_York', openLocal: '09:30', tradingDays: MON_FRI, currency: 'USD',
    holidays: ['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25','2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24'] },
  { code: 'NSE', label: 'NSE — India', region: 'in', timeZone: 'Asia/Kolkata', openLocal: '09:15', tradingDays: MON_FRI, currency: 'INR',
    holidays: ['2026-01-26','2026-03-03','2026-03-19','2026-04-03','2026-04-14','2026-05-01','2026-08-15','2026-10-02','2026-11-09','2026-12-25','2027-01-26','2027-03-22','2027-04-14','2027-08-15','2027-10-02','2027-12-25'] },
  { code: 'BSE', label: 'BSE — India', region: 'in', timeZone: 'Asia/Kolkata', openLocal: '09:15', tradingDays: MON_FRI, currency: 'INR',
    holidays: ['2026-01-26','2026-03-03','2026-03-19','2026-04-03','2026-04-14','2026-05-01','2026-08-15','2026-10-02','2026-11-09','2026-12-25','2027-01-26','2027-03-22','2027-04-14','2027-08-15','2027-10-02','2027-12-25'] },
  { code: 'LSE', label: 'London Stock Exchange', region: 'uk', timeZone: 'Europe/London', openLocal: '08:00', tradingDays: MON_FRI, currency: 'GBP', holidays: ['2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'] },
  { code: 'XETRA', label: 'Frankfurt (XETRA)', region: 'eu', timeZone: 'Europe/Berlin', openLocal: '09:00', tradingDays: MON_FRI, currency: 'EUR', holidays: ['2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-24','2026-12-25','2026-12-31'] },
  { code: 'EURONEXT_PARIS', label: 'Euronext Paris', region: 'eu', timeZone: 'Europe/Paris', openLocal: '09:00', tradingDays: MON_FRI, currency: 'EUR', holidays: ['2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-12-25'] },
  { code: 'TSE', label: 'Tokyo Stock Exchange', region: 'jp', timeZone: 'Asia/Tokyo', openLocal: '09:00', tradingDays: MON_FRI, currency: 'JPY', holidays: ['2026-01-01','2026-01-02','2026-01-12','2026-05-04','2026-05-05','2026-12-31'] },
  { code: 'HKEX', label: 'Hong Kong Exchange', region: 'hk', timeZone: 'Asia/Hong_Kong', openLocal: '09:30', tradingDays: MON_FRI, currency: 'HKD', holidays: ['2026-01-01','2026-04-03','2026-05-01','2026-10-01','2026-12-25'] },
  { code: 'ASX', label: 'Australian Securities Exchange', region: 'au', timeZone: 'Australia/Sydney', openLocal: '10:00', tradingDays: MON_FRI, currency: 'AUD', holidays: ['2026-01-01','2026-01-26','2026-04-03','2026-04-06','2026-04-27','2026-12-25','2026-12-28'] },
  { code: 'TSX', label: 'Toronto Stock Exchange', region: 'ca', timeZone: 'America/Toronto', openLocal: '09:30', tradingDays: MON_FRI, currency: 'CAD', holidays: ['2026-01-01','2026-02-16','2026-04-03','2026-05-18','2026-07-01','2026-09-07','2026-10-12','2026-12-25','2026-12-28'] },
]

const byCode = new Map(EXCHANGES.map((e) => [e.code, e]))

export function getExchange(code: string): Exchange {
  const found = byCode.get(code)
  if (!found) throw new Error(`Unknown exchange: ${code}`)
  return found
}

export function isSupportedExchange(code: string): boolean { return byCode.has(code) }
```

- [ ] **Step 4: Implement `src/lib/markets/clock.ts`**

```ts
import { DateTime } from 'luxon'
import type { Exchange } from './exchanges'

export const DIGEST_LEAD_MINUTES = 60
const DUE_WINDOW_MINUTES = 2

function openOn(ex: Exchange, sessionDate: string): DateTime {
  const [h, m] = ex.openLocal.split(':').map(Number)
  return DateTime.fromISO(sessionDate, { zone: ex.timeZone }).set({ hour: h, minute: m, second: 0, millisecond: 0 })
}

export function isTradingDay(ex: Exchange, sessionDate: string): boolean {
  const dt = DateTime.fromISO(sessionDate, { zone: ex.timeZone })
  return ex.tradingDays.includes(dt.weekday) && !ex.holidays.includes(sessionDate)
}

export function nextSessionOpen(ex: Exchange, from: Date): { sessionDate: string; openInstant: Date } {
  let cursor = DateTime.fromJSDate(from, { zone: ex.timeZone })
  for (let i = 0; i < 400; i++) {
    const sessionDate = cursor.toFormat('yyyy-MM-dd')
    if (isTradingDay(ex, sessionDate)) {
      const open = openOn(ex, sessionDate)
      if (open.toMillis() > from.getTime()) return { sessionDate, openInstant: open.toJSDate() }
    }
    cursor = cursor.plus({ days: 1 }).startOf('day')
  }
  throw new Error(`No trading day found for ${ex.code} within 400 days`)
}

export function digestInstantFor(ex: Exchange, sessionDate: string): Date {
  return openOn(ex, sessionDate).minus({ minutes: DIGEST_LEAD_MINUTES }).toJSDate()
}

export function currentSessionWindow(ex: Exchange, now: Date) {
  const sessionDate = DateTime.fromJSDate(now, { zone: ex.timeZone }).toFormat('yyyy-MM-dd')
  return { sessionDate, openInstant: openOn(ex, sessionDate).toJSDate(), digestInstant: digestInstantFor(ex, sessionDate) }
}

export function isDue(ex: Exchange, now: Date, windowMinutes = DUE_WINDOW_MINUTES): { due: boolean; sessionDate: string } {
  const { sessionDate, digestInstant } = currentSessionWindow(ex, now)
  if (!isTradingDay(ex, sessionDate)) return { due: false, sessionDate }
  const delta = now.getTime() - digestInstant.getTime()
  return { due: delta >= 0 && delta < windowMinutes * 60_000, sessionDate }
}

export function missedWindows(ex: Exchange, now: Date, lookbackHours = 3): string[] {
  const out: string[] = []
  for (const offset of [0, -1]) {
    const date = DateTime.fromJSDate(now, { zone: ex.timeZone }).plus({ days: offset }).toFormat('yyyy-MM-dd')
    if (!isTradingDay(ex, date)) continue
    const instant = digestInstantFor(ex, date).getTime()
    const age = now.getTime() - instant
    if (age > 0 && age <= lookbackHours * 3_600_000) out.push(date)
  }
  return out
}
```

`isDue` computes the session date in the **exchange's** zone, not the server's — a server in UTC and a server in Sydney must agree on which session is due.

- [ ] **Step 5: Create the barrel and run tests**

```ts
// src/lib/markets/index.ts
export * from './exchanges'; export * from './clock'
```

Run: `npx vitest run src/lib/markets`
Expected: all passed. If a DST assertion fails, print `nextSessionOpen(nasdaq, ...)` and check the holiday list — do **not** relax the assertion.

- [ ] **Step 6: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: exchange registry and DST-correct session clock"
```

---

### Task 4: Auth core and API routes

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/service.ts`, `src/lib/auth/rateLimit.ts`, `src/app/api/auth/register/route.ts`, `login/route.ts`, `logout/route.ts`, `me/route.ts`, `src/middleware.ts`
- Test: `src/lib/auth/__tests__/session.test.ts`, `src/lib/auth/__tests__/service.test.ts`

**Interfaces:**
- Consumes: `UserModel`, `ProfileModel` (Task 2), `getEnv` (Task 1)
- Produces: `hashPassword(pw): Promise<string>`, `verifyPassword(pw, hash): Promise<boolean>`, `signSession(userId): string`, `verifySession(token): { userId: string } | null`, `SESSION_COOKIE = 'bb_session'`, `registerUser({ email, password, name, timeZone }): Promise<{ userId: string }>`, `loginUser({ email, password }): Promise<{ userId: string }>`, `getSessionUser(): Promise<{ id, email, name, timeZone, hasProfile } | null>` (server-only, reads cookie).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/auth/__tests__/session.test.ts
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/env', () => ({ getEnv: () => ({ JWT_SECRET: 'z'.repeat(32) }) }))
const { signSession, verifySession } = await import('../session')
const { hashPassword, verifyPassword } = await import('../password')

describe('session tokens', () => {
  it('round-trips a user id', () => {
    expect(verifySession(signSession('abc123'))?.userId).toBe('abc123')
  })
  it('rejects a tampered token', () => {
    expect(verifySession(signSession('abc123').slice(0, -2) + 'xy')).toBeNull()
  })
  it('rejects garbage', () => { expect(verifySession('nonsense')).toBeNull() })
})

describe('password hashing', () => {
  it('does not store the plaintext', async () => {
    const h = await hashPassword('correct horse battery')
    expect(h).not.toContain('correct')
    expect(await verifyPassword('correct horse battery', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })
})
```

```ts
// src/lib/auth/__tests__/service.test.ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/env', () => ({ getEnv: () => ({ JWT_SECRET: 'z'.repeat(32) }) }))
vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))

const { loginUser, registerUser } = await import('../service')
let mem: MongoMemoryServer

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()))
}, 60_000)
afterAll(async () => { await mongoose.disconnect(); await mem.stop() })

describe('registerUser', () => {
  it('creates a user and an empty profile', async () => {
    const { userId } = await registerUser({ email: 'a@b.com', password: 'longenough1', name: 'A', timeZone: 'Asia/Kolkata' })
    expect(userId).toBeTruthy()
    const profile = await mongoose.model('Profile').findOne({ userId })
    expect(profile).not.toBeNull()
    expect(profile!.completedAt).toBeUndefined()
  })
  it('rejects a duplicate email case-insensitively', async () => {
    await expect(registerUser({ email: 'A@B.com', password: 'longenough1', name: 'A', timeZone: 'UTC' }))
      .rejects.toThrow(/already registered/i)
  })
})

describe('loginUser', () => {
  it('accepts the right password', async () => {
    expect((await loginUser({ email: 'a@b.com', password: 'longenough1' })).userId).toBeTruthy()
  })
  it('gives an identical error for wrong password and unknown email', async () => {
    const a = await loginUser({ email: 'a@b.com', password: 'nope' }).catch((e) => e.message)
    const b = await loginUser({ email: 'ghost@b.com', password: 'nope' }).catch((e) => e.message)
    expect(a).toBe(b) // no user enumeration
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `password.ts` and `session.ts`**

```ts
// src/lib/auth/password.ts
import bcrypt from 'bcryptjs'
const COST = 12
export const hashPassword = (pw: string) => bcrypt.hash(pw, COST)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)
```

```ts
// src/lib/auth/session.ts
import jwt from 'jsonwebtoken'
import { getEnv } from '@/lib/env'

export const SESSION_COOKIE = 'bb_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, getEnv().JWT_SECRET, { algorithm: 'HS256', expiresIn: SESSION_MAX_AGE })
}

export function verifySession(token: string | undefined): { userId: string } | null {
  if (!token) return null
  try {
    const payload = jwt.verify(token, getEnv().JWT_SECRET, { algorithms: ['HS256'] })
    const sub = typeof payload === 'object' && payload ? (payload as jwt.JwtPayload).sub : undefined
    return typeof sub === 'string' ? { userId: sub } : null
  } catch { return null }
}
```

- [ ] **Step 4: Implement `service.ts`**

```ts
import { cookies } from 'next/headers'
import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel, UserModel } from '@/lib/db/models'
import { hashPassword, verifyPassword } from './password'
import { SESSION_COOKIE, verifySession } from './session'

const BAD_CREDENTIALS = 'Email or password is incorrect'

export async function registerUser(input: { email: string; password: string; name: string; timeZone: string }) {
  await connectToDatabase()
  const email = input.email.trim().toLowerCase()
  if (await UserModel.exists({ email })) throw new Error('That email is already registered')
  const user = await UserModel.create({
    email, name: input.name.trim(), timeZone: input.timeZone,
    passwordHash: await hashPassword(input.password),
  })
  await ProfileModel.create({ userId: user._id })
  return { userId: String(user._id) }
}

export async function loginUser(input: { email: string; password: string }) {
  await connectToDatabase()
  const user = await UserModel.findOne({ email: input.email.trim().toLowerCase() })
  // Always run a comparison so timing does not reveal whether the email exists.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
  const ok = await verifyPassword(input.password, hash)
  if (!user || !ok) throw new Error(BAD_CREDENTIALS)
  user.lastLoginAt = new Date()
  await user.save()
  return { userId: String(user._id) }
}

export async function getSessionUser() {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) return null
  await connectToDatabase()
  const user = await UserModel.findById(session.userId).lean()
  if (!user) return null
  const profile = await ProfileModel.findOne({ userId: user._id }).lean()
  return {
    id: String(user._id), email: user.email, name: user.name, timeZone: user.timeZone,
    hasProfile: Boolean(profile?.completedAt),
  }
}
```

- [ ] **Step 5: Implement `rateLimit.ts`**

```ts
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit = 8, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > limit) return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  return { ok: true, retryAfter: 0 }
}
```

In-memory is honest for a single-process Phase 1 deployment; a note in the file records that a shared store is needed once there is more than one instance.

- [ ] **Step 6: Implement the four auth routes**

```ts
// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/auth/rateLimit'
import { registerUser } from '@/lib/auth/service'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/auth/session'

const body = z.object({
  email: z.string().email(),
  password: z.string().min(10, 'Use at least 10 characters'),
  name: z.string().min(1).max(80),
  timeZone: z.string().min(1).default('UTC'),
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local'
  const limit = rateLimit(`register:${ip}`, 5)
  if (!limit.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  try {
    const { userId } = await registerUser(parsed.data)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, signSession(userId), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: SESSION_MAX_AGE,
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 })
  }
}
```

`login/route.ts` is identical in shape but calls `loginUser`, uses `rateLimit(\`login:${ip}\`, 8)`, and returns `401` on failure. `logout/route.ts` clears the cookie with `maxAge: 0`. `me/route.ts` returns `await getSessionUser()` or `401`.

- [ ] **Step 7: Implement `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

const PROTECTED = ['/dashboard', '/onboarding', '/digest', '/archive', '/settings']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!PROTECTED.some((p) => pathname.startsWith(p))) return NextResponse.next()
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next()
  const login = new URL('/login', request.url)
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/dashboard/:path*', '/onboarding/:path*', '/digest/:path*', '/archive/:path*', '/settings/:path*'] }
```

Middleware checks only for cookie *presence* — it runs on the Edge runtime where `jsonwebtoken` is unavailable. Signature verification happens in `getSessionUser`, which every protected page calls.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth`
Expected: all passed.

- [ ] **Step 9: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: email/password auth with JWT cookie sessions"
```

---

### Task 5: News collection pipeline

**Files:**
- Create: `src/lib/news/taxonomy.ts`, `src/lib/news/feeds.ts`, `src/lib/news/fetch.ts`, `src/lib/news/normalise.ts`, `src/lib/news/score.ts`, `src/lib/news/collect.ts`, `src/lib/news/index.ts`
- Test: `src/lib/news/__tests__/normalise.test.ts`, `src/lib/news/__tests__/score.test.ts`, `src/lib/news/__tests__/collect.test.ts`

**Interfaces:**
- Consumes: `getExchange`, `nextSessionOpen` (Task 3); `ArticleModel` (Task 2)
- Produces:
  - `SECTORS: { id, label, keywords[] }[]`, `THEMES: { id, label, keywords[] }[]`, `POPULAR_TICKERS: { symbol, name, exchange, sector }[]`
  - `RawItem { title, link, source, publishedAt, snippet }`
  - `CollectedArticle { url, canonicalUrl, title, source, publishedAt, snippet, matchedTickers[], matchedSectors[], relevance }`
  - `canonicaliseUrl(url): string`, `normaliseTitle(t): string`, `dedupe(items: RawItem[]): RawItem[]`
  - `scoreArticle(item, profile): { relevance, matchedTickers, matchedSectors }`
  - `buildFeedUrls(profile): { url: string; kind: 'ticker'|'topic'|'publisher'; hint?: string }[]`
  - `collectArticles(profile, opts?: { since?: Date; limit?: number; fetcher?: FeedFetcher }): Promise<CollectedArticle[]>`
  - `MAX_ARTICLES = 35`

- [ ] **Step 1: Write the failing tests for normalisation and dedupe**

```ts
// src/lib/news/__tests__/normalise.test.ts
import { describe, expect, it } from 'vitest'
import { canonicaliseUrl, dedupe, normaliseTitle } from '../normalise'

describe('canonicaliseUrl', () => {
  it('strips tracking parameters and the fragment', () => {
    expect(canonicaliseUrl('https://reuters.com/a/b?utm_source=x&utm_medium=y&id=7#top'))
      .toBe('https://reuters.com/a/b?id=7')
  })
  it('drops a trailing slash and lowercases the host', () => {
    expect(canonicaliseUrl('https://Reuters.COM/a/b/')).toBe('https://reuters.com/a/b')
  })
  it('returns the input unchanged when it is not a URL', () => {
    expect(canonicaliseUrl('not a url')).toBe('not a url')
  })
})

describe('normaliseTitle', () => {
  it('removes the publisher suffix and punctuation', () => {
    expect(normaliseTitle('Infosys cuts guidance — Reuters')).toBe('infosys cuts guidance')
  })
})

describe('dedupe', () => {
  const item = (title: string, link: string) =>
    ({ title, link, source: 's', publishedAt: new Date('2026-09-10'), snippet: '' })

  it('collapses the same story published under different tracking URLs', () => {
    const out = dedupe([
      item('Infosys cuts guidance', 'https://x.com/a?utm_source=g'),
      item('Infosys cuts guidance', 'https://x.com/a'),
    ])
    expect(out).toHaveLength(1)
  })
  it('collapses the same wire story from different outlets by title', () => {
    const out = dedupe([
      item('Infosys cuts FY guidance', 'https://reuters.com/a'),
      item('Infosys cuts FY guidance!', 'https://mint.com/b'),
    ])
    expect(out).toHaveLength(1)
  })
  it('keeps genuinely different stories', () => {
    expect(dedupe([item('Infosys cuts guidance', 'https://a.com/1'), item('TCS wins deal', 'https://b.com/2')]))
      .toHaveLength(2)
  })
})
```

- [ ] **Step 2: Write the failing tests for scoring and collection**

```ts
// src/lib/news/__tests__/score.test.ts
import { describe, expect, it } from 'vitest'
import { scoreArticle } from '../score'

const profile = { tickers: ['INFY'], sectors: ['technology'], themes: ['earnings'], exchanges: ['NSE'] }
const item = (title: string) => ({ title, link: 'https://x.com/a', source: 'Reuters', publishedAt: new Date(), snippet: '' })

describe('scoreArticle', () => {
  it('scores an exact ticker match above a sector match', () => {
    const ticker = scoreArticle(item('INFY cuts guidance'), profile).relevance
    const sector = scoreArticle(item('Technology stocks slip'), profile).relevance
    expect(ticker).toBeGreaterThan(sector)
  })
  it('scores a sector match above a theme-only match', () => {
    expect(scoreArticle(item('Technology stocks slip'), profile).relevance)
      .toBeGreaterThan(scoreArticle(item('Earnings season begins'), profile).relevance)
  })
  it('records which ticker matched', () => {
    expect(scoreArticle(item('INFY cuts guidance'), profile).matchedTickers).toEqual(['INFY'])
  })
  it('does not match a ticker inside a longer word', () => {
    expect(scoreArticle(item('Infymatic Ltd rallies'), profile).matchedTickers).toEqual([])
  })
  it('scores an unrelated article zero', () => {
    expect(scoreArticle(item('Local bakery opens'), profile).relevance).toBe(0)
  })
})
```

```ts
// src/lib/news/__tests__/collect.test.ts
import { describe, expect, it } from 'vitest'
import { collectArticles } from '../collect'
import type { RawItem } from '../normalise'

const profile = { tickers: ['INFY'], sectors: ['technology'], themes: [], exchanges: ['NSE'], experienceLevel: 'intermediate' as const }

const fake = (items: Record<string, RawItem[]>) => async (url: string) => {
  if (url.includes('boom')) throw new Error('feed down')
  return items[url] ?? items['*'] ?? []
}

describe('collectArticles', () => {
  it('returns scored, deduped articles sorted by relevance', async () => {
    const items: RawItem[] = [
      { title: 'Local bakery opens', link: 'https://a.com/1', source: 'A', publishedAt: new Date(), snippet: '' },
      { title: 'INFY cuts guidance', link: 'https://b.com/2', source: 'B', publishedAt: new Date(), snippet: '' },
      { title: 'INFY cuts guidance', link: 'https://b.com/2?utm_source=x', source: 'B', publishedAt: new Date(), snippet: '' },
    ]
    const out = await collectArticles(profile, { fetcher: fake({ '*': items }) })
    expect(out.map((a) => a.title)).toEqual(['INFY cuts guidance'])
  })

  it('survives a feed that throws', async () => {
    const out = await collectArticles(profile, {
      fetcher: async (url) => {
        if (url.includes('news.google')) throw new Error('down')
        return [{ title: 'INFY cuts guidance', link: 'https://b.com/2', source: 'B', publishedAt: new Date(), snippet: '' }]
      },
    })
    expect(out.length).toBeGreaterThan(0)
  })

  it('excludes articles older than the since date', async () => {
    const old: RawItem[] = [{ title: 'INFY old news', link: 'https://b.com/old', source: 'B', publishedAt: new Date('2020-01-01'), snippet: '' }]
    const out = await collectArticles(profile, { since: new Date('2026-09-09'), fetcher: fake({ '*': old }) })
    expect(out).toHaveLength(0)
  })

  it('caps the result set', async () => {
    const many: RawItem[] = Array.from({ length: 200 }, (_, i) => ({
      title: `INFY story ${i}`, link: `https://b.com/${i}`, source: 'B', publishedAt: new Date(), snippet: '',
    }))
    const out = await collectArticles(profile, { fetcher: fake({ '*': many }) })
    expect(out.length).toBeLessThanOrEqual(35)
  })
})
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run src/lib/news`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `taxonomy.ts`**

This doubles as the source of the onboarding tile options in Task 9, so the two can never drift.

```ts
export interface TaxonomyEntry { id: string; label: string; keywords: string[] }

export const SECTORS: TaxonomyEntry[] = [
  { id: 'technology', label: 'Technology', keywords: ['technology', 'tech', 'software', 'it services', 'cloud'] },
  { id: 'semiconductors', label: 'Semiconductors', keywords: ['semiconductor', 'chip', 'chipmaker', 'foundry', 'wafer'] },
  { id: 'banking', label: 'Banking & Finance', keywords: ['bank', 'banking', 'lender', 'nbfc', 'credit'] },
  { id: 'energy', label: 'Energy & Oil', keywords: ['oil', 'crude', 'brent', 'energy', 'refinery', 'opec'] },
  { id: 'renewables', label: 'Renewables', keywords: ['solar', 'wind', 'renewable', 'clean energy', 'battery'] },
  { id: 'healthcare', label: 'Healthcare & Pharma', keywords: ['pharma', 'healthcare', 'drug', 'biotech', 'fda'] },
  { id: 'automotive', label: 'Automotive & EV', keywords: ['auto', 'automaker', 'vehicle', 'ev', 'electric vehicle'] },
  { id: 'consumer', label: 'Consumer & Retail', keywords: ['retail', 'consumer', 'fmcg', 'e-commerce'] },
  { id: 'industrials', label: 'Industrials', keywords: ['industrial', 'manufacturing', 'machinery', 'infrastructure'] },
  { id: 'realestate', label: 'Real Estate', keywords: ['real estate', 'property', 'housing', 'reit'] },
  { id: 'metals', label: 'Metals & Mining', keywords: ['steel', 'copper', 'mining', 'aluminium', 'iron ore'] },
  { id: 'telecom', label: 'Telecom', keywords: ['telecom', 'spectrum', '5g', 'broadband'] },
  { id: 'aerospace', label: 'Aerospace & Defence', keywords: ['aerospace', 'defence', 'defense', 'aviation'] },
  { id: 'logistics', label: 'Transport & Logistics', keywords: ['logistics', 'shipping', 'freight', 'airline'] },
]

export const THEMES: TaxonomyEntry[] = [
  { id: 'earnings', label: 'Earnings & results', keywords: ['earnings', 'results', 'quarterly', 'guidance', 'profit'] },
  { id: 'ipos', label: 'IPOs & listings', keywords: ['ipo', 'listing', 'public offering', 'debut'] },
  { id: 'ma', label: 'Mergers & acquisitions', keywords: ['acquisition', 'merger', 'takeover', 'stake buy'] },
  { id: 'macro', label: 'Rates & macro', keywords: ['inflation', 'interest rate', 'fed', 'rbi', 'gdp', 'cpi'] },
  { id: 'ai', label: 'AI & disruption', keywords: ['artificial intelligence', 'ai', 'machine learning', 'automation'] },
  { id: 'dividends', label: 'Dividends & buybacks', keywords: ['dividend', 'buyback', 'payout'] },
  { id: 'regulation', label: 'Policy & regulation', keywords: ['regulation', 'sebi', 'sec', 'antitrust', 'tariff', 'ban'] },
  { id: 'commodities', label: 'Commodities & currency', keywords: ['commodity', 'gold', 'rupee', 'dollar', 'currency'] },
  { id: 'analyst', label: 'Analyst calls', keywords: ['upgrade', 'downgrade', 'price target', 'rating', 'brokerage'] },
]

export const POPULAR_TICKERS = [
  { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', sector: 'semiconductors' },
  { symbol: 'GOOGL', name: 'Alphabet', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'AMZN', name: 'Amazon', exchange: 'NASDAQ', sector: 'consumer' },
  { symbol: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'TSLA', name: 'Tesla', exchange: 'NASDAQ', sector: 'automotive' },
  { symbol: 'AMD', name: 'AMD', exchange: 'NASDAQ', sector: 'semiconductors' },
  { symbol: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', sector: 'banking' },
  { symbol: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE', sector: 'energy' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', sector: 'energy' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', sector: 'technology' },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE', sector: 'technology' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', sector: 'banking' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', sector: 'banking' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', sector: 'automotive' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', exchange: 'NSE', sector: 'healthcare' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', exchange: 'NSE', sector: 'industrials' },
  { symbol: 'ASML', name: 'ASML', exchange: 'EURONEXT_PARIS', sector: 'semiconductors' },
  { symbol: 'SAP', name: 'SAP', exchange: 'XETRA', sector: 'technology' },
  { symbol: 'HSBA', name: 'HSBC', exchange: 'LSE', sector: 'banking' },
  { symbol: 'SHEL', name: 'Shell', exchange: 'LSE', sector: 'energy' },
]

export const sectorById = new Map(SECTORS.map((s) => [s.id, s]))
export const themeById = new Map(THEMES.map((t) => [t.id, t]))
```

- [ ] **Step 5: Implement `normalise.ts`**

```ts
export interface RawItem { title: string; link: string; source: string; publishedAt: Date; snippet: string }

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref|ref_src|igshid|si)/i

export function canonicaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING.test(key)) parsed.searchParams.delete(key)
    }
    let out = parsed.toString()
    if (out.endsWith('/')) out = out.slice(0, -1)
    return out
  } catch { return url }
}

export function normaliseTitle(title: string): string {
  return title
    .replace(/\s+[—–|-]\s+[^—–|-]{2,30}$/u, '')   // trailing " — Reuters"
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function dedupe(items: RawItem[]): RawItem[] {
  const seenUrl = new Set<string>()
  const seenTitle = new Set<string>()
  const out: RawItem[] = []
  for (const item of items) {
    const url = canonicaliseUrl(item.link)
    const title = normaliseTitle(item.title)
    if (!url || !title) continue
    if (seenUrl.has(url) || seenTitle.has(title)) continue
    seenUrl.add(url); seenTitle.add(title)
    out.push(item)
  }
  return out
}
```

- [ ] **Step 6: Implement `score.ts`**

```ts
import { sectorById, themeById } from './taxonomy'
import type { RawItem } from './normalise'

export interface ScoringProfile {
  tickers?: string[]; sectors?: string[]; themes?: string[]; exchanges?: string[]
}

const TICKER_WEIGHT = 100
const SECTOR_WEIGHT = 40
const THEME_WEIGHT = 15

export function scoreArticle(item: RawItem, profile: ScoringProfile) {
  const haystack = `${item.title} ${item.snippet}`.toLowerCase()
  const matchedTickers: string[] = []
  const matchedSectors: string[] = []
  let relevance = 0

  for (const ticker of profile.tickers ?? []) {
    // \b keeps "INFY" from matching inside "Infymatic"
    if (new RegExp(`\\b${ticker.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack)) {
      matchedTickers.push(ticker); relevance += TICKER_WEIGHT
    }
  }
  for (const id of profile.sectors ?? []) {
    if (sectorById.get(id)?.keywords.some((k) => haystack.includes(k))) {
      matchedSectors.push(id); relevance += SECTOR_WEIGHT
    }
  }
  for (const id of profile.themes ?? []) {
    if (themeById.get(id)?.keywords.some((k) => haystack.includes(k))) relevance += THEME_WEIGHT
  }
  if (relevance > 0) {
    const ageHours = (Date.now() - item.publishedAt.getTime()) / 3_600_000
    relevance += Math.max(0, 12 - ageHours) // gentle recency nudge, never dominant
  }
  return { relevance, matchedTickers, matchedSectors }
}
```

- [ ] **Step 7: Implement `feeds.ts` and `fetch.ts`**

```ts
// src/lib/news/feeds.ts
import { sectorById, themeById } from './taxonomy'

export interface FeedSpec { url: string; kind: 'ticker' | 'topic' | 'publisher'; hint?: string }

const PUBLISHERS: Record<string, string[]> = {
  us: ['https://feeds.content.dowjones.io/public/rss/mw_topstories', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  in: ['https://www.livemint.com/rss/markets', 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'],
  uk: ['https://www.ft.com/markets?format=rss'],
  eu: ['https://www.cnbc.com/id/19794221/device/rss/rss.html'],
  jp: ['https://www.cnbc.com/id/19832390/device/rss/rss.html'],
  hk: ['https://www.cnbc.com/id/19832390/device/rss/rss.html'],
  au: ['https://www.cnbc.com/id/19794221/device/rss/rss.html'],
  ca: ['https://www.cnbc.com/id/100003114/device/rss/rss.html'],
}

const googleNews = (query: string, region: string) => {
  const locale = region === 'in' ? 'hl=en-IN&gl=IN&ceid=IN:en' : 'hl=en-US&gl=US&ceid=US:en'
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:1d`)}&${locale}`
}

export function buildFeedUrls(profile: {
  tickers?: string[]; sectors?: string[]; themes?: string[]; exchanges?: string[]
}, regions: string[] = ['us']): FeedSpec[] {
  const specs: FeedSpec[] = []
  for (const ticker of (profile.tickers ?? []).slice(0, 12)) {
    specs.push({ url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`, kind: 'ticker', hint: ticker })
    specs.push({ url: googleNews(`${ticker} stock`, regions[0] ?? 'us'), kind: 'ticker', hint: ticker })
  }
  for (const id of (profile.sectors ?? []).slice(0, 8)) {
    const entry = sectorById.get(id)
    if (entry) specs.push({ url: googleNews(`${entry.label} stocks`, regions[0] ?? 'us'), kind: 'topic', hint: id })
  }
  for (const id of (profile.themes ?? []).slice(0, 6)) {
    const entry = themeById.get(id)
    if (entry) specs.push({ url: googleNews(entry.label, regions[0] ?? 'us'), kind: 'topic', hint: id })
  }
  for (const region of new Set(regions)) {
    for (const url of PUBLISHERS[region] ?? []) specs.push({ url, kind: 'publisher' })
  }
  return specs
}
```

```ts
// src/lib/news/fetch.ts
import Parser from 'rss-parser'
import type { RawItem } from './normalise'

export type FeedFetcher = (url: string) => Promise<RawItem[]>

const parser = new Parser({ timeout: 8_000, headers: { 'User-Agent': 'Bellbrief/1.0 (+news digest)' } })

function sourceFrom(item: { creator?: string; source?: unknown }, feedTitle: string | undefined, link: string): string {
  const raw = (item.source as { title?: string } | string | undefined)
  if (typeof raw === 'string' && raw) return raw
  if (raw && typeof raw === 'object' && raw.title) return raw.title
  if (feedTitle) return feedTitle
  try { return new URL(link).hostname.replace(/^www\./, '') } catch { return 'unknown' }
}

export const fetchFeed: FeedFetcher = async (url) => {
  const feed = await parser.parseURL(url)
  return (feed.items ?? []).flatMap((item) => {
    if (!item.title || !item.link) return []
    const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : new Date()
    if (Number.isNaN(publishedAt.getTime())) return []
    return [{
      title: item.title.trim(),
      link: item.link,
      source: sourceFrom(item as never, feed.title, item.link),
      publishedAt,
      snippet: (item.contentSnippet ?? item.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
    }]
  })
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      out[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return out
}
```

- [ ] **Step 8: Implement `collect.ts` and the barrel**

```ts
// src/lib/news/collect.ts
import { getExchange } from '@/lib/markets'
import { buildFeedUrls } from './feeds'
import { fetchFeed, mapWithConcurrency, type FeedFetcher } from './fetch'
import { canonicaliseUrl, dedupe, type RawItem } from './normalise'
import { scoreArticle, type ScoringProfile } from './score'

export const MAX_ARTICLES = 35
const CONCURRENCY = 6

export interface CollectedArticle {
  url: string; canonicalUrl: string; title: string; source: string
  publishedAt: Date; snippet: string
  matchedTickers: string[]; matchedSectors: string[]; relevance: number
}

export async function collectArticles(
  profile: ScoringProfile,
  opts: { since?: Date; limit?: number; fetcher?: FeedFetcher } = {},
): Promise<CollectedArticle[]> {
  const fetcher = opts.fetcher ?? fetchFeed
  const since = opts.since ?? new Date(Date.now() - 24 * 3_600_000)
  const limit = opts.limit ?? MAX_ARTICLES

  const regions = [...new Set((profile.exchanges ?? []).map((code) => {
    try { return getExchange(code).region } catch { return 'us' }
  }))]
  const specs = buildFeedUrls(profile, regions.length ? regions : ['us'])

  const batches = await mapWithConcurrency(specs, CONCURRENCY, async (spec) => {
    try { return await fetcher(spec.url) } catch { return [] as RawItem[] }
  })

  const fresh = batches.flat().filter((item) => item.publishedAt.getTime() >= since.getTime())

  return dedupe(fresh)
    .map((item) => {
      const { relevance, matchedTickers, matchedSectors } = scoreArticle(item, profile)
      return {
        url: item.link, canonicalUrl: canonicaliseUrl(item.link), title: item.title,
        source: item.source, publishedAt: item.publishedAt, snippet: item.snippet,
        matchedTickers, matchedSectors, relevance,
      }
    })
    .filter((a) => a.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit)
}
```

```ts
// src/lib/news/index.ts
export * from './taxonomy'; export * from './feeds'; export * from './fetch'
export * from './normalise'; export * from './score'; export * from './collect'
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/lib/news`
Expected: all passed.

- [ ] **Step 10: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: RSS news collection with dedupe and relevance scoring"
```

---

### Task 6: Gemini AI layer with code-validated citations

**Files:**
- Create: `src/lib/ai/prompt.ts`, `src/lib/ai/schema.ts`, `src/lib/ai/gemini.ts`, `src/lib/ai/validate.ts`, `src/lib/ai/summarise.ts`, `src/lib/ai/index.ts`, `scripts/verify-gemini.mjs`
- Test: `src/lib/ai/__tests__/validate.test.ts`, `src/lib/ai/__tests__/summarise.test.ts`

**Interfaces:**
- Consumes: `CollectedArticle` (Task 5), `ExperienceLevel` (Task 2), `getEnv` (Task 1)
- Produces:
  - `PROMPT_VERSION = 'p1'`, `GEMINI_MODEL = 'gemini-2.5-flash'`
  - `buildDigestPrompt(articles, profile): string`
  - `DIGEST_RESPONSE_SCHEMA` (Gemini `responseSchema` object)
  - `RawDigest { headline, overview, sentiment, narrative: {text, citations}[], claims: {claim, sources, agreement, confidence, note?}[] }`
  - `validateCitations(raw, articleCount): { digest: RawDigest; droppedSentences: number; degraded: boolean }`
  - `summarise(articles, profile, opts?): Promise<SummariseResult>` where `SummariseResult { status: 'ready'|'quiet'|'degraded'; digest: RawDigest; droppedSentences: number; model: string; promptVersion: string; tokensUsed?: number }`

- [ ] **Step 1: Write the failing tests for the citation validator — this is where "with proofs" is actually enforced**

```ts
// src/lib/ai/__tests__/validate.test.ts
import { describe, expect, it } from 'vitest'
import { validateCitations } from '../validate'

const raw = (over: Partial<Parameters<typeof validateCitations>[0]> = {}) => ({
  headline: 'IT majors under pressure',
  overview: 'Guidance cuts weigh on IT services.',
  sentiment: 'risk-off' as const,
  narrative: [{ text: 'Accenture cut guidance.', citations: [0] }],
  claims: [{ claim: 'Accenture cut guidance', sources: [0], agreement: 'corroborated' as const, confidence: 0.9 }],
  ...over,
})

describe('validateCitations', () => {
  it('keeps sentences whose citations all resolve', () => {
    const out = validateCitations(raw(), 3)
    expect(out.digest.narrative).toHaveLength(1)
    expect(out.droppedSentences).toBe(0)
  })

  it('DROPS a sentence citing an article index that does not exist', () => {
    const out = validateCitations(raw({
      narrative: [
        { text: 'Real claim.', citations: [0] },
        { text: 'Hallucinated claim.', citations: [99] },
      ],
    }), 3)
    expect(out.digest.narrative.map((s) => s.text)).toEqual(['Real claim.'])
    expect(out.droppedSentences).toBe(1)
  })

  it('drops a sentence with no citations at all', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Uncited assertion.', citations: [] }] }), 3)
    expect(out.digest.narrative).toHaveLength(0)
    expect(out.droppedSentences).toBe(1)
  })

  it('keeps a sentence but prunes only its invalid indexes when some resolve', () => {
    const out = validateCitations(raw({ narrative: [{ text: 'Mixed.', citations: [0, 99] }] }), 3)
    expect(out.digest.narrative[0].citations).toEqual([0])
    expect(out.droppedSentences).toBe(0)
  })

  it('demotes a claim whose every source is invalid to discarded', () => {
    const out = validateCitations(raw({
      claims: [{ claim: 'Fabricated', sources: [42], agreement: 'corroborated', confidence: 0.9 }],
    }), 3)
    expect(out.digest.claims[0].agreement).toBe('discarded')
    expect(out.digest.claims[0].sources).toEqual([])
  })

  it('downgrades a claim marked corroborated but backed by only one source', () => {
    const out = validateCitations(raw({
      claims: [{ claim: 'Only one outlet', sources: [1], agreement: 'corroborated', confidence: 0.8 }],
    }), 3)
    expect(out.digest.claims[0].agreement).toBe('single-source')
  })

  it('flags the digest degraded when more than 40% of sentences are dropped', () => {
    const out = validateCitations(raw({
      narrative: [
        { text: 'ok', citations: [0] },
        { text: 'bad', citations: [99] },
        { text: 'bad', citations: [98] },
      ],
    }), 3)
    expect(out.degraded).toBe(true)
  })

  it('clamps confidence into 0..1', () => {
    const out = validateCitations(raw({
      claims: [{ claim: 'c', sources: [0, 1], agreement: 'corroborated', confidence: 7 }],
    }), 3)
    expect(out.digest.claims[0].confidence).toBe(1)
  })
})
```

- [ ] **Step 2: Write the failing tests for `summarise` fallback behaviour**

```ts
// src/lib/ai/__tests__/summarise.test.ts
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/env', () => ({ getEnv: () => ({ GEMINI_API_KEY: 'test-key' }) }))
const { summarise } = await import('../summarise')

const article = (i: number) => ({
  url: `https://x.com/${i}`, canonicalUrl: `https://x.com/${i}`, title: `Story ${i}`,
  source: 'Reuters', publishedAt: new Date('2026-09-10T06:00:00Z'), snippet: 's',
  matchedTickers: ['INFY'], matchedSectors: [], relevance: 100,
})
const profile = { experienceLevel: 'beginner' as const, sectors: [], themes: [], tickers: ['INFY'], exchanges: ['NSE'] }

describe('summarise', () => {
  it('returns quiet without calling the model when there are no articles', async () => {
    const generate = vi.fn()
    const out = await summarise([], profile, { generate })
    expect(out.status).toBe('quiet')
    expect(generate).not.toHaveBeenCalled()
  })

  it('returns a ready digest for a well-formed model response', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        headline: 'IT under pressure', overview: 'o', sentiment: 'risk-off',
        narrative: [{ text: 'Guidance was cut.', citations: [0] }],
        claims: [{ claim: 'Guidance cut', sources: [0, 1], agreement: 'corroborated', confidence: 0.9 }],
      }),
      usage: 900,
    })
    const out = await summarise([article(0), article(1)], profile, { generate })
    expect(out.status).toBe('ready')
    expect(out.digest.narrative).toHaveLength(1)
    expect(out.tokensUsed).toBe(900)
  })

  it('NEVER fabricates a summary: after retries it degrades to raw headlines', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('503 unavailable'))
    const out = await summarise([article(0), article(1)], profile, { generate, retries: 1, retryDelayMs: 0 })
    expect(out.status).toBe('degraded')
    expect(out.digest.headline).toMatch(/SUMMARY UNAVAILABLE/)
    expect(out.digest.narrative).toHaveLength(0)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('degrades rather than throwing when the model returns unparseable JSON', async () => {
    const generate = vi.fn().mockResolvedValue({ text: 'I am not JSON' })
    const out = await summarise([article(0)], profile, { generate, retries: 0, retryDelayMs: 0 })
    expect(out.status).toBe('degraded')
  })

  it('asks for beginner-level language when the profile says beginner', async () => {
    const generate = vi.fn().mockResolvedValue({ text: JSON.stringify({ headline: 'h', overview: '', sentiment: 'mixed', narrative: [], claims: [] }) })
    await summarise([article(0)], profile, { generate })
    expect(generate.mock.calls[0][0].prompt).toMatch(/beginner/i)
  })
})
```

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run src/lib/ai`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/lib/ai/prompt.ts`**

The prompt is written as hard constraints, not polite requests, and every rule exists because of a specific failure mode noted in a comment.

```ts
import type { CollectedArticle } from '@/lib/news'
import type { ExperienceLevel } from '@/lib/db/models'

export const PROMPT_VERSION = 'p1'

const REGISTER: Record<ExperienceLevel, string> = {
  beginner: 'The reader is a BEGINNER. The first time you use any market term (guidance, ADR, basis points, dilution, short interest), add a four-to-eight word plain-English gloss in parentheses. Prefer short sentences.',
  intermediate: 'The reader is an INTERMEDIATE investor. Standard market vocabulary is fine. Do not explain common terms.',
  advanced: 'The reader is ADVANCED. Use precise market vocabulary with no explanation. Be terse and quantitative; lead with numbers.',
}

export interface PromptProfile {
  experienceLevel: ExperienceLevel
  tickers?: string[]; sectors?: string[]; themes?: string[]; exchanges?: string[]
  riskAppetite?: string; horizon?: string
}

export function buildDigestPrompt(articles: CollectedArticle[], profile: PromptProfile): string {
  const corpus = articles
    .map((a, i) => `[${i}] SOURCE: ${a.source}\n    PUBLISHED: ${a.publishedAt.toISOString()}\n    TITLE: ${a.title}\n    SUMMARY: ${a.snippet || '(headline only)'}`)
    .join('\n\n')

  return `You are the research desk for Bellbrief, a pre-market briefing service. You are writing the brief that a single reader will see sixty minutes before ${(profile.exchanges ?? ['their exchange']).join(' and ')} opens.

## Reader
Follows these tickers: ${(profile.tickers ?? []).join(', ') || 'none specified'}
Follows these sectors: ${(profile.sectors ?? []).join(', ') || 'none specified'}
Follows these themes: ${(profile.themes ?? []).join(', ') || 'none specified'}
Risk appetite: ${profile.riskAppetite ?? 'balanced'}. Horizon: ${profile.horizon ?? 'long-term'}.
${REGISTER[profile.experienceLevel]}

## Source material — ${articles.length} articles, each with a numbered index
${corpus}

## Absolute rules

1. GROUNDING. Use ONLY the numbered articles above. You have no other knowledge of these companies, prices, or events. If a fact is not in the articles, it does not exist for this task. Never supply a figure, date, percentage or quotation that is not present in the text above.

2. CITATION. Every sentence in \`narrative\` MUST carry at least one index in its \`citations\` array, and every index MUST be a number that appears above. A sentence you cannot cite is a sentence you must not write. Indexes are integers, never strings, never ranges.

3. NO INVENTED INDEXES. Do not cite an index higher than ${articles.length - 1}. Citations are checked mechanically after you respond; an invented index causes the whole sentence to be deleted, so an uncitable sentence is worse than no sentence.

4. CLAIM CLASSIFICATION. In \`claims\`, decompose the story into individual factual assertions. Classify each one honestly:
   - "corroborated" — stated by TWO OR MORE independent sources. List every supporting index.
   - "disputed" — sources CONFLICT. Say what the disagreement is in \`note\`. Do NOT average the positions, pick a winner, or smooth it over. A reader is better served by "these two outlets disagree" than by a confident blend.
   - "single-source" — only one source says it. Still list it.
   - "discarded" — opinion presented as fact, promotional content, price-target speculation, or an unsourced rumour. Include it with \`agreement: "discarded"\` and a one-line reason in \`note\` so the reader can see what you rejected and why.

5. NO ADVICE. Report what sources reported. Never recommend buying, selling, holding, entering, exiting, or sizing anything. Never predict a price. Do not write "investors should".

6. RELEVANCE. Lead with what actually moves this reader's stated interests. A major story unrelated to their interests belongs at the end or not at all.

7. QUIET DAYS. If the articles contain nothing materially new for this reader, set \`sentiment\` to "quiet", write a one-sentence \`overview\` saying so, and leave \`narrative\` empty. Never inflate trivia into a headline. A short honest brief is a success, not a failure.

8. FORM. \`headline\` is at most 60 characters, no ticker soup, no exclamation marks. \`overview\` is one sentence. \`narrative\` is 3 to 6 sentences that read as continuous prose. Write in plain declarative English, not bullet fragments. No emoji.

Respond with JSON conforming exactly to the provided schema. No markdown fence, no commentary.`
}
```

- [ ] **Step 5: Implement `src/lib/ai/schema.ts`**

```ts
export const GEMINI_MODEL = 'gemini-2.5-flash'

export const DIGEST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    overview: { type: 'string' },
    sentiment: { type: 'string', enum: ['risk-on', 'risk-off', 'mixed', 'quiet'] },
    narrative: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          citations: { type: 'array', items: { type: 'integer' } },
        },
        required: ['text', 'citations'],
      },
    },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          sources: { type: 'array', items: { type: 'integer' } },
          agreement: { type: 'string', enum: ['corroborated', 'disputed', 'single-source', 'discarded'] },
          confidence: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['claim', 'sources', 'agreement', 'confidence'],
      },
    },
  },
  required: ['headline', 'overview', 'sentiment', 'narrative', 'claims'],
} as const
```

- [ ] **Step 6: Implement `src/lib/ai/validate.ts`**

```ts
import type { Agreement, DigestClaim, NarrativeSentence } from '@/lib/db/models'

export interface RawDigest {
  headline: string
  overview: string
  sentiment: 'risk-on' | 'risk-off' | 'mixed' | 'quiet'
  narrative: NarrativeSentence[]
  claims: DigestClaim[]
}

const DEGRADED_DROP_RATIO = 0.4

export function validateCitations(raw: RawDigest, articleCount: number) {
  const valid = (index: unknown): index is number =>
    typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < articleCount

  let droppedSentences = 0
  const narrative: NarrativeSentence[] = []
  for (const sentence of raw.narrative ?? []) {
    const citations = [...new Set((sentence.citations ?? []).filter(valid))]
    // A sentence with no resolvable citation is unprovable, so it is not shown at all.
    if (citations.length === 0) { droppedSentences++; continue }
    narrative.push({ text: sentence.text, citations })
  }

  const claims: DigestClaim[] = (raw.claims ?? []).map((claim) => {
    const sources = [...new Set((claim.sources ?? []).filter(valid))]
    let agreement: Agreement = claim.agreement
    if (sources.length === 0) agreement = 'discarded'
    else if (agreement === 'corroborated' && sources.length < 2) agreement = 'single-source'
    return {
      claim: claim.claim,
      sources,
      agreement,
      confidence: Math.min(1, Math.max(0, Number(claim.confidence) || 0)),
      note: claim.note,
    }
  })

  const total = (raw.narrative ?? []).length
  const degraded = total > 0 && droppedSentences / total > DEGRADED_DROP_RATIO

  return {
    digest: {
      headline: raw.headline ?? '',
      overview: raw.overview ?? '',
      sentiment: raw.sentiment ?? 'mixed',
      narrative,
      claims,
    } satisfies RawDigest,
    droppedSentences,
    degraded,
  }
}
```

- [ ] **Step 7: Implement `src/lib/ai/gemini.ts`**

```ts
import { GoogleGenAI } from '@google/genai'
import { getEnv } from '@/lib/env'
import { DIGEST_RESPONSE_SCHEMA, GEMINI_MODEL } from './schema'

export interface GenerateArgs { prompt: string; timeoutMs?: number }
export interface GenerateResult { text: string; usage?: number }
export type Generate = (args: GenerateArgs) => Promise<GenerateResult>

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY })
  return client
}

export const generateWithGemini: Generate = async ({ prompt, timeoutMs = 60_000 }) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: DIGEST_RESPONSE_SCHEMA as never,
        temperature: 0.2,          // low: this is reporting, not writing
        maxOutputTokens: 4096,
        abortSignal: controller.signal,
      },
    })
    const text = response.text ?? ''
    if (!text) throw new Error('Gemini returned an empty response')
    return { text, usage: response.usageMetadata?.totalTokenCount }
  } finally {
    clearTimeout(timer)
  }
}
```

If the installed `@google/genai` rejects `abortSignal` inside `config`, wrap the call in `Promise.race` against a rejecting timer instead — the contract `Generate` must not change.

- [ ] **Step 8: Implement `src/lib/ai/summarise.ts`**

```ts
import type { CollectedArticle } from '@/lib/news'
import { generateWithGemini, type Generate } from './gemini'
import { buildDigestPrompt, PROMPT_VERSION, type PromptProfile } from './prompt'
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function stripFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
}

function quiet(message: string): RawDigest {
  return { headline: 'Quiet morning', overview: message, sentiment: 'quiet', narrative: [], claims: [] }
}

function degradedDigest(articles: CollectedArticle[]): RawDigest {
  return {
    headline: 'SUMMARY UNAVAILABLE — headlines only',
    overview: `The summariser could not be reached, so here are the ${articles.length} most relevant headlines, unsummarised.`,
    sentiment: 'mixed',
    narrative: [],
    claims: [],
  }
}

export async function summarise(
  articles: CollectedArticle[],
  profile: PromptProfile,
  opts: { generate?: Generate; retries?: number; retryDelayMs?: number } = {},
): Promise<SummariseResult> {
  const base = { model: GEMINI_MODEL, promptVersion: PROMPT_VERSION, droppedSentences: 0 }

  if (articles.length === 0) {
    return { ...base, status: 'quiet', digest: quiet('No news matching your interests was published overnight.') }
  }

  const generate = opts.generate ?? generateWithGemini
  const retries = opts.retries ?? 2
  const retryDelayMs = opts.retryDelayMs ?? 1_500
  const prompt = buildDigestPrompt(articles, profile)

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
        digest, droppedSentences, tokensUsed: usage,
      }
    } catch (error) {
      lastError = (error as Error).message
    }
  }

  // Never fabricate. Ship the raw headlines, clearly labelled.
  return { ...base, status: 'degraded', digest: degradedDigest(articles), error: lastError }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/lib/ai`
Expected: all passed (13 assertions across the two files).

- [ ] **Step 10: Write `scripts/verify-gemini.mjs` and verify the real key**

The supplied key starts with `AQ.` rather than `AIza`, which is not the usual AI Studio shape, so this must be checked against the live API before the pipeline is trusted.

```js
// scripts/verify-gemini.mjs
import { GoogleGenAI } from '@google/genai'

const key = process.env.GEMINI_API_KEY
if (!key) { console.error('GEMINI_API_KEY is not set'); process.exit(1) }
console.log(`Key shape: ${key.slice(0, 6)}… length ${key.length}`)

try {
  const ai = new GoogleGenAI({ apiKey: key })
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Reply with exactly: OK',
    config: { maxOutputTokens: 16 },
  })
  console.log('PASS — model replied:', JSON.stringify(res.text))
} catch (error) {
  console.error('FAIL —', error?.message ?? error)
  console.error('\nIf this is a 400/401/403, the key is expired or not an AI Studio key.')
  console.error('Get a fresh one at https://aistudio.google.com/apikey (it will start with "AIza").')
  process.exit(2)
}
```

Run: `npm run verify:gemini`
Expected: `PASS`. **If it fails, stop and report the exact error to the user** — the rest of the pipeline is built and tested against mocks, so it will work the moment a valid key is present, but do not claim the digest works end-to-end until this passes.

- [ ] **Step 11: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: Gemini digest layer with mechanically validated citations"
```

---

### Task 7: Mail layer

**Files:**
- Create: `src/lib/mail/template.ts`, `src/lib/mail/drivers.ts`, `src/lib/mail/send.ts`, `src/lib/mail/index.ts`
- Test: `src/lib/mail/__tests__/template.test.ts`, `src/lib/mail/__tests__/send.test.ts`

**Interfaces:**
- Consumes: `DigestDoc` (Task 2), `getEnv` (Task 1)
- Produces: `renderDigestEmail(input): { subject, html, text }`, `MailDriver { name: string; send(msg): Promise<void> }`, `selectDriver(env): MailDriver`, `sendDigestEmail(user, digest, opts?): Promise<{ status: 'sent'|'failed'|'skipped'; error?: string }>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/mail/__tests__/template.test.ts
import { describe, expect, it } from 'vitest'
import { renderDigestEmail } from '../template'

const input = {
  name: 'Sathvik', exchange: 'NSE', sessionDate: '2026-09-10',
  openLocal: '09:15', timeZone: 'Asia/Kolkata', appUrl: 'http://localhost:3000',
  digest: {
    _id: 'abc', status: 'ready', headline: 'IT majors under pressure',
    overview: 'Guidance cuts weigh on services names.',
    narrative: [{ text: 'Accenture cut guidance.', citations: [0] }],
    claims: [{ claim: 'Guidance cut', sources: [0], agreement: 'single-source', confidence: 0.7 }],
    articles: [{ index: 0, url: 'https://reuters.com/a', title: 'Accenture trims forecast', source: 'Reuters', publishedAt: new Date('2026-09-10T02:00:00Z') }],
    sentiment: 'risk-off',
  },
}

describe('renderDigestEmail', () => {
  it('puts the exchange and headline in the subject', () => {
    expect(renderDigestEmail(input as never).subject).toContain('NSE')
    expect(renderDigestEmail(input as never).subject).toContain('IT majors under pressure')
  })
  it('renders every citation as a real link to its source', () => {
    expect(renderDigestEmail(input as never).html).toContain('https://reuters.com/a')
  })
  it('includes the no-advice disclaimer', () => {
    expect(renderDigestEmail(input as never).html.toLowerCase()).toContain('not investment advice')
  })
  it('provides a plain-text alternative containing the narrative', () => {
    expect(renderDigestEmail(input as never).text).toContain('Accenture cut guidance.')
  })
  it('uses no pink or purple', () => {
    const html = renderDigestEmail(input as never).html.toLowerCase()
    for (const banned of ['pink', 'purple', 'magenta', 'violet', 'fuchsia', '#ff00ff', '#e91e63', '#9c27b0']) {
      expect(html).not.toContain(banned)
    }
  })
  it('labels a degraded digest in the subject', () => {
    const degraded = { ...input, digest: { ...input.digest, status: 'degraded', headline: 'SUMMARY UNAVAILABLE — headlines only' } }
    expect(renderDigestEmail(degraded as never).subject).toMatch(/unavailable/i)
  })
})
```

```ts
// src/lib/mail/__tests__/send.test.ts
import { describe, expect, it, vi } from 'vitest'
import { selectDriver } from '../drivers'

describe('selectDriver', () => {
  it('uses the file driver when no Resend key is configured', () => {
    expect(selectDriver({ RESEND_API_KEY: undefined, MAIL_FROM: 'a@b.c' } as never).name).toBe('file')
  })
  it('uses the resend driver when a key is configured', () => {
    expect(selectDriver({ RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.c' } as never).name).toBe('resend')
  })
})

describe('sendDigestEmail', () => {
  it('skips when the user has opted out', async () => {
    const { sendDigestEmail } = await import('../send')
    const driver = { name: 'test', send: vi.fn() }
    const out = await sendDigestEmail(
      { email: 'a@b.com', name: 'A', timeZone: 'UTC', emailOptIn: false } as never,
      { headline: 'h', status: 'ready', articles: [], narrative: [], claims: [] } as never,
      { driver, exchange: 'NSE' },
    )
    expect(out.status).toBe('skipped')
    expect(driver.send).not.toHaveBeenCalled()
  })

  it('reports failure without throwing when the driver rejects', async () => {
    const { sendDigestEmail } = await import('../send')
    const driver = { name: 'test', send: vi.fn().mockRejectedValue(new Error('403 domain not verified')) }
    const out = await sendDigestEmail(
      { email: 'a@b.com', name: 'A', timeZone: 'UTC', emailOptIn: true } as never,
      { headline: 'h', status: 'ready', articles: [], narrative: [], claims: [] } as never,
      { driver, exchange: 'NSE', retries: 0 },
    )
    expect(out.status).toBe('failed')
    expect(out.error).toMatch(/403/)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/mail`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/mail/template.ts`**

Email HTML must use table layout and inline styles; Gmail strips `<style>` blocks and ignores flexbox.

```ts
import type { DigestArticleRef, DigestClaim, NarrativeSentence } from '@/lib/db/models'

export interface DigestEmailInput {
  name: string; exchange: string; sessionDate: string
  openLocal: string; timeZone: string; appUrl: string
  digest: {
    _id: string; status: string; headline: string; overview: string
    narrative: NarrativeSentence[]; claims: DigestClaim[]
    articles: DigestArticleRef[]; sentiment: string
  }
}

const C = { bg: '#0A0C0B', panel: '#111614', border: '#1B2320', text: '#E6EDE9', muted: '#8D9A93', accent: '#A8FF60', amber: '#FFC24B' }

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function renderDigestEmail(input: DigestEmailInput): { subject: string; html: string; text: string } {
  const { digest } = input
  const subject = `${input.exchange} opens ${input.openLocal} — ${digest.headline}`

  const sentence = (s: NarrativeSentence) => {
    const marks = s.citations.map((i) => {
      const a = digest.articles.find((x) => x.index === i)
      return a ? `<a href="${escape(a.url)}" style="color:${C.accent};text-decoration:none;font-size:11px">[${i + 1}]</a>` : ''
    }).join('')
    return `${escape(s.text)} ${marks}`
  }

  const narrative = digest.narrative.length
    ? `<p style="margin:0 0 16px;color:${C.text};font-size:15px;line-height:1.75">${digest.narrative.map(sentence).join(' ')}</p>`
    : `<p style="margin:0 0 16px;color:${C.muted};font-size:14px;line-height:1.7">${escape(digest.overview)}</p>`

  const shown = digest.claims.filter((c) => c.agreement !== 'discarded')
  const claims = shown.length ? `
    <p style="margin:22px 0 8px;color:${C.muted};font-size:10px;letter-spacing:1.6px;text-transform:uppercase">Claim ledger</p>
    ${shown.map((c) => {
      const colour = c.agreement === 'disputed' ? C.amber : C.accent
      const label = c.agreement === 'corroborated' ? `${c.sources.length} sources agree`
        : c.agreement === 'disputed' ? 'sources disagree' : 'single source'
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr>
        <td style="background:${C.panel};border-left:3px solid ${colour};border-radius:6px;padding:11px 13px">
          <div style="color:${C.text};font-size:13px;line-height:1.5">${escape(c.claim)}</div>
          <div style="color:${colour};font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-top:6px">${label}${c.note ? ` — ${escape(c.note)}` : ''}</div>
        </td></tr></table>`
    }).join('')}` : ''

  const sources = digest.articles.length ? `
    <p style="margin:22px 0 8px;color:${C.muted};font-size:10px;letter-spacing:1.6px;text-transform:uppercase">Sources</p>
    ${digest.articles.map((a) => `<div style="margin:0 0 6px;font-size:12px;line-height:1.5">
      <span style="color:${C.accent}">[${a.index + 1}]</span>
      <a href="${escape(a.url)}" style="color:${C.text};text-decoration:none">${escape(a.title)}</a>
      <span style="color:${C.muted}"> — ${escape(a.source)}</span>
    </div>`).join('')}` : ''

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.bg};border:1px solid ${C.border};border-radius:14px;padding:26px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <tr><td>
    <div style="color:${C.accent};font-size:12px;letter-spacing:3.4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">BELLBRIEF</div>
    <div style="color:${C.muted};font-size:11px;margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">
      ${escape(input.exchange)} · SESSION ${escape(input.sessionDate)} · OPENS ${escape(input.openLocal)} ${escape(input.timeZone)}
    </div>
    <h1 style="color:#ffffff;font-size:23px;line-height:1.25;margin:20px 0 10px;letter-spacing:-0.4px">${escape(digest.headline)}</h1>
    <p style="color:${C.muted};font-size:13px;line-height:1.6;margin:0 0 18px">${escape(digest.overview)}</p>
    ${narrative}${claims}${sources}
    <table role="presentation" width="100%" style="margin:26px 0 0"><tr><td align="center">
      <a href="${escape(input.appUrl)}/digest/${escape(String(digest._id))}" style="display:inline-block;background:${C.accent};color:${C.bg};font-size:13px;font-weight:600;padding:11px 22px;border-radius:8px;text-decoration:none">Open the proof view</a>
    </td></tr></table>
    <p style="color:${C.muted};font-size:10.5px;line-height:1.6;margin:24px 0 0;border-top:1px solid ${C.border};padding-top:14px">
      Bellbrief summarises published news and links every claim to its source. This is not investment advice.
      <a href="${escape(input.appUrl)}/settings" style="color:${C.muted}">Manage emails</a>.
    </p>
  </td></tr>
</table></td></tr></table></body></html>`

  const text = [
    `BELLBRIEF — ${input.exchange} opens ${input.openLocal} ${input.timeZone}`,
    '', digest.headline, digest.overview, '',
    ...digest.narrative.map((s) => `${s.text} [${s.citations.map((i) => i + 1).join(',')}]`),
    '', 'SOURCES',
    ...digest.articles.map((a) => `[${a.index + 1}] ${a.title} — ${a.source} — ${a.url}`),
    '', 'Not investment advice.', `${input.appUrl}/digest/${digest._id}`,
  ].join('\n')

  return { subject, html, text }
}
```

- [ ] **Step 4: Implement `src/lib/mail/drivers.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Resend } from 'resend'
import type { Env } from '@/lib/env'

export interface MailMessage { to: string; from: string; subject: string; html: string; text: string }
export interface MailDriver { name: string; send(message: MailMessage): Promise<void> }

export const fileDriver: MailDriver = {
  name: 'file',
  async send(message) {
    const dir = path.join(process.cwd(), '.mail')
    await mkdir(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safe = message.to.replace(/[^a-z0-9]/gi, '_')
    await writeFile(path.join(dir, `${stamp}-${safe}.html`), message.html, 'utf8')
    await writeFile(path.join(dir, `${stamp}-${safe}.txt`), `Subject: ${message.subject}\n\n${message.text}`, 'utf8')
  },
}

export function resendDriver(apiKey: string): MailDriver {
  const client = new Resend(apiKey)
  return {
    name: 'resend',
    async send(message) {
      const { error } = await client.emails.send({
        from: message.from, to: message.to, subject: message.subject,
        html: message.html, text: message.text,
      })
      if (error) throw new Error(`${error.name ?? 'resend_error'}: ${error.message}`)
    },
  }
}

export function selectDriver(env: Pick<Env, 'RESEND_API_KEY' | 'MAIL_FROM'>): MailDriver {
  return env.RESEND_API_KEY ? resendDriver(env.RESEND_API_KEY) : fileDriver
}
```

- [ ] **Step 5: Implement `src/lib/mail/send.ts` and the barrel**

```ts
import { getExchange } from '@/lib/markets'
import { getEnv } from '@/lib/env'
import { selectDriver, type MailDriver } from './drivers'
import { renderDigestEmail } from './template'

export async function sendDigestEmail(
  user: { email: string; name: string; timeZone: string; emailOptIn: boolean },
  digest: Parameters<typeof renderDigestEmail>[0]['digest'] & { sessionDate?: string },
  opts: { exchange: string; driver?: MailDriver; retries?: number },
): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }> {
  if (!user.emailOptIn) return { status: 'skipped' }

  const env = getEnv()
  const driver = opts.driver ?? selectDriver(env)
  const exchange = (() => { try { return getExchange(opts.exchange) } catch { return null } })()

  const { subject, html, text } = renderDigestEmail({
    name: user.name, exchange: opts.exchange,
    sessionDate: digest.sessionDate ?? '',
    openLocal: exchange?.openLocal ?? '', timeZone: exchange?.timeZone ?? user.timeZone,
    appUrl: env.APP_URL, digest,
  })

  const retries = opts.retries ?? 1
  let lastError = 'unknown error'
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await driver.send({ to: user.email, from: env.MAIL_FROM, subject, html, text })
      return { status: 'sent' }
    } catch (error) { lastError = (error as Error).message }
  }
  return { status: 'failed', error: lastError }
}
```

```ts
// src/lib/mail/index.ts
export * from './template'; export * from './drivers'; export * from './send'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/mail`
Expected: all passed.

- [ ] **Step 7: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: digest email template and swappable mail drivers"
```

---

### Task 8: Digest orchestrator

**Files:**
- Create: `src/lib/digest/generate.ts`, `src/lib/digest/index.ts`
- Test: `src/lib/digest/__tests__/generate.test.ts`

**Interfaces:**
- Consumes: `collectArticles` (Task 5), `summarise` (Task 6), `sendDigestEmail` (Task 7), models (Task 2), `getExchange`/`digestInstantFor`/`nextSessionOpen` (Task 3)
- Produces: `generateDigest({ userId, exchange, sessionDate, deps? }): Promise<{ digestId: string; status: string; created: boolean }>`; `DigestDeps { collect?, summarise?, sendEmail? }` for injection.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/digest/__tests__/generate.test.ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/env', () => ({ getEnv: () => ({ APP_URL: 'http://localhost:3000', MAIL_FROM: 'a@b.c', RESEND_API_KEY: undefined }) }))
vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))

const { generateDigest } = await import('../generate')
const { DigestModel, ProfileModel, UserModel } = await import('@/lib/db/models')

let mem: MongoMemoryServer
let userId: string

const article = (i: number) => ({
  url: `https://x.com/${i}`, canonicalUrl: `https://x.com/${i}`, title: `Story ${i}`, source: 'Reuters',
  publishedAt: new Date('2026-09-10T02:00:00Z'), snippet: 's', matchedTickers: ['INFY'], matchedSectors: [], relevance: 100,
})

const deps = (over = {}) => ({
  collect: vi.fn().mockResolvedValue([article(0), article(1)]),
  summarise: vi.fn().mockResolvedValue({
    status: 'ready', droppedSentences: 0, model: 'gemini-2.5-flash', promptVersion: 'p1', tokensUsed: 100,
    digest: {
      headline: 'IT under pressure', overview: 'o', sentiment: 'risk-off',
      narrative: [{ text: 'Guidance cut.', citations: [0] }],
      claims: [{ claim: 'Guidance cut', sources: [0, 1], agreement: 'corroborated', confidence: 0.9 }],
    },
  }),
  sendEmail: vi.fn().mockResolvedValue({ status: 'sent' }),
  ...over,
})

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()))
}, 60_000)
afterAll(async () => { await mongoose.disconnect(); await mem.stop() })

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ProfileModel.deleteMany({}), DigestModel.deleteMany({})])
  const user = await UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'A', timeZone: 'Asia/Kolkata' })
  userId = String(user._id)
  await ProfileModel.create({
    userId: user._id, exchanges: ['NSE'], tickers: ['INFY'], sectors: ['technology'],
    themes: ['earnings'], experienceLevel: 'beginner', emailOptIn: true, completedAt: new Date(),
  })
})

describe('generateDigest', () => {
  it('persists a digest with an index-to-article map covering every citation', async () => {
    const d = deps()
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect(out.status).toBe('ready')
    const saved = await DigestModel.findById(out.digestId).lean()
    expect(saved!.articles).toHaveLength(2)
    expect(saved!.articles[0].index).toBe(0)
    for (const s of saved!.narrative) {
      for (const c of s.citations) expect(saved!.articles.some((a) => a.index === c)).toBe(true)
    }
  })

  it('passes the experience level through to the summariser', async () => {
    const d = deps()
    await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect(d.summarise.mock.calls[0][1].experienceLevel).toBe('beginner')
  })

  it('is idempotent: a second call returns the existing digest and does not re-summarise', async () => {
    const first = deps()
    const a = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: first })
    const second = deps()
    const b = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: second })
    expect(b.digestId).toBe(a.digestId)
    expect(b.created).toBe(false)
    expect(second.summarise).not.toHaveBeenCalled()
    expect(await DigestModel.countDocuments({ userId })).toBe(1)
  })

  it('stores a quiet digest when no articles are found', async () => {
    const d = deps({ collect: vi.fn().mockResolvedValue([]) })
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    expect(out.status).toBe('quiet')
  })

  it('records the email failure on the digest without failing the digest', async () => {
    const d = deps({ sendEmail: vi.fn().mockResolvedValue({ status: 'failed', error: '403 not verified' }) })
    const out = await generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: d })
    const saved = await DigestModel.findById(out.digestId).lean()
    expect(out.status).toBe('ready')
    expect(saved!.emailStatus).toBe('failed')
    expect(saved!.emailError).toMatch(/403/)
  })

  it('throws a clear error when the profile is missing', async () => {
    await ProfileModel.deleteMany({})
    await expect(generateDigest({ userId, exchange: 'NSE', sessionDate: '2026-09-10', deps: deps() }))
      .rejects.toThrow(/profile/i)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/digest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/digest/generate.ts`**

```ts
import { connectToDatabase } from '@/lib/db/connect'
import { ArticleModel, DigestModel, ProfileModel, UserModel } from '@/lib/db/models'
import { digestInstantFor, getExchange } from '@/lib/markets'
import { collectArticles, type CollectedArticle } from '@/lib/news'
import { summarise as summariseWithGemini } from '@/lib/ai'
import { sendDigestEmail } from '@/lib/mail'

export interface DigestDeps {
  collect?: typeof collectArticles
  summarise?: typeof summariseWithGemini
  sendEmail?: typeof sendDigestEmail
}

export async function generateDigest(input: {
  userId: string; exchange: string; sessionDate: string; deps?: DigestDeps
}): Promise<{ digestId: string; status: string; created: boolean }> {
  const { userId, exchange, sessionDate } = input
  const collect = input.deps?.collect ?? collectArticles
  const summarise = input.deps?.summarise ?? summariseWithGemini
  const sendEmail = input.deps?.sendEmail ?? sendDigestEmail

  await connectToDatabase()

  const existing = await DigestModel.findOne({ userId, exchange, sessionDate }).lean()
  if (existing) return { digestId: String(existing._id), status: existing.status, created: false }

  const [user, profile] = await Promise.all([
    UserModel.findById(userId).lean(),
    ProfileModel.findOne({ userId }).lean(),
  ])
  if (!user) throw new Error(`No user ${userId}`)
  if (!profile) throw new Error(`No profile for user ${userId}`)

  const ex = getExchange(exchange)
  const since = new Date(digestInstantFor(ex, sessionDate).getTime() - 24 * 3_600_000)

  const articles: CollectedArticle[] = await collect(
    { tickers: profile.tickers, sectors: profile.sectors, themes: profile.themes, exchanges: [exchange] },
    { since },
  )

  const result = await summarise(articles, {
    experienceLevel: profile.experienceLevel,
    tickers: profile.tickers, sectors: profile.sectors, themes: profile.themes,
    exchanges: [exchange], riskAppetite: profile.riskAppetite, horizon: profile.horizon,
  })

  // Persist articles for reuse across users, then build the index->article map the digest renders from.
  const refs = await Promise.all(articles.map(async (a, index) => {
    let id: unknown
    try {
      const doc = await ArticleModel.findOneAndUpdate(
        { url: a.url },
        { $set: { ...a, fetchedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean()
      id = doc?._id
    } catch { /* a duplicate-key race is harmless; the digest keeps its own copy */ }
    return { index, articleId: id, url: a.url, title: a.title, source: a.source, publishedAt: a.publishedAt }
  }))

  const created = await DigestModel.create({
    userId, exchange, sessionDate,
    digestInstant: digestInstantFor(ex, sessionDate),
    status: result.status,
    headline: result.digest.headline,
    overview: result.digest.overview,
    narrative: result.digest.narrative,
    claims: result.digest.claims,
    sentiment: result.digest.sentiment,
    articles: refs,
    model: result.model, promptVersion: result.promptVersion,
    tokensUsed: result.tokensUsed, droppedSentences: result.droppedSentences,
    emailStatus: 'pending',
  })

  const mail = await sendEmail(
    { email: user.email, name: user.name, timeZone: user.timeZone, emailOptIn: profile.emailOptIn },
    {
      _id: String(created._id), status: created.status, headline: created.headline,
      overview: created.overview, narrative: created.narrative, claims: created.claims,
      articles: created.articles, sentiment: created.sentiment, sessionDate,
    } as never,
    { exchange },
  )
  created.emailStatus = mail.status
  created.emailError = mail.error
  await created.save()

  return { digestId: String(created._id), status: created.status, created: true }
}
```

- [ ] **Step 4: Create the barrel and run tests**

```ts
// src/lib/digest/index.ts
export * from './generate'
```

Run: `npx vitest run src/lib/digest`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: digest orchestrator with idempotent persistence"
```

---

### Task 9: Scheduler and cron endpoint

**Files:**
- Create: `src/lib/scheduler/tick.ts`, `src/lib/scheduler/start.ts`, `src/lib/scheduler/index.ts`, `src/app/api/cron/run/route.ts`, `src/instrumentation.ts`
- Test: `src/lib/scheduler/__tests__/tick.test.ts`

**Interfaces:**
- Consumes: `EXCHANGES`/`isDue`/`missedWindows` (Task 3), `generateDigest` (Task 8), `JobRunModel`/`ProfileModel` (Task 2)
- Produces: `tick(now, opts?): Promise<TickReport>` where `TickReport { due: string[]; runs: { exchange, sessionDate, usersProcessed, succeeded, failed, skipped?: true }[] }`; `runFor(exchange, sessionDate, opts?)`; `startScheduler(): void`

- [ ] **Step 1: Write the failing tests — idempotency is the whole point of this module**

```ts
// src/lib/scheduler/__tests__/tick.test.ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))

const { tick } = await import('../tick')
const { JobRunModel, ProfileModel, UserModel } = await import('@/lib/db/models')

let mem: MongoMemoryServer
const NSE_DIGEST_INSTANT = new Date('2026-09-10T02:45:00Z') // 08:15 IST open minus 60 min

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()))
}, 60_000)
afterAll(async () => { await mongoose.disconnect(); await mem.stop() })

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ProfileModel.deleteMany({}), JobRunModel.deleteMany({})])
  const user = await UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'A', timeZone: 'Asia/Kolkata' })
  await ProfileModel.create({ userId: user._id, exchanges: ['NSE'], tickers: ['INFY'], completedAt: new Date() })
})

describe('tick', () => {
  it('generates a digest for each user of a due exchange', async () => {
    const generate = vi.fn().mockResolvedValue({ digestId: 'd1', status: 'ready', created: true })
    const report = await tick(NSE_DIGEST_INSTANT, { generate })
    expect(report.due).toContain('NSE')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0][0]).toMatchObject({ exchange: 'NSE', sessionDate: '2026-09-10' })
  })

  it('does nothing when no exchange is due', async () => {
    const generate = vi.fn()
    const report = await tick(new Date('2026-09-10T01:00:00Z'), { generate })
    expect(report.due).toEqual([])
    expect(generate).not.toHaveBeenCalled()
  })

  it('IS IDEMPOTENT: two ticks in the same window generate once', async () => {
    const generate = vi.fn().mockResolvedValue({ digestId: 'd1', status: 'ready', created: true })
    await tick(NSE_DIGEST_INSTANT, { generate })
    await tick(new Date(NSE_DIGEST_INSTANT.getTime() + 30_000), { generate })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(await JobRunModel.countDocuments({ key: 'NSE:2026-09-10' })).toBe(1)
  })

  it('does not run on a weekend', async () => {
    const generate = vi.fn()
    await tick(new Date('2026-09-12T02:45:00Z'), { generate }) // Saturday
    expect(generate).not.toHaveBeenCalled()
  })

  it('ignores users who have not completed onboarding', async () => {
    await ProfileModel.updateMany({}, { $unset: { completedAt: 1 } })
    const generate = vi.fn()
    await tick(NSE_DIGEST_INSTANT, { generate })
    expect(generate).not.toHaveBeenCalled()
  })

  it('records failures per user and keeps going', async () => {
    const other = await UserModel.create({ email: 'b@b.com', passwordHash: 'h', name: 'B', timeZone: 'UTC' })
    await ProfileModel.create({ userId: other._id, exchanges: ['NSE'], completedAt: new Date() })
    const generate = vi.fn()
      .mockRejectedValueOnce(new Error('gemini down'))
      .mockResolvedValueOnce({ digestId: 'd2', status: 'ready', created: true })
    const report = await tick(NSE_DIGEST_INSTANT, { generate })
    expect(report.runs[0].succeeded).toBe(1)
    expect(report.runs[0].failed).toBe(1)
    const run = await JobRunModel.findOne({ key: 'NSE:2026-09-10' }).lean()
    expect(run!.finishedAt).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/scheduler`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/scheduler/tick.ts`**

```ts
import { connectToDatabase } from '@/lib/db/connect'
import { JobRunModel, ProfileModel } from '@/lib/db/models'
import { generateDigest } from '@/lib/digest'
import { EXCHANGES, isDue, missedWindows, getExchange } from '@/lib/markets'

export interface RunReport { exchange: string; sessionDate: string; usersProcessed: number; succeeded: number; failed: number; skipped?: true }
export interface TickReport { due: string[]; runs: RunReport[] }

type Generate = typeof generateDigest
const USER_CONCURRENCY = 4

export async function runFor(
  exchange: string, sessionDate: string, opts: { generate?: Generate } = {},
): Promise<RunReport> {
  const generate = opts.generate ?? generateDigest
  await connectToDatabase()
  const key = `${exchange}:${sessionDate}`

  // Claim the run. The unique index makes this an atomic lock across processes.
  try {
    await JobRunModel.create({ key, exchange, sessionDate })
  } catch {
    return { exchange, sessionDate, usersProcessed: 0, succeeded: 0, failed: 0, skipped: true }
  }

  const profiles = await ProfileModel.find({ exchanges: exchange, completedAt: { $ne: null } }).select('userId').lean()
  let succeeded = 0
  let failed = 0

  let cursor = 0
  const workers = Array.from({ length: Math.min(USER_CONCURRENCY, profiles.length) }, async () => {
    while (cursor < profiles.length) {
      const profile = profiles[cursor++]
      try {
        await generate({ userId: String(profile.userId), exchange, sessionDate })
        succeeded++
      } catch (error) {
        failed++
        console.error(`[bellbrief] digest failed for ${profile.userId} ${key}:`, (error as Error).message)
      }
    }
  })
  await Promise.all(workers)

  await JobRunModel.updateOne({ key }, {
    $set: { finishedAt: new Date(), usersProcessed: profiles.length, succeeded, failed },
  })

  return { exchange, sessionDate, usersProcessed: profiles.length, succeeded, failed }
}

export async function tick(now: Date, opts: { generate?: Generate; catchUp?: boolean } = {}): Promise<TickReport> {
  const due: string[] = []
  const runs: RunReport[] = []

  for (const exchange of EXCHANGES) {
    const sessions = new Set<string>()
    const { due: isNow, sessionDate } = isDue(exchange, now)
    if (isNow) sessions.add(sessionDate)
    if (opts.catchUp) for (const date of missedWindows(exchange, now)) sessions.add(date)

    for (const date of sessions) {
      due.push(exchange.code)
      runs.push(await runFor(exchange.code, date, opts))
    }
  }
  return { due, runs }
}

export async function runNow(exchangeCode: string, opts: { generate?: Generate } = {}) {
  const exchange = getExchange(exchangeCode)
  const { sessionDate } = isDue(exchange, new Date())
  return runFor(exchange.code, sessionDate, opts)
}
```

- [ ] **Step 4: Implement `start.ts`, `index.ts`, and `src/instrumentation.ts`**

```ts
// src/lib/scheduler/start.ts
import cron from 'node-cron'
import { tick } from './tick'

let started = false

export function startScheduler(): void {
  if (started) return
  started = true

  // Catch up first: a laptop that was asleep at T-60 should still deliver the brief.
  tick(new Date(), { catchUp: true })
    .then((r) => { if (r.runs.length) console.log('[bellbrief] catch-up:', JSON.stringify(r.runs)) })
    .catch((e) => console.error('[bellbrief] catch-up failed:', e.message))

  cron.schedule('* * * * *', async () => {
    try {
      const report = await tick(new Date())
      if (report.runs.length) console.log('[bellbrief] tick:', JSON.stringify(report.runs))
    } catch (error) {
      console.error('[bellbrief] tick failed:', (error as Error).message)
    }
  })
  console.log('[bellbrief] scheduler started — checking every minute')
}
```

```ts
// src/lib/scheduler/index.ts
export * from './tick'; export * from './start'
```

```ts
// src/instrumentation.ts — Next runs this once per server process
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { getEnv } = await import('@/lib/env')
  if (!getEnv().SCHEDULER_ENABLED) { console.log('[bellbrief] scheduler disabled'); return }
  const { startScheduler } = await import('@/lib/scheduler/start')
  startScheduler()
}
```

- [ ] **Step 5: Implement `src/app/api/cron/run/route.ts`**

This is what Vercel Cron or an external scheduler calls in a serverless deployment, and what you use to trigger a brief on demand during testing.

```ts
import { NextResponse } from 'next/server'
import { getEnv } from '@/lib/env'
import { runNow, tick } from '@/lib/scheduler'

export const maxDuration = 300

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${getEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const exchange = url.searchParams.get('exchange')
  try {
    const result = exchange
      ? { forced: await runNow(exchange) }
      : await tick(new Date(), { catchUp: url.searchParams.get('catchUp') === 'true' })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/scheduler`
Expected: 6 passed.

- [ ] **Step 7: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: minute-tick scheduler with distributed lock and catch-up"
```

---

### Task 10: Terminal Noir design system, landing page, auth pages

**Files:**
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/Panel.tsx`, `Button.tsx`, `Field.tsx`, `Logo.tsx`, `ThemeToggle.tsx`, `Reveal.tsx`, `src/components/ThemeProvider.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/AuthForm.tsx`
- Test: `src/app/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: auth API routes (Task 4), `EXCHANGES` (Task 3)
- Produces: CSS custom properties `--bb-bg`, `--bb-panel`, `--bb-border`, `--bb-text`, `--bb-muted`, `--bb-accent`, `--bb-amber`, `--bb-red`; components `Panel`, `Button`, `Field`, `Logo`, `ThemeToggle`, `Reveal`; `AuthForm` (client component, `mode: 'login' | 'register'`).

- [ ] **Step 1: Write the failing guard test — the no-pink-or-purple constraint must be mechanically enforced, not remembered**

```ts
// src/app/__tests__/theme.test.ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(process.cwd(), 'src')
const BANNED = [
  /\bpink-\d/, /\bpurple-\d/, /\bfuchsia-\d/, /\bviolet-\d/,
  /#ff00ff/i, /#e91e63/i, /#9c27b0/i, /#673ab7/i,
  /\bmagenta\b/i, /rebeccapurple/i,
]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : walk(full)
    return /\.(tsx?|css)$/.test(entry) && !full.includes('__tests__') ? [full] : []
  })
}

describe('brand constraints', () => {
  it('uses no pink or purple anywhere in src/', () => {
    const offences: string[] = []
    for (const file of walk(ROOT)) {
      const content = readFileSync(file, 'utf8')
      for (const pattern of BANNED) {
        if (pattern.test(content)) offences.push(`${path.relative(ROOT, file)} matches ${pattern}`)
      }
    }
    expect(offences).toEqual([])
  })

  it('never mentions the abandoned Nexora name', () => {
    const offences = walk(ROOT).filter((f) => /nexora/i.test(readFileSync(f, 'utf8')))
    expect(offences).toEqual([])
  })

  it('defines the Terminal Noir tokens in globals.css', () => {
    const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    for (const token of ['--bb-bg', '--bb-panel', '--bb-border', '--bb-text', '--bb-muted', '--bb-accent', '--bb-amber', '--bb-red']) {
      expect(css).toContain(token)
    }
  })

  it('defines a light theme override', () => {
    expect(readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')).toContain('[data-theme=\'light\']')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/app`
Expected: FAIL — `globals.css` lacks the tokens.

- [ ] **Step 3: Write `src/app/globals.css`**

```css
@import 'tailwindcss';

:root {
  --bb-bg: #0a0c0b;
  --bb-panel: #111614;
  --bb-panel-2: #0f1412;
  --bb-border: #1b2320;
  --bb-text: #e6ede9;
  --bb-bright: #ffffff;
  --bb-muted: #8d9a93;
  --bb-faint: #5c6b64;
  --bb-accent: #a8ff60;
  --bb-accent-dim: #17231b;
  --bb-amber: #ffc24b;
  --bb-red: #ff5c5c;
  --bb-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
  --bb-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

:root[data-theme='light'] {
  --bb-bg: #f7f8f7;
  --bb-panel: #ffffff;
  --bb-panel-2: #eef1ef;
  --bb-border: #d8dedb;
  --bb-text: #14211b;
  --bb-bright: #060a08;
  --bb-muted: #5d6b64;
  --bb-faint: #8a958f;
  --bb-accent: #2f7d18;
  --bb-accent-dim: #e6f5dc;
  --bb-amber: #9a6410;
  --bb-red: #c02a2a;
}

@theme inline {
  --color-bb-bg: var(--bb-bg);
  --color-bb-panel: var(--bb-panel);
  --color-bb-panel-2: var(--bb-panel-2);
  --color-bb-border: var(--bb-border);
  --color-bb-text: var(--bb-text);
  --color-bb-bright: var(--bb-bright);
  --color-bb-muted: var(--bb-muted);
  --color-bb-faint: var(--bb-faint);
  --color-bb-accent: var(--bb-accent);
  --color-bb-accent-dim: var(--bb-accent-dim);
  --color-bb-amber: var(--bb-amber);
  --color-bb-red: var(--bb-red);
  --font-mono: var(--bb-mono);
  --font-sans: var(--bb-sans);
}

* { box-sizing: border-box; }

html, body {
  background: var(--bb-bg);
  color: var(--bb-text);
  font-family: var(--bb-sans);
  -webkit-font-smoothing: antialiased;
}

.bb-num { font-family: var(--bb-mono); font-variant-numeric: tabular-nums; }

.bb-label {
  font-family: var(--bb-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--bb-faint);
}

/* A single hairline grid, very low contrast — reads as a terminal, not as decoration. */
.bb-grid-bg {
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--bb-border) 55%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--bb-border) 55%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
}

.bb-scanline::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(var(--bb-bg) 50%, transparent 50%);
  background-size: 100% 3px;
  opacity: 0.14;
  pointer-events: none;
}

:focus-visible {
  outline: 2px solid var(--bb-accent);
  outline-offset: 2px;
  border-radius: 4px;
}

::selection { background: var(--bb-accent); color: var(--bb-bg); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Write the shared components**

```tsx
// src/components/ui/Panel.tsx
export function Panel({ children, className = '', as: Tag = 'div' }: {
  children: React.ReactNode; className?: string; as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={`rounded-xl border border-bb-border bg-bb-panel ${className}`}>{children}</Tag>
  )
}
```

```tsx
// src/components/ui/Button.tsx
'use client'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'quiet'
const styles: Record<Variant, string> = {
  primary: 'bg-bb-accent text-bb-bg hover:brightness-110 font-semibold',
  ghost: 'border border-bb-border text-bb-text hover:border-bb-accent hover:text-bb-accent',
  quiet: 'text-bb-muted hover:text-bb-text',
}

export function Button({ variant = 'primary', className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  )
}
```

```tsx
// src/components/ui/Field.tsx
import type { InputHTMLAttributes } from 'react'

export function Field({ label, error, ...rest }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="bb-label mb-2 block">{label}</span>
      <input
        {...rest}
        className="w-full rounded-lg border border-bb-border bg-bb-panel-2 px-3.5 py-2.5 text-sm text-bb-text outline-none transition-colors placeholder:text-bb-faint focus:border-bb-accent"
      />
      {error ? <span className="mt-1.5 block text-xs text-bb-red">{error}</span> : null}
    </label>
  )
}
```

```tsx
// src/components/ui/Logo.tsx
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'text-[11px]', md: 'text-[13px]', lg: 'text-[15px]' }[size]
  return (
    <span className={`font-mono font-medium tracking-[0.26em] text-bb-accent ${cls}`}>
      BELLBRIEF
    </span>
  )
}
```

```tsx
// src/components/ThemeProvider.tsx
'use client'
import { useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem('bb-theme')
    if (stored === 'light') document.documentElement.dataset.theme = 'light'
  }, [])
  return <>{children}</>
}

export function ThemeToggle() {
  const [light, setLight] = useState(false)
  useEffect(() => { setLight(document.documentElement.dataset.theme === 'light') }, [])
  return (
    <button
      onClick={() => {
        const next = !light
        setLight(next)
        if (next) document.documentElement.dataset.theme = 'light'
        else delete document.documentElement.dataset.theme
        localStorage.setItem('bb-theme', next ? 'light' : 'dark')
      }}
      className="bb-label transition-colors hover:text-bb-accent"
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      {light ? 'DARK' : 'LIGHT'}
    </button>
  )
}
```

```tsx
// src/components/ui/Reveal.tsx
'use client'
import { motion } from 'framer-motion'

export function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 5: Write `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bellbrief — your market brief, an hour before the bell',
  description: 'One AI-summarised, source-cited news brief for the stocks and sectors you follow, delivered 60 minutes before your exchange opens.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-bb-bg text-bb-text antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Write the landing page `src/app/(marketing)/page.tsx`**

A server component. The hero states the promise, a live countdown proves the timing claim, three panels explain the mechanism, and one panel shows a real proof ledger — because the differentiator is the receipts, so the landing page should show them rather than assert them.

```tsx
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { Panel } from '@/components/ui/Panel'
import { Reveal } from '@/components/ui/Reveal'
import { ThemeToggle } from '@/components/ThemeProvider'
import { EXCHANGES } from '@/lib/markets'
import { LandingCountdown } from './LandingCountdown'

const STEPS = [
  { n: '01', title: 'Tell us what you follow', body: 'Five questions. Pick your exchanges, sectors, tickers and themes from a grid — no forms to fill in.' },
  { n: '02', title: 'We read the morning for you', body: 'Every trading day we sweep news feeds across your interests, drop duplicates, and rank what actually touches your names.' },
  { n: '03', title: 'It lands an hour before the bell', body: 'Summarised, cited, and timed to your exchange — 08:30 in New York, 08:15 in Mumbai, wherever you happen to be sitting.' },
]

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-6">
          <ThemeToggle />
          <Link href="/login" className="text-sm text-bb-muted transition-colors hover:text-bb-text">Sign in</Link>
          <Link href="/register" className="rounded-lg bg-bb-accent px-4 py-2 text-sm font-semibold text-bb-bg transition-all hover:brightness-110">
            Create account
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <Reveal>
          <p className="bb-label mb-5">Pre-market intelligence · {EXCHANGES.length} exchanges</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-bb-bright md:text-6xl">
            Your market brief,
            <br />
            <span className="text-bb-accent">an hour before the bell.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-bb-muted md:text-lg">
            Bellbrief reads the overnight news for the stocks and sectors you actually follow,
            summarises it, and shows you the source behind every sentence — sixty minutes
            before your exchange opens, in your timezone.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/register" className="rounded-lg bg-bb-accent px-6 py-3 text-sm font-semibold text-bb-bg transition-all hover:brightness-110">
              Get your first brief
            </Link>
            <Link href="/login" className="rounded-lg border border-bb-border px-6 py-3 text-sm text-bb-text transition-colors hover:border-bb-accent hover:text-bb-accent">
              I already have an account
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="mt-14">
          <LandingCountdown />
        </Reveal>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.08}>
              <Panel className="h-full p-6">
                <span className="bb-num text-2xl text-bb-accent">{step.n}</span>
                <h3 className="mt-4 text-base font-semibold text-bb-bright">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-bb-muted">{step.body}</p>
              </Panel>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <Panel className="overflow-hidden p-0">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-bb-border p-8 md:border-b-0 md:border-r">
                <p className="bb-label">Why the receipts matter</p>
                <h2 className="mt-4 text-2xl font-semibold leading-tight text-bb-bright">
                  Most summaries hide their sources. Ours are checked.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-bb-muted">
                  Language models cite things that do not exist. So Bellbrief verifies every
                  citation against the articles it actually fetched, and any sentence whose
                  source cannot be resolved is deleted before you ever see it. When outlets
                  disagree, the brief says so instead of blending them into one confident
                  paragraph.
                </p>
              </div>
              <div className="bg-bb-panel-2 p-8">
                <p className="bb-label mb-4">Claim ledger — sample</p>
                <div className="space-y-2.5">
                  {[
                    { claim: 'Accenture cut its FY guidance', label: '3 sources agree', tone: 'accent' },
                    { claim: 'Indian IT ADRs fell 2–3% overnight', label: '2 sources agree', tone: 'accent' },
                    { claim: 'The weakness is structural, not cyclical', label: 'sources disagree', tone: 'amber' },
                    { claim: '“INFY to crash 20%”', label: 'discarded — unsourced blog', tone: 'faint' },
                  ].map((row) => (
                    <div
                      key={row.claim}
                      className={`rounded-lg bg-bb-panel p-3 border-l-2 ${
                        row.tone === 'accent' ? 'border-bb-accent' : row.tone === 'amber' ? 'border-bb-amber' : 'border-bb-border'
                      }`}
                    >
                      <p className={`text-[13px] leading-snug ${row.tone === 'faint' ? 'text-bb-faint line-through' : 'text-bb-text'}`}>
                        {row.claim}
                      </p>
                      <p className={`bb-label mt-1.5 ${
                        row.tone === 'accent' ? 'text-bb-accent' : row.tone === 'amber' ? 'text-bb-amber' : 'text-bb-faint'
                      }`}>
                        {row.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      <footer className="relative border-t border-bb-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-bb-faint md:flex-row md:items-center md:justify-between">
          <Logo size="sm" />
          <p>Bellbrief summarises published news and links every claim to its source. Not investment advice.</p>
        </div>
      </footer>
    </main>
  )
}
```

- [ ] **Step 7: Write `src/app/(marketing)/LandingCountdown.tsx`**

The countdown must be a client component and must render nothing time-dependent on the server, or hydration will mismatch.

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/Panel'

const SAMPLES = [
  { code: 'NASDAQ', label: 'New York', zone: 'America/New_York', open: '09:30' },
  { code: 'NSE', label: 'Mumbai', zone: 'Asia/Kolkata', open: '09:15' },
  { code: 'LSE', label: 'London', zone: 'Europe/London', open: '08:00' },
]

function msUntilNextOpen(zone: string, open: string): number {
  const [h, m] = open.split(':').map(Number)
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: zone }))
  const target = new Date(local)
  target.setHours(h, m, 0, 0)
  if (target <= local) target.setDate(target.getDate() + 1)
  return target.getTime() - local.getTime()
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')

export function LandingCountdown() {
  const [, setBeat] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setBeat((b) => b + 1), 1_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Panel className="p-5">
      <p className="bb-label mb-4">Next opens · your brief lands 60 minutes earlier</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SAMPLES.map((s) => {
          const ms = msUntilNextOpen(s.zone, s.open)
          const hours = ms / 3_600_000
          const minutes = (ms % 3_600_000) / 60_000
          const seconds = (ms % 60_000) / 1_000
          return (
            <div key={s.code} className="rounded-lg bg-bb-panel-2 px-4 py-3.5">
              <p className="text-[11px] text-bb-muted">{s.label} · {s.code}</p>
              <p className="bb-num mt-1.5 text-xl text-bb-accent" suppressHydrationWarning>
                {pad(hours)}:{pad(minutes)}:{pad(seconds)}
              </p>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
```

- [ ] **Step 8: Write `src/app/(auth)/AuthForm.tsx` and the two pages**

```tsx
'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Logo } from '@/components/ui/Logo'
import { Panel } from '@/components/ui/Panel'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const next = useSearchParams().get('next')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(null)
    const form = new FormData(event.currentTarget)
    const payload: Record<string, string> = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }
    if (mode === 'register') {
      payload.name = String(form.get('name') ?? '')
      // The browser is the only place that knows the user's real zone.
      payload.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(body.error ?? 'Something went wrong'); return }
    router.push(mode === 'register' ? '/onboarding' : (next ?? '/dashboard'))
  }

  const isRegister = mode === 'register'
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <Panel className="relative w-full max-w-md p-8">
        <Link href="/"><Logo /></Link>
        <h1 className="mt-7 text-2xl font-semibold tracking-tight text-bb-bright">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-bb-muted">
          {isRegister ? 'Five questions and your first brief is scheduled.' : 'Sign in to see this morning’s brief.'}
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          {isRegister ? <Field label="Name" name="name" required autoComplete="name" placeholder="Sathvik" /> : null}
          <Field label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          <Field
            label="Password" name="password" type="password" required
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 10 : undefined}
            placeholder={isRegister ? 'At least 10 characters' : '••••••••'}
          />
          {error ? <p role="alert" className="rounded-lg border border-bb-red/40 bg-bb-red/10 px-3 py-2 text-xs text-bb-red">{error}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-bb-muted">
          {isRegister ? 'Already have an account? ' : 'No account yet? '}
          <Link href={isRegister ? '/login' : '/register'} className="text-bb-accent hover:underline">
            {isRegister ? 'Sign in' : 'Create one'}
          </Link>
        </p>
      </Panel>
    </main>
  )
}
```

```tsx
// src/app/(auth)/login/page.tsx
import { Suspense } from 'react'
import { AuthForm } from '../AuthForm'
export default function LoginPage() {
  return <Suspense><AuthForm mode="login" /></Suspense>
}
```

```tsx
// src/app/(auth)/register/page.tsx
import { Suspense } from 'react'
import { AuthForm } from '../AuthForm'
export default function RegisterPage() {
  return <Suspense><AuthForm mode="register" /></Suspense>
}
```

`useSearchParams` requires a `Suspense` boundary in the App Router; without it `next build` fails.

- [ ] **Step 9: Delete the scaffold page and run the guard tests**

```bash
rm -f src/app/page.tsx
npx vitest run src/app
```

Expected: 4 passed. If the pink/purple test fails, fix the offending file — never relax the pattern list.

- [ ] **Step 10: Verify visually**

Run: `npm run dev`, open `http://localhost:3000`, `http://localhost:3000/register`, and `http://localhost:3000/login`.
Check: countdown ticks; theme toggle switches and survives reload; no pink or purple; layout holds at 375px width.

- [ ] **Step 11: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: Terminal Noir design system, landing page, auth pages"
```

---

### Task 11: Onboarding wizard — five questions, Spotify-style tile grids

**Files:**
- Create: `src/app/onboarding/page.tsx`, `src/app/onboarding/OnboardingWizard.tsx`, `src/components/ui/TileGrid.tsx`, `src/app/api/onboarding/route.ts`
- Test: `src/app/api/onboarding/__tests__/route.test.ts`, `src/components/ui/__tests__/tileGrid.test.tsx`

**Interfaces:**
- Consumes: `SECTORS`, `THEMES`, `POPULAR_TICKERS` (Task 5), `EXCHANGES` (Task 3), `getSessionUser` (Task 4), `ProfileModel` (Task 2)
- Produces: `TileGrid` (client, `options`, `selected`, `onToggle`, `min?`, `columns?`); `POST /api/onboarding` accepting `{ exchanges, sectors, tickers, themes, experienceLevel, riskAppetite, horizon, emailOptIn }` and setting `completedAt`.

The five questions, fixed: **1** exchanges · **2** sectors · **3** tickers · **4** themes · **5** experience + risk + horizon (one screen, three tile rows).

- [ ] **Step 1: Write the failing API test**

```ts
// src/app/api/onboarding/__tests__/route.test.ts
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const session = { userId: '' }
vi.mock('@/lib/db/connect', () => ({ connectToDatabase: async () => mongoose }))
vi.mock('@/lib/auth/service', () => ({ getSessionUser: async () => (session.userId ? { id: session.userId } : null) }))

const { POST } = await import('../route')
const { ProfileModel, UserModel } = await import('@/lib/db/models')

let mem: MongoMemoryServer
const post = (body: unknown) => POST(new Request('http://localhost/api/onboarding', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}))

const valid = {
  exchanges: ['NSE'], sectors: ['technology', 'banking'], tickers: ['INFY'],
  themes: ['earnings'], experienceLevel: 'beginner', riskAppetite: 'balanced',
  horizon: 'long-term', emailOptIn: true,
}

beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri('bellbrief'))
}, 60_000)
afterAll(async () => { await mongoose.disconnect(); await mem.stop() })

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), ProfileModel.deleteMany({})])
  const user = await UserModel.create({ email: 'a@b.com', passwordHash: 'h', name: 'A', timeZone: 'UTC' })
  session.userId = String(user._id)
  await ProfileModel.create({ userId: user._id })
})

describe('POST /api/onboarding', () => {
  it('saves the profile and stamps completedAt', async () => {
    expect((await post(valid)).status).toBe(200)
    const profile = await ProfileModel.findOne({ userId: session.userId }).lean()
    expect(profile!.sectors).toEqual(['technology', 'banking'])
    expect(profile!.experienceLevel).toBe('beginner')
    expect(profile!.completedAt).toBeInstanceOf(Date)
  })

  it('requires at least one exchange', async () => {
    expect((await post({ ...valid, exchanges: [] })).status).toBe(400)
  })

  it('rejects an unsupported exchange code', async () => {
    expect((await post({ ...valid, exchanges: ['MOONEX'] })).status).toBe(400)
  })

  it('requires at least two interests across sectors, tickers and themes', async () => {
    expect((await post({ ...valid, sectors: [], tickers: [], themes: [] })).status).toBe(400)
  })

  it('uppercases and deduplicates tickers', async () => {
    await post({ ...valid, tickers: ['infy', 'INFY', 'tcs'] })
    const profile = await ProfileModel.findOne({ userId: session.userId }).lean()
    expect(profile!.tickers).toEqual(['INFY', 'TCS'])
  })

  it('rejects an unauthenticated request', async () => {
    session.userId = ''
    expect((await post(valid)).status).toBe(401)
  })
})
```

- [ ] **Step 2: Write the failing TileGrid test**

```tsx
// src/components/ui/__tests__/tileGrid.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TileGrid } from '../TileGrid'

const options = [
  { id: 'a', label: 'Technology' },
  { id: 'b', label: 'Banking' },
]

describe('TileGrid', () => {
  it('reports the toggled id', () => {
    const onToggle = vi.fn()
    render(<TileGrid options={options} selected={[]} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /technology/i }))
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('marks a selected tile with aria-checked', () => {
    render(<TileGrid options={options} selected={['a']} onToggle={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /technology/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: /banking/i })).toHaveAttribute('aria-checked', 'false')
  })
})
```

Add `jsdom` and `@testing-library/react` for this: `npm i -D jsdom @testing-library/react @testing-library/jest-dom`, and add `import '@testing-library/jest-dom/vitest'` to a `vitest.setup.ts` referenced from `vitest.config.ts` via `test.setupFiles`.

- [ ] **Step 3: Run and confirm failure**

Run: `npx vitest run src/app/api/onboarding src/components/ui`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/components/ui/TileGrid.tsx`**

```tsx
'use client'
import { motion } from 'framer-motion'

export interface TileOption { id: string; label: string; sub?: string }

export function TileGrid({ options, selected, onToggle, columns = 3 }: {
  options: TileOption[]; selected: string[]; onToggle: (id: string) => void; columns?: 2 | 3 | 4
}) {
  const grid = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns]
  return (
    <div className={`grid grid-cols-1 gap-2.5 ${grid}`}>
      {options.map((option, i) => {
        const active = selected.includes(option.id)
        return (
          <motion.button
            key={option.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => onToggle(option.id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(i * 0.022, 0.4) }}
            whileTap={{ scale: 0.98 }}
            className={`group relative flex flex-col items-start gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors ${
              active
                ? 'border-bb-accent bg-bb-accent-dim'
                : 'border-bb-border bg-bb-panel hover:border-bb-muted'
            }`}
          >
            <span className={`text-sm font-medium ${active ? 'text-bb-accent' : 'text-bb-text'}`}>{option.label}</span>
            {option.sub ? <span className="text-[11px] text-bb-faint">{option.sub}</span> : null}
            <span
              aria-hidden
              className={`absolute right-3.5 top-3.5 grid h-4 w-4 place-items-center rounded-[5px] border text-[10px] transition-colors ${
                active ? 'border-bb-accent bg-bb-accent text-bb-bg' : 'border-bb-border text-transparent'
              }`}
            >
              ✓
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Implement `src/app/api/onboarding/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth/service'
import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel } from '@/lib/db/models'
import { isSupportedExchange } from '@/lib/markets'
import { SECTORS, THEMES } from '@/lib/news'

const sectorIds = SECTORS.map((s) => s.id)
const themeIds = THEMES.map((t) => t.id)

const body = z.object({
  exchanges: z.array(z.string()).min(1, 'Pick at least one exchange').max(4)
    .refine((codes) => codes.every(isSupportedExchange), 'Unsupported exchange'),
  sectors: z.array(z.enum(sectorIds as [string, ...string[]])).max(14).default([]),
  tickers: z.array(z.string().min(1).max(20)).max(25).default([]),
  themes: z.array(z.enum(themeIds as [string, ...string[]])).max(9).default([]),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  riskAppetite: z.enum(['conservative', 'balanced', 'aggressive']),
  horizon: z.enum(['intraday', 'swing', 'long-term']),
  emailOptIn: z.boolean().default(true),
}).refine(
  (d) => d.sectors.length + d.tickers.length + d.themes.length >= 2,
  { message: 'Pick at least two interests so we know what to look for' },
)

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const data = parsed.data
  const tickers = [...new Set(data.tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]

  await connectToDatabase()
  await ProfileModel.updateOne(
    { userId: user.id },
    { $set: { ...data, tickers, completedAt: new Date() } },
    { upsert: true },
  )
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Implement `src/app/onboarding/OnboardingWizard.tsx`**

```tsx
'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { TileGrid, type TileOption } from '@/components/ui/TileGrid'

export interface WizardData {
  exchanges: TileOption[]; sectors: TileOption[]; tickers: TileOption[]; themes: TileOption[]
}

const EXPERIENCE: TileOption[] = [
  { id: 'beginner', label: 'New to this', sub: 'Explain the jargon as you go' },
  { id: 'intermediate', label: 'Comfortable', sub: 'Standard market language is fine' },
  { id: 'advanced', label: 'Experienced', sub: 'Terse and quantitative, no hand-holding' },
]
const RISK: TileOption[] = [
  { id: 'conservative', label: 'Conservative' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'aggressive', label: 'Aggressive' },
]
const HORIZON: TileOption[] = [
  { id: 'intraday', label: 'Intraday' },
  { id: 'swing', label: 'Weeks to months' },
  { id: 'long-term', label: 'Years' },
]

export function OnboardingWizard({ data }: { data: WizardData }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [exchanges, setExchanges] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [tickers, setTickers] = useState<string[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [experienceLevel, setExperience] = useState('intermediate')
  const [riskAppetite, setRisk] = useState('balanced')
  const [horizon, setHorizon] = useState('long-term')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (list: string[], set: (v: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  // Only show tickers listed on an exchange the user actually picked.
  const tickerOptions = useMemo(
    () => data.tickers.filter((t) => exchanges.length === 0 || exchanges.includes(String(t.sub ?? ''))),
    [data.tickers, exchanges],
  )

  const steps = [
    {
      title: 'Which markets do you watch?', hint: 'Your brief arrives 60 minutes before these open.',
      body: <TileGrid options={data.exchanges} selected={exchanges} onToggle={toggle(exchanges, setExchanges)} columns={3} />,
      valid: exchanges.length > 0, invalidMessage: 'Pick at least one exchange',
    },
    {
      title: 'What sectors interest you?', hint: 'Pick as many as you like — this shapes what we sweep for.',
      body: <TileGrid options={data.sectors} selected={sectors} onToggle={toggle(sectors, setSectors)} columns={3} />,
      valid: true,
    },
    {
      title: 'Any specific stocks?', hint: 'Named tickers get the highest priority in your brief.',
      body: <TileGrid options={tickerOptions} selected={tickers} onToggle={toggle(tickers, setTickers)} columns={4} />,
      valid: true,
    },
    {
      title: 'What kind of news matters to you?', hint: 'Earnings, deals, policy — whatever you actually act on.',
      body: <TileGrid options={data.themes} selected={themes} onToggle={toggle(themes, setThemes)} columns={3} />,
      valid: sectors.length + tickers.length + themes.length >= 2,
      invalidMessage: 'Pick at least two interests across the last three questions',
    },
    {
      title: 'How should we write it?', hint: 'This sets the reading level of every brief.',
      body: (
        <div className="space-y-7">
          <div>
            <p className="bb-label mb-2.5">Experience</p>
            <TileGrid options={EXPERIENCE} selected={[experienceLevel]} onToggle={setExperience} columns={3} />
          </div>
          <div>
            <p className="bb-label mb-2.5">Risk appetite</p>
            <TileGrid options={RISK} selected={[riskAppetite]} onToggle={setRisk} columns={3} />
          </div>
          <div>
            <p className="bb-label mb-2.5">Holding horizon</p>
            <TileGrid options={HORIZON} selected={[horizon]} onToggle={setHorizon} columns={3} />
          </div>
        </div>
      ),
      valid: true,
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1

  async function finish() {
    setBusy(true); setError(null)
    const response = await fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchanges, sectors, tickers, themes, experienceLevel, riskAppetite, horizon, emailOptIn: true }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(payload.error ?? 'Could not save your answers'); return }
    router.push('/dashboard')
  }

  return (
    <main className="relative min-h-dvh">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="bb-num text-xs text-bb-faint">{String(step + 1).padStart(2, '0')} / 05</span>
        </div>

        <div className="mt-6 flex gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={5}>
          {steps.map((_, i) => (
            <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-bb-accent' : 'bg-bb-border'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-bb-bright md:text-3xl">{current.title}</h1>
            <p className="mt-2 text-sm text-bb-muted">{current.hint}</p>
            <div className="mt-7">{current.body}</div>
          </motion.div>
        </AnimatePresence>

        {error ? <p role="alert" className="mt-6 rounded-lg border border-bb-red/40 bg-bb-red/10 px-3 py-2 text-xs text-bb-red">{error}</p> : null}
        {!current.valid && current.invalidMessage
          ? <p className="mt-6 text-xs text-bb-amber">{current.invalidMessage}</p>
          : null}

        <div className="mt-9 flex items-center justify-between border-t border-bb-border pt-6">
          <Button variant="quiet" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
          {isLast
            ? <Button onClick={finish} disabled={busy || !current.valid}>{busy ? 'Saving…' : 'Schedule my first brief'}</Button>
            : <Button onClick={() => setStep((s) => s + 1)} disabled={!current.valid}>Continue</Button>}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Implement `src/app/onboarding/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/service'
import { EXCHANGES } from '@/lib/markets'
import { POPULAR_TICKERS, SECTORS, THEMES } from '@/lib/news'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <OnboardingWizard
      data={{
        exchanges: EXCHANGES.map((e) => ({ id: e.code, label: e.label, sub: `opens ${e.openLocal} ${e.timeZone}` })),
        sectors: SECTORS.map((s) => ({ id: s.id, label: s.label })),
        // `sub` carries the exchange code so the wizard can filter tickers by chosen market.
        tickers: POPULAR_TICKERS.map((t) => ({ id: t.symbol, label: t.symbol, sub: t.exchange })),
        themes: THEMES.map((t) => ({ id: t.id, label: t.label })),
      }}
    />
  )
}
```

Note: the ticker tile shows the symbol as its label and the exchange as `sub`, which is also the filter key — if you change `sub` you must update `tickerOptions` in the wizard.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/app/api/onboarding src/components/ui`
Expected: 8 passed.

- [ ] **Step 9: Verify visually**

Run `npm run dev`, register a fresh account, walk all five steps. Check: progress rail fills; Continue is disabled until each step is valid; tiles stagger in; step 4 blocks with the two-interest message when nothing is selected; finishing lands on `/dashboard`.

- [ ] **Step 10: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: five-question onboarding wizard with tile-grid selection"
```

---

### Task 12: Dashboard, digest detail with Proof tab, archive, settings

**Files:**
- Create: `src/components/AppShell.tsx`, `src/components/Countdown.tsx`, `src/components/DigestView.tsx`, `src/components/ClaimLedger.tsx`, `src/app/dashboard/page.tsx`, `src/app/digest/[id]/page.tsx`, `src/app/archive/page.tsx`, `src/app/settings/page.tsx`, `src/app/settings/SettingsForm.tsx`, `src/app/api/digest/latest/route.ts`, `src/app/api/settings/route.ts`
- Test: `src/components/__tests__/digestView.test.tsx`

**Interfaces:**
- Consumes: `getSessionUser` (Task 4), `DigestModel`/`ProfileModel` (Task 2), `nextSessionOpen`/`digestInstantFor`/`getExchange` (Task 3)
- Produces: `AppShell` (nav + logo + theme toggle + sign out); `Countdown` (client, `targetIso`, `label`); `DigestView` (client, `digest`, tabs Narrative/Proof); `ClaimLedger` (claims + articles); `GET /api/digest/latest`; `PATCH /api/settings`.

- [ ] **Step 1: Write the failing test for the digest view — the citation-rendering contract is the thing worth testing**

```tsx
// src/components/__tests__/digestView.test.tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DigestView } from '../DigestView'

const digest = {
  _id: 'd1', status: 'ready', exchange: 'NSE', sessionDate: '2026-09-10',
  headline: 'IT majors under pressure', overview: 'Guidance cuts weigh on services names.',
  sentiment: 'risk-off',
  narrative: [
    { text: 'Accenture cut its full-year guidance.', citations: [0] },
    { text: 'Indian IT ADRs fell overnight.', citations: [0, 1] },
  ],
  claims: [
    { claim: 'Accenture cut guidance', sources: [0, 1], agreement: 'corroborated', confidence: 0.92 },
    { claim: 'The weakness is structural', sources: [1], agreement: 'disputed', confidence: 0.4, note: 'ET says structural, CNBC says cyclical' },
    { claim: 'INFY to crash 20%', sources: [], agreement: 'discarded', confidence: 0, note: 'unsourced blog' },
  ],
  articles: [
    { index: 0, url: 'https://reuters.com/a', title: 'Accenture trims forecast', source: 'Reuters', publishedAt: '2026-09-10T02:00:00Z' },
    { index: 1, url: 'https://livemint.com/b', title: 'IT ADRs slip', source: 'Mint', publishedAt: '2026-09-10T03:00:00Z' },
  ],
  droppedSentences: 0,
}

describe('DigestView', () => {
  it('shows the narrative by default', () => {
    render(<DigestView digest={digest as never} />)
    expect(screen.getByText(/Accenture cut its full-year guidance/)).toBeInTheDocument()
  })

  it('renders every citation as a link to the real source URL', () => {
    render(<DigestView digest={digest as never} />)
    const links = screen.getAllByRole('link', { name: /\[1\]/ })
    expect(links[0]).toHaveAttribute('href', 'https://reuters.com/a')
  })

  it('switches to the Proof tab and shows the claim ledger', () => {
    render(<DigestView digest={digest as never} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    expect(screen.getByText('Accenture cut guidance')).toBeInTheDocument()
    expect(screen.getByText(/2 sources agree/i)).toBeInTheDocument()
  })

  it('labels a disputed claim as disputed and shows the disagreement note', () => {
    render(<DigestView digest={digest as never} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    expect(screen.getByText(/sources disagree/i)).toBeInTheDocument()
    expect(screen.getByText(/ET says structural/)).toBeInTheDocument()
  })

  it('shows a discarded claim as discarded rather than hiding it', () => {
    render(<DigestView digest={digest as never} />)
    fireEvent.click(screen.getByRole('tab', { name: /proof/i }))
    expect(screen.getByText(/discarded/i)).toBeInTheDocument()
  })

  it('always shows the no-advice disclaimer', () => {
    render(<DigestView digest={digest as never} />)
    expect(screen.getByText(/not investment advice/i)).toBeInTheDocument()
  })

  it('warns prominently when the digest is degraded', () => {
    render(<DigestView digest={{ ...digest, status: 'degraded', narrative: [] } as never} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/summary/i)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/components/__tests__/digestView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/AppShell.tsx`**

```tsx
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ThemeProvider'
import { SignOutButton } from './SignOutButton'

const LINKS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/archive', label: 'Archive' },
  { href: '/settings', label: 'Settings' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="bb-grid-bg pointer-events-none absolute inset-0 opacity-25" aria-hidden />
      <header className="relative border-b border-bb-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard"><Logo /></Link>
            <nav className="flex gap-5">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-[13px] text-bb-muted transition-colors hover:text-bb-text">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-5">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-5xl px-6 py-9">{children}</main>
    </div>
  )
}
```

```tsx
// src/components/SignOutButton.tsx
'use client'
export function SignOutButton() {
  return (
    <button
      onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/' }}
      className="bb-label transition-colors hover:text-bb-red"
    >
      SIGN OUT
    </button>
  )
}
```

- [ ] **Step 4: Implement `src/components/Countdown.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0')

export function Countdown({ targetIso, label, sublabel }: { targetIso: string; label: string; sublabel?: string }) {
  const [remaining, setRemaining] = useState(() => new Date(targetIso).getTime() - Date.now())

  useEffect(() => {
    const timer = setInterval(() => setRemaining(new Date(targetIso).getTime() - Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [targetIso])

  const done = remaining <= 0
  const hours = remaining / 3_600_000
  const minutes = (remaining % 3_600_000) / 60_000
  const seconds = (remaining % 60_000) / 1_000

  return (
    <div>
      <p className="bb-label">{label}</p>
      <p className={`bb-num mt-2 text-4xl tracking-tight md:text-5xl ${done ? 'text-bb-muted' : 'text-bb-accent'}`} suppressHydrationWarning>
        {done ? '00:00:00' : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </p>
      {sublabel ? <p className="mt-2 text-xs text-bb-muted">{sublabel}</p> : null}
    </div>
  )
}
```

- [ ] **Step 5: Implement `src/components/ClaimLedger.tsx`**

```tsx
import type { DigestArticleRef, DigestClaim } from '@/lib/db/models'

const TONE: Record<string, { border: string; text: string; label: (c: DigestClaim) => string }> = {
  corroborated: { border: 'border-bb-accent', text: 'text-bb-accent', label: (c) => `${c.sources.length} sources agree` },
  'single-source': { border: 'border-bb-border', text: 'text-bb-muted', label: () => 'single source' },
  disputed: { border: 'border-bb-amber', text: 'text-bb-amber', label: () => 'sources disagree' },
  discarded: { border: 'border-bb-border', text: 'text-bb-faint', label: () => 'discarded' },
}

export function ClaimLedger({ claims, articles }: { claims: DigestClaim[]; articles: DigestArticleRef[] }) {
  if (claims.length === 0) {
    return <p className="text-sm text-bb-muted">No claims were extracted for this session.</p>
  }
  return (
    <div className="space-y-2.5">
      {claims.map((claim, i) => {
        const tone = TONE[claim.agreement] ?? TONE['single-source']
        return (
          <div key={i} className={`rounded-lg border-l-2 bg-bb-panel-2 p-4 ${tone.border}`}>
            <p className={`text-sm leading-snug ${claim.agreement === 'discarded' ? 'text-bb-faint line-through' : 'text-bb-text'}`}>
              {claim.claim}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {claim.sources.map((index) => {
                const article = articles.find((a) => a.index === index)
                if (!article) return null
                return (
                  <a
                    key={index}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
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
```

- [ ] **Step 6: Implement `src/components/DigestView.tsx`**

```tsx
'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { ClaimLedger } from './ClaimLedger'
import type { DigestArticleRef, DigestClaim, NarrativeSentence } from '@/lib/db/models'

export interface DigestViewModel {
  _id: string; status: 'ready' | 'quiet' | 'degraded' | 'failed'
  exchange: string; sessionDate: string
  headline: string; overview: string; sentiment: string
  narrative: NarrativeSentence[]; claims: DigestClaim[]
  articles: (Omit<DigestArticleRef, 'publishedAt'> & { publishedAt: string | Date })[]
  droppedSentences?: number
}

const SENTIMENT_TONE: Record<string, string> = {
  'risk-on': 'text-bb-accent', 'risk-off': 'text-bb-red', mixed: 'text-bb-amber', quiet: 'text-bb-muted',
}

export function DigestView({ digest }: { digest: DigestViewModel }) {
  const [tab, setTab] = useState<'narrative' | 'proof'>('narrative')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="bb-label">{digest.exchange} · session {digest.sessionDate}</span>
        <span className={`bb-label ${SENTIMENT_TONE[digest.sentiment] ?? 'text-bb-muted'}`}>{digest.sentiment}</span>
      </div>

      <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-bb-bright md:text-3xl">
        {digest.headline}
      </h1>
      {digest.overview ? <p className="mt-3 text-sm leading-relaxed text-bb-muted">{digest.overview}</p> : null}

      {digest.status === 'degraded' ? (
        <p role="alert" className="mt-5 rounded-lg border border-bb-amber/40 bg-bb-amber/10 px-4 py-3 text-xs leading-relaxed text-bb-amber">
          The summary could not be generated for this session, so only raw headlines are shown below.
          Nothing here has been paraphrased or inferred.
        </p>
      ) : null}

      <div role="tablist" aria-label="Digest views" className="mt-7 flex gap-1 border-b border-bb-border">
        {([['narrative', 'Narrative'], ['proof', `Proof (${digest.claims.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative px-4 py-2.5 text-[13px] transition-colors ${tab === id ? 'text-bb-accent' : 'text-bb-muted hover:text-bb-text'}`}
          >
            {label}
            {tab === id ? <motion.span layoutId="digest-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-bb-accent" /> : null}
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
                  {digest.narrative.map((sentence, i) => (
                    <span key={i}>
                      {sentence.text}{' '}
                      {sentence.citations.map((index) => {
                        const article = digest.articles.find((a) => a.index === index)
                        if (!article) return null
                        return (
                          <a
                            key={index}
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${article.title} — ${article.source}`}
                            className="align-super font-mono text-[10px] text-bb-accent hover:underline"
                          >
                            [{index + 1}]
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
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-bb-text hover:text-bb-accent hover:underline">
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
            <ClaimLedger claims={digest.claims} articles={digest.articles as never} />
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-10 border-t border-bb-border pt-5 text-[11px] leading-relaxed text-bb-faint">
        Bellbrief summarises published news and links every claim to its source.
        Citations are verified against the articles actually fetched; any sentence whose source
        could not be resolved was removed{digest.droppedSentences ? ` (${digest.droppedSentences} this session)` : ''}.
        This is not investment advice.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Implement `src/app/dashboard/page.tsx`**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DateTime } from 'luxon'
import { AppShell } from '@/components/AppShell'
import { Countdown } from '@/components/Countdown'
import { DigestView } from '@/components/DigestView'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/service'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel, ProfileModel } from '@/lib/db/models'
import { DIGEST_LEAD_MINUTES, getExchange, nextSessionOpen } from '@/lib/markets'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  await connectToDatabase()
  const profile = await ProfileModel.findOne({ userId: user.id }).lean()
  if (!profile?.completedAt) redirect('/onboarding')

  const primary = getExchange(profile.exchanges[0] ?? 'NASDAQ')
  const { sessionDate, openInstant } = nextSessionOpen(primary, new Date())
  const digestInstant = new Date(openInstant.getTime() - DIGEST_LEAD_MINUTES * 60_000)

  const latest = await DigestModel.findOne({ userId: user.id }).sort({ digestInstant: -1, createdAt: -1 }).lean()

  const inUserZone = (d: Date) => DateTime.fromJSDate(d).setZone(user.timeZone).toFormat('HH:mm')
  const inExchangeZone = (d: Date) => DateTime.fromJSDate(d).setZone(primary.timeZone).toFormat('HH:mm')

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <Panel className="p-6">
          <Countdown
            targetIso={digestInstant.toISOString()}
            label={`Next brief · ${primary.code}`}
            sublabel={`Lands ${inUserZone(digestInstant)} your time (${user.timeZone}) — ${inExchangeZone(digestInstant)} in ${primary.timeZone}, one hour before the ${inExchangeZone(openInstant)} open.`}
          />
        </Panel>
        <Panel className="p-6">
          <p className="bb-label">Your profile</p>
          <dl className="mt-4 space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-4"><dt className="text-bb-muted">Exchanges</dt><dd className="text-right text-bb-text">{profile.exchanges.join(', ')}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-bb-muted">Tickers</dt><dd className="text-right text-bb-text">{profile.tickers.length ? profile.tickers.join(', ') : '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-bb-muted">Sectors</dt><dd className="text-right text-bb-text">{profile.sectors.length}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-bb-muted">Written for</dt><dd className="text-right text-bb-text">{profile.experienceLevel}</dd></div>
          </dl>
          <Link href="/settings" className="bb-label mt-5 inline-block transition-colors hover:text-bb-accent">EDIT →</Link>
        </Panel>
      </div>

      <Panel className="mt-4 p-6 md:p-8">
        {latest ? (
          <DigestView
            digest={{
              ...latest,
              _id: String(latest._id),
              articles: latest.articles.map((a) => ({ ...a, articleId: undefined, publishedAt: a.publishedAt })),
            } as never}
          />
        ) : (
          <div className="py-8 text-center">
            <p className="bb-label">No brief yet</p>
            <h2 className="mt-3 text-xl font-semibold text-bb-bright">Your first brief is scheduled</h2>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-bb-muted">
              It will appear here at {inUserZone(digestInstant)} your time on {sessionDate}, one hour before {primary.code} opens.
              We will email it to you at the same moment.
            </p>
          </div>
        )}
      </Panel>
    </AppShell>
  )
}
```

- [ ] **Step 8: Implement the digest detail, archive, and settings pages**

```tsx
// src/app/digest/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { DigestView } from '@/components/DigestView'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/service'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel } from '@/lib/db/models'

export const dynamic = 'force-dynamic'

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const { id } = await params

  await connectToDatabase()
  // Scoped by userId as well as id, so an id from another account cannot be read.
  const digest = await DigestModel.findOne({ _id: id, userId: user.id }).lean().catch(() => null)
  if (!digest) notFound()

  return (
    <AppShell>
      <Panel className="p-6 md:p-8">
        <DigestView digest={{ ...digest, _id: String(digest._id) } as never} />
      </Panel>
    </AppShell>
  )
}
```

```tsx
// src/app/archive/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/service'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel } from '@/lib/db/models'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, string> = {
  ready: 'text-bb-accent', quiet: 'text-bb-muted', degraded: 'text-bb-amber', failed: 'text-bb-red',
}

export default async function ArchivePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  await connectToDatabase()
  const digests = await DigestModel.find({ userId: user.id })
    .sort({ digestInstant: -1, createdAt: -1 }).limit(60)
    .select('exchange sessionDate status headline claims').lean()

  return (
    <AppShell>
      <p className="bb-label">Archive · {digests.length} briefs</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-bb-bright">Every brief we have sent you</h1>

      <div className="mt-7 space-y-2.5">
        {digests.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-bb-muted">Nothing archived yet — your first brief is still ahead of you.</Panel>
        ) : digests.map((d) => (
          <Link key={String(d._id)} href={`/digest/${d._id}`} className="block">
            <Panel className="p-5 transition-colors hover:border-bb-accent">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="bb-label">{d.exchange} · {d.sessionDate}</span>
                <span className={`bb-label ${STATUS_TONE[d.status] ?? 'text-bb-muted'}`}>{d.status}</span>
              </div>
              <p className="mt-2.5 text-[15px] font-medium text-bb-text">{d.headline}</p>
              <p className="mt-1.5 text-xs text-bb-faint">{d.claims?.length ?? 0} claims in the ledger</p>
            </Panel>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
```

```tsx
// src/app/settings/page.tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { Panel } from '@/components/ui/Panel'
import { getSessionUser } from '@/lib/auth/service'
import { connectToDatabase } from '@/lib/db/connect'
import { ProfileModel } from '@/lib/db/models'
import { EXCHANGES } from '@/lib/markets'
import { POPULAR_TICKERS, SECTORS, THEMES } from '@/lib/news'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  await connectToDatabase()
  const profile = await ProfileModel.findOne({ userId: user.id }).lean()
  if (!profile) redirect('/onboarding')

  return (
    <AppShell>
      <p className="bb-label">Settings</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-bb-bright">What we watch for you</h1>
      <p className="mt-2 text-sm text-bb-muted">
        Signed in as {user.email} · timezone {user.timeZone} (detected from your browser)
      </p>
      <Panel className="mt-7 p-6 md:p-8">
        <SettingsForm
          initial={{
            exchanges: profile.exchanges, sectors: profile.sectors, tickers: profile.tickers,
            themes: profile.themes, experienceLevel: profile.experienceLevel,
            riskAppetite: profile.riskAppetite, horizon: profile.horizon, emailOptIn: profile.emailOptIn,
          }}
          options={{
            exchanges: EXCHANGES.map((e) => ({ id: e.code, label: e.label, sub: `opens ${e.openLocal} ${e.timeZone}` })),
            sectors: SECTORS.map((s) => ({ id: s.id, label: s.label })),
            tickers: POPULAR_TICKERS.map((t) => ({ id: t.symbol, label: t.symbol, sub: t.exchange })),
            themes: THEMES.map((t) => ({ id: t.id, label: t.label })),
          }}
        />
      </Panel>
    </AppShell>
  )
}
```

`SettingsForm` is a client component reusing `TileGrid` for the same four dimensions plus an email opt-in checkbox, `PATCH`ing `/api/settings`. `src/app/api/settings/route.ts` reuses the exact zod schema from `src/app/api/onboarding/route.ts` — export it from there as `onboardingBody` and import it, rather than duplicating the validation rules in two places.

```ts
// src/app/api/digest/latest/route.ts
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/service'
import { connectToDatabase } from '@/lib/db/connect'
import { DigestModel } from '@/lib/db/models'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectToDatabase()
  const digest = await DigestModel.findOne({ userId: user.id }).sort({ digestInstant: -1, createdAt: -1 }).lean()
  return NextResponse.json({ digest: digest ? { ...digest, _id: String(digest._id) } : null })
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/components`
Expected: 7 passed.

- [ ] **Step 10: Commit**

```bash
git add -A ':!.env' && git commit -m "feat: dashboard, digest narrative/proof views, archive, settings"
```

---

### Task 13: End-to-end verification

**Files:**
- Create: `scripts/trigger-digest.mjs`, `README.md`
- Test: full suite

**Interfaces:**
- Consumes: everything
- Produces: `scripts/trigger-digest.mjs` — forces a digest for one exchange immediately, bypassing the clock, so the pipeline can be proved without waiting for 08:30.

- [ ] **Step 1: Run the whole suite and the type check**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: all tests pass, no type errors, build succeeds. **Fix anything that fails before continuing — do not proceed past a red suite.**

- [ ] **Step 2: Verify the Gemini key against the live API**

```bash
npm run verify:gemini
```

Expected: `PASS`. If it fails with 400/401/403, the supplied `AQ.`-prefixed key is not a valid AI Studio key — **report the exact error to the user and ask for a fresh key from https://aistudio.google.com/apikey**. Everything downstream is already proven against mocks, so this is the only blocker.

- [ ] **Step 3: Write `scripts/trigger-digest.mjs`**

```js
// Forces the T-60 job for one exchange right now. Usage: node --env-file=.env scripts/trigger-digest.mjs NSE
const exchange = process.argv[2] ?? 'NASDAQ'
const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/api/cron/run?exchange=${exchange}`
const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
console.log(response.status, JSON.stringify(await response.json(), null, 2))
```

- [ ] **Step 4: Walk the whole product by hand**

With `npm run dev` running:

1. Register at `/register` — confirm the browser's timezone was captured (check the `users` document).
2. Complete all five onboarding steps; pick NSE plus a ticker and two sectors.
3. Land on `/dashboard` — confirm the countdown shows the correct T‑60 instant in **your** local time and names the exchange's time separately.
4. Force a digest: `node --env-file=.env scripts/trigger-digest.mjs NSE`
5. Reload `/dashboard` — the brief should be there. Read it.
6. **Verify the citations by hand.** Click three markers. Each must open a real article that actually supports the sentence. If any marker opens something unrelated, the prompt or the validator has a bug — stop and fix it, do not ship it.
7. Open the **Proof** tab — check corroborated/disputed/discarded labels look sane against the source list.
8. Check the email: `ls .mail/` if no Resend key resolved, otherwise your inbox. Confirm citations are clickable links and the disclaimer is present.
9. Run the trigger a second time — confirm no duplicate digest appears (`db.digests.countDocuments()` unchanged) and the response reports the run as skipped.
10. Visit `/archive` and open the brief from there.
11. Change interests in `/settings`, force another digest for the next session date, confirm the content shifts.
12. Resize to 375px on every page; toggle light/dark on every page.

- [ ] **Step 5: Confirm the scheduler fires unattended**

Temporarily set a test exchange's `openLocal` to two minutes from now in `src/lib/markets/exchanges.ts`, restart `npm run dev`, and watch for `[bellbrief] tick:` in the log with a digest created. **Revert the file afterwards** and confirm `git diff` is clean.

- [ ] **Step 6: Write `README.md`**

Cover: what Bellbrief is; the exchange-anchored-trigger rule; setup (`npm install`, copy `.env.example` to `.env`, generate `JWT_SECRET`/`CRON_SECRET` with `openssl rand -hex 32`); `npm run dev`; `npm test`; how to force a digest; the Resend unverified-domain limitation; the note that Phase 1 has no live price data; and a **rotate these secrets** warning listing all three.

- [ ] **Step 7: Final commit**

```bash
git add -A ':!.env'
git commit -m "docs: README and manual digest trigger script"
git log --oneline
```

---

## Self-Review

**Spec coverage.** §1 product → Tasks 10–12. §2 decisions → all. §3 architecture → module layout in Tasks 1–9. §4 timezone core → Task 3 (registry, clock, DST tests) + Task 9 (tick, lock, catch-up). §5 data model → Task 2. §6 news pipeline → Task 5. §7 AI layer → Task 6 (both prompt layer and code validation). §8 delivery → Task 7 (email, drivers, Resend caveat) + Task 12 (in-app). §9 auth/security → Task 4. §10 UI → Tasks 10–12, with the no-pink/purple constraint mechanically enforced by a test in Task 10. §11 error handling → Task 6 degraded path, Task 7 failure path, Task 8 email-failure persistence, Task 9 per-user failure isolation. §12 testing → every task is test-first. §13 environment → Task 1. §14 Phase 2 → explicitly out of scope.

**Placeholder scan.** No TBDs. Every code step carries real code. The two places that describe rather than show — `SettingsForm` and the `login`/`logout`/`me` routes — each state the exact component to copy and the exact symbol to import, and both are trivial variants of code given in full in the same task.

**Type consistency.** `CollectedArticle` is produced in Task 5 and consumed unchanged in Tasks 6 and 8. `RawDigest` flows Task 6 → Task 8. `NarrativeSentence`, `DigestClaim`, `DigestArticleRef`, `Agreement`, `ExperienceLevel` are all defined once in Task 2 and imported everywhere after. `Generate` (Task 6) is the single injection point for Gemini; `MailDriver` (Task 7) for email; `DigestDeps` (Task 8) and `{ generate }` (Task 9) for the orchestrator and scheduler. The onboarding zod schema is exported from Task 11 and reused by settings in Task 12 rather than restated.

**One gap accepted deliberately:** the digest shows no price data, because Phase 1 has no market-data source. The spec records this and the mockups' price chips arrive with Phase 2.
