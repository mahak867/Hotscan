const fs = require('fs');

// ── FEATURE: Server-side scan limit in api/groq.js ──────────────────────────
let groq = fs.readFileSync('api/groq.js', 'utf8');

// Add Supabase scan check after IP rate limit
groq = groq.replace(
  `  // Key pool`,
  `  // Server-side scan limit for free users
  // Reads Authorization header set by client — verifies with Supabase
  const authHeader = req.headers.get('authorization') || ''
  const userToken = authHeader.replace('Bearer ', '').trim()
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

  // Key pool`
);

fs.writeFileSync('api/groq.js', groq, 'utf8');
console.log('Server-side scan limit:', groq.includes('Daily scan limit reached') ? 'OK' : 'FAILED');

// ── FEATURE: Send auth token with scan requests ──────────────────────────────
let sc = fs.readFileSync('src/groq.js', 'utf8');
// Add auth header to API proxy calls
sc = sc.replace(
  `    var hdrs = state.KEY\n      ? { 'Authorization': 'Bearer ' + state.KEY, 'Content-Type': 'application/json' }\n      : { 'Content-Type': 'application/json' }`,
  `    var _authToken = state.currentUser && state._sb ? (await state._sb.auth.getSession().then(function(r){ return r.data && r.data.session ? r.data.session.access_token : '' }).catch(function(){ return '' })) : ''
    var hdrs = state.KEY
      ? { 'Authorization': 'Bearer ' + state.KEY, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json', 'X-User-Token': _authToken }`
);
// Update proxy route to read X-User-Token
groq = fs.readFileSync('api/groq.js', 'utf8');
groq = groq.replace(
  `  const authHeader = req.headers.get('authorization') || ''\n  const userToken = authHeader.replace('Bearer ', '').trim()`,
  `  const authHeader = req.headers.get('authorization') || ''\n  const xToken = req.headers.get('x-user-token') || ''\n  const userToken = (authHeader.startsWith('Bearer gsk_') ? '' : authHeader.replace('Bearer ', '').trim()) || xToken`
);
fs.writeFileSync('src/groq.js', sc, 'utf8');
fs.writeFileSync('api/groq.js', groq, 'utf8');
console.log('Auth token in requests:', sc.includes('X-User-Token') ? 'OK' : 'FAILED');
console.log('API reads X-User-Token:', groq.includes('x-user-token') ? 'OK' : 'FAILED');

// ── FEATURE: Supabase Storage for car images ─────────────────────────────────
let col = fs.readFileSync('src/collection.js', 'utf8');
// Add image upload helper
col = col.replace(
  `export async function saveToCloud(item) {`,
  `async function uploadImageToStorage(imageDataUrl, itemId) {
  if (!imageDataUrl || !state._sb || !state.currentUser) return null
  try {
    // Convert base64 to blob
    var arr = imageDataUrl.split(',')
    var mime = arr[0].match(/:(.*?);/)[1]
    var bstr = atob(arr[1])
    var n = bstr.length
    var u8arr = new Uint8Array(n)
    while(n--) u8arr[n] = bstr.charCodeAt(n)
    var blob = new Blob([u8arr], {type: mime})
    var ext = mime === 'image/png' ? 'png' : 'jpg'
    var path = state.currentUser.id + '/' + itemId + '.' + ext
    var up = await state._sb.storage.from('car-images').upload(path, blob, {
      contentType: mime, upsert: true
    })
    if (up.error) return null
    var urlData = state._sb.storage.from('car-images').getPublicUrl(path)
    return urlData.data && urlData.data.publicUrl ? urlData.data.publicUrl : null
  } catch(e) { return null }
}

export async function saveToCloud(item) {`
);

// Use storage URL if image is base64
col = col.replace(
  `    var thumb = item.image || null\n    if (thumb && thumb.length > 8000) thumb = null`,
  `    var thumb = item.image || null
    // Upload to Supabase Storage if image is base64 (not already a URL)
    if (thumb && thumb.startsWith('data:') && thumb.length > 100) {
      var storageUrl = await uploadImageToStorage(thumb, item.id || Date.now())
      if (storageUrl) thumb = storageUrl
      else if (thumb.length > 8000) thumb = null // too large for DB column
    }`
);

fs.writeFileSync('src/collection.js', col, 'utf8');
console.log('Supabase Storage upload:', col.includes('uploadImageToStorage') ? 'OK' : 'FAILED');
console.log('Storage in saveToCloud:', col.includes('storageUrl') ? 'OK' : 'FAILED');

