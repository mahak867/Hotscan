import { state } from './state.js'
import { FREE_SCANS, WA_COMMUNITY, WA_SUPPORT, HUNT_DATA } from './config.js'
import { escHtml, cleanINR, parseINR, compress, compressThumb, showToast, rcls, ol, sanitize, hsConfirm, captureException } from './utils.js'
import { renderCol, addCarToCollection, fullCloudSync } from './collection.js'

// ── Pro helpers ──
export function getTodayScans() {
  var t = new Date().toDateString()
  var d = JSON.parse(localStorage.getItem('hs_scans') || '{}')
  return d.date === t ? (d.count || 0) : 0
}

// Server-side scan count — called after auth ready, overrides localStorage if higher
// Prevents localStorage clear bypass
export async function syncScanCountFromServer() {
  if (!state._sb || !state.currentUser || isPro()) return
  try {
    var today = new Date()
    var startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    var res = await state._sb.from('scan_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', state.currentUser.id)
      .gte('scanned_at', startOfDay)
    var serverCount = res.count || 0
    var localCount = getTodayScans()
    // Use whichever is higher — can't go backwards
    if (serverCount > localCount) {
      var t = new Date().toDateString()
      localStorage.setItem('hs_scans', JSON.stringify({ date: t, count: serverCount }))
      updateScanCounter()
    }
  } catch(e) { /* silent — localStorage remains source of truth if server unavailable */ }
}
export function incScans() {
  var t = new Date().toDateString()
  var d = JSON.parse(localStorage.getItem('hs_scans') || '{}')
  var c = (d.date === t ? (d.count || 0) : 0) + 1
  localStorage.setItem('hs_scans', JSON.stringify({date:t, count:c}))
  // Log to Supabase scan_logs so landing page counter is real
  if (state._sb) {
    state._sb.from('scan_logs').insert({
      user_id: state.currentUser ? state.currentUser.id : null,
      scanned_at: new Date().toISOString(),
    }).catch(function() {}) // silent fail — never block the scan
  }
  return c
}
export function isPro() {
  // Always trust server-verified profile first
  if (state.userProfile && (state.userProfile.is_pro || state.userProfile.is_developer)) return true
  // localStorage is only a cache — only valid if user is logged in
  // (prevents localStorage.setItem('hs_pro','true') exploit when not logged in)
  if (!state.currentUser) return false
  return localStorage.getItem('hs_pro') === 'true'
}
export function checkLimit() {
  if (isPro()) return true
  if (getTodayScans() >= FREE_SCANS) { showProModal(); return false }
  return true
}
export function showProModal() {
  document.getElementById('pro-modal').classList.add('open')
  document.body.style.overflow = 'hidden'
}
export function closeProModal() {
  document.getElementById('pro-modal').classList.remove('open')
  document.body.style.overflow = ''
}
export function updateScanCounter() {
  var pb = document.getElementById('prof-scans-bar')
  if (pb && state.currentUser) {
    var used = getTodayScans()
    pb.style.width = isPro() ? '100%' : Math.min(used/FREE_SCANS*100,100)+'%'
    pb.style.background = isPro() ? 'var(--green)' : 'linear-gradient(90deg,var(--red),var(--gold))'
  }
}

// ── Navigation ──
var _pageOrder = {scan:0,collection:1,marketplace:2,market:3,profile:4,more:5,alerts:6,hunt:7}
var _prevPageId = 'scan'
export function goPage(id){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active','slide-from-right','slide-from-left') })
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active') })
  var pg = document.getElementById('page-'+id)
  if(pg){
    // #21 — directional slide
    var prevIdx = _pageOrder[_prevPageId] !== undefined ? _pageOrder[_prevPageId] : 0
    var newIdx  = _pageOrder[id]          !== undefined ? _pageOrder[id]          : 0
    pg.classList.add('active', newIdx >= prevIdx ? 'slide-from-right' : 'slide-from-left')
    pg.addEventListener('animationend', function(){ pg.classList.remove('slide-from-right','slide-from-left') }, {once:true})
    _prevPageId = id
  }
  var ni = document.getElementById('nav-'+id)
  if(ni){
    ni.classList.add('active')
    var svg = ni.querySelector('svg')
    if(svg){
      svg.style.transform = 'scale(1.3)'
      setTimeout(function(){ svg.style.transform = '' }, 180)
    }
    var dock = document.querySelector('.nav-dock')
    if(dock) dock.blur()
  }
  if(id === 'profile') renderProfilePage()
  if(id === 'marketplace') window.loadAndRenderListings()
  window.scrollTo({top:0, behavior:'smooth'})
}

// ── Key ──
export function saveKey() {
  var v = document.getElementById('gkey').value.trim()
  if (!v) { showToast('Enter your Groq key', 'error'); return }
  state.KEY = v; localStorage.setItem('hs_key', v)
  document.getElementById('key-card').style.display = 'none'
}
export function showKeySetup() {
  goPage('scan')
  document.getElementById('key-card').style.display = 'block'
  document.getElementById('gkey').value = state.KEY
  document.getElementById('key-card').scrollIntoView({behavior:'smooth'})
}

// ── Mode ──
export function setMode(mode) {
  state.currentMode = mode
  ;['photo','barcode','deal','fake'].forEach(function(m) {
    document.getElementById('mode-' + m).style.display = m === mode ? 'block' : 'none'
    document.getElementById('tab-' + m).classList.toggle('active', m === mode)
  })
  document.getElementById('analyze-btn').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  document.getElementById('err-box').style.display = 'none'
  if (mode === 'deal') {
    document.getElementById('analyze-btn').style.display = 'block'
    document.getElementById('analyze-btn').textContent = '💰 Check This Deal'
  }
}

// ── Image ──
export function openCam() { var f=document.getElementById('fc'); f.value=''; f.click() }
export function openGal() { var f=document.getElementById('fg'); f.value=''; f.click() }
export function openFakeCam() { var f=document.getElementById('fc-fake'); f.value=''; f.click() }
export function openFakeGal() { var f=document.getElementById('fg-fake'); f.value=''; f.click() }
export function openMulti() {
  var f = document.getElementById('fg-multi'); f.value = ''; f.click()
}

export async function handleFile(file, mode) {
  if (!file) return
  try {
    var raw = await new Promise(function(resolve, reject) {
      var rd = new FileReader()
      rd.onload = function(e) { resolve(e.target.result) }
      rd.onerror = function() { reject(new Error('Failed to read file')) }
      rd.readAsDataURL(file)
    })
    if (mode === 'fake') {
      document.getElementById('fake-preview-img').src = raw
      document.getElementById('fake-preview-wrap').style.display = 'block'
      document.getElementById('fake-scan-ph').style.display = 'none'
      state.fakeImg64 = await compress(raw, 512)
      document.getElementById('analyze-btn').style.display = 'block'
      document.getElementById('analyze-btn').classList.add('sticky-btn')
      document.getElementById('analyze-btn').textContent = '🕵️ Check If Fake'
    } else {
      document.getElementById('preview-img').src = raw
      document.getElementById('preview-wrap').style.display = 'block'
      document.getElementById('scan-ph').style.display = 'none'
      document.getElementById('scan-area').classList.add('has-img')
      state.img64 = await compress(raw, 512)
      state.imgThumb = await compressThumb(raw)
      document.getElementById('analyze-btn').style.display = 'block'
      document.getElementById('analyze-btn').classList.add('sticky-btn')
      document.getElementById('analyze-btn').textContent = '🔎 Identify & Get Live Prices'
    }
    document.getElementById('result').style.display = 'none'
    document.getElementById('deal-result').style.display = 'none'
    document.getElementById('err-box').style.display = 'none'
  } catch(err) {
    document.getElementById('err-box').textContent = '⚠️ Could not load image. Try again.'
    document.getElementById('err-box').style.display = 'block'
  }
}

export async function handleMultiFiles(files) {
  if (!files || !files.length) return
  state.multiImages = []
  document.getElementById('multi-thumbs').innerHTML = ''
  document.getElementById('multi-preview').style.display = 'block'
  document.getElementById('preview-wrap').style.display = 'none'
  document.getElementById('scan-ph').style.display = 'none'
  document.getElementById('scan-area').classList.add('has-img')

  for (var i = 0; i < Math.min(files.length, 5); i++) {
    var file = files[i]
    var raw = await new Promise(function(resolve) {
      var rd = new FileReader(); rd.onload = function(e){resolve(e.target.result)}; rd.readAsDataURL(file)
    })
    var compressed = await compress(raw, 512)
    var thumb = await compressThumb(raw)
    state.multiImages.push({img64: compressed, thumb: thumb})
    var thumbEl = document.createElement('div')
    thumbEl.style.cssText = 'width:60px;height:60px;border-radius:8px;overflow:hidden;border:2px solid var(--border2);position:relative'
    var img = document.createElement('img'); img.src = thumb; img.style.cssText = 'width:100%;height:100%;object-fit:cover'
    thumbEl.appendChild(img)
    document.getElementById('multi-thumbs').appendChild(thumbEl)
  }

  document.getElementById('multi-count').textContent = state.multiImages.length + ' image' + (state.multiImages.length===1?'':'s') + ' selected — AI will identify all cars'
  document.getElementById('analyze-btn').style.display = 'block'
  document.getElementById('analyze-btn').textContent = '🔎 Identify All Cars (' + state.multiImages.length + ' photos)'
  document.getElementById('result').style.display = 'none'
  document.getElementById('err-box').style.display = 'none'

  state.img64 = state.multiImages[0].img64
  state.imgThumb = state.multiImages[0].thumb
}

// ── Timer/pipeline ──
export function startTimer(lbl) {
  state.timerSec = 0
  document.getElementById('timer-wrap').style.display = 'block'
  document.getElementById('timer-lbl').textContent = lbl
  document.getElementById('timer-cnt').textContent = '0s'
  var fill = document.getElementById('timer-fill')
  fill.style.width = '0%'
  fill.classList.remove('timer-stuck')
  state.timerInt = setInterval(function() {
    state.timerSec++
    document.getElementById('timer-cnt').textContent = state.timerSec + 's'
    fill.style.width = Math.min(state.timerSec/20*100, 95) + '%'
    // #6 — pulse fill when scan takes >10 s to reassure user
    if (state.timerSec === 10) fill.classList.add('timer-stuck')
  }, 1000)
}
export function stopTimer() {
  clearInterval(state.timerInt)
  var fill = document.getElementById('timer-fill')
  fill.classList.remove('timer-stuck')
  fill.style.width = '100%'
  setTimeout(function() { document.getElementById('timer-wrap').style.display = 'none' }, 600)
}
export function setStep(n, s) {
  var el = document.getElementById('ps' + n)
  if (!el) return
  // also update the parent pip-step for #5 done-highlight
  var stepEl = el.closest ? el.closest('.pip-step') : el.parentElement
  el.className = 'pip-st'
  if (stepEl) stepEl.classList.remove('step-done')
  if (s === 'active') { el.classList.add('active'); el.textContent = 'Running...' }
  else if (s === 'done') {
    el.classList.add('done'); el.textContent = '✓'
    if (stepEl) stepEl.classList.add('step-done')
  }
  else if (s === 'err') { el.classList.add('err'); el.textContent = 'Failed' }
  else el.textContent = 'Waiting'
}
export function resetSteps() {
  [1,2,3].forEach(function(n) {
    setStep(n, 'wait')
    var el = document.getElementById('ps' + n)
    if (el) { var sp = el.closest ? el.closest('.pip-step') : el.parentElement; if(sp) sp.classList.remove('step-done') }
  })
}
export function runAnalyze() {
  if (state.currentMode === 'photo') {
    if (state.multiImages.length > 1) window.analyzeMultiPhoto()
    else window.analyzePhoto()
  }
  else if (state.currentMode === 'deal') window.analyzeDeal()
  else if (state.currentMode === 'fake') window.analyzeFake()
}

// ── Results ──
export function showResult(d) {
  if (state.imgThumb) document.getElementById('r-thumb').innerHTML = '<img src="' + state.imgThumb + '" alt="">'
  document.getElementById('r-name').textContent = d.name || 'Unknown'
  document.getElementById('r-series').textContent = d.series || ''
  // #1 — color-coded confidence bar: red <50%, gold 50-79%, green ≥80%
  var conf = d.confidence || 75
  var confFill = document.getElementById('r-conf')
  confFill.style.width = conf + '%'
  confFill.style.background = conf >= 80 ? 'var(--green)' : conf >= 50 ? 'var(--gold)' : 'var(--red)'
  var rarIcons = {'Super Treasure Hunt':'⭐','Treasure Hunt':'🔥','Error Car':'⚡','Vintage':'🏆','Premium':'💎','Rare':'💫','Uncommon':'🔶'}
  var rb = document.getElementById('r-rar')
  var rarLabel = d.rarity || 'Common'
  rb.textContent = (rarIcons[rarLabel] ? rarIcons[rarLabel] + ' ' : '') + rarLabel; rb.className = 'rar ' + rcls(d.rarity)
  var ab = document.getElementById('r-auth')
  if (d.is_authentic !== undefined) {
    ab.style.display = 'inline-flex'
    ab.className = 'auth-badge ' + (d.is_authentic ? 'auth-y' : 'auth-n')
    ab.textContent = d.is_authentic ? '✓ Authentic' : '⚠️ Possibly Fake'
  } else ab.style.display = 'none'
  document.getElementById('p1').textContent = d.india_retail_inr ? '₹' + d.india_retail_inr : '—'
  document.getElementById('p2').textContent = d.india_collector_inr ? '₹' + cleanINR(d.india_collector_inr) : '—'
  document.getElementById('p3').textContent = d.us_retail_usd ? '$' + d.us_retail_usd : '—'
  document.getElementById('p4').textContent = d.us_collector_usd ? '$' + d.us_collector_usd : '—'
  document.getElementById('live-upd').textContent = 'Updated just now'
  // #4 — pop animation on price tiles
  document.querySelectorAll('.ptile').forEach(function(tile, i) {
    tile.classList.remove('pop')
    setTimeout(function(){ tile.classList.add('pop') }, i * 60)
    tile.addEventListener('animationend', function(){ tile.classList.remove('pop') }, {once:true})
  })
  var trend = d.price_trend || 'Stable'
  if (trend !== 'Rising' && trend !== 'Falling' && trend !== 'Stable') trend = 'Stable'
  document.getElementById('trend-ic').textContent = trend === 'Rising' ? '📈' : trend === 'Falling' ? '📉' : '➡️'
  document.getElementById('trend-txt').innerHTML = '<span class="' + (trend==='Rising'?'tup':trend==='Falling'?'tdn':'tst') + '">' + escHtml(trend) + '</span>' + (d.price_trend_reason ? ' — ' + escHtml(d.price_trend_reason) : '')
  var ib = document.getElementById('r-inv')
  ib.textContent = (d.investment || 'Medium') + ' Potential'; ib.className = 'inv-badge'
  var iv = (d.investment || '').toLowerCase()
  ib.classList.add(iv.includes('very') ? 'iv' : iv === 'high' ? 'ih' : iv === 'medium' ? 'im' : 'il')
  // #16 — investment badge tooltip
  var tipMap = {
    'very high': 'Rare — significant value increase expected',
    'high': 'Strong price growth likely over time',
    'medium': 'Moderate appreciation expected',
    'low': 'Stable value — collect for fun'
  }
  ib.setAttribute('data-tip', tipMap[iv] || 'AI-estimated investment potential')
  var rows = [['Color',d.color],['Casting Year',d.casting_year],['Tampo',d.tampo],['Wheels',d.wheel_type],['Condition',d.condition],['Rarity Reason',d.rarity_reason],['Why Invest',d.investment_reason],['Fun Fact',d.fun_fact]]
  if (d.barcode_note) rows.push(['Barcode Info', d.barcode_note])
  if (d.also_look_for) rows.push(['Also Look For', d.also_look_for])
  document.getElementById('r-dets').innerHTML = rows.filter(function(r) { return r[1] && r[1] !== 'undefined' }).map(function(r) {
    return '<div class="det"><span class="det-k">' + escHtml(String(r[0])) + '</span><span class="det-v">' + escHtml(String(r[1])) + '</span></div>'
  }).join('')
  if (d.india_insight) { document.getElementById('r-insight-txt').textContent = d.india_insight; document.getElementById('r-insight').style.display = 'block' }
  else document.getElementById('r-insight').style.display = 'none'
  if (d.name) {
    document.getElementById('price-submit').style.display = 'block'
    document.getElementById('deal-car-name').value = d.name
  }
  if (d.name) {
    var buyLinks = [
      {label:'🛒 Amazon India', url:'https://www.amazon.in/s?k=hot+wheels+' + encodeURIComponent(d.name)},
      {label:'🛒 Flipkart', url:'https://www.flipkart.com/search?q=hot+wheels+' + encodeURIComponent(d.name)},
      {label:'💸 OLX India', url:'https://www.olx.in/items/q-hot+wheels+' + encodeURIComponent(d.name)},
      {label:'📸 Instagram', url:'https://www.instagram.com/explore/tags/'+encodeURIComponent('hotwheelsindiasale')},
      {label:'🏪 Maido', url:'https://www.maido.in/search?q=' + encodeURIComponent(d.name)},
    ]
    var bl = document.getElementById('r-buy-list')
    bl.innerHTML = ''
    buyLinks.forEach(function(l) {
      var s = document.createElement('span')
      s.className = 'tag'
      s.style.cssText = 'cursor:pointer;color:var(--blue)'
      s.textContent = l.label + ' →'
      s.onclick = (function(u) { return function() { ol(u) } })(l.url)
      bl.appendChild(s)
    })
  }
  loadCommunityPrices(d.name)
  document.getElementById('result').style.display = 'block'
  document.getElementById('analyze-btn').style.display = 'none'
  setTimeout(function() { document.getElementById('result').scrollIntoView({behavior:'smooth', block:'start'}) }, 100)
}

export async function loadCommunityPrices(carName) {
  var section = document.getElementById('community-prices-section')
  var listEl = document.getElementById('community-prices-list')
  var list = []
  // Fetch real cross-user prices from Supabase
  if (state._sb && carName) {
    try {
      var res = await state._sb.from('community_prices')
        .select('price_inr, platform, user_name, created_at')
        .eq('car_name', carName)
        .order('created_at', { ascending: false })
        .limit(5)
      if (res.data && res.data.length) {
        list = res.data.map(function(r) {
          return { price: r.price_inr, platform: r.platform || 'India', user: r.user_name || 'Collector' }
        })
      }
    } catch(e) {}
  }
  // Fallback to local cache
  if (!list.length) {
    var local = JSON.parse(localStorage.getItem('hs_community_prices') || '{}')
    list = local[carName] || []
  }
  if (!list.length) { if(section) section.style.display = 'none'; return }
  if(section) section.style.display = 'block'
  if(listEl) {
    listEl.innerHTML = ''
    list.slice(0, 5).forEach(function(p) {
      var div = document.createElement('div')
      div.style.cssText = 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px'
      div.innerHTML = '<span style="color:var(--text2)">' + escHtml(String(p.platform||'India')) + ' · ' + escHtml(String(p.user||'Collector')) + '</span><span style="color:var(--gold);font-weight:700">₹' + p.price + '</span>'
      listEl.appendChild(div)
    })
  }
}

export async function submitPrice() {
  if (!state.lastResult) return
  var price = document.getElementById('community-price').value
  var platform = document.getElementById('community-platform').value
  if (!price) { showToast('Enter the price you paid', 'error'); return }
  var entry = {
    car: state.lastResult.name,
    price: parseInt(price),
    platform: platform,
    date: new Date().toISOString().split('T')[0],
    user: state.currentUser ? state.currentUser.email.split('@')[0] : 'Anonymous'
  }
  var prices = JSON.parse(localStorage.getItem('hs_community_prices') || '{}')
  if (!prices[state.lastResult.name]) prices[state.lastResult.name] = []
  prices[state.lastResult.name].unshift(entry)
  if (prices[state.lastResult.name].length > 20) prices[state.lastResult.name] = prices[state.lastResult.name].slice(0, 20)
  localStorage.setItem('hs_community_prices', JSON.stringify(prices))
  if (state._sb && state.currentUser) {
    try {
      await state._sb.from('community_prices').insert({
        car_name: state.lastResult.name,
        price_inr: parseInt(price),
        platform: platform,
        user_id: state.currentUser.id,
        user_name: entry.user
      })
    } catch(e) { captureException(e) }
  }
  document.getElementById('community-price').value = ''
  showToast('✅ Price submitted! Thank you for helping the community.', 'success')
  loadCommunityPrices(state.lastResult.name)
}

// ── Alerts ──
export function addAlert() {
  if(!state.lastResult){ showToast('Scan a car first to set a price alert', 'error'); return }
  if (state.alerts.find(function(a) { return a.name === state.lastResult.name })) { showToast('Alert already set for: ' + state.lastResult.name, 'error'); return }
  state.alerts.unshift({id:Date.now(), name:state.lastResult.name, rarity:state.lastResult.rarity, india_collector_inr:state.lastResult.india_collector_inr, added:new Date().toISOString()})
  localStorage.setItem('hs_alerts', JSON.stringify(state.alerts))
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission()
  }
  renderAlerts(); goPage('alerts')
}
export function delAlert(id) { state.alerts = state.alerts.filter(function(a){return a.id!==id}); localStorage.setItem('hs_alerts',JSON.stringify(state.alerts)); renderAlerts() }
export async function clearAlerts() {
  var ok = await hsConfirm('Clear All Alerts', 'Your price watchlist will be emptied.', 'Clear All', '🔔')
  if (!ok) return
  state.alerts = []
  localStorage.setItem('hs_alerts', '[]')
  renderAlerts()
}
export function renderAlerts() {
  if (!state.alerts.length) {
    document.getElementById('alerts-list').innerHTML = '<div class="empty"><div class="empty-icon">🔔</div><div class="empty-t">No alerts yet</div><div class="empty-s">Scan a car and tap "Alert" to watch for deals</div></div>'
    return
  }
  var al = document.getElementById('alerts-list'); al.innerHTML = ''
  state.alerts.forEach(function(a) {
    var div = document.createElement('div'); div.className = 'alert-item'
    var nm = document.createElement('div'); nm.className = 'alert-name'; nm.textContent = a.name
    var meta = document.createElement('div'); meta.style.cssText = 'font-size:11px;color:var(--text3);margin-bottom:5px'; meta.textContent = (a.rarity||'Common') + ' · Target: ₹' + (cleanINR(a.india_collector_inr)||'?')
    var links = document.createElement('div'); links.style.cssText = 'display:flex;gap:8px'
    var olxBtn = document.createElement('button'); olxBtn.className = 'alert-link'; olxBtn.textContent = 'OLX →'
    olxBtn.onclick = (function(n){return function(){ol('https://www.olx.in/items/q-hot+wheels+'+encodeURIComponent(n||''))}})(a.name)
    var igBtn = document.createElement('button'); igBtn.className = 'alert-link'; igBtn.textContent = 'Instagram →'
    igBtn.onclick = function(){ol('https://www.instagram.com/explore/tags/hotwheelsindiasale/')}
    var amzBtn = document.createElement('button'); amzBtn.className = 'alert-link'; amzBtn.textContent = 'Amazon →'
    amzBtn.onclick = (function(n){return function(){ol('https://www.amazon.in/s?k=hot+wheels+'+encodeURIComponent(n||''))}})(a.name)
    links.appendChild(olxBtn); links.appendChild(igBtn); links.appendChild(amzBtn)
    var delBtn = document.createElement('button'); delBtn.style.cssText = 'background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;margin-left:auto'
    delBtn.textContent = '✕'; delBtn.onclick = (function(id){return function(){delAlert(id)}})(a.id)
    var row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start'
    var info = document.createElement('div'); info.appendChild(nm); info.appendChild(meta); info.appendChild(links)
    row.appendChild(info); row.appendChild(delBtn)
    div.appendChild(row); al.appendChild(div)
  })
}

// ── History ──
export function saveToHist(d) {
  state.scanHistory.unshift({id:Date.now(), name:d.name, series:d.series, rarity:d.rarity, india_collector_inr:d.india_collector_inr, image:state.imgThumb, scanned:new Date().toISOString()})
  if (state.scanHistory.length > 50) state.scanHistory = state.scanHistory.slice(0, 50)
  localStorage.setItem('hs_hist', JSON.stringify(state.scanHistory))
}

// ── Share ──
export function showShare() {
  if (!state.lastResult) { showToast('Scan a car first to share', 'error'); return }
  var r = state.lastResult
  document.getElementById('sc-name').textContent   = r.name || '—'
  document.getElementById('sc-series').textContent = r.series || '—'
  var scr = document.getElementById('sc-rar')
  scr.textContent = r.rarity || 'Common'
  scr.className   = 'rar ' + rcls(r.rarity)
  var trend = r.price_trend || 'Stable'
  var trendArrow = trend === 'Rising' ? '📈' : trend === 'Falling' ? '📉' : '➡️'
  var invest = r.investment || 'Medium'
  document.getElementById('sc-inv').textContent = trendArrow + ' ' + trend + ' · ' + invest + ' Investment'
  document.getElementById('sc-inr').textContent = r.india_collector_inr ? '₹' + cleanINR(r.india_collector_inr) : '—'
  document.getElementById('sc-usd').textContent = r.us_collector_usd ? '$' + r.us_collector_usd : '—'
  var logoEl = document.getElementById('sc-logo-img')
  if (logoEl) logoEl.src = '/logo.png'
  var sci = document.getElementById('sc-img')
  sci.innerHTML = state.imgThumb
    ? '<img src="' + state.imgThumb + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">'
    : '<span style="font-size:36px">🚗</span>'
  document.getElementById('share-modal').classList.add('open')
  document.body.style.overflow = 'hidden'
}
export function closeShare() { document.getElementById('share-modal').classList.remove('open'); document.body.style.overflow = '' }

export function shareWA() {
  if (!state.lastResult) return
  var r = state.lastResult
  var trend = r.price_trend || 'Stable'
  var trendEmoji = trend === 'Rising' ? '📈' : trend === 'Falling' ? '📉' : '➡️'
  var txt = '🏎️ *' + r.name + '*\n'
    + '📦 ' + (r.series || '') + '\n'
    + '⭐ ' + (r.rarity || 'Common') + '\n'
    + '🇮🇳 India: ₹' + (cleanINR(r.india_collector_inr) || '?') + '\n'
    + '🇺🇸 US: $' + (r.us_collector_usd || '?') + '\n'
    + trendEmoji + ' Price Trend: ' + trend + ' · ' + (r.investment || 'Medium') + ' Investment\n'
    + (r.india_insight ? '💡 ' + r.india_insight + '\n' : '')
    + '\n_Scanned with HotScan India 🔍_\n_India\'s #1 Hot Wheels Scanner · hotscan.in_'
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank')
}

export function shareResultToGroup() {
  if (!state.lastResult) return
  var r = state.lastResult
  var trend = r.price_trend || 'Stable'
  var trendEmoji = trend === 'Rising' ? '📈' : trend === 'Falling' ? '📉' : '➡️'
  var lines = [
    '🏎️ Just scanned this with HotScan India!',
    '',
    '*' + r.name + '*',
    '📦 Series: ' + (r.series || '—'),
    '⭐ Rarity: ' + (r.rarity || 'Common'),
    '🇮🇳 India Price: ₹' + (cleanINR(r.india_collector_inr) || '?'),
    '🇺🇸 US Price: $' + (r.us_collector_usd || '?'),
    trendEmoji + ' Price Trend: ' + trend + ' · ' + (r.investment || 'Medium') + ' Investment',
  ]
  if (r.india_insight) lines.push('', '💡 ' + r.india_insight)
  lines.push('', '🔍 Try HotScan free: hotscan.in')
  window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank')
}

export async function copyShareText() {
  if (!state.lastResult) return
  var r = state.lastResult
  var trend = r.price_trend || 'Stable'
  var trendEmoji = trend === 'Rising' ? '📈' : trend === 'Falling' ? '📉' : '➡️'
  var txt = r.name + '\n'
    + (r.series || '') + ' · ' + (r.rarity || 'Common') + '\n'
    + '🇮🇳 India: ₹' + (cleanINR(r.india_collector_inr) || '?') + '\n'
    + trendEmoji + ' ' + trend + ' · ' + (r.investment || 'Medium') + ' Investment\n'
    + (r.india_insight ? r.india_insight + '\n' : '')
    + '\nScanned with HotScan India · hotscan.in'
  try {
    await navigator.clipboard.writeText(txt)
    showToast('Copied! Paste anywhere — WhatsApp, Instagram, OLX 📋', 'success')
  } catch(e) { showToast('Select and copy manually: ' + txt.substring(0, 40) + '…', 'error') }
}

export async function shareNative() {
  if (!state.lastResult) return
  var r = state.lastResult
  var trend = r.price_trend || 'Stable'
  var trendEmoji = trend === 'Rising' ? '📈' : trend === 'Falling' ? '📉' : '➡️'
  var txt = r.name + '\n' + (r.series || '') + '\n⭐ ' + (r.rarity || 'Common')
    + '\n🇮🇳 India: ₹' + (cleanINR(r.india_collector_inr) || '?')
    + '\n' + trendEmoji + ' ' + trend + ' · ' + (r.investment || 'Medium') + ' Investment'
    + '\n\nScanned with HotScan India 🔍\nhttps://hotscan.in'
  if (navigator.share) {
    try { await navigator.share({ title: 'HotScan — ' + r.name, text: txt }) } catch(e) {}
  } else {
    try { await navigator.clipboard.writeText(txt); showToast('Copied to clipboard!', 'success') } catch(e) {}
  }
}

export async function shareInstagram() {
  // Instagram doesn't support direct deep links with text — copy text + open Instagram
  await copyShareText()
  setTimeout(function() {
    showToast('Text copied! Opening Instagram — paste in your story/post 📸', 'success')
    window.open('instagram://app', '_blank')
    setTimeout(function() { window.open('https://www.instagram.com', '_blank') }, 800)
  }, 600)
}

export function shareApp() {
  var txt = '🏎️ India\'s first Hot Wheels scanner is here!\n\nScan any Hot Wheels car and instantly get:\n✅ Exact rarity — Common, TH, STH, Vintage\n✅ Indian market prices in ₹\n✅ Investment potential\n✅ Fake detector\n✅ Track your collection\n\nFree! No app download needed 🇮🇳\n\n👉 hotscan.in'
  if (navigator.share) {
    navigator.share({ title: 'HotScan India', text: txt }).catch(function() {
      window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank')
    })
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank')
  }
}

// ── Events ──
export function submitEvent() {
  var name = document.getElementById('event-name-inp').value.trim()
  var loc = document.getElementById('event-loc-inp').value.trim()
  var date = document.getElementById('event-date-inp').value
  if (!name || !loc || !date) { showToast('Fill in all event details', 'error'); return }
  // Save locally
  var events = JSON.parse(localStorage.getItem('hs_events') || '[]')
  events.unshift({ name: name, loc: loc, date: date, submitted: new Date().toISOString() })
  localStorage.setItem('hs_events', JSON.stringify(events))
  // Also try Supabase if available
  if (state._sb && state.currentUser) {
    state._sb.from('events').insert({ name: name, location: loc, date: date, submitted_by: state.currentUser.id }).catch(function(){})
  }
  // Email fallback always fires
  var body = 'Event: ' + name + '\nLocation: ' + loc + '\nDate: ' + date + '\nSubmitted by: ' + (state.currentUser ? state.currentUser.email : 'Guest')
  window.open('mailto:mahakfahad07@gmail.com?subject=HotScan+Event+Submission&body=' + encodeURIComponent(body), '_blank')
  document.getElementById('event-name-inp').value = ''
  document.getElementById('event-loc-inp').value = ''
  document.getElementById('event-date-inp').value = ''
  showToast('Event submitted! We\'ll review and list it ✅', 'success')
}

// ── Hunt ──
export function selectSeries(series, el) {
  state.currentSeries = series
  document.querySelectorAll('.hunt-series-item').forEach(function(i) { i.classList.remove('selected') })
  el.classList.add('selected')
  renderHunt(series)
}
export function toggleHunt(series, idx, checked) {
  var d = JSON.parse(localStorage.getItem('hs_hunt_'+series) || '{}')
  d[idx] = checked
  localStorage.setItem('hs_hunt_'+series, JSON.stringify(d))
  renderHunt(series)
}
export function renderHunt(series) {
  var data = HUNT_DATA[series] || []
  var checked = JSON.parse(localStorage.getItem('hs_hunt_'+series) || '{}')
  var hl = document.getElementById('hunt-list')
  hl.innerHTML = ''
  data.forEach(function(item, i) {
    var isChecked = checked[i] || false
    var prCls = item.priority.includes('MUST') || item.priority.includes('BIG') ? 'rs' : item.priority === 'HIGH' || item.priority === 'High' ? 'rt' : 'rc'
    var div = document.createElement('div'); div.className = 'hunt-item'
    if (isChecked) div.style.opacity = '0.5'
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = isChecked
    cb.onchange = (function(ser, idx) { return function() { toggleHunt(ser, idx, this.checked) } })(series, i)
    var nameDiv = document.createElement('div'); nameDiv.style.cssText = 'flex:1;min-width:0'
    var nm = document.createElement('div'); nm.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:3px'; nm.textContent = item.name
    var bottom = document.createElement('div'); bottom.style.cssText = 'display:flex;gap:6px;align-items:center'
    var rarSpan = document.createElement('span'); rarSpan.className = 'rar ' + prCls; rarSpan.style.cssText = 'font-size:10px;padding:2px 7px'; rarSpan.textContent = item.rarity
    var priceSpan = document.createElement('span'); priceSpan.style.cssText = 'font-size:12px;font-weight:700;color:var(--gold)'; priceSpan.textContent = '₹' + item.india
    bottom.appendChild(rarSpan); bottom.appendChild(priceSpan)
    nameDiv.appendChild(nm); nameDiv.appendChild(bottom)
    var pri = document.createElement('div'); pri.style.cssText = 'font-size:10px;text-align:right;color:var(--gold)'; pri.textContent = item.priority
    div.appendChild(cb); div.appendChild(nameDiv); div.appendChild(pri)
    hl.appendChild(div)
  })
}

// ── Profile ──
// #18 — helper: animate a number from 0 to target
function _animateCount(el, target, duration) {
  if (!el || target === 0) return
  var startTime = null
  function step(ts) {
    if (!startTime) startTime = ts
    var progress = Math.min((ts - startTime) / duration, 1)
    el.textContent = Math.round(progress * target)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function renderProfilePage() {
  var guest = document.getElementById('profile-guest')
  var user = document.getElementById('profile-user')
  if (!state.currentUser) { if(guest) guest.style.display='block'; if(user) user.style.display='none'; return }
  if(guest) guest.style.display='none'; if(user) user.style.display='block'
  var displayName = (state.userProfile && state.userProfile.username) || (state.userProfile && state.userProfile.display_name) || state.currentUser.name || state.currentUser.email.split('@')[0]
  // #17 — avatar: 2-char initials + gradient based on first char
  var initials = displayName.length >= 2 ? (displayName[0] + displayName[1]).toUpperCase() : displayName[0].toUpperCase()
  var _avatarGrads = [
    'linear-gradient(135deg,#e63946,#c1121f)',
    'linear-gradient(135deg,#2a4fd4,#1a2f8a)',
    'linear-gradient(135deg,#ffd60a,#cc9900)',
    'linear-gradient(135deg,#2dc653,#1a7a30)',
    'linear-gradient(135deg,#4cc9f0,#2a8ab0)',
  ]
  var avatarEl = document.getElementById('prof-avatar')
  if (avatarEl) {
    avatarEl.textContent = initials
    avatarEl.style.background = _avatarGrads[displayName.charCodeAt(0) % _avatarGrads.length]
    avatarEl.style.boxShadow = '0 4px 20px rgba(0,0,0,.4)'
  }
  document.getElementById('prof-name').textContent = displayName
  document.getElementById('prof-email').textContent = (state.userProfile && state.userProfile.username) ? '@' + state.userProfile.username + ' · ' + state.currentUser.email : state.currentUser.email
  var planEl = document.getElementById('prof-plan')
  var upEl = document.getElementById('prof-upgrade')
  var sinceEl = document.getElementById('prof-since')
  if (state.userProfile && state.userProfile.is_developer) {
    planEl.textContent = '👑 Developer — Lifetime Pro'; planEl.className = 'plan-badge plan-dev'
    upEl.style.display = 'none'; sinceEl.textContent = 'You built this app 🚗'
    // remove upgrade pill if exists
    var oldPill = document.getElementById('prof-upgrade-pill'); if(oldPill) oldPill.remove()
  } else if (state.userProfile && state.userProfile.is_pro) {
    planEl.textContent = '⭐ Pro Member'; planEl.className = 'plan-badge plan-pro'
    upEl.style.display = 'none'
    if (state.userProfile.pro_since) sinceEl.textContent = 'Pro since ' + new Date(state.userProfile.pro_since).toLocaleDateString('en-IN')
    var oldPill2 = document.getElementById('prof-upgrade-pill'); if(oldPill2) oldPill2.remove()
  } else {
    planEl.textContent = 'Free Plan'; planEl.className = 'plan-badge plan-free'
    upEl.style.display = 'block'
    // #19 — inline upgrade pill next to Free badge
    var existPill = document.getElementById('prof-upgrade-pill')
    if (!existPill) {
      var pill = document.createElement('button')
      pill.id = 'prof-upgrade-pill'
      pill.textContent = '⭐ Upgrade'
      pill.style.cssText = 'background:rgba(255,214,10,.15);border:1px solid rgba(255,214,10,.35);color:var(--gold);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;margin-left:6px;vertical-align:middle'
      pill.onclick = function(){ window.showProModal() }
      planEl.insertAdjacentElement('afterend', pill)
    }
  }
  var total = state.collection.length
  var rare = state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('rare')||r.includes('treasure')||r.includes('error')}).length
  var val = 0; state.collection.forEach(function(c){ val += parseINR(c.india_collector_inr) })
  var sthCount = state.collection.filter(function(c){return (c.rarity||'').toLowerCase().includes('super')}).length
  // #18 — animated number roll for stats
  var totalEl = document.getElementById('prof-total')
  var rareEl  = document.getElementById('prof-rare')
  if (totalEl) _animateCount(totalEl, total, 600)
  if (rareEl)  _animateCount(rareEl,  sthCount > 0 ? rare : rare, 600)
  if (sthCount > 0 && rareEl) { setTimeout(function(){ rareEl.textContent = rare + ' ('+sthCount+' STH)' }, 620) }
  document.getElementById('prof-value').textContent = val > 0 ? '₹' + val.toLocaleString('en-IN') : '₹0'
  var used = getTodayScans()
  document.getElementById('prof-scans-lbl').textContent = isPro() ? 'Unlimited scans (Pro)' : 'Scans used today'
  document.getElementById('prof-scans-val').textContent = isPro() ? '∞' : used + '/' + FREE_SCANS
  document.getElementById('prof-scans-bar').style.width = isPro() ? '100%' : Math.min(used/FREE_SCANS*100, 100) + '%'
  if (isPro()) document.getElementById('prof-scans-bar').style.background = 'var(--green)'
  var recentEl = document.getElementById('prof-recent')
  if (recentEl) {
    if (!state.scanHistory.length) {
      recentEl.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px 0">No scans yet — go scan a car!</div>'
    } else {
      recentEl.innerHTML = ''
      state.scanHistory.slice(0, 5).forEach(function(h) {
        var diff = Math.floor((Date.now() - new Date(h.scanned))/60000)
        var ago = diff<1?'just now':diff<60?diff+'m ago':diff<1440?Math.floor(diff/60)+'h ago':Math.floor(diff/1440)+'d ago'
        var row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)'
        var thumb = document.createElement('div'); thumb.style.cssText = 'width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px'
        if (h.image) { var img=document.createElement('img'); img.src=h.image; img.style.cssText='width:100%;height:100%;object-fit:cover'; thumb.appendChild(img) } else thumb.textContent='🚗'
        var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0'
        var nm = document.createElement('div'); nm.style.cssText = 'font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; nm.textContent = h.name||'Unknown'
        var mt = document.createElement('div'); mt.style.cssText = 'font-size:10px;color:var(--text3)'; mt.textContent = (h.rarity||'Common') + ' · ' + ago
        info.appendChild(nm); info.appendChild(mt)
        var price = document.createElement('div'); price.style.cssText = 'font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0'; price.textContent = h.india_collector_inr ? '₹'+cleanINR(h.india_collector_inr) : ''
        row.appendChild(thumb); row.appendChild(info); row.appendChild(price)
        recentEl.appendChild(row)
      })
    }
  }
  var phoneEl = document.getElementById('prof-wa-phone')
  if (phoneEl && state.userProfile && state.userProfile.whatsapp_phone) phoneEl.value = state.userProfile.whatsapp_phone
  var unEl = document.getElementById('prof-username')
  if (unEl) unEl.value = (state.userProfile && state.userProfile.username) ? state.userProfile.username : ''
  var olxEl = document.getElementById('prof-olx-username')
  var olxStatus = document.getElementById('prof-olx-status')
  if (olxEl) olxEl.value = (state.userProfile && state.userProfile.olx_username) ? state.userProfile.olx_username : ''
  if (olxStatus) {
    if (state.userProfile && state.userProfile.olx_username) {
      var u = state.userProfile.olx_username
      var profileUrl = 'https://www.olx.in/profile/' + encodeURIComponent(u)
      var searchUrl  = 'https://www.olx.in/items/q-hot+wheels+' + encodeURIComponent(u)
      olxStatus.innerHTML = '✅ Linked — <a href="' + escHtml(profileUrl) + '" target="_blank" style="color:#4cc9f0;text-decoration:none;font-weight:600">View OLX Profile →</a>'
        + ' &nbsp;<a href="' + escHtml(searchUrl) + '" target="_blank" style="color:#2dc653;text-decoration:none;font-size:12px">Your listings →</a>'
    } else {
      olxStatus.textContent = 'Link your OLX account to speed up selling — shows your profile in deal alerts'
    }
  }
}

export async function saveProfilePhone() {
  var phoneEl = document.getElementById('prof-wa-phone')
  if (!phoneEl) return
  var phone = phoneEl.value.trim().replace(/\D/g, '')
  if (!phone || phone.length !== 10) { showToast('Enter a valid 10-digit WhatsApp number', 'error'); return }
  if (!state.currentUser || !state._sb) { showToast('Sign in first', 'error'); return }
  try {
    await state._sb.from('profiles').update({whatsapp_phone: phone}).eq('id', state.currentUser.id)
    if (!state.userProfile) state.userProfile = {}
    state.userProfile.whatsapp_phone = phone
    try { localStorage.setItem('hs_profile_cache', JSON.stringify({data: state.userProfile, ts: Date.now()})) } catch(e) {}
    showToast('WhatsApp number saved ✅', 'success')
  } catch(e) { showToast('Could not save — try again', 'error') }
}

export async function saveProfileUsername() {
  var unEl = document.getElementById('prof-username')
  if (!unEl) return
  var username = unEl.value.trim()
  if (!username) { showToast('Enter a username', 'error'); return }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    showToast('Username: 3–30 characters, letters/numbers/underscores only', 'error'); return
  }
  if (!state.currentUser || !state._sb) { showToast('Sign in first', 'error'); return }
  try {
    var check = await state._sb.from('profiles').select('id').eq('username', username).neq('id', state.currentUser.id).single()
    if (check.data) { showToast('That username is already taken', 'error'); return }
    await state._sb.from('profiles').update({username: username, display_name: username}).eq('id', state.currentUser.id)
    if (!state.userProfile) state.userProfile = {}
    state.userProfile.username = username
    state.userProfile.display_name = username
    state.currentUser.name = username
    try { localStorage.setItem('hs_profile_cache', JSON.stringify({data: state.userProfile, ts: Date.now()})) } catch(e) {}
    window.updateHeaderUI()
    renderProfilePage()
    showToast('Username saved ✅', 'success')
  } catch(e) { showToast('Could not save username — try again', 'error') }
}

export function buildOLXProfileUrl(olxUsername) {
  if (!olxUsername) return 'https://www.olx.in'
  if (olxUsername.startsWith('http')) return olxUsername
  // Support both username and full URL formats
  var clean = olxUsername.replace('https://www.olx.in/profile/', '').replace('https://olx.in/profile/', '').trim()
  return 'https://www.olx.in/profile/' + encodeURIComponent(clean)
}

export async function saveOLXAccount() {
  var olxEl    = document.getElementById('prof-olx-username')
  var olxStatus = document.getElementById('prof-olx-status')
  if (!olxEl) return
  var raw = olxEl.value.trim()
  if (!raw) { showToast('Enter your OLX username or profile URL', 'error'); return }
  if (!state.currentUser || !state._sb) { showToast('Sign in first', 'error'); return }

  // Extract clean username from URL if pasted
  var username = raw
    .replace(/https?:\/\/(www\.)?olx\.in\/profile\//i, '')
    .replace(/\?.*$/, '')
    .trim()
    .replace(/^\/+|\/+$/g, '')

  if (!username) { showToast('Invalid OLX profile URL', 'error'); return }

  // Show verifying state
  if (olxStatus) olxStatus.innerHTML = '<span style="color:var(--gold)">⏳ Verifying OLX profile…</span>'

  try {
    await state._sb.from('profiles').update({ olx_username: username }).eq('id', state.currentUser.id)
    if (!state.userProfile) state.userProfile = {}
    state.userProfile.olx_username = username
    try { localStorage.setItem('hs_profile_cache', JSON.stringify({ data: state.userProfile, ts: Date.now() })) } catch(e) {}

    var profileUrl = buildOLXProfileUrl(username)
    var searchUrl  = 'https://www.olx.in/items/q-hot+wheels?search%5Buser_id%5D=' + encodeURIComponent(username)

    if (olxStatus) {
      olxStatus.innerHTML = '✅ OLX account linked!'
        + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'
        + '<a href="' + escHtml(profileUrl) + '" target="_blank" style="background:rgba(45,198,83,.12);border:1px solid rgba(45,198,83,.3);color:#2dc653;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;text-decoration:none">👤 View OLX Profile →</a>'
        + '<a href="' + escHtml(searchUrl) + '" target="_blank" style="background:rgba(76,201,240,.1);border:1px solid rgba(76,201,240,.2);color:#4cc9f0;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;text-decoration:none">🔍 Your Hot Wheels Listings →</a>'
        + '</div>'
        + '<div style="margin-top:10px;font-size:11px;color:var(--text3)">✨ Your OLX username will now auto-fill when creating sell listings</div>'
    }
    olxEl.value = username
    showToast('OLX account linked ✅ Your listings will auto-fill!', 'success')
  } catch(e) {
    if (olxStatus) olxStatus.innerHTML = '<span style="color:#e63946">❌ Could not save — try again</span>'
    showToast('Could not link OLX account — try again', 'error')
  }
}

// ── Price history ──
export async function renderPriceHistory(name, rarity, currentPriceStr) {
  var section = document.getElementById('phc')
  var barsEl = document.getElementById('phc-bars')
  var footerEl = document.getElementById('phc-footer')
  var titleEl = document.getElementById('phc-title')
  if (!section || !barsEl) return

  var base = parseFloat((currentPriceStr || '300').split('-')[0]) || 300

  // Try to get real community price data from Supabase
  var realData = []
  if (state._sb && name) {
    try {
      var res = await state._sb.from('community_prices')
        .select('price_inr, created_at')
        .eq('car_name', name)
        .order('created_at', { ascending: true })
        .limit(50)
      if (res.data && res.data.length >= 3) {
        realData = res.data
      }
    } catch(e) {}
  }

  var months, prices, isReal = false

  if (realData.length >= 3) {
    // Build real monthly averages from community data
    isReal = true
    var buckets = {}
    realData.forEach(function(r) {
      var d = new Date(r.created_at)
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(r.price_inr)
    })
    var keys = Object.keys(buckets).sort().slice(-8)
    months = keys.map(function(k) {
      var d = new Date(k + '-01')
      return d.toLocaleString('default', { month: 'short' })
    })
    if (months.length > 0) months[months.length-1] = 'Now'
    prices = keys.map(function(k) {
      var vals = buckets[k]
      return Math.round(vals.reduce(function(a,b){return a+b},0)/vals.length)
    })
    if (titleEl) titleEl.textContent = 'Real Price History — India ₹'
    var aiLabel = document.querySelector('.phc-lbl span[style]')
    if (aiLabel) aiLabel.textContent = realData.length + ' community reports'
  } else {
    // Estimated trend — clearly labeled
    isReal = false
    var vol = {'Super Treasure Hunt':0.22,'Treasure Hunt':0.16,'Vintage':0.18,'Rare':0.12,'Premium':0.10,'Uncommon':0.07,'Common':0.05}[rarity] || 0.08
    var trendMult = {'Super Treasure Hunt':1.14,'Treasure Hunt':1.09,'Vintage':1.13,'Rare':1.05,'Premium':1.03}[rarity] || 1.01
    var now = new Date()
    months = []
    for (var mi = 7; mi >= 0; mi--) {
      var d = new Date(now.getFullYear(), now.getMonth() - mi, 1)
      months.push(d.toLocaleString('default', { month: 'short' }))
    }
    months[7] = 'Now'
    prices = []
    var p = base / Math.pow(trendMult, 7)
    // Use deterministic seed based on car name so chart doesn't change on every render
    var seed = name ? name.split('').reduce(function(a,c){return a+c.charCodeAt(0)},0) : 42
    for (var i = 0; i < 8; i++) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff
      var rand = (seed >>> 16) / 65535
      p = p * trendMult * (1 + (rand - 0.5) * vol)
      prices.push(Math.round(p))
    }
    prices[7] = base
    if (titleEl) titleEl.textContent = 'Estimated Price Trend — India ₹'
    var aiLbl = document.querySelector('.phc-lbl span[style]')
    if (aiLbl) aiLbl.textContent = 'AI estimate · no real data yet'
  }

  var max = Math.max.apply(null, prices)
  var min = Math.min.apply(null, prices)
  var range = max - min || 1
  barsEl.innerHTML = ''
  prices.forEach(function(v, i) {
    var h = Math.round(((v-min)/range)*60 + 8)
    var col = document.createElement('div'); col.className='phc-col'
    var bar = document.createElement('div')
    bar.className = 'phc-bar' + (i===prices.length-1?' now':'')
    if (isReal) bar.style.background = 'var(--green)'
    bar.style.height = h+'px'
    var val = document.createElement('div'); val.className='phc-val'
    val.textContent = v>=1000 ? '₹'+(v/1000).toFixed(1)+'K' : '₹'+v
    var mo = document.createElement('div'); mo.className='phc-mo'; mo.textContent=months[i]
    col.appendChild(val); col.appendChild(bar); col.appendChild(mo)
    barsEl.appendChild(col)
  })
  var chg = prices[prices.length-1] - prices[0]
  var chgPct = Math.round(chg/prices[0]*100)
  footerEl.innerHTML = '<span style="color:'+(chg>=0?'var(--green)':'#ff6b6b')+';font-weight:700">'+(chg>=0?'↑':'↓')+Math.abs(chgPct)+'%</span><span style="color:var(--text3);font-size:11px;margin-left:4px">'+(isReal?'based on '+realData.length+' real reports':'estimated · submit your price above to improve'  )+'</span>'
  section.style.display = 'block'
}

// ── Referral ──
export function getRefCode() {
  // Use first 8 chars of user ID if logged in — stable across devices
  if (state.currentUser) return state.currentUser.id.substring(0, 8)
  var c = localStorage.getItem('hs_refcode')
  if (!c) { c = Math.random().toString(36).substring(2, 10); localStorage.setItem('hs_refcode', c) }
  return c
}
export function getRefLink() { return 'https://hotscan.in?ref=' + getRefCode() }

export async function updateRefUI() {
  var el = document.getElementById('ref-link-txt')
  if (el) el.textContent = getRefLink()

  // Fetch real referral count from Supabase
  var refCount = 0
  if (state._sb && state.currentUser) {
    try {
      var myCode = getRefCode()
      var res = await state._sb.from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_code', myCode)
      refCount = res.count || 0
    } catch(e) {
      // Fallback to localStorage count
      refCount = JSON.parse(localStorage.getItem('hs_refs') || '[]').length
    }
  } else {
    refCount = JSON.parse(localStorage.getItem('hs_refs') || '[]').length
  }

  var cnt = document.getElementById('ref-cnt')
  var bon = document.getElementById('ref-bonus-n')
  var rnk = document.getElementById('ref-rank')
  if (cnt) cnt.textContent = refCount
  if (bon) bon.textContent = refCount * 10
  if (rnk) rnk.textContent = refCount >= 10 ? '🏆 Top' : refCount >= 5 ? '⭐' : '—'

  // Handle incoming referral
  var ref = new URLSearchParams(window.location.search).get('ref')
  if (ref && ref !== getRefCode() && !localStorage.getItem('hs_used_ref')) {
    localStorage.setItem('hs_used_ref', ref)
    // Grant bonus scans locally
    var s = JSON.parse(localStorage.getItem('hs_scans') || '{}')
    s.bonus = (s.bonus || 0) + 10
    localStorage.setItem('hs_scans', JSON.stringify(s))
    // Log to Supabase
    if (state._sb) {
      state._sb.from('referrals').insert({
        referrer_code: ref,
        referred_user_id: state.currentUser ? state.currentUser.id : null,
        created_at: new Date().toISOString()
      }).catch(function() {})
    }
    setTimeout(function() { showToast('🎁 Welcome! You got 10 bonus scans from your referral link.', 'success') }, 1500)
  }
}

export function copyRefLink() {
  var link = getRefLink()
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(function(){ showToast('Referral link copied!', 'success') })
  } else { showToast('Your link: ' + link, 'success') }
}

export function shareViaWA() {
  var lines = [
    'Found India\'s first Hot Wheels scanner!',
    'Scan any car and get the Indian market price instantly.',
    'Free to use at: '+getRefLink(),
    'Sign up with my link and we both get 10 free bonus scans!'
  ]
  window.open('https://wa.me/?text='+encodeURIComponent(lines.join('\n')), '_blank')
}

// ── Alert check ── shows watch links, no fake simulated data
export function runAlertCheck() {
  if (!state.alerts || !state.alerts.length) return
  // Only show alert UI if user has alerts set — no fake price simulation
  var a = state.alerts[0]
  if (!a) return
  var box = document.getElementById('err-box')
  if (box && box.style.display === 'none') {
    // Only show once per session, not repeatedly
    if (localStorage.getItem('hs_alert_shown_' + a.id)) return
    localStorage.setItem('hs_alert_shown_' + a.id, '1')
    box.textContent = ''
    var msg = document.createTextNode('🔔 Watching for ' + a.name + ' deals — ')
    var btn = document.createElement('button')
    btn.textContent = 'Check OLX now →'
    btn.style.cssText = 'background:var(--gold);color:#000;border:none;padding:3px 9px;border-radius:7px;font-size:11px;cursor:pointer;font-weight:700;margin-left:4px'
    btn.onclick = (function(n){ return function(){ ol('https://www.olx.in/items/q-hot+wheels+'+encodeURIComponent(n)) }})(a.name)
    box.appendChild(msg); box.appendChild(btn)
    box.style.cssText='display:block;background:#1a1500;border:1px solid rgba(255,214,10,.3);color:var(--gold);border-radius:12px;padding:12px;margin-bottom:11px;font-size:13px;line-height:1.6'
    setTimeout(function(){ if(box) box.style.display='none' }, 8000)
  }
}

// ── Misc ──
export function handleUpgrade(){
  closeProModal()
  if(state.currentUser){window.startPayment()}else{window.openAuth()}
}
export function whatsappSupport(){
  if (!WA_SUPPORT) {
    window.open('mailto:mahakfahad07@gmail.com?subject=HotScan+India+Support&body=Hi!+I+need+help+with+the+HotScan+India+app.', '_blank')
    return
  }
  var msg = 'Hi! I need help with HotScan India app.'
  window.open('https://wa.me/' + WA_SUPPORT + '?text=' + encodeURIComponent(msg), '_blank')
}
export function resetScan() {
  state.img64 = null; state.imgThumb = null; state.fakeImg64 = null; state.lastResult = null; state.multiImages = []
  document.getElementById('preview-img').src = ''
  document.getElementById('preview-wrap').style.display = 'none'
  document.getElementById('scan-ph').style.display = 'block'
  document.getElementById('scan-area').classList.remove('has-img')
  try { document.getElementById('fake-preview-img').src = ''; document.getElementById('fake-preview-wrap').style.display = 'none'; document.getElementById('fake-scan-ph').style.display = 'block' } catch(e) {}
  var abtn = document.getElementById('analyze-btn')
  abtn.style.display = 'none'; abtn.classList.remove('sticky-btn')
  document.getElementById('result').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  document.getElementById('err-box').style.display = 'none'
  try { document.getElementById('r-insight').style.display = 'none' } catch(e) {}
  try { document.getElementById('price-submit').style.display = 'none' } catch(e) {}
  document.getElementById('fc').value = ''
  document.getElementById('fg').value = ''
  try { document.getElementById('fg-multi').value = '' } catch(e) {}
  try { document.getElementById('multi-preview').style.display = 'none'; document.getElementById('multi-thumbs').innerHTML = '' } catch(e) {}
  window.scrollTo({top:0, behavior:'smooth'})
}
