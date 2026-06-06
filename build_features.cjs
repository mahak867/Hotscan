const fs = require('fs');

// ══════════════════════════════════════════════════════════════
// FEATURE 1: Toast Queue — stack toasts instead of replacing
// ══════════════════════════════════════════════════════════════
let utils = fs.readFileSync('src/utils.js', 'utf8');
utils = utils.replace(
  `export function showToast(msg, type, duration){`,
  `var _toastQueue = []
var _toastRunning = false
function _runToastQueue() {
  if (_toastRunning || !_toastQueue.length) return
  _toastRunning = true
  var item = _toastQueue.shift()
  var el = document.getElementById('hs-toast')
  if (!el) { _toastRunning = false; _runToastQueue(); return }
  el.textContent = item.msg
  el.className = 'toast-show toast-' + (item.type || 'info')
  el.style.display = 'block'
  setTimeout(function() {
    el.style.display = 'none'
    _toastRunning = false
    _runToastQueue()
  }, item.duration || 2800)
}
export function showToast(msg, type, duration){`
);
utils = utils.replace(
  `  var el=document.getElementById('hs-toast'); if(!el) return
  el.textContent=msg; el.className='toast-show toast-'+(type||'info')
  el.style.display='block'
  clearTimeout(el._t); el._t=setTimeout(function(){el.style.display='none'},duration||2800)
}`,
  `  _toastQueue.push({msg, type, duration})
  _runToastQueue()
}`
);
fs.writeFileSync('src/utils.js', utils, 'utf8');
console.log('Feature 1 toast queue:', utils.includes('_toastQueue') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 2: Collection value history sparkline
// ══════════════════════════════════════════════════════════════
let col = fs.readFileSync('src/collection.js', 'utf8');
// Snapshot value when car is added
col = col.replace(
  `  state.collection.unshift(item)\n  if (navigator.vibrate) navigator.vibrate(30)`,
  `  state.collection.unshift(item)\n  if (navigator.vibrate) navigator.vibrate(30)\n  // Snapshot collection value for history chart\n  try {\n    var _vh = JSON.parse(localStorage.getItem('hs_val_hist') || '[]')\n    var _tv = 0; state.collection.forEach(function(c){ _tv += parseINR(c.india_collector_inr) })\n    _vh.push({ts: Date.now(), val: _tv})\n    if (_vh.length > 90) _vh = _vh.slice(-90)\n    localStorage.setItem('hs_val_hist', JSON.stringify(_vh))\n  } catch(e) {}`
);
// Fix sparkline to use value history instead of car counts
col = col.replace(
  `  // #7 — micro sparkline: last 6 months of car additions\n  var sparkEl = document.getElementById('val-sparkline')\n  if (sparkEl) {\n    var now = new Date()\n    var months = []\n    for (var mi = 5; mi >= 0; mi--) {\n      var d = new Date(now.getFullYear(), now.getMonth() - mi, 1)\n      months.push({label: d.toLocaleString('default', {month:'short'}), count: 0})\n    }\n    state.collection.forEach(function(c) {\n      if (!c.added) return\n      var added = new Date(c.added)\n      for (var i = 0; i < 6; i++) {\n        var ref = new Date(now.getFullYear(), now.getMonth() - (5-i), 1)\n        if (added.getMonth() === ref.getMonth() && added.getFullYear() === ref.getFullYear()) {\n          months[i].count++; break\n        }\n      }\n    })\n    var maxCount = Math.max.apply(null, months.map(function(m){return m.count})) || 1\n    sparkEl.innerHTML = ''\n    months.forEach(function(m, idx) {\n      var h = Math.max(Math.round((m.count / maxCount) * 28), m.count > 0 ? 4 : 2)\n      var col = document.createElement('div'); col.className = 'val-spark-col'\n      var bar = document.createElement('div'); bar.className = 'val-spark-bar' + (idx === 5 ? ' now' : '')\n      bar.style.height = h + 'px'\n      var lbl = document.createElement('div'); lbl.className = 'val-spark-lbl'; lbl.textContent = m.label\n      col.appendChild(bar); col.appendChild(lbl)\n      sparkEl.appendChild(col)\n    })\n  }`,
  `  // Sparkline: show value history over last 6 months
  var sparkEl = document.getElementById('val-sparkline')
  if (sparkEl) {
    var _vh = []
    try { _vh = JSON.parse(localStorage.getItem('hs_val_hist') || '[]') } catch(e) {}
    var now = new Date()
    var months = []
    for (var mi = 5; mi >= 0; mi--) {
      var md = new Date(now.getFullYear(), now.getMonth() - mi, 1)
      months.push({label: md.toLocaleString('default', {month:'short'}), val: 0})
    }
    // Use latest snapshot per month
    _vh.forEach(function(snap) {
      var sd = new Date(snap.ts)
      for (var i = 0; i < 6; i++) {
        var ref = new Date(now.getFullYear(), now.getMonth() - (5-i), 1)
        if (sd.getMonth() === ref.getMonth() && sd.getFullYear() === ref.getFullYear()) {
          months[i].val = Math.max(months[i].val, snap.val)
        }
      }
    })
    // Fill empty months with current value
    var currentVal = 0; state.collection.forEach(function(c){ currentVal += parseINR(c.india_collector_inr) })
    months.forEach(function(m) { if (!m.val && currentVal) m.val = currentVal })
    var maxVal = Math.max.apply(null, months.map(function(m){return m.val})) || 1
    sparkEl.innerHTML = ''
    months.forEach(function(m, idx) {
      var h = Math.max(Math.round((m.val / maxVal) * 28), m.val > 0 ? 4 : 2)
      var sc = document.createElement('div'); sc.className = 'val-spark-col'
      var bar = document.createElement('div'); bar.className = 'val-spark-bar' + (idx === 5 ? ' now' : '')
      bar.style.height = h + 'px'
      bar.title = m.label + ': \u20b9' + Math.round(m.val).toLocaleString('en-IN')
      var lbl = document.createElement('div'); lbl.className = 'val-spark-lbl'; lbl.textContent = m.label
      sc.appendChild(bar); sc.appendChild(lbl)
      sparkEl.appendChild(sc)
    })
  }`
);
fs.writeFileSync('src/collection.js', col, 'utf8');
console.log('Feature 2 value history sparkline:', col.includes('hs_val_hist') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 3: Duplicate car — ask to add another copy
// ══════════════════════════════════════════════════════════════
col = fs.readFileSync('src/collection.js', 'utf8');
col = col.replace(
  `  var isDupe = state.collection.some(function(x){ return x.name && item.name && x.name.toLowerCase()===item.name.toLowerCase() && x.color===item.color })\n  if (isDupe) { showToast(item.name + \" is already in your collection!\", \"error\"); return }`,
  `  var isDupe = state.collection.some(function(x){ return x.name && item.name && x.name.toLowerCase()===item.name.toLowerCase() && x.color===item.color })
  if (isDupe) {
    hsConfirm('Already in Collection', item.name + ' is already in your collection. Add another copy?', 'Add Copy', '➕').then(function(ok) {
      if (ok) _doAddToCol(item)
    })
    return
  }
  _doAddToCol(item)
}
function _doAddToCol(item) {`
);
// Need to close the addToCol function and wrap rest
col = col.replace(
  `  _doAddToCol(item)
}
function _doAddToCol(item) {  state.collection.unshift(item)`,
  `  _doAddToCol(item)
}
function _doAddToCol(item) {
  state.collection.unshift(item)`
);
fs.writeFileSync('src/collection.js', col, 'utf8');
console.log('Feature 3 duplicate confirm:', col.includes('Add another copy') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 4: Pull to refresh on collection page
// ══════════════════════════════════════════════════════════════
let main = fs.readFileSync('src/main.js', 'utf8');
if (!main.includes('Pull to refresh')) {
  main = main.replace(
    `// window.load: app init`,
    `// Pull to refresh on collection page
;(function(){
  var startY = 0, pulling = false, refreshEl = null
  document.addEventListener('touchstart', function(e) {
    var pg = document.getElementById('page-collection')
    if (!pg || !pg.classList.contains('active')) return
    if (window.scrollY === 0 || (pg.scrollTop !== undefined && pg.scrollTop === 0)) {
      startY = e.touches[0].clientY; pulling = true
    }
  }, {passive: true})
  document.addEventListener('touchmove', function(e) {
    if (!pulling) return
    var dy = e.touches[0].clientY - startY
    if (dy > 20 && !refreshEl) {
      refreshEl = document.createElement('div')
      refreshEl.style.cssText = 'position:fixed;top:52px;left:0;right:0;text-align:center;padding:8px;font-size:12px;color:var(--text2);z-index:999;background:var(--bg)'
      refreshEl.textContent = dy > 60 ? '⬆️ Release to refresh' : '⬇️ Pull to refresh'
      document.body.appendChild(refreshEl)
    } else if (refreshEl) {
      refreshEl.textContent = dy > 60 ? '⬆️ Release to refresh' : '⬇️ Pull to refresh'
    }
  }, {passive: true})
  document.addEventListener('touchend', function(e) {
    var dy = e.changedTouches[0].clientY - startY
    if (refreshEl) { document.body.removeChild(refreshEl); refreshEl = null }
    if (pulling && dy > 60 && window.state && window.state.currentUser) {
      window.showToast('Refreshing...', 'info')
      window.fullCloudSync().then(function(ok) {
        if (ok) { window.renderCol(); window.showToast('Collection updated \u2705', 'success') }
      }).catch(function(){})
    }
    pulling = false
  }, {passive: true})
})()

// window.load: app init`
  );
}
fs.writeFileSync('src/main.js', main, 'utf8');
console.log('Feature 4 pull to refresh:', main.includes('Pull to refresh') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 5: pricedb.js used in searchPrices
// ══════════════════════════════════════════════════════════════
let sc = fs.readFileSync('src/scanner.js', 'utf8');
// Check if dbLookup is imported
if (!sc.includes('dbLookup')) {
  sc = sc.replace(
    `import { addCarToCollection } from './collection.js'`,
    `import { addCarToCollection } from './collection.js'\nimport { dbLookup } from './pricedb.js'`
  );
}
// Use dbLookup in searchPrices before calling AI
sc = sc.replace(
  `async function searchPrices(carName, rarity, castingYear) {\n  try {\n    var body = { carName, rarity, castingYear }\n    var url = state.KEY ? 'https://api.groq.com/openai/v1/chat/completions' : '/api/prices'`,
  `async function searchPrices(carName, rarity, castingYear) {
  // Check local price DB first — faster and more accurate for known castings
  try {
    var dbResult = dbLookup(carName)
    if (dbResult && dbResult.india_retail_inr) {
      return {
        india_retail_inr: dbResult.india_retail_inr,
        india_collector_inr: dbResult.india_collector_inr,
        us_retail_usd: dbResult.us_retail_usd,
        us_collector_usd: dbResult.us_collector_usd,
        price_trend: dbResult.trend || 'Stable',
        price_trend_reason: 'From HotScan verified price database',
        india_insight: 'Verified price from Indian collector data',
        data_quality: 'Verified'
      }
    }
  } catch(e) {}
  try {
    var body = { carName, rarity, castingYear }
    var url = state.KEY ? 'https://api.groq.com/openai/v1/chat/completions' : '/api/prices'`
);
fs.writeFileSync('src/scanner.js', sc, 'utf8');
console.log('Feature 5 pricedb in searchPrices:', sc.includes('dbLookup') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 6: Want List — add to wishlist from scan result
// ══════════════════════════════════════════════════════════════
let ui = fs.readFileSync('src/ui.js', 'utf8');
// Add addToWantList function
if (!ui.includes('addToWantList')) {
  ui = ui.replace(
    `export function addAlert(`,
    `export function addToWantList() {
  if (!state.lastResult) { showToast('Scan a car first', 'error'); return }
  try {
    var wl = JSON.parse(localStorage.getItem('hs_want') || '[]')
    var exists = wl.some(function(w){ return w.name === state.lastResult.name })
    if (exists) { showToast(state.lastResult.name + ' is already on your want list', 'error'); return }
    wl.unshift({
      id: Date.now(),
      name: state.lastResult.name,
      series: state.lastResult.series,
      rarity: state.lastResult.rarity,
      india_retail_inr: state.lastResult.india_retail_inr,
      image: state.imgThumb,
      added: new Date().toISOString()
    })
    localStorage.setItem('hs_want', JSON.stringify(wl))
    showToast('Added to want list \u2764\uFE0F', 'success')
    renderWantList()
  } catch(e) {}
}

export function removeFromWantList(id) {
  try {
    var wl = JSON.parse(localStorage.getItem('hs_want') || '[]')
    wl = wl.filter(function(w){ return w.id !== id })
    localStorage.setItem('hs_want', JSON.stringify(wl))
    renderWantList()
    showToast('Removed from want list', 'success')
  } catch(e) {}
}

export function renderWantList() {
  var el = document.getElementById('want-list')
  if (!el) return
  var wl = []
  try { wl = JSON.parse(localStorage.getItem('hs_want') || '[]') } catch(e) {}
  if (!wl.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text2);font-size:13px">No cars on your want list yet. Scan a car and tap \u2764\uFE0F Want!</div>'
    return
  }
  el.innerHTML = wl.map(function(w) {
    var thumb = w.image ? '<img src="' + w.image + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover">' : '<div style="width:40px;height:40px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px">\uD83D\uDE97</div>'
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">' +
      thumb +
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(w.name) + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">' + escHtml(w.rarity||'') + ' \u00B7 \u20B9' + cleanINR(w.india_retail_inr) + '</div></div>' +
      '<button onclick="removeFromWantList(' + w.id + ')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">\u{1F5D1}\uFE0F</button>' +
      '</div>'
  }).join('')
}

export function addAlert(`
  );
}
fs.writeFileSync('src/ui.js', ui, 'utf8');
console.log('Feature 6 want list:', ui.includes('addToWantList') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 7: Add ❤️ Want button to scan result
// ══════════════════════════════════════════════════════════════
let h = fs.readFileSync('index.html', 'utf8');
if (!h.includes('addToWantList')) {
  h = h.replace(
    `onclick="addToCol()" class="ract"`,
    `onclick="addToWantList()" class="ract" title="Add to want list">\u2764\uFE0F Want</button>\n          <button onclick="addToCol()" class="ract"`
  );
  // Add want list section to collection page
  h = h.replace(
    `<div id="col-list"`,
    `<div id="want-list" style="margin-bottom:16px"></div>\n  <div id="col-list"`
  );
}
fs.writeFileSync('index.html', h, 'utf8');
console.log('Feature 7 want button in HTML:', h.includes('addToWantList') ? 'OK' : 'FAILED');

// ══════════════════════════════════════════════════════════════
// FEATURE 8: Expose new functions to window
// ══════════════════════════════════════════════════════════════
main = fs.readFileSync('src/main.js', 'utf8');
main = main.replace(
  `import {\n  goPage, saveKey, showKeySetup, setMode, resetScan,`,
  `import { addToWantList, removeFromWantList, renderWantList } from './ui.js'\nimport {\n  goPage, saveKey, showKeySetup, setMode, resetScan,`
);
main = main.replace(
  `window.clearScanHistory = clearScanHistory`,
  `window.clearScanHistory = clearScanHistory\nwindow.addToWantList = addToWantList\nwindow.removeFromWantList = removeFromWantList\nwindow.renderWantList = renderWantList`
);
fs.writeFileSync('src/main.js', main, 'utf8');
console.log('Feature 8 want list on window:', main.includes('addToWantList') ? 'OK' : 'FAILED');

console.log('\n=== ALL FEATURES DONE ===');
