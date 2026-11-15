// Strip any accidental ₹ prefix that AI may include in price range strings (e.g. "₹8000-25000" → "8000-25000")
export function cleanINR(v) { return v ? String(v).replace(/^₹+/, '') : '' }
// Parse the lower bound of a price range stored in india_collector_inr, safely ignoring ₹ prefix
export function parseINR(v, fallback) { var n = parseFloat(cleanINR(v||String(fallback||0)).replace(/,/g,'').split('-')[0]); return isNaN(n) ? (fallback||0) : n }

// Display form of a stored price or range: "6000-9000" → "₹6,000–9,000".
export function fmtINR(v) {
  var c = cleanINR(v).replace(/,/g, '').trim()
  if (!c) return ''
  var parts = c.split(/\s*[-–]\s*/).map(function (x) { var n = Number(x); return isFinite(n) && x !== '' ? n.toLocaleString('en-IN') : x })
  return '₹' + parts.join('–')
}

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

// One toast at a time: a new message replaces the current one rather than
// queueing behind it, so feedback always matches the tap that caused it.
var _toastTimer = null
export function showToast(msg, type, duration) {
  type = type || 'info'
  var el = document.getElementById('hs-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'hs-toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  // Callers historically prefixed their own emoji; the coloured dot carries
  // the status now, so strip a leading one instead of showing both.
  el.textContent = String(msg == null ? '' : msg).replace(/^[\u2600-\u27BF\uFE0F\u{1F000}-\u{1FAFF}\s]+/u, '')
  el.className = 'toast toast-' + type
  void el.offsetWidth
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(function () { el.classList.remove('show') }, duration || 2800)
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
    var isDestructive = /delete|remove|clear|reset/i.test(okLabel || '')
    if (okBtn) okBtn.className = 'btn btn-block ' + (isDestructive ? 'btn-danger' : 'btn-primary')
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
  if (!result || !window.state) return []
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
        showToast('Achievement: ' + a.label.replace(/^\S+\s/, '') + '. ' + a.desc, 'success', 3200)
      }, i * 500)
    })
  }
  
  return earned
}

// Pro is a 30-day term recorded in profiles.pro_until (set server-side by the
// Razorpay webhook). is_pro alone no longer means Pro — a ₹99/month purchase
// used to grant access forever. Developers are always Pro.
export function isProActive(profile) {
  if (!profile) return false
  if (profile.is_developer) return true
  if (!profile.is_pro || !profile.pro_until) return false
  var until = Date.parse(profile.pro_until)
  return isFinite(until) && until > Date.now()
}
