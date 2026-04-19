# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, email **mahakfahad07@gmail.com** with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Security Architecture

### API Key Handling
- **Groq API keys** are stored exclusively in Vercel environment variables and are never shipped to the client. All AI requests are proxied through `/api/groq` (a Vercel Edge Function).
- **Supabase anon key** (`SUPA_KEY` in `src/config.js`) is intentionally public per [Supabase design](https://supabase.com/docs/guides/api/api-keys). Row-Level Security (RLS) policies ensure each user can only access their own rows.
- **Razorpay publishable key** (`RZP_KEY`) is a standard client-side credential equivalent to Stripe's publishable key; it cannot initiate server-side charges.

### Rate Limiting
- The `/api/groq` edge proxy enforces a **10 requests / IP / 60 s** hard limit before any AI key is consumed.

### XSS Prevention
- All AI-generated strings rendered via `innerHTML` pass through `escHtml()` (HTML-encodes `& < > " '`).
- User inputs pass through `sanitize()` (strips `< > " '`, max 500 chars) before any database write.

### CORS
- The API proxy rejects any `Origin` not in an explicit allowlist (`hotscan.in`, Vercel preview URLs).
