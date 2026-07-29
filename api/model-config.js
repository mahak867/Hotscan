import { MODELS } from './_models.js'

export const config = { runtime: 'nodejs', maxDuration: 30 }

// Public, read-only — just model ID strings, nothing sensitive. Lets the
// Chrome extension (and anything else that can't be redeployed instantly)
// pick up model changes without needing a republish through the Chrome Web
// Store review process, which can take days.
async function handler(req) {
  return new Response(JSON.stringify({ haiku: MODELS.HAIKU, vision: MODELS.VISION }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // 1hr — model changes aren't urgent-second-by-second
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// NOTE: these MUST be named HTTP-method exports, not `export default`.
// Under Vercel's Node.js runtime, a default export is treated as the
// Express-style (req, res) => void signature and its RETURN VALUE IS
// IGNORED — so returning a Response from a default export meant the
// function never actually responded, hung, and died at the maxDuration
// limit with FUNCTION_INVOCATION_TIMEOUT (a 504 to the client). Named
// method exports use the Web fetch-style API where returning a Response
// is correct.
export async function GET(req) { return await handler(req) }
export async function OPTIONS(req) { return await handler(req) }
