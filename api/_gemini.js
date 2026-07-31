// Gemini provider for the vision proxy.
//
// Why this exists: Groq's free tier caps at 8,000 tokens/minute shared across
// every user, which is roughly four scans a minute for the whole product. Every
// code-side optimisation is already spent. Gemini's free tier is far higher
// (exact figures are model- and account-specific — check AI Studio), which makes
// it the better primary for a free-tier launch.
//
// The client keeps talking OpenAI-shaped JSON to /api/groq. Translation happens
// here in both directions, so switching providers needs no client change and no
// second code path in the scanner.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/'

// Candidate models, tried in order. A 404 means the ID is retired — Google
// closed gemini-2.5-flash to new projects, and the first deploy of this
// integration failed on exactly that. Retrying the next candidate turns a
// deprecation from an outage into a log line.
//
// Order: an explicit GEMINI_MODEL override wins, then the current GA flash
// model, then the lighter one as a floor.
export const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
].filter(Boolean)

export const GEMINI_VISION_MODEL = GEMINI_MODELS[0]

export function hasGeminiKey() {
  return !!process.env.GEMINI_API_KEY
}

// OpenAI chat-completions body -> Gemini generateContent body.
//
// The shapes differ in three ways that matter: Gemini separates the system
// prompt into systemInstruction rather than a message with role 'system'; it
// uses inline_data with raw base64 rather than a data: URL; and generation
// settings live under generationConfig.
export function toGeminiBody(openaiBody) {
  const messages = openaiBody.messages || []
  const systemParts = []
  const contents = []

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push({ text: typeof m.content === 'string' ? m.content : '' })
      continue
    }
    const parts = []
    if (typeof m.content === 'string') {
      parts.push({ text: m.content })
    } else if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'text') {
          parts.push({ text: c.text })
        } else if (c.type === 'image_url' && c.image_url && c.image_url.url) {
          const url = c.image_url.url
          // data:<mime>;base64,<payload>
          const comma = url.indexOf(',')
          const mime = (url.slice(5, url.indexOf(';')) || 'image/jpeg')
          const data = comma > -1 ? url.slice(comma + 1) : ''
          if (data) parts.push({ inline_data: { mime_type: mime, data } })
        }
      }
    }
    if (parts.length) {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts })
    }
  }

  const body = {
    contents,
    generationConfig: {
      temperature: typeof openaiBody.temperature === 'number' ? openaiBody.temperature : 0.1,
      maxOutputTokens: openaiBody.max_tokens || 2000,
    },
  }
  if (systemParts.length) body.systemInstruction = { parts: systemParts }
  return body
}

// Gemini generateContent response -> OpenAI chat-completions shape.
//
// Everything downstream (parseJSON, the scanner's result handling) reads
// choices[0].message.content, so returning that exact shape means no caller
// needs to know which provider answered.
export function fromGeminiResponse(g) {
  const cand = g && g.candidates && g.candidates[0]
  const parts = (cand && cand.content && cand.content.parts) || []
  const text = parts.map(function (p) { return p.text || '' }).join('')
  return {
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: (cand && cand.finishReason) || 'stop',
    }],
    usage: (g && g.usageMetadata) ? {
      prompt_tokens: g.usageMetadata.promptTokenCount,
      completion_tokens: g.usageMetadata.candidatesTokenCount,
      total_tokens: g.usageMetadata.totalTokenCount,
    } : undefined,
    _provider: 'gemini',
  }
}

// Calls Gemini and returns a fetch-like { ok, status, json, text } so the proxy
// can treat it interchangeably with the Groq path.
async function callGeminiModel(model, key, geminiBody, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(function () { ctrl.abort() }, timeoutMs || 45000)
  try {
    const res = await fetch(GEMINI_BASE + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiBody),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const raw = await res.text()
    if (!res.ok) {
      // 429 / RESOURCE_EXHAUSTED means out of quota; the proxy maps it onto the
      // same handling as a Groq 429 so the client sees one consistent
      // rate-limit story regardless of which provider answered.
      return { ok: false, status: res.status, error: raw.slice(0, 400) }
    }
    let parsed
    try { parsed = JSON.parse(raw) } catch (e) {
      return { ok: false, status: 502, error: 'Gemini returned unparseable JSON' }
    }
    return { ok: true, status: 200, data: fromGeminiResponse(parsed) }
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') return { ok: false, status: 504, error: 'Gemini request timed out' }
    return { ok: false, status: 502, error: (e && e.message) || 'Gemini request failed' }
  }
}

// Calls Gemini and returns a fetch-like result so the proxy can treat it
// interchangeably with the Groq path.
//
// Walks GEMINI_MODELS on a 404 only. A 404 means the model ID is retired, which
// no amount of retrying the same ID will fix — every other status (quota,
// timeout, malformed request) is returned immediately so the caller falls back
// to Groq rather than burning time on models that will fail the same way.
export async function callGemini(openaiBody, timeoutMs) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { ok: false, status: 503, error: 'No Gemini key configured' }

  // An explicit gemini-* model in the request wins outright.
  const candidates = (openaiBody.model && openaiBody.model.startsWith('gemini'))
    ? [openaiBody.model]
    : GEMINI_MODELS

  const geminiBody = toGeminiBody(openaiBody)
  let last = { ok: false, status: 503, error: 'No Gemini model configured' }
  for (const model of candidates) {
    last = await callGeminiModel(model, key, geminiBody, timeoutMs)
    if (last.ok) {
      if (model !== candidates[0]) last.data._model_fallback = model
      return last
    }
    if (last.status !== 404) return last
  }
  return last
}
