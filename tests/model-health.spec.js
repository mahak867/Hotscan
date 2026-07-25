// This is the test that would have caught today's entire scanning outage
// automatically. Groq deprecated the vision model this app depended on, and
// it went unnoticed until a user tried scanning and got a raw API error.
// This pings Groq directly with each model Hotscan actually uses and fails
// loudly the moment one stops working — before a real user ever hits it.
//
// Requires a GROQ_API_KEY_1 (or GROQ_API_KEY) repository secret in GitHub
// Actions — see the workflow file for where it's wired in. Without that
// secret set, this test skips with a clear message rather than false-failing
// CI on unrelated changes.
import { test, expect } from '@playwright/test'

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY
const MODELS_TO_CHECK = [
  { name: 'openai/gpt-oss-20b', vision: false },
  { name: 'openai/gpt-oss-120b', vision: false },
  { name: 'qwen/qwen3.6-27b', vision: true },
]

// A tiny but real 64x64 solid-color PNG — small enough to keep the request
// cheap, but not the degenerate 1x1 pixel case that some vision models'
// preprocessing may reject or choke on for reasons unrelated to whether the
// model itself is actually available.
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYklEQVR4nO3PMQ0AIADAMEAS/gUgCxEcDcmqYJtn7/GzpQNeNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaBdzXoBrL6L/ScAAAAASUVORK5CYII='

test.describe('Groq model health', () => {
  test.skip(!GROQ_KEY, 'GROQ_API_KEY_1 not set — add it as a GitHub Actions secret to enable this check')

  for (const model of MODELS_TO_CHECK) {
    test(`${model.name} is still available`, async ({ request }) => {
      const body = model.vision
        ? {
            model: model.name,
            messages: [{ role: 'user', content: [
              { type: 'text', text: 'What color is this?' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + TINY_PNG_B64 } },
            ] }],
            max_tokens: 5,
          }
        : { model: model.name, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }

      const res = await request.post('https://api.groq.com/openai/v1/chat/completions', {
        headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
        data: body,
      })

      if (!res.ok()) {
        const errText = await res.text()
        // Specifically call out deprecation so the failure message is
        // immediately actionable, not just "got a 400"
        const isDeprecated = /decommission|deprecat|no longer supported/i.test(errText)
        expect(res.ok(), isDeprecated
          ? `MODEL DEPRECATED: ${model.name} — ${errText.slice(0,200)}\nUpdate api/_models.js, src/config.js, and extension/popup.js's fallback.`
          : `Unexpected error from ${model.name}: ${res.status()} ${errText.slice(0,200)}`
        ).toBeTruthy()
      }
    })
  }
})
