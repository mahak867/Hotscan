// Strip any accidental ₹ prefix that AI may include in price range strings (e.g. "₹8000-25000" → "8000-25000")
export function cleanINR(v) { return v ? String(v).replace(/^₹+/, '') : '' }
// Parse the lower bound of a price range stored in india_collector_inr, safely ignoring ₹ prefix
export function parseINR(v, fallback) { var n = parseFloat(cleanINR(v||String(fallback||0)).replace(/,/g,'').split('-')[0]); return isNaN(n) ? (fallback||0) : n }

export function escHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
}

export function sanitize(str){
  if(!str) return ''
  return String(str).replace(/[<>"']/g, function(c){
    return {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  }).trim().substring(0, 500)
}

export function compress(dataUrl, maxSize) {
  maxSize = maxSize || 512
  return new Promise(function(resolve) {
    var img = new Image()
    img.onload = function() {
      try {
        var c = document.createElement('canvas')
        var w = img.width, h = img.height
        if (w > h) { if (w > maxSize) { h = Math.round(h*maxSize/w); w = maxSize } }
        else { if (h > maxSize) { w = Math.round(w*maxSize/h); h = maxSize } }
        c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.82))
      } catch(e) { resolve(dataUrl) }
    }
    img.onerror = function() { resolve(dataUrl) }
    img.src = dataUrl
  })
}

export function compressThumb(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image()
    img.onload = function() {
      try {
        var c = document.createElement('canvas'), s = Math.min(img.width, img.height)
        c.width = 120; c.height = 120
        c.getContext('2d').drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, 120, 120)
        resolve(c.toDataURL('image/jpeg', 0.7))
      } catch(e) { resolve(dataUrl) }
    }
    img.onerror = function() { resolve(dataUrl) }
    img.src = dataUrl
  })
}

var _toastQueue = []
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
export function showToast(msg, type, duration){
  type = type || 'info'; duration = duration || 2800
  var existing = document.getElementById('hs-toast')
  if(existing) existing.remove()
  // #20 — icon prefix per type
  var iconMap = {success:'✅ ', error:'❌ ', info:'ℹ️ '}
  var icon = iconMap[type] || ''
  var toast = document.createElement('div')
  toast.id = 'hs-toast'
  toast.className = 'hs-toast-' + type   // #20 — type-based left border via CSS
  toast.textContent = icon + msg
  toast.style.cssText = [
    'position:fixed','bottom:80px','left:50%','transform:translateX(-50%) translateY(20px)',
    'background:' + (type==='error' ? '#2a0a0a' : type==='success' ? '#0a1a0a' : '#0d0d1e'),
    'color:' + (type==='error' ? '#ff8080' : type==='success' ? '#80ff90' : '#c0d0ff'),
    'border:1px solid ' + (type==='error' ? 'rgba(255,80,80,.3)' : type==='success' ? 'rgba(80,255,90,.3)' : 'rgba(42,79,212,.3)'),
    'padding:10px 18px','border-radius:20px','font-size:13px','font-weight:600',
    'z-index:9000','max-width:80%','text-align:center',
    'box-shadow:0 4px 20px rgba(0,0,0,.5)',
    'transition:all .3s cubic-bezier(.4,0,.2,1)',
    'pointer-events:none','white-space:normal',
    'word-break:break-word',
    'max-width:88vw',
  ].join(';')
  document.body.appendChild(toast)
  requestAnimationFrame(function(){
    toast.style.transform = 'translateX(-50%) translateY(0)'
    toast.style.opacity = '1'
  })
  setTimeout(function(){
    toast.style.transform = 'translateX(-50%) translateY(20px)'
    toast.style.opacity = '0'
    setTimeout(function(){ if(toast.parentNode) toast.remove() }, 300)
  }, duration)
}

export function ol(url) { if (url && url !== '#') window.open(url, '_blank') }

export function rcls(r) {
  var rv = (r || '').toLowerCase()
  return rv.includes('super') ? 'rs' : rv.includes('treasure') ? 'rt' : rv.includes('error') ? 're' : rv.includes('rare') || rv.includes('vintage') || rv.includes('premium') ? 'rr' : rv.includes('uncommon') ? 'ru' : 'rc'
}

// Custom confirm — replaces browser confirm() with a styled modal
// Usage: await hsConfirm('Title', 'Message', 'Delete', '🗑️')
export function hsConfirm(title, message, okLabel, icon) {
  return new Promise(function(resolve, reject) {
    var overlay = document.getElementById('hs-confirm-overlay')
    var titleEl = document.getElementById('hs-confirm-title')
    var msgEl   = document.getElementById('hs-confirm-msg')
    var okBtn   = document.getElementById('hs-confirm-ok')
    var iconEl  = document.getElementById('hs-confirm-icon')
    if (!overlay) { resolve(window.confirm(message || title)); return }
    if (titleEl) titleEl.textContent = title || 'Are you sure?'
    if (msgEl)   msgEl.textContent   = message || ''
    if (okBtn)   okBtn.textContent   = okLabel || 'Confirm'
    if (iconEl)  iconEl.textContent  = icon || '⚠️'
    // Red for destructive, gold for neutral
    var isDestructive = (okLabel || '').toLowerCase().includes('delete') || (okLabel || '').toLowerCase().includes('remove') || (okLabel || '').toLowerCase().includes('clear')
    if (okBtn) okBtn.style.background = isDestructive ? '#e63946' : '#ffd60a'
    if (okBtn) okBtn.style.color = isDestructive ? '#fff' : '#000'
    overlay.style.display = 'flex'
    window._confirmResolve = function() { overlay.style.display = 'none'; resolve(true) }
    window._confirmReject  = function() { overlay.style.display = 'none'; resolve(false) }
  })
}

// Styled number-input dialog, same pattern as hsConfirm above. Returns the
// entered number, or null if cancelled / left blank / non-numeric.
// Used by markListingSold() to capture the real final sale price.
export function hsPromptPrice(title, message) {
  return new Promise(function(resolve) {
    var overlay = document.getElementById('hs-prompt-overlay')
    var titleEl = document.getElementById('hs-prompt-title')
    var msgEl   = document.getElementById('hs-prompt-msg')
    var input   = document.getElementById('hs-prompt-input')
    if (!overlay) { var v = window.prompt(message || title); resolve(v ? parseInt(v) : null); return }
    if (titleEl) titleEl.textContent = title || 'Enter an amount'
    if (msgEl)   msgEl.textContent   = message || ''
    if (input)   input.value = ''
    overlay.style.display = 'flex'
    setTimeout(function() { if (input) input.focus() }, 50)
    window._promptResolve = function() {
      var val = input ? parseInt(input.value) : NaN
      overlay.style.display = 'none'
      resolve(isNaN(val) || val <= 0 ? null : val)
    }
    window._promptReject = function() { overlay.style.display = 'none'; resolve(null) }
  })
}

// Safe Sentry wrapper — works even if Sentry hasn't loaded yet
// Import this instead of Sentry directly in any module
export function captureException(e) {
  try {
    if (window.Sentry && window.Sentry.captureException) {
      window.Sentry.captureException(e)
    }
  } catch(_) {}
}

// Achievement tracking system
export function checkAndEarnAchievements(result) {
  if (!result || !window.state) return
  var earned = []
  var ach = window.state.achievements || []
  
  // First Scan
  if (ach.indexOf('first_scan') === -1) {
    ach.push('first_scan')
    earned.push({id: 'first_scan', label: '🔍 First Scan', desc: 'Scanned your first car'})
  }
  
  // 10 Cars
  if (window.state.collection.length >= 10 && ach.indexOf('10_cars') === -1) {
    ach.push('10_cars')
    earned.push({id: '10_cars', label: '🏎️ Collection Starter', desc: 'Collected 10 cars'})
  }
  
  // 50 Cars
  if (window.state.collection.length >= 50 && ach.indexOf('50_cars') === -1) {
    ach.push('50_cars')
    earned.push({id: '50_cars', label: '🏁 Serious Collector', desc: 'Collected 50 cars'})
  }
  
  // Treasure Hunt
  if (result.rarity && result.rarity.toLowerCase().includes('treasure') && ach.indexOf('found_th') === -1) {
    ach.push('found_th')
    earned.push({id: 'found_th', label: '🔥 Treasure Hunter', desc: 'Found a Treasure Hunt'})
  }
  
  // Super Treasure Hunt
  if (result.rarity && result.rarity.toLowerCase().includes('super treasure') && ach.indexOf('found_sth') === -1) {
    ach.push('found_sth')
    earned.push({id: 'found_sth', label: '⭐ Super Find', desc: 'Found a Super Treasure Hunt'})
  }
  
  // High Value Find (₹5000+)
  var val = parseINR(result.india_collector_inr || '0')
  if (val >= 5000 && ach.indexOf('high_value') === -1) {
    ach.push('high_value')
    earned.push({id: 'high_value', label: '💎 High Roller', desc: 'Found a car worth ₹5000+'})
  }
  
  // Save achievements
  window.state.achievements = ach
  localStorage.setItem('hs_ach', JSON.stringify(ach))
  
  // Show notifications for newly earned achievements
  if (earned.length > 0) {
    earned.forEach(function(a, i) {
      setTimeout(function() {
        showToast('🏆 ' + a.label + ' — ' + a.desc, 'success', 3000)
      }, i * 500)
    })
  }
  
  return earned
}
