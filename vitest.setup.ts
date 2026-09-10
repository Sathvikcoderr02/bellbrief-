import '@testing-library/jest-dom/vitest'
import { existsSync } from 'node:fs'

/**
 * Load .env for opt-in live tests. `getEnv()` validates the whole environment
 * at once (deliberately — misconfiguration should fail at boot, not at 08:30
 * when the scheduler fires), so any module touching it needs the full set.
 * Unit tests mock `@/lib/env` and are unaffected either way.
 */
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env')
  } catch {
    // A missing or unreadable .env is fine; unit tests do not need it.
  }
}
