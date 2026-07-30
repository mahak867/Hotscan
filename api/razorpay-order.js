// Creates a Razorpay order server-side.
//
// Why this exists: startPayment() previously built the checkout options entirely
// in the browser — amount 9900 and notes.user_id — with no order backing them.
// Razorpay faithfully signs whatever it is given, so a user could open the
// console, launch checkout with amount:100 and notes.user_id set to any uuid,
// pay ₹1, and the webhook would receive a genuinely signed payment.captured
// event. The signature proved the message came from Razorpay; it proved nothing
// about the amount or who it was for.
//
// With an order, both are fixed here, from a verified session, before the user
// ever reaches the payment sheet. The client receives only an order_id.

import { captureServerException } from './_sentry.js'

// Paise. Single source of truth — the webhook validates against this same value.
export const PRO_PRICE_PAISE = 9900

const RZP_KEY_ID     = process.env.RZP_KEY_ID || process.env.VITE_RZP_KEY
const RZP_KEY_SECRET = process.env.RZP_KEY_SECRET
const SUPA_URL = process.env.VITE_SUPA_URL || process.env.SUPA_URL
const SUPA_KEY = process.env.VITE_SUPA_KEY || process.env.SUPA_KEY

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  })
}

// Resolves the caller's real user id from their Supabase JWT. The id must come
// from the token, never from the request body — that is the whole point.
async function verifyUser(token) {
  if (!token || token.length < 20 || !SUPA_URL || !SUPA_KEY) return null
  try {
    const res = await fetch(SUPA_URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: SUPA_KEY },
    })
    if (!res.ok) return null
    const user = await res.json()
    return user && user.id ? user : null
  } catch (e) {
    return null
  }
}

async function handleRequest(req) {
  const cors = {
    'Access-Control-Allow-Origin': 'https://www.hotscan.in',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    return json({ error: 'Payments are not configured' }, 503, cors)
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = (req.headers.get('x-user-token') || authHeader.replace('Bearer ', '')).trim()
  const user = await verifyUser(token)
  if (!user) return json({ error: 'Sign in to upgrade' }, 401, cors)

  try {
    const auth = 'Basic ' + btoa(RZP_KEY_ID + ':' + RZP_KEY_SECRET)
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: PRO_PRICE_PAISE,
        currency: 'INR',
        // Both of these are now server-set and travel with the order, so the
        // webhook can trust them.
        notes: { user_id: user.id, plan: 'pro_monthly' },
        // Lets Razorpay reject an accidental duplicate for the same user within
        // its own dedupe window.
        receipt: 'pro_' + user.id.slice(0, 8) + '_' + Math.floor(Date.now() / 1000),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      captureServerException(
        new Error('Razorpay order creation failed: ' + res.status + ' ' + JSON.stringify(data).slice(0, 300)),
        { tags: { endpoint: 'razorpay-order' }, extra: { userId: user.id } }
      )
      return json({ error: 'Could not start checkout — try again' }, 502, cors)
    }
    // Deliberately narrow: the client needs the order id and the display amount,
    // nothing else.
    return json({ order_id: data.id, amount: data.amount, currency: data.currency }, 200, cors)
  } catch (e) {
    captureServerException(e, { tags: { endpoint: 'razorpay-order' } })
    return json({ error: 'Could not start checkout — try again' }, 500, cors)
  }
}

// NOTE: named HTTP-method exports, not `export default`. Under Vercel's Node.js
// runtime a default export is treated as the Express-style (req, res) signature
// and its return value is ignored, so the function never responds and dies at
// maxDuration with a 504.
export async function POST(req) { return handleRequest(req) }
export async function OPTIONS(req) { return handleRequest(req) }
