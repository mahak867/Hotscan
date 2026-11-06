// HotScan India — Groq API proxy  (Vercel Edge Function)
//
import { captureServerException } from './_sentry.js'
import { callGemini, hasGeminiKey } from './_gemini.js'

// Reported once per instance: if Gemini is misconfigured every request fails
// identically, and a flood of identical Sentry events adds nothing.
let _geminiWarned = false
let _quotaWarned = false

// Pro is a 30-day term (pro_until), not a permanent flag. Developers are exempt.
// Rows upgraded before pro_until existed have is_pro=true and pro_until=null;
// the migration backfills those to pro_since + 30 days, so null here means
// "not Pro" rather than "Pro forever".
function isProActive(profile) {
  if (!profile) return false
  if (profile.is_developer) return true
  if (!profile.is_pro || !profile.pro_until) return false
  const until = Date.parse(profile.pro_until)
  return Number.isFinite(until) && until > Date.now()
}

// Records a scan against the daily quota. Extracted so BOTH providers log it —
// otherwise a scan served by Gemini would never count, and the free tier would
// be unenforceable again through a different door.
async function logScan(scanUserId, userToken, supaUrl, supaKey) {
  if (!scanUserId || !supaUrl || !supaKey) return
  try {
    await fetch(supaUrl + '/rest/v1/scan_logs', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + userToken,
        'apikey': supaKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ user_id: scanUserId, scanned_at: new Date().toISOString() }),
    })
  } catch (e) { /* never fail the response because logging failed */ }
}
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
// Free scans per signed-in user per day. Kept here rather than inlined so the
// gate and the message quoting it can never drift apart.
const FREE_SCANS_PER_DAY = 5
const UPSTASH_URL   = process.env.UPSTASH_KV_REST_API_URL
const UPSTASH_TOKEN = process.env.UPSTASH_KV_REST_API_TOKEN

// Degraded-mode limiter, used only when Upstash is missing or failing. It is
// per-instance (so weaker than Redis), but it means a Redis outage degrades the
// limit instead of removing it. Failing fully closed would block every user
// behind carrier NAT, which is most of the Indian mobile audience.
const _localHits = new Map()
let _limiterWarned = false
function localRateLimited(ip) {
  const now = Date.now()
  const rec = _localHits.get(ip)
  if (!rec || now - rec.start > IP_WINDOW_S * 1000) {
    if (_localHits.size > 5000) _localHits.clear() // bound memory
    _localHits.set(ip, { start: now, count: 1 })
    return false
  }
  rec.count++
  return rec.count > IP_MAX_REQS
}
function degradedLimiter(ip, reason) {
  if (!_limiterWarned) {
    _limiterWarned = true
    captureServerException(new Error('Upstash rate limiter unavailable (' + reason + ') — using in-memory fallback'), { tags: { endpoint: 'groq', check: 'ratelimit' } })
  }
  return localRateLimited(ip)
}

async function isRateLimited(ip) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return degradedLimiter(ip, 'not configured')
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
    if (!res.ok) return degradedLimiter(ip, 'HTTP ' + res.status)
    const data = await res.json()
    const count = data && data[0] && data[0].result
    if (typeof count !== 'number') return degradedLimiter(ip, 'malformed response')
    return count > IP_MAX_REQS
  } catch (e) {
    return degradedLimiter(ip, 'network error')
  }
}

// Guest trial. Someone arriving from a WhatsApp collector group should be able
// to scan a car before being asked to sign up — that first scan IS the pitch,
// and demanding an account before showing any value is the surest way to lose
// them. Capped hard, because these scans are unattributable and therefore the
// abuse surface: 2 per IP per day is enough to prove the product works and far
// too few to be worth farming.
const GUEST_SCANS_PER_DAY = 3
// Backstop against one actor farming the guest tier by clearing storage for a
// fresh device id. Deliberately generous: on Indian mobile networks a single
// public IP can front a very large number of unrelated people.
const GUEST_SCANS_PER_IP_PER_DAY = 60
// Guest text calls: one scan can trigger a price-fallback call and a deal check,
// so allow a handful per scan, still hard-capped.
const GUEST_TEXT_PER_DAY = 15
const GUEST_TEXT_PER_IP_PER_DAY = 300

// Counts a guest's scans, keyed on device id where available and IP otherwise.
//
// IP alone is the wrong key in this market. Jio and Tata have run carrier-grade
// NAT from the start and Airtel has migrated to it, so thousands of unrelated
// mobile users share one public address. An IP-keyed allowance of a few scans
// means the first couple of people on a carrier IP consume it and everyone
// behind them is told they have used up scans they never made — which, for a
// launch into a WhatsApp group of collectors on mobile data, is every user
// after the first two.
//
// A localStorage device id is spoofable by clearing storage. That is an
// acceptable trade: it raises the effort of farming while not punishing
// legitimate users, and the per-IP ceiling below catches bulk abuse.
async function guestScanCount(ip, deviceId, kind) {
  // kind 'text' keeps a separate, larger budget for guest text calls (price
  // fallback, deal check) so they neither burn scan credits nor go uncapped.
  const prefix = kind === 'text' ? 'guest:text:' : 'guest:groq:'
  const ipCap = kind === 'text' ? GUEST_TEXT_PER_IP_PER_DAY : GUEST_SCANS_PER_IP_PER_DAY
  // Fail CLOSED when Redis is unconfigured: without a counter there is no cap,
  // and an uncapped anonymous path is exactly the hole this whole change exists
  // to close. Signed-in users are unaffected.
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return Infinity
  try {
    const day = new Date().toISOString().slice(0, 10)
    // Date-stamped key gives a natural daily reset without needing a cron.
    const key = deviceId
      ? prefix + day + ':d:' + deviceId
      : prefix + day + ':' + ip
    const ipKey = prefix + day + ':ip:' + ip
    const res = await fetch(UPSTASH_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 172800, 'NX'], // 48h, comfortably past any timezone edge
        ['INCR', ipKey],
        ['EXPIRE', ipKey, 172800, 'NX'],
      ]),
    })
    if (!res.ok) return Infinity
    const data = await res.json()
    const count = data && data[0] && data[0].result
    const ipCount = data && data[2] && data[2].result
    // Either ceiling can stop a guest, but they are wildly different sizes: a
    // few per device, many per IP. Report whichever has been breached so the
    // caller's message stays accurate.
    if (typeof ipCount === 'number' && ipCount > ipCap) return Infinity
    return typeof count === 'number' ? count : Infinity
  } catch (e) {
    return Infinity
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

// ── Request validation ───────────────────────────────────────────────────────
// This proxy spends a shared, paid key pool on behalf of anonymous callers, so
// it must only forward the request shapes the app itself sends. Anything else
// (unknown model, huge max_tokens, extra fields, oversized images) is rejected
// BEFORE a provider is called.
//
// Vercel caps Node function bodies at 4.5 MB; 4 MB leaves headroom and is far
// above what the app sends (five compressed photos are well under 2 MB).
const MAX_BODY_BYTES   = 4 * 1024 * 1024
const MAX_IMAGES       = 5
const MAX_IMAGE_CHARS  = 1_500_000          // per data URL (~1.1 MB of JPEG)
const MAX_TEXT_CHARS   = 24_000             // per text part / message
const MAX_MESSAGES     = 4
const MAX_TOKENS_CAP   = 2000               // highest value the client uses
// Keep in sync with api/_models.js / src/config.js.
const ALLOWED_MODELS = new Set([
  'qwen/qwen3.8-27b',
  // Groq shut qwen3.6-27b down on 2026-09-14. Installed PWAs and the extension
  // may still send it until they refresh, so it is accepted and rewritten to
  // its successor below rather than rejected.
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
])
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/

// Returns { body, imageCount } on success or { error } on rejection.
function validateBody(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Body must be a JSON object' }
  const allowedKeys = new Set(['model', 'messages', 'temperature', 'max_tokens', 'response_format'])
  for (const k of Object.keys(raw)) if (!allowedKeys.has(k)) return { error: 'Unsupported field: ' + k }
  if (!ALLOWED_MODELS.has(raw.model)) return { error: 'Unsupported model' }
  if (!Array.isArray(raw.messages) || !raw.messages.length || raw.messages.length > MAX_MESSAGES) {
    return { error: 'Invalid messages' }
  }
  let imageCount = 0
  const messages = []
  for (const m of raw.messages) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role)) return { error: 'Invalid message role' }
    if (typeof m.content === 'string') {
      if (m.content.length > MAX_TEXT_CHARS) return { error: 'Message too long' }
      messages.push({ role: m.role, content: m.content })
      continue
    }
    if (!Array.isArray(m.content) || m.role !== 'user') return { error: 'Invalid message content' }
    const parts = []
    for (const c of m.content) {
      if (c && c.type === 'text' && typeof c.text === 'string') {
        if (c.text.length > MAX_TEXT_CHARS) return { error: 'Text part too long' }
        parts.push({ type: 'text', text: c.text })
      } else if (c && c.type === 'image_url' && c.image_url && typeof c.image_url.url === 'string') {
        const url = c.image_url.url
        if (url.length > MAX_IMAGE_CHARS) return { error: 'Image too large — retake with a smaller photo' }
        if (!DATA_URL_RE.test(url)) return { error: 'Images must be base64 JPEG/PNG/WebP data URLs' }
        if (++imageCount > MAX_IMAGES) return { error: 'Too many images (max ' + MAX_IMAGES + ')' }
        parts.push({ type: 'image_url', image_url: { url } })
      } else {
        return { error: 'Unsupported content part' }
      }
    }
    messages.push({ role: m.role, content: parts })
  }
  const MODEL_ALIASES = { 'qwen/qwen3.6-27b': 'qwen/qwen3.8-27b' }
  const body = { model: MODEL_ALIASES[raw.model] || raw.model, messages }
  if (raw.temperature !== undefined) {
    if (typeof raw.temperature !== 'number' || !(raw.temperature >= 0 && raw.temperature <= 1)) return { error: 'Invalid temperature' }
    body.temperature = raw.temperature
  }
  const mt = raw.max_tokens === undefined ? 1000 : raw.max_tokens
  if (!Number.isInteger(mt) || mt < 1 || mt > MAX_TOKENS_CAP) return { error: 'max_tokens must be 1-' + MAX_TOKENS_CAP }
  body.max_tokens = mt
  if (raw.response_format !== undefined) {
    if (!raw.response_format || raw.response_format.type !== 'json_object') return { error: 'Unsupported response_format' }
    body.response_format = { type: 'json_object' }
  }
  return { body, imageCount }
}

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
    'Access-Control-Allow-Headers': 'Content-Type, x-user-token, x-device-id',
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
  // Identity comes from x-user-token only.
  //
  // The Authorization header used to be a fallback, with a `Bearer gsk_` special
  // case that blanked the token — so a free user past their five scans could
  // re-enable themselves just by prefixing the header. Reading identity from one
  // place removes that, and removes the ambiguity that created it.
  const xToken = req.headers.get('x-user-token') || ''
  const userToken = xToken.trim()
  // Hoisted so the scan_logs insert after a successful Groq call (below) can
  // reuse them — this is what makes the count and the gate the same request,
  // instead of relying on the client to separately call incScans() afterward.
  const SUPA_URL = process.env.VITE_SUPA_URL || process.env.SUPA_URL
  const SUPA_KEY = process.env.VITE_SUPA_KEY || process.env.SUPA_KEY
  let scanUserId = null

  // Parse and validate the body BEFORE any quota or provider work, so a
  // malformed or oversized request costs nothing and never consumes a scan.
  const declaredLen = parseInt(req.headers.get('content-length') || '0', 10)
  if (declaredLen > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, cors)
  let rawText
  try { rawText = await req.text() } catch { return json({ error: 'Could not read body' }, 400, cors) }
  if (rawText.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, cors)
  let parsed
  try { parsed = JSON.parse(rawText) } catch { return json({ error: 'Invalid JSON body' }, 400, cors) }
  const v = validateBody(parsed)
  if (v.error) return json({ error: v.error }, 400, cors)
  const body = v.body
  // Only image-bearing requests are "scans". Text calls (price fallback, deal
  // check) used to be logged as scans too, which — once the quota below
  // actually worked — would have let one real scan burn several of the five
  // daily credits. Text calls stay covered by the per-IP limiter, the model
  // allowlist and the max_tokens cap.
  const isScan = v.imageCount > 0

  // Every scan is now accounted for, as either a guest trial or a signed-in
  // user. The quota block used to be wrapped in `if (userToken)`, so omitting
  // the header skipped both the daily limit and the scan_logs insert — unlimited
  // vision completions on the shared paid key pool, uncounted. That made the
  // free tier, and the Pro upgrade it funds, unenforceable by anyone with curl.
  //
  // Users on their own Groq key never reach this proxy at all.
  const isGuest = !userToken || userToken.length < 20

  if (isGuest && isScan) {
    // Let a newcomer actually try the product before asking for an account —
    // the first scan is the pitch. Capped hard because guest scans cannot be
    // attributed to anyone.
    // Device id is client-supplied, so treat it as untrusted: constrain it hard
    // before it becomes part of a Redis key.
    const rawDevice = (req.headers.get('x-device-id') || '').trim()
    const deviceId = /^[a-zA-Z0-9-]{8,64}$/.test(rawDevice) ? rawDevice : ''
    const used = await guestScanCount(ip, deviceId)
    if (used > GUEST_SCANS_PER_DAY) {
      return json({
        error: 'You have used your ' + GUEST_SCANS_PER_DAY + ' free scans. Create a free account for ' + FREE_SCANS_PER_DAY + ' scans every day.',
        signUpRequired: true,
      }, 401, cors)
    }
  } else if (isGuest) {
    const rawDevice = (req.headers.get('x-device-id') || '').trim()
    const deviceId = /^[a-zA-Z0-9-]{8,64}$/.test(rawDevice) ? rawDevice : ''
    const usedText = await guestScanCount(ip, deviceId, 'text')
    if (usedText > GUEST_TEXT_PER_DAY) {
      return json({ error: 'Free guest limit reached — create a free account to keep going.', signUpRequired: true }, 401, cors)
    }
  } else {
    if (!SUPA_URL || !SUPA_KEY) {
      return json({ error: 'Server auth not configured' }, 503, cors)
    }
    let userId = null
    try {
      const userRes = await fetch(SUPA_URL + '/auth/v1/user', {
        headers: { 'Authorization': 'Bearer ' + userToken, 'apikey': SUPA_KEY }
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        userId = userData && userData.id
      }
    } catch (e) { /* handled immediately below */ }

    // Fail CLOSED on identity: a token that will not verify is exactly what this
    // gate exists for. The quota check below still fails open, so a transient
    // Supabase blip degrades to "scan allowed" for a real signed-in user rather
    // than breaking scanning for everyone.
    if (!userId) {
      return json({ error: 'Session expired — sign in again to scan.' }, 401, cors)
    }
    scanUserId = userId
  }

  // Daily quota for signed-in free users.
  //
  // This used to reference `userId`, which is declared with `let` inside the
  // else-block above and is therefore out of scope here. The ReferenceError was
  // swallowed by the catch, so the quota never ran for anyone. scanUserId is
  // the outer-scope copy of the same verified id.
  //
  // Read failures are a deliberate, visible fail-open: a Supabase blip should
  // not stop a verified user scanning, but it is reported so a persistent
  // failure (which would mean no quota at all) cannot go unnoticed.
  if (scanUserId && isScan) {
    const authHeaders = { 'Authorization': 'Bearer ' + userToken, 'apikey': SUPA_KEY }
    let quotaChecked = false
    try {
      const profileRes = await fetch(
        SUPA_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(scanUserId) + '&select=is_pro,pro_until,is_developer',
        { headers: authHeaders }
      )
      if (profileRes.ok) {
        const profiles = await profileRes.json()
        const profile = profiles && profiles[0]
        if (!isProActive(profile)) {
          const today = new Date().toISOString().split('T')[0]
          const logsRes = await fetch(
            SUPA_URL + '/rest/v1/scan_logs?user_id=eq.' + encodeURIComponent(scanUserId) + '&scanned_at=gte.' + today + 'T00:00:00Z&select=id',
            { headers: authHeaders }
          )
          if (logsRes.ok) {
            const logs = await logsRes.json()
            quotaChecked = true
            if (Array.isArray(logs) && logs.length >= FREE_SCANS_PER_DAY) {
              return json({ error: 'Daily scan limit reached — upgrade to Pro for unlimited scans', limitReached: true }, 429, cors)
            }
          }
        } else {
          quotaChecked = true
        }
      }
    } catch (e) { /* reported below */ }
    if (!quotaChecked && !_quotaWarned) {
      _quotaWarned = true
      captureServerException(new Error('Scan quota could not be read — allowing scan (fail-open)'), { tags: { endpoint: 'groq', check: 'quota' } })
    }
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

  // ── Gemini first ──────────────────────────────────────────────────────
  // Groq's free tier is 8,000 tokens/minute shared across every user of the
  // app — about four scans a minute in total, and every code-side optimisation
  // for it is already spent. Gemini's free tier is far larger, so it serves as
  // primary and Groq becomes the fallback rather than the other way round.
  //
  // Groq is deliberately kept rather than removed: it is materially faster, and
  // two independent free tiers means one provider's outage or exhausted quota
  // is not an outage of the product. Set GEMINI_PRIMARY=0 to flip the order
  // back without a deploy of new code.
  const geminiFirst = hasGeminiKey() && process.env.GEMINI_PRIMARY !== '0'
  if (geminiFirst) {
    const g = await callGemini(body, 45000)
    if (g.ok) {
      if (isScan) await logScan(scanUserId, userToken, SUPA_URL, SUPA_KEY)
      return json(g.data, 200, cors)
    }
    // Quota exhausted or transient failure — fall through to Groq rather than
    // failing the scan. Reported once so a persistent Gemini problem is visible
    // instead of silently costing Groq quota forever.
    if (!_geminiWarned) {
      _geminiWarned = true
      captureServerException(
        new Error('Gemini failed (' + g.status + '), falling back to Groq: ' + String(g.error).slice(0, 200)),
        { tags: { endpoint: 'groq', provider: 'gemini' } }
      )
    }
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
    if (groqRes.ok) {
      if (isScan) await logScan(scanUserId, userToken, SUPA_URL, SUPA_KEY)
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
