// SINGLE SOURCE OF TRUTH for server-side Groq model IDs.
// Imported by api/prices.js. The main app's src/config.js keeps its own copy
// (it's bundled at build time by Vite, can't import from api/ at runtime) —
// keep the two in sync when Groq changes models again. The Chrome extension
// (extension/popup.js) no longer hardcodes its own copy — it fetches
// api/model-config.js at runtime instead, so THAT one now updates the moment
// this file changes, with no extension republish needed.
//
// Last changed: July 2026, when Groq deprecated Llama 4 Scout/Maverick
// (vision), llama-3.2-90b-vision-preview (old vision fallback),
// llama-3.1-8b-instant, llama-3.3-70b-versatile, and renamed
// compound-beta / compound-beta-mini to groq/compound / groq/compound-mini
// on their move to general availability.

export var MODELS = {
  HAIKU: 'openai/gpt-oss-20b',
  CODEX: 'openai/gpt-oss-120b',
  VISION: 'qwen/qwen3.6-27b',
  VISION_FALLBACK: 'qwen/qwen3.6-27b',
  COMPOUND: 'groq/compound',
  COMPOUND_MINI: 'groq/compound-mini',
}
