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

export const config = { runtime: 'edge' }

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

async function markUserPro(userId, paymentId) {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_KEY not set')
    return false
  }
  const res = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      is_pro: true,
      pro_since: new Date().toISOString(),
      razorpay_payment_id: paymentId,
    })
  })
  return res.ok
}

export default async function handler(req) {
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

    if (!userId) {
      console.error('No user_id in payment notes — payment:', paymentId)
      captureServerException(new Error('Razorpay payment captured with no user_id in notes'), { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId } })
      return new Response('No user_id in notes', { status: 400 })
    }

    const success = await markUserPro(userId, paymentId)
    if (!success) {
      // This means someone was actually charged money and their Pro upgrade
      // failed to apply — the single most business-critical silent failure
      // this webhook could have, and previously it only logged to Vercel's
      // console where nobody would see it until the customer complained.
      console.error('Failed to update Supabase for user:', userId)
      captureServerException(new Error('Payment captured but Supabase Pro upgrade failed — customer was charged without receiving Pro'), { tags: { endpoint: 'razorpay-webhook' }, extra: { paymentId, userId } })
      return new Response('DB update failed', { status: 500 })
    }

    console.log('Pro activated for user:', userId, 'payment:', paymentId)
    return new Response('OK', { status: 200 })
  }

  // Ignore other events
  return new Response('Event ignored', { status: 200 })
}
