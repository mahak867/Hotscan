const fs = require('fs');
let fixes = [], errors = [];

function patch(file, search, replace, label) {
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes(search)) {
    fs.writeFileSync(file, c.replace(search, replace), 'utf8');
    fixes.push('OK: ' + label);
  } else {
    errors.push('SKIP: ' + label);
  }
}

// AUTH FIXES
patch('src/auth.js',
  'signInEmail = lu.data',
  "signInEmail = typeof lu.data === 'string' ? lu.data : (lu.data && lu.data.email) ? lu.data.email : String(lu.data || '')",
  'Auth: safe username RPC email extraction'
);
patch('src/auth.js',
  "state.currentUser=null; state.userProfile=null\n  localStorage.removeItem('hs_pro')",
  "state.currentUser=null; state.userProfile=null; state.collection=[]\n  localStorage.removeItem('hs_pro')\n  if(window.renderCol) window.renderCol()",
  'Auth: clear collection on signout'
);
patch('src/auth.js',
  "if(event==='SIGNED_IN'){ closeAuth(); setTimeout(showSuccessCelebration,300) }",
  "if(event==='SIGNED_IN'){ closeAuth(); if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(showSuccessCelebration,300) }",
  'Auth: respect prefers-reduced-motion'
);

// COLLECTION FIXES
patch('src/collection.js',
  "  if (!item) {\n    // fallback: try matching by index (for legacy numeric IDs)\n    var asNum = parseInt(id)\n    if (!isNaN(asNum)) item = state.collection.find(function(c) { return Math.abs(Number(c.id) - asNum) < 1000 })\n  }\n  if (!item) { showToast('Car not found', 'error'); return }",
  "  if (!item) { showToast('Car not found — try refreshing', 'error'); return }",
  'Collection: remove dangerous fuzzy delete'
);
patch('src/collection.js',
  "  state.collection.unshift(item)\n  if (navigator.vibrate) navigator.vibrate(30)\n  renderCol()\n  if (state._sb && state.currentUser) {\n    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; } }catch(e){} })()\n  }\n  renderCol(); window.goPage('collection')",
  "  state.collection.unshift(item)\n  if (navigator.vibrate) navigator.vibrate(30)\n  if (state._sb && state.currentUser) {\n    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; localStorage.setItem('hs_col_hash','') } }catch(e){} })()\n  }\n  renderCol(); window.goPage('collection')",
  'Collection: remove duplicate renderCol on add'
);

// SCANNER FIXES
patch('src/scanner.js',
  "var _imgKey = state.img64.substring(50, 150)",
  "var _l=state.img64.length; var _imgKey=state.img64.substring(0,40)+state.img64.substring(Math.floor(_l/2)-20,Math.floor(_l/2)+20)+state.img64.substring(_l-40)",
  'Scanner: better cache key'
);
patch('src/scanner.js',
  "var _imgKey2 = state.img64.substring(50, 150)",
  "var _l2=state.img64.length; var _imgKey2=state.img64.substring(0,40)+state.img64.substring(Math.floor(_l2/2)-20,Math.floor(_l2/2)+20)+state.img64.substring(_l2-40)",
  'Scanner: better cache key on save'
);
patch('src/scanner.js',
  "function applyKnownPremiumOverrides(d) {\n  if (!d || !d.name) return d;\n  var n = d.name.toLowerCase();",
  "function applyKnownPremiumOverrides(d) {\n  if (!d || !d.name) return d;\n  d = Object.assign({}, d);\n  var n = d.name.toLowerCase();",
  'Scanner: no mutation in overrides'
);

// GROQ FIXES
patch('src/groq.js',
  "if (res.status === 400 || res.status === 404) {\n        var err = new Error(sm || 'Model not available'); err.modelError = true; throw err\n      }",
  "if (res.status === 404) {\n        var err = new Error(sm || 'Model not available'); err.modelError = true; throw err\n      }\n      if (res.status === 400) { throw new Error(sm || 'Bad request — try again') }",
  'Groq: only fallback on 404'
);

// CONFIG FIXES
patch('src/config.js',
  "export var VISION_FALLBACK = 'llama-3.2-11b-vision-instruct'",
  "export var VISION_FALLBACK = 'llama-3.2-90b-vision-preview'",
  'Config: better vision fallback model'
);

// MAIN FIXES
patch('src/main.js',
  "window.Sentry = Sentry\n",
  "window.Sentry = Sentry\nwindow.onerror = function(msg,src,line,col,err){ if(window.Sentry) window.Sentry.captureException(err||new Error(msg)); if(window.showToast&&msg&&!msg.includes('Script error')) window.showToast('Something went wrong — try refreshing','error',4000); return false }\nwindow.onunhandledrejection = function(e){ if(window.Sentry) window.Sentry.captureException(e.reason) }\n",
  'Main: global error boundary'
);
patch('src/main.js',
  "  if (window.state && window.state.currentUser && window.state._sb && !window._syncInFlight) {",
  "  if (document.hidden) return\n  if (window.state && window.state.currentUser && window.state._sb && !window._syncInFlight) {",
  'Main: skip sync when tab hidden'
);

// UTILS FIXES
patch('src/utils.js',
  "export function parseINR(v, fallback) { var n = parseFloat(cleanINR(v||String(fallback||0)).split('-')[0]); return isNaN(n) ? (fallback||0) : n }",
  "export function parseINR(v, fallback) { var n = parseFloat(cleanINR(v||String(fallback||0)).replace(/,/g,'').split('-')[0]); return isNaN(n) ? (fallback||0) : n }",
  'Utils: parseINR handles commas'
);

// UI FIXES
patch('src/ui.js',
  "export function saveToHist(d) {\n  state.scanHistory.unshift({id:Date.now(), name:d.name, series:d.series, rarity:d.rarity, india_collector_inr:d.india_collector_inr, image:state.imgThumb, scanned:new Date().toISOString()})\n  if (state.scanHistory.length > 50) state.scanHistory = state.scanHistory.slice(0, 50)\n  localStorage.setItem('hs_hist', JSON.stringify(state.scanHistory))\n}",
  "export function saveToHist(d) {\n  var entry = {id:Date.now(), name:d.name, series:d.series, rarity:d.rarity, india_collector_inr:d.india_collector_inr, scanned:new Date().toISOString()}\n  state.scanHistory.unshift(entry)\n  if (state.scanHistory.length > 50) state.scanHistory = state.scanHistory.slice(0, 50)\n  try { localStorage.setItem('hs_hist', JSON.stringify(state.scanHistory)) } catch(e) { try { localStorage.removeItem('hs_hist'); localStorage.setItem('hs_hist', JSON.stringify([entry])) } catch(e2) {} }\n}",
  'UI: saveToHist strips image, handles quota error'
);
patch('src/ui.js',
  "  if (state._sb) {\n    ;(async function() {\n      try {\n        await state._sb.from('scan_logs').insert({\n          user_id: state.currentUser ? state.currentUser.id : null,\n          scanned_at: new Date().toISOString(),\n        })\n      } catch(e) {}\n    })()\n  }",
  "  if (state._sb && state.currentUser) {\n    ;(async function() {\n      try {\n        await state._sb.from('scan_logs').insert({\n          user_id: state.currentUser.id,\n          scanned_at: new Date().toISOString(),\n        })\n      } catch(e) {}\n    })()\n  }",
  'UI: skip scan_logs insert for guests'
);

console.log('\n=== RESULTS ===');
fixes.forEach(function(f){ console.log(f) });
if(errors.length){ console.log('\n=== SKIPPED (already done or text differs) ==='); errors.forEach(function(e){ console.log(e) }) }
console.log('\nApplied:', fixes.length, '| Skipped:', errors.length);
