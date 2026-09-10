import { GoogleGenAI } from '@google/genai'
import { getEnv } from '@/lib/env'
import { DIGEST_RESPONSE_SCHEMA, GEMINI_MODEL, MAX_OUTPUT_TOKENS, THINKING_BUDGET } from './schema'

export interface GenerateArgs {
  prompt: string
  timeoutMs?: number
}

export interface GenerateResult {
  text: string
  usage?: number
}

/** The single seam where the model is called, so everything above it is testable. */
export type Generate = (args: GenerateArgs) => Promise<GenerateResult>

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY })
  return client
}

export const generateWithGemini: Generate = async ({ prompt, timeoutMs = 90_000 }) => {
  const call = getClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: DIGEST_RESPONSE_SCHEMA as never,
      // Low temperature: this is reporting, not composition.
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
    },
  })

  // Raced rather than passed as an abort signal, so the timeout works
  // regardless of which SDK version is installed.
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gemini timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    const response = await Promise.race([call, timeout])
    const text = response.text
    if (!text) {
      throw new Error(
        `Gemini returned no text (finishReason: ${response.candidates?.[0]?.finishReason ?? 'unknown'})`,
      )
    }
    return { text, usage: response.usageMetadata?.totalTokenCount }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
