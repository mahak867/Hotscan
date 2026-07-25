// Minimal server-side error reporter for Vercel Edge Functions.
// The Edge runtime has `fetch` but not Node APIs, so the full @sentry/node
// SDK doesn't work here — this posts directly to Sentry's envelope ingest
// endpoint instead. Same project as the client (src/main.js), so server and
// client errors show up in the same Sentry dashboard.
//
// Before this file existed, api/groq.js, api/prices.js, and
// api/razorpay-webhook.js had ZERO error reporting — a server-side failure
// (like a deprecated model returning a 400) was invisible until a user
// happened to notice and report it. This is what closes that gap.

var DSN_PROJECT_ID = '4511283969851392'
var DSN_KEY = 'd30983e80b41aa7d1074e677160ffe4d'
var DSN_HOST = 'o4511283952353280.ingest.us.sentry.io'

export async function captureServerException(error, context) {
  try {
    var message = (error && error.message) || String(error)
    var stack = (error && error.stack) || ''
    var eventId = crypto.randomUUID().replace(/-/g, '')
    var payload = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      environment: 'production',
      server_name: 'vercel-edge',
      tags: context && context.tags || {},
      extra: context && context.extra || {},
      exception: {
        values: [{
          type: (error && error.name) || 'Error',
          value: message,
          stacktrace: stack ? { frames: [{ filename: 'server', function: (context && context.function) || 'unknown', context_line: stack.slice(0, 500) }] } : undefined,
        }],
      },
    }
    var envelope = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) + '\n' +
      JSON.stringify({ type: 'event' }) + '\n' +
      JSON.stringify(payload)
    // Fire-and-forget — never let error reporting itself block or fail the request
    fetch('https://' + DSN_HOST + '/api/' + DSN_PROJECT_ID + '/envelope/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': 'Sentry sentry_version=7, sentry_key=' + DSN_KEY,
      },
      body: envelope,
    }).catch(function() {})
  } catch (e) {
    // Reporting itself must never throw into the caller
  }
}
