const fs = require('fs');

// FIX 1: Auth timeout 15s→25s + username RPC timeout
let auth = fs.readFileSync('src/auth.js', 'utf8');
auth = auth.replace(
  "var _to=setTimeout(function(){ setAuthLoading(false); showAuthErr('Request timed out — try again') },15000)",
  "var _to=setTimeout(function(){ setAuthLoading(false); showAuthErr('Connection timed out — check your internet and try again') },25000)"
);
auth = auth.replace(
  "var lu = await state._sb.rpc('get_email_by_username', { p_username: rawInput })",
  "var lu = await Promise.race([state._sb.rpc('get_email_by_username', { p_username: rawInput }), new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'))},8000)})])"
);
fs.writeFileSync('src/auth.js', auth, 'utf8');
console.log('Fix 1 auth:', auth.includes('25000') ? 'OK' : 'FAILED');

// FIX 2: Scan cache — skip Groq for same image within 24h
let scanner = fs.readFileSync('src/scanner.js', 'utf8');
scanner = scanner.replace(
  "export async function analyzePhoto() {\n  if (!state.img64) return\n  if (!window.checkLimit()) return",
  `export async function analyzePhoto() {
  if (!state.img64) return
  if (!window.checkLimit()) return
  try {
    var _imgKey = state.img64.substring(50, 150)
    var _cache = JSON.parse(localStorage.getItem('hs_scan_cache') || '{}')
    if (_cache[_imgKey] && Date.now() - _cache[_imgKey].ts < 86400000) {
      var _cached = _cache[_imgKey].data
      state.lastResult = _cached
      window.saveToHist && window.saveToHist(_cached)
      window.showResult(_cached)
      window.incScans()
      window.updateScanCounter && window.updateScanCounter()
      if (navigator.vibrate) navigator.vibrate(30)
      if (window.updateStreak) window.updateStreak()
      return
    }
  } catch(e) {}`
);
scanner = scanner.replace(
  "if (navigator.vibrate) navigator.vibrate(200)",
  `if (navigator.vibrate) navigator.vibrate([30, 50, 30])
    try {
      var _imgKey2 = state.img64.substring(50, 150)
      var _cache2 = JSON.parse(localStorage.getItem('hs_scan_cache') || '{}')
      _cache2[_imgKey2] = { data: result, ts: Date.now() }
      var _keys = Object.keys(_cache2)
      if (_keys.length > 50) delete _cache2[_keys[0]]
      localStorage.setItem('hs_scan_cache', JSON.stringify(_cache2))
    } catch(e) {}`
);
fs.writeFileSync('src/scanner.js', scanner, 'utf8');
console.log('Fix 2 scan cache:', scanner.includes('hs_scan_cache') ? 'OK' : 'FAILED');

// FIX 3: updateStreak after scan + haptic
let ui = fs.readFileSync('src/ui.js', 'utf8');
ui = ui.replace(
  "window._checkAchievements && window._checkAchievements(d)\n  \n  // #1",
  "window._checkAchievements && window._checkAchievements(d)\n  if (window.updateStreak) window.updateStreak()\n  // #1"
);
fs.writeFileSync('src/ui.js', ui, 'utf8');
console.log('Fix 3 streak:', ui.includes('window.updateStreak()') ? 'OK' : 'FAILED');

// FIX 4: Collection dirty check — skip re-render if data unchanged
let col = fs.readFileSync('src/collection.js', 'utf8');
col = col.replace(
  "state.collection = cloudItems\n        localStorage.setItem('hs_col', JSON.stringify(state.collection))\n        if (newHash !== oldHash) renderCol()",
  `state.collection = cloudItems
        var _newHash = cloudItems.map(function(c){return c.id+':'+(c.rarity||'')}).join(',')
        var _oldHash = localStorage.getItem('hs_col_hash')
        localStorage.setItem('hs_col', JSON.stringify(state.collection))
        localStorage.setItem('hs_col_hash', _newHash)
        if (_newHash !== _oldHash) renderCol()`
);

// FIX 5: Guest empty state
col = col.replace(
  "export function renderCol() {",
  `export function renderCol() {
  if (!window.state || (!window.state.currentUser && state.collection.length === 0)) {
    var _list = document.getElementById('col-list')
    if (_list) _list.innerHTML = '<div style="text-align:center;padding:40px 20px"><div style="font-size:40px;margin-bottom:12px">🔐</div><div style="font-size:15px;font-weight:700;margin-bottom:6px">Sign in to see your collection</div><div style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.6">Your collection syncs across all devices when signed in</div><button class="btn-red" style="padding:12px 24px;border-radius:12px;font-size:14px" onclick="window.openAuth()">Sign In / Create Account</button></div>'
    return
  }`
);

// FIX 6: Haptics on add/delete
col = col.replace(
  "state.collection.unshift(item)\n  renderCol()",
  "state.collection.unshift(item)\n  if (navigator.vibrate) navigator.vibrate(30)\n  renderCol()"
);
col = col.replace(
  "state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })\n  if (navigator.vibrate) navigator.vibrate([20, 30, 20])",
  "state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })"
);
col = col.replace(
  "state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })",
  "state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })\n  if (navigator.vibrate) navigator.vibrate([20, 30, 20])"
);
fs.writeFileSync('src/collection.js', col, 'utf8');
console.log('Fix 4-6 collection:', col.includes('Sign in to see') && col.includes('navigator.vibrate') ? 'OK' : 'FAILED');

// FIX 7: Marketplace retry button
let mp = fs.readFileSync('src/marketplace.js', 'utf8');
mp = mp.replace(
  "console.warn('Listings fetch error:', res.error.message)\n        captureException(new Error('Listings table error: ' + res.error.message))",
  `console.warn('Listings fetch error:', res.error.message)
        captureException(new Error('Listings table error: ' + res.error.message))
        wrap.innerHTML = '<div style="text-align:center;padding:32px"><div style="font-size:32px;margin-bottom:10px">⚠️</div><div style="font-size:14px;font-weight:600;margin-bottom:6px">Could not load listings</div><div style="font-size:12px;color:var(--text2);margin-bottom:14px">Check your connection</div><button class="btn-red" style="padding:10px 20px;border-radius:10px;font-size:13px" onclick="loadAndRenderListings()">🔄 Retry</button></div>'
        return`
);
fs.writeFileSync('src/marketplace.js', mp, 'utf8');
console.log('Fix 7 marketplace:', mp.includes('Retry') ? 'OK' : 'FAILED');

console.log('\nAll fixes done!');
