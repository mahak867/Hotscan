import '@fontsource-variable/bricolage-grotesque/wght.css'
import '@fontsource-variable/schibsted-grotesk/wght.css'
import './style.css'
import * as Sentry from '@sentry/browser'
import { state } from './state.js'
import { VISION_MODEL, SUPA_URL, SUPA_KEY, FREE_SCANS } from './config.js'
import { ol, showToast, checkAndEarnAchievements, isProActive } from './utils.js'
import {
  openAuth, closeAuth, toggleAuthMode, authContinue, signInWithGoogle,
  sendPasswordReset, openAccountModal, closeAccountModal, signOutUser,
  updateHeaderUI, startPayment, loadProfile, initAuth,
  uploadAvatar, removeAvatar
} from './auth.js'
import {
  addToCol, delFromCol, sCol, fCol, searchCol, renderCol, exportVal,
  addCarToCollection, fullCloudSync, editColItem, saveColEdit, closeColEdit,
  setColView, setColTab, shareSaleList
} from './collection.js'
import {
  mpMode, mpFilter, loadAndRenderListings, deleteListing, submitListing,
  openSellerSheet, closeSellerSheet, submitSellerRating,
  openOlxSearch, olxLastResult,
  quickSell, slNotesCounter, slClearPriceHint, slSaveCity, slPhotoSelected
} from './marketplace.js'
import { renderFakeChecklist, resetFakeChecklist } from './guide.js'
import { carArt } from './carart.js'
import {
  goPage, saveKey, showKeySetup, setMode, resetScan,
  openCam, openGal, openFakeCam, openFakeGal, openMulti,
  handleFile, handleMultiFiles,
  submitPrice, addAlert, delAlert, clearAlerts,
  showShare, closeShare, shareWA, shareNative, shareApp, shareResultToGroup,
  copyShareText, shareInstagram,
  submitEvent, renderEvents, renderTrends, selectSeries, toggleHunt,
  showProModal, closeProModal, isPro, getTodayScans, incScans, updateScanCounter,
  checkLimit, syncScanCountFromServer,
  renderProfilePage, saveProfilePhone, saveProfileUsername, saveOLXAccount,
  renderPriceHistory, renderAlerts, renderHunt,
  getRefCode, getRefLink, updateRefUI, copyRefLink, shareViaWA,
  runAlertCheck, handleUpgrade, whatsappSupport, updateStreak, shareCollection,
  startTimer, stopTimer, setStep, resetSteps, runAnalyze, showResult, loadCommunityPrices,
  saveToHist, clearScanHistory, exportCollectionCSV, resetAchievements,
  addToWantList, removeFromWantList, renderWantList, moveWantToCollection, renderRecentScans, shareWantList, moveDockIndicator
} from './ui.js'
import {
  analyzePhoto, analyzeDeal, analyzeFake, scanBarcode,
  analyzeMultiPhoto
} from './scanner.js'

// ── Sentry error monitoring ────────────────────────────────────────────
var _hostname = window.location.hostname
var _sentryEnv = (_hostname === 'hotscan.in' || _hostname.endsWith('.hotscan.in')) ? 'production'
               : _hostname.includes('vercel.app') ? 'preview'
               : 'development'
Sentry.init({
  dsn: 'https://d30983e80b41aa7d1074e677160ffe4d@o4511283952353280.ingest.us.sentry.io/4511283969851392',
  environment: _sentryEnv,
  release: 'hotscan@' + (typeof __SENTRY_RELEASE__ !== 'undefined' ? __SENTRY_RELEASE__ : 'dev'),
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: _sentryEnv === 'production' ? 0.1 : 1.0,
  beforeSend: function(event) {
    // Only drop errors in local dev — keep preview (vercel.app) errors so staging
    // bugs are visible in Sentry under the 'preview' environment filter.
    if (_hostname.includes('localhost') || _hostname === '127.0.0.1') return null
    return event
  }
})
// Expose on window so captureException wrapper in utils.js can access it
window.Sentry = Sentry
window.onerror = function(msg,src,line,col,err){ if(window.Sentry) window.Sentry.captureException(err||new Error(msg)); if(window.showToast&&msg&&!msg.includes('Script error')) window.showToast('Something went wrong — try refreshing','error',4000); return false }
window.onunhandledrejection = function(e){ if(window.Sentry) window.Sentry.captureException(e.reason) }

// NOTE: Do NOT strip the URL hash here — Supabase's detectSessionInUrl:true reads
// the access_token from the hash when the client initialises. Stripping it early
// prevents the OAuth redirect flow from working.

// Expose all onclick-callable functions on window
Object.assign(window, {
  openAuth, closeAuth, toggleAuthMode, authContinue, signInWithGoogle,
  sendPasswordReset, closeAccountModal, signOutUser, openAccountModal,
  startPayment, handleUpgrade, updateHeaderUI, loadProfile,
  uploadAvatar, removeAvatar,
  goPage, setMode, saveKey, showKeySetup, resetScan,
  openCam, openGal, openFakeCam, openFakeGal, openMulti, runAnalyze,
  analyzePhoto, analyzeDeal, analyzeFake, scanBarcode,
  addToCol, delFromCol, sCol, fCol, exportVal, addCarToCollection,
  fullCloudSync, renderCol, setColView, setColTab, editColItem, saveColEdit, closeColEdit,
  addToWantList, removeFromWantList, renderWantList, moveWantToCollection, shareWantList, shareSaleList,
  clearScanHistory, exportCollectionCSV, resetAchievements, resetFakeChecklist,
  submitPrice, addAlert, delAlert, clearAlerts, renderAlerts,
  showShare, closeShare, shareWA, shareNative, shareApp, shareResultToGroup,
  copyShareText, shareInstagram,
  submitEvent, renderEvents, renderTrends, selectSeries, toggleHunt,
  showProModal, closeProModal, isPro, checkLimit,
  mpMode, mpFilter, loadAndRenderListings, deleteListing, submitListing,
  openSellerSheet, closeSellerSheet, submitSellerRating,
  openOlxSearch, olxLastResult,
  quickSell, slNotesCounter, slClearPriceHint, slSaveCity, slPhotoSelected,
  copyRefLink, shareViaWA,
  shareCollection, updateStreak,
  renderProfilePage, saveProfilePhone, saveProfileUsername, saveOLXAccount,
  whatsappSupport,
  ol, showToast,
  getTodayScans, incScans, updateScanCounter, syncScanCountFromServer,
  showResult, loadCommunityPrices, startTimer, stopTimer, setStep, resetSteps, saveToHist,
  analyzeMultiPhoto,
})

// Modules that cannot import state without a cycle (utils.js, and scanner.js in
// places) read it from window. It was never assigned, so achievements, realtime
// sync and pull-to-refresh all silently did nothing.
window.state = state
window.FREE_SCANS = FREE_SCANS
window.toggleCelebrations = function (checked) { localStorage.setItem('hs_celebrations', checked ? 'on' : 'off') }
window._checkAchievements = checkAndEarnAchievements

// ── File inputs ───────────────────────────────────────────────────────
function bindFileInputs() {
  function single(id, mode) {
    var el = document.getElementById(id)
    if (!el) return
    el.addEventListener('change', function (e) {
      if (mode === 'photo') {
        state.multiImages = []
        var mp = document.getElementById('multi-preview'); if (mp) mp.style.display = 'none'
      }
      if (e.target.files[0]) handleFile(e.target.files[0], mode)
    })
  }
  single('fc', 'photo'); single('fg', 'photo'); single('fc-fake', 'fake'); single('fg-fake', 'fake')

  var fgMulti = document.getElementById('fg-multi')
  if (fgMulti) fgMulti.addEventListener('change', function (e) {
    // Copy then clear, so picking the same files again still fires a change.
    var files = Array.prototype.slice.call(e.target.files || [])
    e.target.value = ''
    if (files.length === 1) {
      state.multiImages = []
      var mp = document.getElementById('multi-preview'); if (mp) mp.style.display = 'none'
      handleFile(files[0], 'photo')
    } else if (files.length > 1) {
      handleMultiFiles(files)
    }
  })

  var cs = document.getElementById('col-search')
  if (cs) cs.addEventListener('input', function () { searchCol(cs.value) })
  var bi = document.getElementById('barcode-input')
  if (bi) bi.addEventListener('keydown', function (e) { if (e.key === 'Enter') scanBarcode() })
}

// ── Routing ───────────────────────────────────────────────────────────
// The manifest shortcuts and shared links use #scan / #collection, and the
// back button should move between pages rather than leave the app. Supabase
// also puts #access_token=… in the hash after OAuth, so only hashes that name
// a real page are treated as routes.
var PAGES = ['scan', 'collection', 'marketplace', 'market', 'guide', 'hunt', 'alerts', 'profile', 'more']
function pageFromHash() {
  var h = (window.location.hash || '').replace(/^#\/?/, '')
  return PAGES.indexOf(h) > -1 ? h : null
}
window.addEventListener('hashchange', function () {
  var p = pageFromHash()
  if (p) goPage(p, true)
})

// ── Offline banner ────────────────────────────────────────────────────
function updateOnlineStatus() {
  var banner = document.getElementById('hs-offline')
  if (banner) banner.style.display = navigator.onLine ? 'none' : 'block'
}
window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

// ── Boot ──────────────────────────────────────────────────────────────
window.addEventListener('load', function () {
  bindFileInputs()

  // Cached profile gives the header its Pro ring before the network answers.
  try {
    var _cp = JSON.parse(localStorage.getItem('hs_profile_cache') || 'null')
    if (_cp && _cp.data && (Date.now() - _cp.ts) < 3600000) {
      state.userProfile = _cp.data
      if (isProActive(_cp.data)) localStorage.setItem('hs_pro', 'true')
    }
  } catch (e) {}

  try {
    if (SUPA_URL && SUPA_KEY && window.supabase && window.supabase.createClient) {
      state._sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: {
          persistSession: true,
          storageKey: 'hs_auth_v2',
          storage: window.localStorage,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit'
        }
      })
    }
  } catch (e) { Sentry.captureException(e) }

  var viz = document.getElementById('scan-viz-car')
  if (viz) viz.innerHTML = carArt({ name: 'Porsche 911', color: 'orange' })

  renderCol()
  renderWantList()
  renderAlerts()
  renderEvents()
  renderTrends()
  renderHunt('mainline')
  renderFakeChecklist()
  renderRecentScans()
  renderProfilePage()
  initAuth()
  updateRefUI()
  updateScanCounter()
  updateStreak(true)
  updateOnlineStatus()

  var start = pageFromHash()
  if (start && start !== 'scan') goPage(start, true)
  moveDockIndicator()

  if (!localStorage.getItem('hs_onboarded')) {
    var ob = document.getElementById('hs-onboard')
    if (ob) ob.style.display = 'flex'
  }

  setTimeout(runAlertCheck, 15000)
  setTimeout(function () {
    var b = document.getElementById('ref-banner')
    if (b && isPro()) b.style.display = 'none'
  }, 2000)
})

// ── Onboarding ────────────────────────────────────────────────────────
var _obStep = 0
var _obSteps = [
  { icon: 'i-scan',   title: 'Scan any Hot Wheels', body: 'Point your camera at a car or pick a photo. HotScan names the casting in a few seconds.' },
  { icon: 'i-rupee',  title: 'Priced in rupees', body: 'Indian retail and collector ranges, not converted US prices. Every result says where its number came from.' },
  { icon: 'i-garage', title: 'Your garage, valued', body: 'Add cars to your collection, record what you paid, and watch the total. It works offline and syncs when you sign in.' },
]
window.obNext = function () {
  _obStep++
  if (_obStep >= _obSteps.length) { window.obSkip(); return }
  var s = _obSteps[_obStep]
  var use = document.querySelector('#hs-ob-step use'); if (use) use.setAttribute('href', '#' + s.icon)
  document.getElementById('hs-ob-title').textContent = s.title
  document.getElementById('hs-ob-body').textContent = s.body
  document.querySelectorAll('.ob-dot').forEach(function (d, i) { d.classList.toggle('active', i === _obStep) })
  if (_obStep === _obSteps.length - 1) document.getElementById('hs-ob-next').textContent = 'Start scanning'
}
window.obSkip = function () {
  localStorage.setItem('hs_onboarded', '1')
  var ob = document.getElementById('hs-onboard')
  if (ob) ob.style.display = 'none'
}

// ── Keyboard ──────────────────────────────────────────────────────────
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open, .auth-modal.open').forEach(function (m) { m.classList.remove('open') })
    document.body.style.overflow = ''
    return
  }
  var tag = (e.target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return
  var map = { s: 'scan', c: 'collection', m: 'marketplace', t: 'market', g: 'guide', p: 'profile' }
  var page = map[(e.key || '').toLowerCase()]
  if (page) { e.preventDefault(); goPage(page, false, true) }
})

window.showSkeleton = function (containerId, count) {
  var el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = Array(count || 3).fill(0).map(function () {
    return '<div class="skeleton-card"><div class="skeleton skeleton-thumb"></div><div style="flex:1;display:flex;flex-direction:column;gap:8px"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line sm"></div><div class="skeleton skeleton-line xs"></div></div></div>'
  }).join('')
}

window.submitScanFeedback = async function (accurate) {
  var fb = document.getElementById('scan-feedback')
  if (fb) fb.style.display = 'none'
  showToast(accurate ? 'Thanks, noted.' : 'Thanks. We use these to improve identification.', 'success')
  if (!state._sb || !state.currentUser) return
  try {
    await state._sb.from('scan_feedback').insert({
      user_id: state.currentUser.id,
      car_name: (state.lastResult && state.lastResult.name) || 'Unknown',
      accurate: accurate,
      model: VISION_MODEL,
      created_at: new Date().toISOString()
    })
  } catch (e) {}
}

// ── Cloud sync ────────────────────────────────────────────────────────
// Realtime pushes changes made on another device. The channel can only be
// opened once auth has resolved, so this is retried from the fallback poll
// below rather than fired once on a timer and hoped for.
var _realtimeFor = null
function ensureRealtime() {
  var uid = state.currentUser && state.currentUser.id
  if (!state._sb || uid === _realtimeFor) return
  if (window._realtimeChannel) { try { window._realtimeChannel.unsubscribe() } catch (e) {} window._realtimeChannel = null }
  _realtimeFor = uid || null
  if (!uid) return
  window._realtimeChannel = state._sb
    .channel('collection-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'collection', filter: 'user_id=eq.' + uid }, syncNow)
    .subscribe()
}
function syncNow() {
  if (!state._sb || !state.currentUser) return Promise.resolve(false)
  return fullCloudSync().then(function (ok) { if (ok) renderCol(); return ok }).catch(function () { return false })
}
setTimeout(ensureRealtime, 3000)
setInterval(function () {
  ensureRealtime()
  if (!document.hidden) syncNow()
}, 300000)
document.addEventListener('visibilitychange', function () { if (!document.hidden) { ensureRealtime(); syncScanCountFromServer() } })
setTimeout(syncScanCountFromServer, 3000)

// Pull to refresh on the collection page. Only arms when the page is already
// scrolled to the very top, so an ordinary scroll back up never triggers it.
;(function () {
  var startY = 0, armed = false
  document.addEventListener('touchstart', function (e) {
    var pg = document.getElementById('page-collection')
    armed = !!(pg && pg.classList.contains('active') && window.scrollY <= 0 && state.currentUser)
    if (armed) startY = e.touches[0].clientY
  }, { passive: true })
  document.addEventListener('touchend', function (e) {
    if (!armed) return
    armed = false
    if (e.changedTouches[0].clientY - startY > 110 && window.scrollY <= 0) {
      showToast('Refreshing collection…', 'info')
      syncNow().then(function (ok) { if (ok) showToast('Collection up to date', 'success') })
    }
  }, { passive: true })
})()
