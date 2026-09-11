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

/**
 * jsdom implements no IntersectionObserver, and framer-motion's `whileInView`
 * needs one — without this every scroll-revealed component throws on mount.
 * The stub reports the target as immediately visible so entrance animations
 * settle in their final state, which is what an assertion wants to see.
 */
class ImmediateIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [0]

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver =
    ImmediateIntersectionObserver as unknown as typeof IntersectionObserver
}
