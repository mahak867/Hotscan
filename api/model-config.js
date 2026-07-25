import { MODELS } from './_models.js'

export const config = { runtime: 'edge' }

// Public, read-only — just model ID strings, nothing sensitive. Lets the
// Chrome extension (and anything else that can't be redeployed instantly)
// pick up model changes without needing a republish through the Chrome Web
// Store review process, which can take days.
export default async function handler(req) {
  return new Response(JSON.stringify({ haiku: MODELS.HAIKU, vision: MODELS.VISION }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // 1hr — model changes aren't urgent-second-by-second
      'Access-Control-Allow-Origin': '*',
    },
  })
}
