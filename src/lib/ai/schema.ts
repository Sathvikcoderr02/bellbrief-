export const GEMINI_MODEL = 'gemini-2.5-flash'

/**
 * `maxOutputTokens` must cover thinking tokens AND visible output. A budget
 * that is too small returns an empty response with finishReason STOP and no
 * error at all, which is silent and very hard to debug — verified against the
 * live API during implementation.
 */
export const MAX_OUTPUT_TOKENS = 8192

/** Small budget: cross-source agreement is a reasoning task, but a shallow one. */
export const THINKING_BUDGET = 1024

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
