import { GoogleGenAI } from '@google/genai'

const key = process.env.GEMINI_API_KEY
if (!key) {
  console.error('GEMINI_API_KEY is not set')
  process.exit(1)
}

console.log(`Key shape: ${key.slice(0, 6)}… (${key.length} chars)`)
if (!key.startsWith('AIza')) {
  console.log('NOTE: AI Studio keys normally start with "AIza". This one does not.')
}

try {
  const ai = new GoogleGenAI({ apiKey: key })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Reply with exactly: OK',
    // maxOutputTokens must cover thinking AND output; a small budget returns
    // an empty response with finishReason STOP and no error.
    config: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
  })
  const text = response.text
  if (!text) {
    console.error('FAIL — call succeeded but returned no text.')
    console.error('finishReason:', response.candidates?.[0]?.finishReason)
    process.exit(3)
  }
  console.log('PASS — model replied:', JSON.stringify(text))
} catch (error) {
  console.error('FAIL —', error?.message ?? error)
  console.error('')
  console.error('If this is a 400/401/403 the key is expired or is not an AI Studio key.')
  console.error('Get a fresh one at https://aistudio.google.com/apikey (it will start with "AIza").')
  process.exit(2)
}
