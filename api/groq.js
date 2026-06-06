// HotScan India — Groq API proxy  (Vercel Edge Function)
//
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

export const config = { runtime: 'edge' }

// ── Allowed browser origins ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://hotscan.in',
  'https://www.hotscan.in',
  'https://hotscan-theta.vercel.app',
]
function isAllowedOrigin(o) { return !o ? false : ALLOWED_ORIGINS.includes(o) || o.endsWith('.vercel.app') }

// ── Per-IP rate limiter (in-memory, resets per Edge instance) ────────────────
// Each Edge invocation is stateless, but this is good enough to blunt burst
// abuse within a single instance.  Max 10 requests / 60 s per IP.
const ipMap = new Map()
const IP_WINDOW_MS  = 60_000
const IP_MAX_REQS   = 25

function isRateLimited(ip) {
  const now  = Date.now()
  // Evict stale entries to prevent memory leak
  if (ipMap.size > 500) {
    for (const [k, v] of ipMap) { if (now - v.start > IP_WINDOW_MS * 2) ipMap.delete(k) }
  }
  const rec  = ipMap.get(ip) || { count: 0, start: now }
  if (now - rec.start > IP_WINDOW_MS) {
    ipMap.set(ip, { count: 1, start: now })
    return false
  }
  if (rec.count >= IP_MAX_REQS) return true
  ipMap.set(ip, { count: rec.count + 1, start: rec.start })
  return false
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
export default async function handler(req) {
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
  if (isRateLimited(ip)) {
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
  if (userToken && userToken.length > 20) {
    try {
      const SUPA_URL = process.env.VITE_SUPA_URL || process.env.SUPA_URL
      const SUPA_KEY = process.env.VITE_SUPA_KEY || process.env.SUPA_KEY
      if (SUPA_URL && SUPA_KEY) {
        // Get user from token
        const userRes = await fetch(SUPA_URL + '/auth/v1/user', {
          headers: { 'Authorization': 'Bearer ' + userToken, 'apikey': SUPA_KEY }
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          const userId = userData.id
          if (userId) {
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
      // All keys exhausted
      return json(
        { error: 'All shared AI keys are rate-limited right now. Add your own free key at console.groq.com, or try again in a minute.' },
        429,
        cors
      )
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
