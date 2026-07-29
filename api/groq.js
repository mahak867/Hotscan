// HotScan India — Groq API proxy  (Vercel Edge Function)
//
import { captureServerException } from './_sentry.js'
// Rate-limit strategy:
//   1. Reads a POOL of up to 5 Groq keys:  GROQ_API_KEY_1 … GROQ_API_KEY_5
//      (GROQ_API_KEY is also accepted as a single-key shorthand)
//   2. Rotates keys round-robin so quota is spread evenly across all free keys.
//   3. On a 429 from Groq it immediately retries with the *next* key in the pool
//      before giving up — so one exhausted key doesn't break all users.
//   4. Per-IP rate-limit: max 10 proxy requests per 60 s per visitor IP.
//      This prevents one visitor from burning through the entire shared quota.
//
// Setup in Vercel dashboard → Settings → Environment Variables:
//   GROQ_API_KEY_1  = gsk_...   (required)
//   GROQ_API_KEY_2  = gsk_...   (optional, but recommended)
//   GROQ_API_KEY_3  = gsk_...   (optional)
//   GROQ_API_KEY_4  = gsk_...   (optional)
//   GROQ_API_KEY_5  = gsk_...   (optional)
//
// Free Groq accounts: get keys at https://console.groq.com  (takes 2 minutes each)

// Edge runtime has a fixed 25-second "must begin responding" ceiling
// (confirmed via Vercel's own docs) regardless of plan — that's what was
// actually causing "Vision error 504" on slower Groq responses, not
// anything in this code. Node.js runtime supports the same Web API
// Request/Response handler style used here already, so this needed zero
// rewrite — just more execution headroom than Edge allows.
export const config = { runtime: 'nodejs', maxDuration: 60 }

// ── Allowed browser origins ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://hotscan.in',
  'https://www.hotscan.in',
  'https://hotscan-theta.vercel.app',
]
function isAllowedOrigin(o) { return !o ? false : ALLOWED_ORIGINS.includes(o) || o.endsWith('.vercel.app') }

// ── Per-IP rate limiter (Upstash Redis — shared across ALL Edge instances) ───
// Fixed-window counter via Redis INCR + EXPIRE. Unlike the old in-memory Map,
// this is consistent no matter which region/instance serves the request.
// Uses the raw REST API (no @upstash/redis dependency needed) since Vercel's
// integration named the vars UPSTASH_KV_* rather than UPSTASH_REDIS_REST_*.
const IP_WINDOW_S   = 60
const IP_MAX_REQS   = 25
const UPSTASH_URL   = process.env.UPSTASH_KV_REST_API_URL
const UPSTASH_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN

async function isRateLimited(ip) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return false // fail open if Redis isn't configured
  try {
    const key = 'ratelimit:groq:' + ip
    // Pipeline: INCR the counter, then EXPIRE it (only takes effect on first INCR
    // in the window since Redis EXPIRE just refreshes the TTL — fine for a fixed window).
    const res = await fetch(UPSTASH_URL + '/pipeline', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + UPSTASH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, IP_WINDOW_S, 'NX'], // NX = only set expiry if key has none yet
      ]),
    })
    if (!res.ok) return false // fail open on Redis errors — don't take the app down
    const data = await res.json()
    const count = data && data[0] && data[0].result
    return typeof count === 'number' && count > IP_MAX_REQS
  } catch (e) {
    return false // fail open
  }
}

// ── Key pool builder ─────────────────────────────────────────────────────────
function buildKeyPool() {
  const pool = []
  // Support a single GROQ_API_KEY as well as numbered GROQ_API_KEY_1…5
  const single = process.env.GROQ_API_KEY
  if (single) pool.push(single)
  for (let i = 1; i <= 5; i++) {
    const k = process.env['GROQ_API_KEY_' + i]
    if (k && !pool.includes(k)) pool.push(k)
  }
  return pool
}

// Simple counter stored per module instance for round-robin
let rrIndex = 0

// ── Main handler ─────────────────────────────────────────────────────────────
async function handler(req) {
  try {
    return await handleRequest(req)
  } catch (e) {
    // The fetch() to Groq below had no error handling at all — if it threw
    // (network error, DNS failure, a Node-runtime-specific fetch quirk,
    // anything) rather than just returning a non-200 response, the
    // exception escaped straight past the error-reporting code further
    // down, which only runs after a SUCCESSFUL fetch. That's exactly why
    // Vercel's dashboard showed 100% errors while Sentry stayed silent —
    // the crash never reached the code that would have reported it. This
    // outer wrapper guarantees visibility into whatever is actually
    // happening, no matter where it happens.
    captureServerException(e, { tags: { endpoint: 'groq' }, function: 'handler (uncaught)' })
    return new Response(JSON.stringify({ error: 'Server error — this has been reported. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleRequest(req) {
  const origin    = req.headers.get('origin') || ''
  const corsOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]

  const cors = {
    'Access-Control-Allow-Origin':  corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  // Per-IP rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (await isRateLimited(ip)) {
    return json(
      { error: 'Too many requests — you\'ve hit the shared scan limit. Add your own free Groq key at console.groq.com for unlimited personal access, or upgrade to HotScan Pro.' },
      429,
      cors
    )
  }

  // Server-side scan limit for free users
  // Reads Authorization header set by client — verifies with Supabase
  const authHeader = req.headers.get('authorization') || ''
  const xToken = req.headers.get('x-user-token') || ''
  const userToken = (authHeader.startsWith('Bearer gsk_') ? '' : authHeader.replace('Bearer ', '').trim()) || xToken
  // Hoisted so the scan_logs insert after a successful Groq call (below) can
  // reuse them — this is what makes the count and the gate the same request,
  // instead of relying on the client to separately call incScans() afterward.
  const SUPA_URL = process.env.VITE_SUPA_URL || process.env.SUPA_URL
  const SUPA_KEY = process.env.VITE_SUPA_KEY || process.env.SUPA_KEY
  let scanUserId = null
  if (userToken && userToken.length > 20) {
    try {
      if (SUPA_URL && SUPA_KEY) {
        // Get user from token
        const userRes = await fetch(SUPA_URL + '/auth/v1/user', {
          headers: { 'Authorization': 'Bearer ' + userToken, 'apikey': SUPA_KEY }
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          const userId = userData.id
          if (userId) {
            scanUserId = userId
            // Check profile for Pro status
            const profileRes = await fetch(SUPA_URL + '/rest/v1/profiles?id=eq.' + userId + '&select=is_pro,is_developer', {
              headers: { 'Authorization': 'Bearer ' + userToken, 'apikey': SUPA_KEY }
            })
            if (profileRes.ok) {
              const profiles = await profileRes.json()
              const profile = profiles && profiles[0]
              const isPro = profile && (profile.is_pro || profile.is_developer)
              if (!isPro) {
                // Count today's scans
                const today = new Date().toISOString().split('T')[0]
                const logsRes = await fetch(
                  SUPA_URL + '/rest/v1/scan_logs?user_id=eq.' + userId + '&scanned_at=gte.' + today + 'T00:00:00Z&select=id',
                  { headers: { 'Authorization': 'Bearer ' + userToken, 'apikey': SUPA_KEY } }
                )
                if (logsRes.ok) {
                  const logs = await logsRes.json()
                  if (logs && logs.length >= 5) {
                    return json({ error: 'Daily scan limit reached — upgrade to Pro for unlimited scans', limitReached: true }, 429, cors)
                  }
                }
              }
            }
          }
        }
      }
    } catch(e) { /* fail open — don't block scan if check errors */ }
  }

  // Key pool
  const pool = buildKeyPool()
  if (!pool.length) {
    return json(
      { error: 'Server AI key not configured — add GROQ_API_KEY_1 in Vercel dashboard.' },
      503,
      cors
    )
  }

  // Parse request body
  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, cors)
  }

  // Try each key in round-robin order; on 429 move to the next key
  const startIdx = rrIndex % pool.length
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = (startIdx + attempt) % pool.length
    const apiKey = pool[idx]

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization:  'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (groqRes.status === 429 && attempt < pool.length - 1) {
      // This key is exhausted — try the next one
      continue
    }

    // Advance the global round-robin pointer after a successful key selection
    rrIndex = (idx + 1) % pool.length

    const data = await groqRes.text()
    if (!groqRes.ok && groqRes.status === 429) {
      // All keys exhausted. Pass Groq's own Retry-After through so the client
      // waits the amount the upstream actually asks for instead of guessing —
      // guessing short is what turns one rate limit into a retry storm.
      const retryAfter = groqRes.headers.get('retry-after') || '60'
      return json(
        { error: 'All shared AI keys are rate-limited right now. Add your own free key at console.groq.com, or try again in a minute.' },
        429,
        { ...cors, 'Retry-After': retryAfter }
      )
    }
    if (!groqRes.ok) {
      // This is exactly the class of failure (e.g. a deprecated model ID)
      // that broke scanning entirely and went unnoticed until a user
      // happened to report it — report it immediately instead of only the
      // client seeing the raw error.
      captureServerException(new Error('Groq scan API error ' + groqRes.status + ': ' + data.slice(0,300)), { tags: { endpoint: 'groq' }, function: 'scan handler' })
    }
    // Log the scan server-side, right here, so usage and enforcement are the
    // same request. Previously this only happened client-side via incScans(),
    // which anyone calling this endpoint directly (bypassing the frontend)
    // could skip entirely — letting the daily-limit counter never increment.
    if (groqRes.ok && scanUserId && SUPA_URL && SUPA_KEY) {
      try {
        await fetch(SUPA_URL + '/rest/v1/scan_logs', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + userToken,
            'apikey': SUPA_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ user_id: scanUserId, scanned_at: new Date().toISOString() }),
        })
      } catch (e) { /* don't fail the response if logging errors */ }
    }

    return new Response(data, {
      status: groqRes.status,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  return json({ error: 'No available AI keys. Please try again shortly.' }, 503, cors)
}

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
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
export async function POST(req) { return await handler(req) }
export async function OPTIONS(req) { return await handler(req) }
