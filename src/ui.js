import { state } from './state.js'
import { FREE_SCANS, WA_COMMUNITY, WA_SUPPORT, HUNT_DATA } from './config.js'
import { escHtml, fmtINR, cleanINR, parseINR, compress, compressThumb, showToast, rcls, ol, sanitize, hsConfirm, captureException, isProActive } from './utils.js'
import { renderCol, addCarToCollection, fullCloudSync } from './collection.js'
import { CONDITIONS, applyCondition, conditionFromScan } from '../shared/pricing.js'

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
  // Log to Supabase scan_logs (Supabase v2 - must await, no .catch())
  if (state._sb && state.currentUser) {
    ;(async function() {
      try {
        await state._sb.from('scan_logs').insert({
          user_id: state.currentUser.id,
          scanned_at: new Date().toISOString(),
        })
      } catch(e) {}
    })()
  }
  return c
}
export function isPro() {
  // Source of truth: server-verified profile loaded from Supabase after auth.
  // localStorage('hs_pro') is NOT trusted — it was removed as a bypass vector.
  // Anyone can setItem('hs_pro','true') in DevTools; server profile cannot be faked.
  if (!state.currentUser) return false
  // Brief race window: currentUser loaded but profile fetch not yet complete
  if (!state.userProfile) return state._profileLoading === true ? true : false
  return isProActive(state.userProfile)
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
  var used = getTodayScans()
  var pro = isPro()
  var pb = document.getElementById('prof-scans-bar')
  if (pb && state.currentUser) {
    pb.style.width = pro ? '100%' : Math.min(used / FREE_SCANS * 100, 100) + '%'
    pb.style.background = pro ? 'var(--green)' : ''
  }
  // Scan allowance, visible where the scanning happens instead of only on the
  // profile page — running out mid-hunt should never be a surprise.
  var q = document.getElementById('scan-quota')
  if (q) {
    var left = Math.max(FREE_SCANS - used, 0)
    q.textContent = pro ? 'Pro · unlimited' : left + ' of ' + FREE_SCANS + ' free scans left'
    q.className = 'quota-pill' + (pro ? ' pro' : left <= 1 ? ' low' : '')
  }
}

// ── Navigation ──
// Sub-pages have no tab of their own; they light up the tab they are reached from.
var _navParent = { guide: 'more', hunt: 'more', alerts: 'more', profile: 'more' }
// Slides the dock's highlight under the active tab. The Scan button has its
// own raised treatment, so the highlight hides while Scan is current.
export function moveDockIndicator() {
  var ind = document.getElementById('dock-ind')
  var active = document.querySelector('.dock .nav-item.active')
  if (!ind) return
  if (!active || active.id === 'nav-scan') { ind.classList.remove('on'); return }
  var w = Math.min(active.offsetWidth - 8, 72)
  ind.style.width = w + 'px'
  ind.style.transform = 'translateX(' + (active.offsetLeft + (active.offsetWidth - w) / 2) + 'px)'
  ind.classList.add('on')
}
if (typeof window !== 'undefined') window.addEventListener('resize', moveDockIndicator)

export function goPage(id, fromHash) {
  var pg = document.getElementById('page-' + id)
  if (!pg) return
  // Cross-fade between pages where the browser supports it; otherwise switch at once.
  var reduce = false
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}
  if (document.startViewTransition && !reduce && !pg.classList.contains('active')) {
    // A second navigation before the first finishes skips the first transition,
    // which rejects its promises. That is expected, not an error.
    var vt = document.startViewTransition(function () { _showPage(id, pg, fromHash) })
    ;[vt.ready, vt.finished, vt.updateCallbackDone].forEach(function (pr) { if (pr && pr.catch) pr.catch(function () {}) })
  } else _showPage(id, pg, fromHash)
}

function _showPage(id, pg, fromHash) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active') })
  document.querySelectorAll('.nav-item').forEach(function (n) {
    n.classList.remove('active'); n.removeAttribute('aria-current')
  })
  pg.classList.add('active')
  ;[document.getElementById('nav-' + (document.getElementById('nav-' + id) ? id : _navParent[id]))].forEach(function (el) {
    if (el) { el.classList.add('active'); el.setAttribute('aria-current', 'page') }
  })
  moveDockIndicator()
  var dd = document.getElementById('profile-dd-menu'); if (dd) dd.classList.remove('open')
  if (id === 'profile') renderProfilePage()
  if (id === 'marketplace') window.loadAndRenderListings()
  if (id === 'collection') { window._colStagger = true; renderCol(); renderWantList() }
  if (id === 'scan') updateScanCounter()
  // Keep the URL in step so back/forward and shared links work. Skipped when
  // the navigation itself came from the hash, and never touches an auth hash.
  if (!fromHash) {
    try {
      var cur = window.location.hash
      if (!/access_token|error_description|type=recovery/.test(cur) && cur !== '#' + id) {
        history.pushState(null, '', id === 'scan' ? window.location.pathname + window.location.search : '#' + id)
      }
    } catch (e) {}
  }
  window.scrollTo(0, 0)
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
    var t = document.getElementById('tab-' + m)
    t.classList.toggle('active', m === mode)
    t.setAttribute('aria-selected', m === mode ? 'true' : 'false')
  })
  document.getElementById('analyze-btn').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  document.getElementById('err-box').style.display = 'none'
  if (mode === 'deal') {
    document.getElementById('analyze-btn').style.display = 'block'
    document.getElementById('analyze-btn').textContent = 'Check this deal'
  }
  // These tips say "Side profile", which is the wrong advice in Fake mode —
  // authenticity is settled by the base, and that panel says so already.
  // Leaving both on screen told the user two contradictory things.
  var tips = document.getElementById('scan-tips-card')
  if (tips) tips.style.display = (mode === 'fake') ? 'none' : ''
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
      state.fakeImg64 = await compress(raw, 1024)
      document.getElementById('analyze-btn').style.display = 'block'
      document.getElementById('analyze-btn').classList.add('sticky-btn')
      document.getElementById('analyze-btn').textContent = 'Check authenticity'
    } else {
      document.getElementById('preview-img').src = raw
      document.getElementById('preview-wrap').style.display = 'block'
      document.getElementById('scan-ph').style.display = 'none'
      document.getElementById('scan-area').classList.add('has-img')
      state.img64 = await compress(raw, 1024)
      state.imgThumb = await compressThumb(raw)
      document.getElementById('analyze-btn').style.display = 'block'
      document.getElementById('analyze-btn').classList.add('sticky-btn')
      document.getElementById('analyze-btn').textContent = 'Identify and price this car'
    }
    document.getElementById('result').style.display = 'none'
    document.getElementById('deal-result').style.display = 'none'
    document.getElementById('err-box').style.display = 'none'
  } catch(err) {
    document.getElementById('err-box').textContent = 'Could not load that image. Try another photo.'
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

  if (files.length > 5) { showToast('Only first 5 images used — ' + (files.length - 5) + ' dropped', 'info') }
  for (var i = 0; i < Math.min(files.length, 5); i++) {
    var file = files[i]
    var raw = await new Promise(function(resolve) {
      var rd = new FileReader(); rd.onload = function(e){resolve(e.target.result)}; rd.readAsDataURL(file)
    })
    // 768 rather than the 1024 a single scan uses. Vision tokens scale with
    // area, so this is ~44% cheaper per image — the difference between a
    // five-photo batch fitting inside the 8,000 tokens-per-minute ceiling and
    // being rejected outright. Still ample for reading casting shape, colour,
    // wheel type and tampo.
    var compressed = await compress(raw, 768)
    var thumb = await compressThumb(raw)
    state.multiImages.push({img64: compressed, thumb: thumb})
  }

  renderMultiThumbs()
  document.getElementById('result').style.display = 'none'
  document.getElementById('err-box').style.display = 'none'
}

// Rebuilt from state on every change rather than appended to, so removing a
// photo cannot leave the thumbnails and state.multiImages disagreeing about
// which index is which — that mismatch would attach the wrong photo to a car.
export function renderMultiThumbs() {
  var wrap = document.getElementById('multi-thumbs')
  if (!wrap) return
  wrap.innerHTML = ''
  state.multiImages.forEach(function(m, i) {
    var cell = document.createElement('div')
    cell.style.cssText = 'width:60px;height:60px;border-radius:8px;overflow:hidden;border:2px solid var(--border2);position:relative'
    var img = document.createElement('img')
    img.src = m.thumb
    img.style.cssText = 'width:100%;height:100%;object-fit:cover'
    cell.appendChild(img)

    var x = document.createElement('button')
    x.type = 'button'
    x.textContent = '✕'
    x.title = 'Remove this photo'
    x.setAttribute('aria-label', 'Remove photo ' + (i+1))
    // Always visible, not hover-revealed: this is a phone-first flow and touch
    // has no hover state to reveal it with.
    x.style.cssText = 'position:absolute;top:1px;right:1px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0'
    x.onclick = (function(idx){ return function(ev){ ev.stopPropagation(); removeMultiImage(idx) } })(i)
    cell.appendChild(x)
    wrap.appendChild(cell)
  })

  var n = state.multiImages.length
  var countEl = document.getElementById('multi-count')
  if (countEl) countEl.textContent = n + ' image' + (n===1?'':'s') + ' selected — AI will identify all cars'
  var btn = document.getElementById('analyze-btn')
  if (btn) {
    btn.style.display = 'block'
    // One photo left is a single scan, not a batch — say so rather than
    // offering to "identify all cars" in one picture.
    btn.textContent = n === 1
      ? 'Identify and price this car'
      : 'Identify all cars (' + n + ' photos)'
  }
  // The rest of the app reads img64/imgThumb for the "current" photo, so it
  // must always track the first remaining image.
  if (n) {
    state.img64 = state.multiImages[0].img64
    state.imgThumb = state.multiImages[0].thumb
  }
}

export function removeMultiImage(i) {
  if (i < 0 || i >= state.multiImages.length) return
  state.multiImages.splice(i, 1)
  if (!state.multiImages.length) {
    // Last photo removed — return the scanner to its empty state instead of
    // leaving an "0 images selected" panel with a dead Identify button.
    state.img64 = null
    state.imgThumb = null
    var prev = document.getElementById('multi-preview'); if (prev) prev.style.display = 'none'
    var thumbs = document.getElementById('multi-thumbs'); if (thumbs) thumbs.innerHTML = ''
    var cnt = document.getElementById('multi-count'); if (cnt) cnt.textContent = '0 images selected'
    var ph = document.getElementById('scan-ph'); if (ph) ph.style.display = ''
    var area = document.getElementById('scan-area'); if (area) area.classList.remove('has-img')
    var btn2 = document.getElementById('analyze-btn'); if (btn2) btn2.style.display = 'none'
    showToast('All photos removed', 'info')
    return
  }
  renderMultiThumbs()
}

// ── Timer/pipeline ──
export function startTimer(lbl) {
  // Without this, calling startTimer again (once per photo in the
  // sequential multi-scan loop) left the previous interval running forever
  // in the background — by photo 5 there were 5 separate 1s intervals all
  // still firing and all incrementing the same counter, making the
  // displayed time run several times faster than real elapsed time. This
  // is almost certainly what looked like a 100+ second hang.
  if (state.timerInt) clearInterval(state.timerInt)
  state.timerSec = 0
  document.querySelectorAll('.scan-area').forEach(function (a) { a.classList.add('scanning') })
  document.getElementById('timer-wrap').style.display = 'block'
  document.getElementById('timer-lbl').innerHTML = '<span class="hs-loader" style="margin-right:8px"><span class="hs-loader-dot"></span><span class="hs-loader-dot"></span><span class="hs-loader-dot"></span></span>' + escHtml(lbl)
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
  document.querySelectorAll('.scan-area').forEach(function (a) { a.classList.remove('scanning') })
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
  if (s === 'active') { el.classList.add('active'); el.innerHTML = '<span class="hs-loader-ring" style="width:13px;height:13px;vertical-align:-2px;margin-right:6px"></span>Working' }
  else if (s === 'done') {
    el.classList.add('done'); el.textContent = 'Done'
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
// Applies a one-shot reveal to the result card, escalating with rarity. Classes
// are removed and re-added so the animation replays on a second scan — without
// the reflow read, the browser coalesces the change and nothing happens.
function _playReveal(rarity) {
  var card = document.getElementById('result')
  if (!card) return
  var r = (rarity || '').toLowerCase()
  var isTh = r.indexOf('treasure') > -1
  var isRare = isTh || r.indexOf('rare') > -1 || r.indexOf('premium') > -1 ||
               r.indexOf('vintage') > -1 || r.indexOf('error') > -1
  card.classList.remove('hs-reveal', 'hs-reveal-rare', 'hs-reveal-th')
  void card.offsetWidth
  card.classList.add(isRare ? 'hs-reveal-rare' : 'hs-reveal')
  if (isTh) card.classList.add('hs-reveal-th')
}

export function showResult(d) {
  document.getElementById('r-thumb').innerHTML = state.imgThumb ? '<img src="' + state.imgThumb + '" alt="">' : ''
  // "Do I already have this?" is the first question on a peg hunt, and the
  // answer used to arrive only as a dialog after tapping Add.
  var ownedEl = document.getElementById('r-owned')
  if (ownedEl) {
    var nm0 = (d.name || '').toLowerCase()
    var owned = nm0 ? state.collection.filter(function (c) { return (c.name || '').toLowerCase() === nm0 }).length : 0
    ownedEl.textContent = owned ? 'In your collection' + (owned > 1 ? ' ×' + owned : '') : ''
    ownedEl.classList.toggle('show', owned > 0)
  }
  document.getElementById('r-name').textContent = d.name || 'Unknown'
  document.getElementById('r-series').textContent = d.series || ''
  // Rarity reveal. Pulling a Treasure Hunt is the emotional peak of the product
  // and previously landed with no acknowledgement whatsoever. Runs once, uses
  // transform/opacity only, and is disabled by the reduced-motion block in CSS.
  _playReveal(d.rarity)
  
  // Check and earn achievements
  window._checkAchievements && window._checkAchievements(d)
  if (window.updateStreak) window.updateStreak()
  // #1 — color-coded confidence bar: red <50%, gold 50-79%, green ≥80%
  // Show the model's real confidence, or an explicit unknown — never a default.
  // This used to read `d.confidence || 75`, which drew a confident 75% bar for a
  // result that carried no confidence at all: a number the app invented and then
  // presented as a measurement.
  var hasConf = typeof d.confidence === 'number' && d.confidence > 0
  var conf = hasConf ? d.confidence : 0
  var confFill = document.getElementById('r-conf')
  confFill.style.width = (hasConf ? conf : 100) + '%'
  confFill.style.background = !hasConf ? 'var(--surface3)'
    : conf >= 80 ? 'var(--green)' : conf >= 50 ? 'var(--gold)' : 'var(--red)'

  // A low-confidence or unevidenced-rarity result needs to say so in words. The
  // bar colour alone is not a warning — most people do not read a bar as doubt,
  // and this is precisely where acting on a wrong answer costs real money.
  var warnEl = document.getElementById('r-confidence-warn')
  if (!warnEl) {
    warnEl = document.createElement('div')
    warnEl.id = 'r-confidence-warn'
    var hero = document.querySelector('#result .r-hero')
    if (hero && hero.parentElement) hero.parentElement.insertBefore(warnEl, hero.nextSibling)
  }
  if (warnEl) {
    var warnings = []
    if (!hasConf) warnings.push('The AI did not report how sure it is about this identification.')
    else if (d._lowConfidence || conf < 75) warnings.push('Low confidence (' + conf + '%) — check the casting name against the base before trusting the price.')
    if (d._needsVerification) warnings.push('This rarity was claimed without stating visible evidence. Verify the TH logo and wheels yourself before paying a premium.')
    if (warnings.length) {
      warnEl.style.cssText = 'padding:11px 13px;border-radius:12px;background:rgba(247,201,72,.08);border:1px solid rgba(247,201,72,.28);font-size:13px;line-height:1.55;color:var(--text2)'
      warnEl.innerHTML = warnings.map(function(w){ return escHtml(w) }).join('<br>')
      warnEl.style.display = 'block'
    } else {
      warnEl.style.display = 'none'
    }
  }
  var rb = document.getElementById('r-rar')
  rb.textContent = d.rarity || 'Common'; rb.className = 'rar ' + rcls(d.rarity)
  // Identification is not authentication. This badge used to render whatever
  // is_authentic the model returned — and the prompt's own JSON example set it
  // to true — so a 128px side shot of a VW bus got a green "Authentic". The
  // only authenticity verdict now lives in Fake Detector mode, which enforces
  // evidence rules. Cached results from before this change may still carry the
  // field, so it is ignored rather than trusted.
  var ab = document.getElementById('r-auth')
  if (ab) ab.style.display = 'none'
  
  // The older #r-low-conf-warning / #r-verify-warning banners repeated the two
  // warnings above word for word, so a doubtful scan showed four boxes.
  document.getElementById('p1').textContent = fmtINR(d.india_retail_inr) || '—'
  var _p1t = document.getElementById('p1'); if (_p1t && _p1t.parentElement) _p1t.parentElement.style.display = d.india_retail_inr ? '' : 'none'
  document.getElementById('p2').textContent = fmtINR(d.india_collector_inr) || '—'
  document.getElementById('p3').textContent = d.us_retail_usd ? '$' + d.us_retail_usd : '—'
  document.getElementById('p4').textContent = d.us_collector_usd ? '$' + d.us_collector_usd : '—'
  // Where the number came from, in plain words. A price is only called live
  // when a listing or report actually stands behind it.
  var _dqEl = document.getElementById('live-upd')
  var _dq = d.data_quality || ''
  var _src = ''
  if (Array.isArray(d.web_sources) && d.web_sources.length) {
    try { _src = ' Source: ' + (d.web_sources[0].title || new URL(d.web_sources[0].url).hostname).replace(/^www\./, '') + '.' } catch (e) {}
  }
  if (_dq.indexOf('Community') === 0 || _dq.indexOf('Verified Sale') === 0) {
    _dqEl.textContent = 'From ' + (d.community_count || 'several') + ' prices reported by collectors. Unverified.'
  } else if (_dq.indexOf('Live') === 0) {
    _dqEl.textContent = (_dq.indexOf('adjusted') > -1 ? 'Based on current Indian listings, pulled back to the usual range for this rarity.' : 'Based on current Indian listings.') + _src
  } else if (_dq.indexOf('Reference') === 0 || _dq === 'Database') {
    _dqEl.textContent = 'Reference price for this casting, not a live quote. Check OLX before paying.'
  } else {
    _dqEl.textContent = 'Typical range for ' + (/^[aeiou]/i.test(d.rarity || '') ? 'an ' : 'a ') + (d.rarity || 'Common') + ' car, not a quote for this exact one.' +
      (state.currentUser ? '' : ' Sign in for live Indian listings.')
  }
  _dqEl.style.color = ''

  // Condition changes the price more than anything else, and a photo cannot
  // judge it reliably, so it is the collector's call. The carded-mint range is
  // kept on the result and re-priced whenever a different condition is chosen.
  var condEl = document.getElementById('r-cond')
  if (condEl) {
    if (!d._carded_inr) d._carded_inr = d.india_collector_inr
    if (!d._condition) d._condition = conditionFromScan(d.condition)
    var paintCond = function () {
      condEl.innerHTML = ''
      CONDITIONS.forEach(function (c) {
        var b = document.createElement('button')
        b.type = 'button'
        b.className = 'chip' + (c.id === d._condition ? ' active' : '')
        b.textContent = c.label
        b.setAttribute('aria-pressed', c.id === d._condition ? 'true' : 'false')
        b.onclick = function () {
          d._condition = c.id
          d.condition = c.label
          d.india_collector_inr = applyCondition(d._carded_inr, c.id)
          document.getElementById('p2').textContent = fmtINR(d.india_collector_inr) || '—'
          paintCond(); paintMult()
        }
        condEl.appendChild(b)
      })
    }
    d.india_collector_inr = applyCondition(d._carded_inr, d._condition)
    paintCond()
    document.getElementById('p2').textContent = fmtINR(d.india_collector_inr) || '—'
  }
  // How far above shelf price the collector market sits. Indian resale is
  // usually quoted as a multiple of MRP, so say it in those terms.
  function paintMult() {
    var multEl = document.getElementById('r-mult')
    if (!multEl) return
    var _ret = parseINR(d.india_retail_inr), _col = parseINR(d.india_collector_inr)
    var _x = _ret > 0 ? _col / _ret : 0
    multEl.textContent = _x >= 1.5 ? 'About ' + (_x >= 10 ? Math.round(_x) : _x.toFixed(1).replace(/\.0$/, '')) + '× shelf price' : ''
  }
  paintMult()
  // #4 — pop animation on price tiles
  document.querySelectorAll('.ptile').forEach(function(tile, i) {
    tile.classList.remove('pop')
    setTimeout(function(){ tile.classList.add('pop') }, i * 60)
    tile.addEventListener('animationend', function(){ tile.classList.remove('pop') }, {once:true})
  })
  // A trend is only shown when a source gave a reason for it. A bare "Stable"
  // with nothing behind it is filler.
  var _trendRow = document.getElementById('r-trend'); if (_trendRow) _trendRow.style.display = d.price_trend_reason ? '' : 'none'
  var trend = d.price_trend || 'Stable'
  if (trend !== 'Rising' && trend !== 'Falling' && trend !== 'Stable') trend = 'Stable'
    document.getElementById('trend-txt').innerHTML = '<span class="' + (trend==='Rising'?'tup':trend==='Falling'?'tdn':'tst') + '">' + escHtml(trend) + '</span>' + (d.price_trend_reason ? ' — ' + escHtml(d.price_trend_reason) : '')
  var ib = document.getElementById('r-inv')
  ib.textContent = d.investment || 'Medium'; ib.className = 'inv-badge'
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
      {label:'Amazon', url:'https://www.amazon.in/s?k=hot+wheels+' + encodeURIComponent(d.name)},
      {label:'Flipkart', url:'https://www.flipkart.com/search?q=hot+wheels+' + encodeURIComponent(d.name)},
      {label:'OLX', url:'https://www.olx.in/items/q-hot+wheels+' + encodeURIComponent(d.name)},
      {label:'Instagram', url:'https://www.instagram.com/explore/tags/'+encodeURIComponent('hotwheelsindiasale')},
      {label:'Maido', url:'https://www.maido.in/search?q=' + encodeURIComponent(d.name)},
    ]
    var bl = document.getElementById('r-buy-list')
    bl.innerHTML = ''
    buyLinks.forEach(function(l) {
      var s = document.createElement('span')
      s.className = 'tag'
      s.setAttribute('role', 'link'); s.tabIndex = 0
      s.textContent = l.label
      s.onclick = (function(u) { return function() { ol(u) } })(l.url)
      bl.appendChild(s)
    })
  }
  loadCommunityPrices(d.name)
  renderPriceHistory(d.name)
  document.getElementById('result').style.display = 'block'
  document.getElementById('analyze-btn').style.display = 'none'
  var _sfb = document.getElementById('scan-feedback'); if (_sfb) _sfb.style.display = 'flex'
  var _tips = document.getElementById('scan-tips-card'); if (_tips) _tips.style.display = 'none'
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
        .ilike('car_name', carName)
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
      div.className = 'li-row'
      div.innerHTML = '<div class="li-body"><div class="li-t">' + escHtml(String(p.platform||'India')) + '</div><div class="li-s">' + escHtml(String(p.user||'Collector')) + '</div></div><div class="li-v">₹' + escHtml(String(Number(p.price)||0)) + '</div>'
      listEl.appendChild(div)
    })
  }
}

export async function submitPrice() {
  if (!state.lastResult) return
  var price = document.getElementById('community-price').value
  var platform = document.getElementById('community-platform').value
  if (!price || parseInt(price) < 50) { showToast('Enter a realistic price (minimum ₹50)', 'error'); return }
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
  showToast('Price reported. Thank you.', 'success')
  document.getElementById('community-price').value = ''
  loadCommunityPrices(state.lastResult.name)
}

// ── Alerts ──
function _readWant() { try { return JSON.parse(localStorage.getItem('hs_want') || '[]') } catch (e) { return [] } }
function _writeWant(wl) { try { localStorage.setItem('hs_want', JSON.stringify(wl)) } catch (e) {} }

export function addToWantList() {
  if (!state.lastResult) { showToast('Scan a car first', 'error'); return }
  var r = state.lastResult
  var wl = _readWant()
  if (wl.some(function (w) { return w.name === r.name })) { showToast(r.name + ' is already on your wishlist', 'info'); return }
  // The whole result is kept, so moving it into the collection later needs no rescan.
  wl.unshift(Object.assign({}, r, { id: Date.now(), image: state.imgThumb, added: new Date().toISOString() }))
  _writeWant(wl)
  showToast('Added to wishlist', 'success')
  renderWantList()
}

export function removeFromWantList(id, silent) {
  _writeWant(_readWant().filter(function (w) { return w.id !== id }))
  renderWantList()
  if (!silent) showToast('Removed from wishlist', 'success')
}

// Found one: it leaves the wishlist and joins the collection in one tap.
export function moveWantToCollection(id) {
  var w = _readWant().find(function (x) { return x.id === id })
  if (!w) return
  addCarToCollection(w, w.image || null)
  removeFromWantList(id, true)
  showToast(w.name + ' moved to your collection', 'success')
}

// Collectors post "ISO" (in search of) lists in groups; this writes one.
export function shareWantList() {
  var wl = _readWant()
  if (!wl.length) { showToast('Your wishlist is empty', 'info'); return }
  var text = '*ISO — looking for these Hot Wheels*\n' +
    wl.map(function (w, i) { return (i + 1) + '. ' + w.name + (w.rarity && w.rarity !== 'Common' ? ' (' + w.rarity + ')' : '') }).join('\n') +
    '\n\nDM me if you have any. List made with HotScan · hotscan.in'
  shareText(text)
}

// Native share sheet where there is one, WhatsApp otherwise.
export function shareText(text) {
  if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return }
  ol('https://wa.me/?text=' + encodeURIComponent(text))
}
if (typeof window !== 'undefined') window.shareText = shareText

// A car added to the collection by any route comes off the wishlist, so the
// list never keeps asking for something already found.
export function pruneWantList(name) {
  if (!name) return
  var wl = _readWant()
  var next = wl.filter(function (w) { return (w.name || '').toLowerCase() !== String(name).toLowerCase() })
  if (next.length !== wl.length) { _writeWant(next); renderWantList() }
}
if (typeof window !== 'undefined') window.pruneWantList = pruneWantList

export function renderWantList() {
  var el = document.getElementById('want-list')
  var wl = _readWant()
  var cnt = document.getElementById('want-count')
  if (cnt) cnt.textContent = wl.length ? String(wl.length) : ''
  if (!el) return
  if (!wl.length) {
    el.innerHTML = '<div class="empty"><div class="empty-t">Nothing on your wishlist</div><div class="empty-s">Scan a car you are hunting for and tap Wishlist. It moves to your collection when you find it.</div></div>'
    return
  }
  el.innerHTML = '<div class="card">' + wl.map(function (w) {
    var price = cleanINR(w.india_collector_inr || w.india_retail_inr)
    return '<div class="li-row">' +
      '<div class="li-thumb">' + (w.image ? '<img src="' + escHtml(w.image) + '" alt="">' : '') + '</div>' +
      '<div class="li-body"><div class="li-t">' + escHtml(w.name) + '</div>' +
      '<div class="li-s">' + escHtml(w.rarity || 'Common') + (price ? ' · ' + escHtml(fmtINR(price)) : '') + '</div></div>' +
      '<button class="btn btn-sm btn-ghost" onclick="moveWantToCollection(' + Number(w.id) + ')">Found it</button>' +
      '<button class="icon-btn" aria-label="Remove from wishlist" onclick="removeFromWantList(' + Number(w.id) + ')"><svg class="ic"><use href="#i-x"/></svg></button>' +
      '</div>'
  }).join('') + '</div>'
}

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
    document.getElementById('alerts-list').innerHTML = '<div class="empty"><div class="empty-t">Nothing on your watchlist</div><div class="empty-s">Scan a car and tap Watch to keep its searches one tap away.</div></div>'
    return
  }
  var al = document.getElementById('alerts-list'); al.innerHTML = ''
  state.alerts.forEach(function(a) {
    var div = document.createElement('div'); div.className = 'alert-item'
    var nm = document.createElement('div'); nm.className = 'alert-name'; nm.textContent = a.name
    var meta = document.createElement('div'); meta.style.cssText = 'font-size:12.5px;color:var(--text3);margin-bottom:10px'; meta.textContent = (a.rarity||'Common') + ' · Target: ₹' + (cleanINR(a.india_collector_inr)||'?')
    var links = document.createElement('div'); links.style.cssText = 'display:flex;gap:8px'
    var olxBtn = document.createElement('button'); olxBtn.className = 'alert-link'; olxBtn.textContent = 'OLX'
    olxBtn.onclick = (function(n){return function(){ol('https://www.olx.in/items/q-hot+wheels+'+encodeURIComponent(n||''))}})(a.name)
    var igBtn = document.createElement('button'); igBtn.className = 'alert-link'; igBtn.textContent = 'Instagram'
    igBtn.onclick = function(){ol('https://www.instagram.com/explore/tags/hotwheelsindiasale/')}
    var amzBtn = document.createElement('button'); amzBtn.className = 'alert-link'; amzBtn.textContent = 'Amazon'
    amzBtn.onclick = (function(n){return function(){ol('https://www.amazon.in/s?k=hot+wheels+'+encodeURIComponent(n||''))}})(a.name)
    links.appendChild(olxBtn); links.appendChild(igBtn); links.appendChild(amzBtn)
    var delBtn = document.createElement('button'); delBtn.className = 'icon-btn'; delBtn.setAttribute('aria-label', 'Remove from watchlist')
    delBtn.textContent = '✕'; delBtn.onclick = (function(id){return function(){delAlert(id)}})(a.id)
    var row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start'
    var info = document.createElement('div'); info.appendChild(nm); info.appendChild(meta); info.appendChild(links)
    row.appendChild(info); row.appendChild(delBtn)
    div.appendChild(row); al.appendChild(div)
  })
}

// ── History ──
export function saveToHist(d) {
  var entry = {id:Date.now(), name:d.name, series:d.series, rarity:d.rarity, india_collector_inr:d.india_collector_inr, scanned:new Date().toISOString()}
  state.scanHistory.unshift(entry)
  if (state.scanHistory.length > 50) state.scanHistory = state.scanHistory.slice(0, 50)
  try { localStorage.setItem('hs_hist', JSON.stringify(state.scanHistory)) } catch(e) { try { localStorage.removeItem('hs_hist'); localStorage.setItem('hs_hist', JSON.stringify([entry])) } catch(e2) {} }
  renderRecentScans()
}

function _ago(iso) {
  var diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  return diff < 1 ? 'just now' : diff < 60 ? diff + 'm ago' : diff < 1440 ? Math.floor(diff / 60) + 'h ago' : Math.floor(diff / 1440) + 'd ago'
}
function _histRows(n) {
  return state.scanHistory.slice(0, n).map(function (h) {
    return '<div class="li-row"><div class="li-body"><div class="li-t">' + escHtml(h.name || 'Unknown') + '</div>' +
      '<div class="li-s">' + escHtml(h.rarity || 'Common') + ' · ' + _ago(h.scanned) + '</div></div>' +
      '<div class="li-v">' + escHtml(fmtINR(h.india_collector_inr)) + '</div></div>'
  }).join('')
}
export function renderRecentScans() {
  var card = document.getElementById('scan-recent-card'), el = document.getElementById('scan-recent')
  if (!card || !el) return
  card.hidden = !state.scanHistory.length
  el.innerHTML = _histRows(4)
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
    ;(async function(){ try{ await state._sb.from('events').insert({name:name,location:loc,date:date,submitted_by:state.currentUser.id}) }catch(e){} })()
  }
  // Email fallback always fires
  var body = 'Event: ' + name + '\nLocation: ' + loc + '\nDate: ' + date + '\nSubmitted by: ' + (state.currentUser ? state.currentUser.email : 'Guest')
  window.open('mailto:mahakfahad07@gmail.com?subject=HotScan+Event+Submission&body=' + encodeURIComponent(body), '_blank')
  document.getElementById('event-name-inp').value = ''
  document.getElementById('event-loc-inp').value = ''
  document.getElementById('event-date-inp').value = ''
  showToast('Event submitted! We\'ll review and list it ✅', 'success')
}

// Real trend data for the Trends page, derived from community_prices.
//
// The page was named Trends and contained no trends — a condition guide, an
// events list and a WhatsApp link. This is the one dataset that is genuinely
// ours and genuinely Indian, so it belongs at the top of it.
//
// Grouping is done client-side rather than with a SQL aggregate so it needs no
// new view or migration; the row cap keeps that honest.
export async function renderTrends() {
  var wrap = document.getElementById('trends-list')
  if (!wrap) return
  var rows = []
  if (state._sb) {
    try {
      var since = new Date(Date.now() - 60 * 86400000).toISOString()
      var res = await state._sb.from('community_prices')
        .select('car_name,price_inr,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500)
      if (!res.error && res.data) rows = res.data
    } catch(e) { /* empty state below */ }
  }

  var byCar = {}
  rows.forEach(function(r) {
    var key = (r.car_name || '').trim()
    if (!key) return
    var k = key.toLowerCase()
    if (!byCar[k]) byCar[k] = { name: key, prices: [] }
    var p = Number(r.price_inr)
    if (p > 0) byCar[k].prices.push(p)
  })

  var cars = Object.keys(byCar).map(function(k) { return byCar[k] })
    .filter(function(c) { return c.prices.length > 0 })
    .map(function(c) {
      var sorted = c.prices.slice().sort(function(a,b){ return a-b })
      var mid = Math.floor(sorted.length / 2)
      // Median, not mean — one mis-typed ₹99,999 would drag an average badly,
      // and submissions are unmoderated.
      var median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid-1] + sorted[mid]) / 2)
      return { name: c.name, n: c.prices.length, median: median }
    })
    .sort(function(a,b){ return b.n - a.n })
    .slice(0, 8)

  if (!cars.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:18px 12px;color:var(--text3)">' +
      '<div style="font-size:24px;margin-bottom:6px">📊</div>' +
      '<div style="font-size:12.5px;font-weight:600;margin-bottom:3px">Not enough data yet</div>' +
      '<div style="font-size:11.5px;line-height:1.6">Submit what you paid after a scan — the more collectors report real prices, the sharper this gets for everyone.</div>' +
      '</div>'
    return
  }

  var max = cars[0].n || 1
  wrap.innerHTML = cars.map(function(c, i) {
    var pct = Math.max(6, Math.round((c.n / max) * 100))
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">' +
        '<div style="font-size:11px;font-weight:800;color:var(--text3);width:16px;flex-shrink:0">' + (i+1) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(c.name) + '</div>' +
          '<div style="height:3px;background:var(--surface3);border-radius:2px;margin-top:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:var(--gold);border-radius:2px"></div>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          '<div style="font-size:12.5px;font-weight:800;color:var(--gold)">₹' + c.median.toLocaleString('en-IN') + '</div>' +
          '<div style="font-size:9.5px;color:var(--text3)">' + c.n + ' report' + (c.n === 1 ? '' : 's') + '</div>' +
        '</div>' +
      '</div>'
  }).join('')
}

// Renders approved, still-upcoming events from the database.
//
// The events list used to be four entries hardcoded in index.html, which went
// stale months ago — a live product advertising meets that already happened
// reads as abandoned. Meanwhile submitEvent() wrote user submissions to the
// events table that nothing ever read, so the loop was open at both ends.
export async function renderEvents() {
  var wrap = document.getElementById('events-list')
  if (!wrap) return
  var rows = []
  if (state._sb) {
    try {
      // The RLS policy already limits this to approved events (or your own),
      // so approval stays a deliberate moderation step rather than automatic.
      var today = new Date().toISOString().slice(0, 10)
      var res = await state._sb.from('events')
        .select('name,location,date')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(12)
      if (!res.error && res.data) rows = res.data
    } catch(e) { /* empty state below is a fine fallback */ }
  }
  if (!rows.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:22px 16px;color:var(--text3)">' +
      '<div style="font-size:26px;margin-bottom:8px">📍</div>' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:4px">No upcoming meets listed</div>' +
      '<div style="font-size:11.5px;line-height:1.6">Know one? Submit it below and we\'ll list it for every collector.</div>' +
      '</div>'
    return
  }
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  wrap.innerHTML = rows.map(function(e) {
    var d = new Date(e.date)
    var day = isNaN(d) ? '?' : d.getDate()
    var mon = isNaN(d) ? '' : months[d.getMonth()]
    return '<div class="event-item">' +
             '<div class="event-date"><div class="event-day">' + day + '</div><div class="event-mon">' + mon + '</div></div>' +
             '<div><div class="event-name">' + escHtml(e.name || '') + '</div>' +
             '<div class="event-loc">📍 ' + escHtml(e.location || '') + '</div></div>' +
           '</div>'
  }).join('')
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
    var _av = (state.userProfile && state.userProfile.avatar_url) || ''
    if (_av) {
      avatarEl.textContent = ''
      avatarEl.innerHTML = '<img src="' + escHtml(_av) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">'
      avatarEl.style.background = 'var(--surface2)'
    } else {
      avatarEl.innerHTML = ''
      avatarEl.textContent = initials
      avatarEl.style.background = _avatarGrads[displayName.charCodeAt(0) % _avatarGrads.length]
    }
    avatarEl.style.overflow = 'hidden'
    avatarEl.style.boxShadow = '0 4px 20px rgba(0,0,0,.4)'
  }
  document.getElementById('prof-name').textContent = displayName
  document.getElementById('prof-email').textContent = (state.userProfile && state.userProfile.username) ? '@' + state.userProfile.username + ' · ' + state.currentUser.email : state.currentUser.email
  var planEl = document.getElementById('prof-plan')
  var upEl = document.getElementById('prof-upgrade')
  var sinceEl = document.getElementById('prof-since')
  if (state.userProfile && state.userProfile.is_developer) {
    planEl.textContent = 'Developer · lifetime Pro'; planEl.className = 'plan-badge plan-dev'
    upEl.style.display = 'none'; sinceEl.textContent = ''
  } else if (isProActive(state.userProfile)) {
    planEl.textContent = 'Pro member'; planEl.className = 'plan-badge plan-pro'
    upEl.style.display = 'none'
    sinceEl.textContent = 'Pro until ' + new Date(state.userProfile.pro_until).toLocaleDateString('en-IN')
  } else {
    planEl.textContent = 'Free Plan'; planEl.className = 'plan-badge plan-free'
    upEl.hidden = false; upEl.style.display = ''
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
      recentEl.innerHTML = '<div class="muted small">No scans yet.</div>'
    } else {
      recentEl.innerHTML = _histRows(5)
    }
  }
  var phoneEl = document.getElementById('prof-wa-phone')
  if (phoneEl && state.userProfile && state.userProfile.whatsapp_phone) phoneEl.value = state.userProfile.whatsapp_phone
  var celebEl = document.getElementById('pref-celebrations')
  if (celebEl) celebEl.checked = localStorage.getItem('hs_celebrations') !== 'off'
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
      olxStatus.textContent = 'Shown on your listings so buyers can check your OLX history.'
    }
  }

  var _bd = [
    { icon:'🎯', name:'First Scan',     desc:'Scanned your first car',       fn:function(){return true} },
    { icon:'📦', name:'10 Cars',        desc:'Added 10 cars to collection',  fn:function(){return state.collection.length>=10} },
    { icon:'🏆', name:'50 Cars',        desc:'Serious collector — 50 cars',  fn:function(){return state.collection.length>=50} },
    { icon:'💰', name:'₹5K Club',       desc:'Collection worth ₹5,000+',     fn:function(){var v=0;state.collection.forEach(function(x){v+=parseINR(x.india_collector_inr)});return v>=5000} },
    { icon:'💎', name:'₹50K Collector', desc:'Collection worth ₹50,000+',    fn:function(){var v=0;state.collection.forEach(function(x){v+=parseINR(x.india_collector_inr)});return v>=50000} },
    { icon:'⭐', name:'STH Hunter',     desc:'Found a Super Treasure Hunt',  fn:function(){return state.collection.some(function(x){return(x.rarity||'').toLowerCase().includes('super treasure')})} },
    { icon:'🔥', name:'TH Tracker',     desc:'Found a Treasure Hunt',        fn:function(){return state.collection.some(function(x){return(x.rarity||'').toLowerCase().includes('treasure hunt')})} },
    { icon:'🔥', name:'7-Day Streak',   desc:'Scanned 7 days in a row',      fn:function(){return (JSON.parse(localStorage.getItem('hs_streak')||'{"count":0}').count||0)>=7} },
    { icon:'👥', name:'Referrer',       desc:'Referred a friend',             fn:function(){return !!(state.userProfile&&(state.userProfile.referral_count||0)>0)} },
  ]
  var _bEl = document.getElementById('prof-badges')
  if (_bEl) {
    var _earn = _bd.filter(function(b){try{return b.fn()}catch(e){return false}})
    var _lock = _bd.filter(function(b){try{return !b.fn()}catch(e){return true}})
    _bEl.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Achievements '+_earn.length+'/'+_bd.length+'</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+
      _earn.map(function(b){return '<div title="'+b.desc+'" style="background:linear-gradient(135deg,rgba(255,214,10,.15),rgba(255,214,10,.05));border:1px solid rgba(255,214,10,.3);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px"><span style="font-size:20px">'+b.icon+'</span><div><div style="font-size:12px;font-weight:700">'+b.name+'</div><div style="font-size:10px;color:rgba(255,255,255,.5)">'+b.desc+'</div></div></div>'}).join('')+
      _lock.map(function(b){return '<div title="'+b.desc+' (locked)" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px;opacity:.35;filter:grayscale(1)"><span style="font-size:20px">'+b.icon+'</span><div><div style="font-size:12px;font-weight:700">'+b.name+'</div><div style="font-size:10px;color:rgba(255,255,255,.5)">'+b.desc+'</div></div></div>'}).join('')+
      '</div>'
  }
}

export async function saveProfilePhone() {
  var phoneEl = document.getElementById('prof-wa-phone')
  if (!phoneEl) return
  var phone = phoneEl.value.trim().replace(/\D/g, '')
  if (!phone || phone.length !== 10) { showToast('Enter a valid 10-digit WhatsApp number', 'error'); return }
  if (!state.currentUser || !state._sb) { showToast('Sign in first to save', 'error'); return }
  var btn = document.querySelector('[onclick="saveProfilePhone()"]')
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…' }
  try {
    var res = await state._sb.from('profiles').upsert({
      id: state.currentUser.id,
      email: state.currentUser.email,
      whatsapp_phone: phone
    }, { onConflict: 'id' })
    if (res && res.error) { showToast(res.error.message || "Save failed — try again", "error"); return }
    if (!state.userProfile) state.userProfile = {}
    state.userProfile.whatsapp_phone = phone
    try { localStorage.setItem('hs_profile_cache', JSON.stringify({ data: state.userProfile, ts: Date.now() })) } catch(e) {}
    showToast('WhatsApp number saved ✅', 'success')
    // Auto-fill sell form phone
    var sellPhone = document.getElementById('sl-phone')
    if (sellPhone && !sellPhone.value) sellPhone.value = phone
  } catch(e) {
    captureException(e)
    showToast('Could not save — ' + (e.message || 'try again'), 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save' }
  }
}

export async function saveProfileUsername() {
  var unEl = document.getElementById('prof-username')
  if (!unEl) return
  var username = unEl.value.trim()
  if (!username) { showToast('Enter a username', 'error'); return }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    showToast('Username: 3–30 characters, letters/numbers/underscores only', 'error'); return
  }
  if (!state.currentUser || !state._sb) { showToast('Sign in first to save', 'error'); return }
  var btn = document.querySelector('[onclick="saveProfileUsername()"]')
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…' }
  try {
    // Check if username is taken by someone else
    var check = await state._sb.from('profiles').select('id').eq('username', username).neq('id', state.currentUser.id)
    if (check.data && check.data.length > 0) {
      showToast('That username is already taken', 'error')
      if (btn) { btn.disabled = false; btn.textContent = 'Save' }
      return
    }
    var res = await Promise.race([
      state._sb.from('profiles').upsert({
        id: state.currentUser.id,
        email: state.currentUser.email,
        username: username,
        display_name: username
      }, { onConflict: 'id' }),
      new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('Save timed out — check connection')) }, 8000) })
    ])
    if (res && res.error) { showToast(res.error.message || "Save failed — try again", "error"); return }
    if (!state.userProfile) state.userProfile = {}
    state.userProfile.username = username
    state.userProfile.display_name = username
    state.currentUser.name = username
    try { localStorage.setItem('hs_profile_cache', JSON.stringify({ data: state.userProfile, ts: Date.now() })) } catch(e) {}
    window.updateHeaderUI && window.updateHeaderUI()
    renderProfilePage()
    showToast('Username saved ✅', 'success')
  } catch(e) {
    captureException(e)
    showToast('Could not save username — ' + (e.message || 'try again'), 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save' }
  }
}

export async function saveOLXAccount() {
  var olxEl = document.getElementById('prof-olx-username')
  var olxStatus = document.getElementById('prof-olx-status')
  if (!olxEl) return
  var raw = olxEl.value.trim()
  if (!raw) { showToast('Enter your OLX username or profile URL', 'error'); return }
  if (!state.currentUser || !state._sb) { showToast('Sign in first to save', 'error'); return }

  // Extract clean username from URL or bare username
  var username = raw
    .replace(/https?:\/\/(www\.)?olx\.in\/profile\//i, '')
    .replace(/\?.*$/, '').trim().replace(/^\/+|\/+$/g, '')

  if (!username || username.length < 2) { showToast('Enter a valid OLX username or profile URL', 'error'); return }

  var btn = document.querySelector('[onclick="saveOLXAccount()"]')
  if (btn) { btn.disabled = true; btn.textContent = 'Linking…' }
  if (olxStatus) olxStatus.innerHTML = '<span style="color:var(--gold)">⏳ Saving OLX account…</span>'

  try {
    var res = await state._sb.from('profiles').upsert({
      id: state.currentUser.id,
      email: state.currentUser.email,
      olx_username: username
    }, { onConflict: 'id' })
    if (res && res.error) { showToast(res.error.message || "Save failed — try again", "error"); return }

    if (!state.userProfile) state.userProfile = {}
    state.userProfile.olx_username = username
    try { localStorage.setItem('hs_profile_cache', JSON.stringify({ data: state.userProfile, ts: Date.now() })) } catch(e) {}
    olxEl.value = username

    var profileUrl = 'https://www.olx.in/profile/' + encodeURIComponent(username)
    var searchUrl  = 'https://www.olx.in/items/q-hot+wheels'
    var createUrl  = 'https://www.olx.in/post-ad/'

    if (olxStatus) {
      olxStatus.innerHTML = '<div style="color:#2dc653;font-weight:700;margin-bottom:10px">✅ OLX account linked as <strong>' + escHtml(username) + '</strong></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
        + '<a href="' + escHtml(profileUrl) + '" target="_blank" style="background:rgba(45,198,83,.1);border:1px solid rgba(45,198,83,.25);color:#2dc653;border-radius:10px;padding:10px;font-size:12px;font-weight:600;text-decoration:none;text-align:center;display:block">👤 View Profile</a>'
        + '<a href="' + escHtml(searchUrl) + '" target="_blank" style="background:rgba(76,201,240,.08);border:1px solid rgba(76,201,240,.2);color:#4cc9f0;border-radius:10px;padding:10px;font-size:12px;font-weight:600;text-decoration:none;text-align:center;display:block">🔍 HW Listings</a>'
        + '<a href="' + escHtml(createUrl) + '" target="_blank" style="background:rgba(230,57,70,.08);border:1px solid rgba(230,57,70,.2);color:#e63946;border-radius:10px;padding:10px;font-size:12px;font-weight:600;text-decoration:none;text-align:center;display:block;grid-column:span 2">📤 Post a Car on OLX →</a>'
        + '</div>'
        + '<div style="margin-top:10px;font-size:11px;color:var(--text3)">💡 When you list a car in HotScan Marketplace, use "Post on OLX" above to cross-list — this doubles your reach</div>'
    }
    showToast('OLX linked ✅ — auto-fills on every sell listing', 'success')
  } catch(e) {
    captureException(e)
    if (olxStatus) olxStatus.innerHTML = '<span style="color:#e63946">❌ Could not save — ' + escHtml(e.message || 'try again') + '</span>'
    showToast('Could not link OLX — ' + (e.message || 'try again'), 'error')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Link' }
  }
}

// ── Price history ──
// Monthly averages of what collectors actually reported paying. Shown only when
// there are at least three reports. The previous fallback drew eight bars from a
// random-number generator seeded with the car's name and labelled them an "AI
// estimate" with a percentage change — invented data presented as a trend.
// (It was also never called, so the chart never appeared at all.)
export async function renderPriceHistory(name) {
  var section = document.getElementById('phc')
  var barsEl = document.getElementById('phc-bars')
  var footerEl = document.getElementById('phc-footer')
  if (!section || !barsEl) return
  section.style.display = 'none'
  if (!state._sb || !name) return
  var rows = []
  try {
    var res = await state._sb.from('community_prices')
      .select('price_inr, created_at')
      .ilike('car_name', name)
      .order('created_at', { ascending: true })
      .limit(200)
    rows = (res && res.data) || []
  } catch (e) { return }
  // The user may have scanned something else while this was in flight.
  if (!state.lastResult || state.lastResult.name !== name || rows.length < 3) return

  var buckets = {}
  rows.forEach(function (r) {
    var d = new Date(r.created_at)
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    ;(buckets[key] = buckets[key] || []).push(Number(r.price_inr) || 0)
  })
  var keys = Object.keys(buckets).sort().slice(-8)
  var prices = keys.map(function (k) { var v = buckets[k]; return Math.round(v.reduce(function (a, b) { return a + b }, 0) / v.length) })
  var max = Math.max.apply(null, prices) || 1
  barsEl.innerHTML = ''
  keys.forEach(function (k, i) {
    var col = document.createElement('div'); col.className = 'phc-col'
    var val = document.createElement('div'); val.className = 'phc-val'
    val.textContent = prices[i] >= 1000 ? '₹' + (prices[i] / 1000).toFixed(1) + 'k' : '₹' + prices[i]
    var bar = document.createElement('div'); bar.className = 'phc-bar' + (i === keys.length - 1 ? ' now' : '')
    bar.style.height = Math.max(Math.round(prices[i] / max * 52), 4) + 'px'
    var mo = document.createElement('div'); mo.className = 'phc-mo'
    mo.textContent = new Date(k + '-01').toLocaleString('en-IN', { month: 'short' })
    col.appendChild(val); col.appendChild(bar); col.appendChild(mo)
    barsEl.appendChild(col)
  })
  var titleEl = document.getElementById('phc-title'); if (titleEl) titleEl.textContent = 'Reported prices by month'
  var pill = document.querySelector('#phc .pill'); if (pill) pill.textContent = rows.length + ' reports'
  if (footerEl) footerEl.textContent = 'Monthly average of prices reported by collectors. Unverified.'
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
      ;(async function(){ try{ await state._sb.from('referrals').insert({
        referrer_code: ref,
        referred_user_id: state.currentUser ? state.currentUser.id : null,
        created_at: new Date().toISOString()
      }) }catch(e){} })()
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

// ── Watchlist reminder ──
// Once per watched car, a nudge that its searches are one tap away. This used to
// overwrite #err-box's inline styles, so every later scan error rendered as a
// gold "deal" banner.
export function runAlertCheck() {
  var a = state.alerts && state.alerts[0]
  if (!a || localStorage.getItem('hs_alert_shown_' + a.id)) return
  localStorage.setItem('hs_alert_shown_' + a.id, '1')
  showToast('Still watching for ' + a.name + '. Open Watchlist to search OLX.', 'info', 4500)
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
  var _fb = document.getElementById('scan-feedback'); if (_fb) _fb.style.display = 'none'
  var _tp = document.getElementById('scan-tips-card'); if (_tp && state.currentMode !== 'fake') _tp.style.display = ''
  try { document.getElementById('price-submit').style.display = 'none' } catch(e) {}
  document.getElementById('fc').value = ''
  document.getElementById('fg').value = ''
  try { document.getElementById('fg-multi').value = '' } catch(e) {}
  try { document.getElementById('multi-preview').style.display = 'none'; document.getElementById('multi-thumbs').innerHTML = '' } catch(e) {}
  window.scrollTo({top:0, behavior:'smooth'})
}

// displayOnly: paint the header chip from storage without counting today.
export function updateStreak(displayOnly) {
  var today = new Date().toDateString()
  var yesterday = new Date(Date.now() - 86400000).toDateString()
  var streak = JSON.parse(localStorage.getItem('hs_streak') || '{"count":0,"last":""}')
  if (displayOnly === true) { if (streak.last !== today && streak.last !== yesterday) streak.count = 0 }
  else if (streak.last === today) {}
  else if (streak.last === yesterday) { streak = { count: streak.count + 1, last: today }; localStorage.setItem('hs_streak', JSON.stringify(streak)) }
  else { streak = { count: 1, last: today }; localStorage.setItem('hs_streak', JSON.stringify(streak)) }
  var el = document.getElementById('hdr-streak')
  if (el && streak.count >= 2) { el.textContent = streak.count + '-day streak'; el.style.display = 'inline-flex' }
  else if (el) { el.style.display = 'none' }
  return streak.count
}

export async function shareCollection() {
  var total = state.collection.length
  if (total === 0) { showToast('Add some cars first!', 'error'); return }
  var val = 0; state.collection.forEach(function(c){val+=parseINR(c.india_collector_inr)})
  var sth = state.collection.filter(function(c){return(c.rarity||'').toLowerCase().includes('super treasure')}).length
  var th  = state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('treasure hunt')&&!r.includes('super')}).length
  var rare= state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('rare')||r.includes('error')||r.includes('vintage')}).length
  var avg = total ? Math.round(val/total) : 0
  showToast('Generating share card\u2026', 'success')
  setTimeout(async function() {
    var W=1080,H=1080,cvs=document.createElement('canvas')
    cvs.width=W; cvs.height=H
    var ctx=cvs.getContext('2d')
    var bg=ctx.createLinearGradient(0,0,W,H)
    bg.addColorStop(0,'#0a0a0a'); bg.addColorStop(0.6,'#111827'); bg.addColorStop(1,'#0a0a0a')
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
    ctx.fillStyle='#E63946'; ctx.fillRect(0,0,W,8)
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1
    for(var gx=0;gx<W;gx+=60){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke()}
    for(var gy=0;gy<H;gy+=60){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke()}
    ctx.fillStyle='#E63946'; ctx.beginPath(); ctx.roundRect(60,48,160,54,27); ctx.fill()
    ctx.fillStyle='#fff'; ctx.font='bold 26px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('HOTSCAN',140,75)
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='500 24px -apple-system,sans-serif'
    ctx.textAlign='left'; ctx.fillText('INDIA',232,75)
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='500 30px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='alphabetic'
    ctx.fillText('MY HOT WHEELS COLLECTION',W/2,175)
    ctx.fillStyle='#FFD60A'; ctx.font='900 120px -apple-system,sans-serif'
    ctx.fillText('\u20B9'+val.toLocaleString('en-IN'),W/2,320)
    ctx.fillStyle='rgba(255,214,10,0.45)'; ctx.font='500 26px -apple-system,sans-serif'
    ctx.fillText('Estimated Collection Value',W/2,368)
    ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(80,408); ctx.lineTo(W-80,408); ctx.stroke()
    var stats=[{l:'Cars',v:String(total),c:'#fff'},{l:'Super THs',v:String(sth),c:'#FFD60A'},{l:'Avg',v:'\u20B9'+avg.toLocaleString('en-IN'),c:'#4CC9F0'},{l:'Rare+',v:String(rare+th),c:'#FF6B6B'}]
    var bW=220,bH=140,gap=16,sX=(W-4*bW-3*gap)/2,sY=438
    stats.forEach(function(s,i){
      var bx=sX+i*(bW+gap),by=sY
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(bx,by,bW,bH,18); ctx.fill()
      ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(bx,by,bW,bH,18); ctx.stroke()
      ctx.fillStyle=s.c; ctx.font='800 50px -apple-system,sans-serif'
      ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.fillText(s.v,bx+bW/2,by+82)
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='500 21px -apple-system,sans-serif'; ctx.fillText(s.l,bx+bW/2,by+115)
    })
    var carsImg=state.collection.filter(function(c){return c.image}).slice(0,6)
    var gY=628,iSz=148,iG=16,tW=6*iSz+5*iG,gX=(W-tW)/2
    await Promise.all([0,1,2,3,4,5].map(function(i){
      return new Promise(function(res){
        var car=carsImg[i]
        if(!car){
          ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.fill()
          ctx.font='60px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText(['🚗','🏎','🚙','🚕','🛻','🚐'][i],gX+i*(iSz+iG)+iSz/2,gY+iSz/2); res(); return
        }
        var img=new Image(); img.crossOrigin='anonymous'
        img.onload=function(){
          ctx.save(); ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.clip()
          ctx.drawImage(img,gX+i*(iSz+iG),gY,iSz,iSz); ctx.restore()
          ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1
          ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.stroke(); res()
        }
        img.onerror=function(){
          ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.fill()
          ctx.font='60px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText('🚗',gX+i*(iSz+iG)+iSz/2,gY+iSz/2); res()
        }
        img.src=car.image
      })
    }))
    ctx.fillStyle='rgba(230,57,70,0.18)'; ctx.beginPath(); ctx.roundRect(W/2-200,836,400,64,32); ctx.fill()
    ctx.strokeStyle='rgba(230,57,70,0.45)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect(W/2-200,836,400,64,32); ctx.stroke()
    ctx.fillStyle='#fff'; ctx.font='600 26px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('hotscan.in \u00B7 Free AI Scanner',W/2,868)
    cvs.toBlob(async function(blob){
      var file=new File([blob],'hotscan-collection.png',{type:'image/png'})
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:'My HotScan Collection',text:'\u20B9'+val.toLocaleString('en-IN')+' \u00B7 '+total+' cars \u00B7 hotscan.in'});return}catch(e){}
      }
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob)
      a.download='hotscan-collection.png'; a.click()
      showToast('Image saved! Share to Instagram or WhatsApp Stories.','success')
    },'image/png')
  }, 50)
}

// Utility: Clear scan history
export async function clearScanHistory() {
  var ok = await hsConfirm('Clear Scan History', 'This will delete all your previous scans. This cannot be undone.', 'Clear', '🗑️')
  if (!ok) return
  state.scanHistory = []
  localStorage.setItem('hs_hist', JSON.stringify([]))
  showToast('Scan history cleared', 'success')
}

// Utility: Export collection as CSV
export function exportCollectionCSV() {
  if (state.collection.length === 0) { showToast('Collection is empty', 'error'); return }
  var headers = ['Name','Series','Rarity','Color','Condition','Retail (₹)','Collector (₹)','US Retail ($)','US Collector ($)','Added Date']
  var rows = state.collection.map(function(c) {
    return [
      c.name||'',
      c.series||'',
      c.rarity||'',
      c.color||'',
      c.condition||'',
      cleanINR(c.india_retail_inr)||'',
      cleanINR(c.india_collector_inr)||'',
      c.us_retail_usd||'',
      c.us_collector_usd||'',
      c.added||''
    ]
  })
  var csv = [headers].concat(rows).map(function(r) {
    return r.map(function(v) { return '"' + String(v).replace(/"/g,'""') + '"' }).join(',')
  }).join('\n')
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'})
  var link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'hotscan-collection-' + new Date().toISOString().split('T')[0] + '.csv'
  link.click()
  showToast('Collection exported as CSV', 'success')
}

// Utility: Reset achievements
export async function resetAchievements() {
  var ok = await hsConfirm('Reset Achievements', 'This will clear all earned badges. You can earn them again by completing actions.', 'Reset', '🔄')
  if (!ok) return
  state.achievements = []
  localStorage.setItem('hs_ach', JSON.stringify([]))
  showToast('Achievements reset', 'success')
}




