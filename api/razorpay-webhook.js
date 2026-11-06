// HotScan India — Razorpay Webhook Handler (Vercel Edge Function)
//
import { captureServerException } from './_sentry.js'
// Verifies payment server-side using Razorpay webhook signature,
// then marks the user as Pro in Supabase.
//
// Setup:
// 1. Go to Razorpay Dashboard → Settings → Webhooks → Add new webhook
//    URL: https://hotscan.in/api/razorpay-webhook
//    Events: payment.captured
//    Secret: (create one, copy it)
// 2. Add to Vercel Environment Variables:
//    RAZORPAY_WEBHOOK_SECRET = your_webhook_secret
//    SUPABASE_SERVICE_KEY    = your supabase service_role key (NOT anon key)
//    VITE_SUPA_URL           = https://qptxrvvpbrnklzpxjtfr.supabase.co

export const config = { runtime: 'nodejs', maxDuration: 30 }

const SUPA_URL = process.env.VITE_SUPA_URL || 'https://qptxrvvpbrnklzpxjtfr.supabase.co'

async function verifyRazorpaySignature(body, signature, secret) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(body)
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuffer = await crypto.subtle.sign('HMAC', key, msgData)
  const sigHex = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqualHex(sigHex, signature)
}

// Constant-time comparison for hex strings. The Edge runtime has no
// crypto.timingSafeEqual (that's Node-only), so this compares every
// character regardless of an early mismatch, accumulating differences
// with bitwise OR rather than short-circuiting on the first bad char —
// closing the timing side-channel a plain `===` would leave open.
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) {
    // Still do a same-cost dummy comparison so mismatched-length requests
    // don't return measurably faster than same-length ones.
    let dummy = 0
    for (let i = 0; i < a.length; i++) dummy |= a.charCodeAt(i)
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const PRO_TERM_DAYS = 30
const RZP_KEY_ID     = process.env.RZP_KEY_ID || process.env.VITE_RZP_KEY
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET

// Fetches the order this payment belongs to straight from Razorpay. Its notes
// were written by /api/razorpay-order from a verified Supabase session, so the
// beneficiary comes from there — never from the payment's own notes, which are
// one hop further from anything we created.
async function fetchOrder(orderId) {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET) return { error: 'Razorpay API keys not configured' }
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(orderId), {
      headers: { Authorization: 'Basic ' + btoa(RZP_KEY_ID + ':' + RZP_KEY_SECRET) },
    })
    if (!res.ok) return { error: 'order fetch ' + res.status, retryable: res.status >= 500 }
    return { order: await res.json() }
  } catch (e) {
    return { error: 'order fetch network error', retryable: true }
  }
}

function serviceHeaders(serviceKey) {
  return {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  }
}

// Grants (or extends) a 30-day Pro term. Idempotent per payment: Razorpay
// retries webhooks, and a retry must not add another 30 days.
// Returns 'ok' | 'duplicate' | 'error'.
async function grantProTerm(userId, paymentId) {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_KEY not set')
    return 'error'
  }
  const uid = encodeURIComponent(userId)
  const cur = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${uid}&select=pro_until,razorpay_payment_id`, {
    headers: serviceHeaders(serviceKey),
  })
  if (!cur.ok) return 'error'
  const rows = await cur.json()
  const profile = rows && rows[0]
  if (!profile) return 'error'
  if (profile.razorpay_payment_id === paymentId) return 'duplicate'

  // Renewing early stacks onto the remaining term instead of discarding it.
  const now = Date.now()
  const existing = Date.parse(profile.pro_until || '') || 0
  const base = Math.max(now, existing)
  const proUntil = new Date(base + PRO_TERM_DAYS * 86400000).toISOString()

  // The razorpay_payment_id filter makes this a compare-and-set, so two
  // concurrent deliveries of the same event cannot both extend the term.
  const filter = profile.razorpay_payment_id
    ? `&razorpay_payment_id=eq.${encodeURIComponent(profile.razorpay_payment_id)}`
    : '&razorpay_payment_id=is.null'
  const res = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${uid}${filter}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders(serviceKey), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      is_pro: true,
      pro_since: new Date(now).toISOString(),
      pro_until: proUntil,
      razorpay_payment_id: paymentId,
    }),
  })
  if (!res.ok) return 'error'
  const updated = await res.json().catch(() => [])
  return Array.isArray(updated) && updated.length ? 'ok' : 'duplicate'
}

async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const signature = req.headers.get('x-razorpay-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()

  // Verify signature
  const isValid = await verifyRazorpaySignature(body, signature, webhookSecret)
  if (!isValid) {
    console.error('Invalid Razorpay webhook signature')
    captureServerException(new Error('Invalid Razorpay webhook signature'), { tags: { endpoint: 'razorpay-webhook' } })
    return new Response('Invalid signature', { status: 400 })
  }

  let event
  try {
    event = JSON.parse(body)
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Handle payment.captured event
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity
    if (!payment) return new Response('No payment data', { status: 400 })

    const paymentId = payment.id
    const userId = payment.notes?.user_id

    // Verify what was actually PAID, not just that Razorpay signed the event.
    //
    // The signature check above only proves the message came from Razorpay — it
    // says nothing about the amount. src/auth.js builds the checkout options in
    // the browser with no server-created order, so a user could open the console
    // and launch Razorpay with amount:100 and notes.user_id set to any uuid, pay
    // ₹1, and receive a genuinely signed payment.captured event. This handler
    // would then have granted Pro — to them, or to any account they named.
    //
    // Amounts are in paise. This is the minimum viable check; the complete fix
    // is a server-created order (see PRO_PRICE_PAISE usage note below) so that
    // neither the amount nor the target user is ever client-supplied.
    const PRO_PRICE_PAISE = 9900
    // order_id is present only for payments created through /api/razorpay-order,
    // where the amount and notes.user_id were set server-side from a verified
    // session. A payment without one was assembled in the browser.
    if (!payment.order_id) {
      captureServerException(
        new Error('Razorpay payment has no order_id — checkout was not server-initiated'),
        { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId, userId } }
      )
      return new Response('No order_id — not upgraded', { status: 200 })
    }
    if (payment.amount !== PRO_PRICE_PAISE || payment.currency !== 'INR' || payment.status !== 'captured') {
      captureServerException(
        new Error('Razorpay payment rejected: expected ' + PRO_PRICE_PAISE + ' INR captured, got ' +
                  payment.amount + ' ' + payment.currency + ' ' + payment.status),
        { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId, userId } }
      )
      // 200 so Razorpay stops retrying — the payment is real, it just does not
      // entitle anyone to Pro. Refunds are handled out of band.
      return new Response('Amount mismatch — not upgraded', { status: 200 })
    }

    // Bind the payment to the order WE created. Without this, the beneficiary
    // was read from payment.notes, which is not an explicit server-side binding.
    const { order, error: orderErr, retryable } = await fetchOrder(payment.order_id)
    if (!order) {
      captureServerException(new Error('Razorpay order lookup failed: ' + orderErr), { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId, orderId: payment.order_id } })
      // 500 on transient failures so Razorpay retries; 200 otherwise.
      return new Response('Order lookup failed', { status: retryable ? 500 : 200 })
    }
    const orderUserId = order.notes && order.notes.user_id
    const orderPlan   = order.notes && order.notes.plan
    if (
      order.id !== payment.order_id ||
      order.amount !== PRO_PRICE_PAISE ||
      order.currency !== 'INR' ||
      orderPlan !== 'pro_monthly' ||
      !orderUserId ||
      (userId && userId !== orderUserId)
    ) {
      captureServerException(
        new Error('Razorpay payment does not match its server-created order — not upgraded'),
        { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId, orderId: payment.order_id, orderAmount: order.amount, orderPlan } }
      )
      return new Response('Order mismatch — not upgraded', { status: 200 })
    }

    const outcome = await grantProTerm(orderUserId, paymentId)
    if (outcome === 'duplicate') {
      return new Response('Already processed', { status: 200 })
    }
    if (outcome !== 'ok') {
      // This means someone was actually charged money and their Pro upgrade
      // failed to apply — the single most business-critical silent failure
      // this webhook could have. 500 makes Razorpay retry; the payment-id
      // compare-and-set keeps retries from double-extending.
      console.error('Failed to update Supabase for user:', orderUserId)
      captureServerException(new Error('Payment captured but Supabase Pro upgrade failed — customer was charged without receiving Pro'), { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId, userId: orderUserId } })
      return new Response('DB update failed', { status: 500 })
    }

    console.log('Pro term granted for user:', orderUserId, 'payment:', paymentId)
    return new Response('OK', { status: 200 })
  }

  // Ignore other events
  return new Response('Event ignored', { status: 200 })
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
