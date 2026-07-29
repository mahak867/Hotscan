import './style.css'
import * as Sentry from '@sentry/browser'
import { state } from './state.js'
import { VISION_MODEL } from './config.js'
import { SUPA_URL, SUPA_KEY, FREE_SCANS } from './config.js'
import { ol, showToast, checkAndEarnAchievements } from './utils.js'
import {
  openAuth, closeAuth, toggleAuthMode, authContinue, signInWithGoogle,
  sendPasswordReset, openAccountModal, closeAccountModal, signOutUser,
  updateHeaderUI, startPayment, loadProfile, initAuth,
  uploadAvatar, removeAvatar
} from './auth.js'
import {
  addToCol, delFromCol, sCol, fCol, searchCol, renderCol, exportVal,
  addCarToCollection, fullCloudSync, editColItem, saveColEdit, closeColEdit,
  setColView
} from './collection.js'
import {
  mpMode, mpFilter, loadAndRenderListings, deleteListing, submitListing,
  openSellerSheet, closeSellerSheet, submitSellerRating,
  openOlxSearch, olxLastResult,
  quickSell, slNotesCounter, slClearPriceHint, slSaveCity, slPhotoSelected
} from './marketplace.js'
import { addToWantList, removeFromWantList, renderWantList } from './ui.js'
import {
  goPage, saveKey, showKeySetup, setMode, resetScan,
  openCam, openGal, openFakeCam, openFakeGal, openMulti,
  handleFile, handleMultiFiles,
  submitPrice, addAlert, delAlert, clearAlerts,
  showShare, closeShare, shareWA, shareNative, shareApp, shareResultToGroup,
  copyShareText, shareInstagram,
  submitEvent, renderEvents, selectSeries, toggleHunt,
  showProModal, closeProModal, isPro, getTodayScans, incScans, updateScanCounter,
  checkLimit, syncScanCountFromServer,
  renderProfilePage, saveProfilePhone, saveProfileUsername, saveOLXAccount,
  renderPriceHistory, renderAlerts, renderHunt,
  getRefCode, getRefLink, updateRefUI, copyRefLink, shareViaWA,
  runAlertCheck, handleUpgrade, whatsappSupport, updateStreak, shareCollection,
  startTimer, stopTimer, setStep, resetSteps, runAnalyze, showResult, loadCommunityPrices,
  saveToHist, clearScanHistory, exportCollectionCSV, resetAchievements
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
  fullCloudSync, renderCol, setColView,
  submitPrice, addAlert, delAlert, clearAlerts, renderAlerts,
  showShare, closeShare, shareWA, shareNative, shareApp, shareResultToGroup,
  copyShareText, shareInstagram,
  submitEvent, renderEvents, selectSeries, toggleHunt,
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

// Alias — called directly from HTML button
window.FREE_SCANS = FREE_SCANS
window.syncCollectionFromCloud = window.fullCloudSync

// Fix: expose `currentUser` as a live getter on window.
// index.html line 50 has onclick="currentUser?openAccountModal():openAuth()"
// which reads bare `currentUser` from the global scope. Without this, it throws
// ReferenceError on every unauthenticated page load (confirmed in Sentry, May 2026).
// state.currentUser is null until initAuth() resolves, so the getter safely returns
// null for logged-out users and the real user object for logged-in ones.
Object.defineProperty(window, 'currentUser', {
  get() { return state.currentUser },
  configurable: true,
})

window.doCloudSync = async function(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing…' }
  try {
    var timeoutP = new Promise(function(_, rej) {
      setTimeout(function() { rej(new Error('timeout')) }, 5000)
    })
    var ok = await Promise.race([window.fullCloudSync(), timeoutP])
    window.renderProfilePage()
    window.showToast(
      ok ? '✅ Collection synced from cloud!' : '⚠️ No cloud data yet — scan a car first',
      ok ? 'success' : 'error'
    )
  } catch(e) {
    if (e.message === 'timeout') {
      window.showToast('Sync timed out — check your connection and try again', 'error')
    } else if (e.message && e.message.includes('relation') && e.message.includes('does not exist')) {
      window.showToast('Database not set up — contact support', 'error')
    } else {
      window.showToast('Sync failed — ' + (e.message || 'try again'), 'error')
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '☁️ Sync Collection from Cloud' }
  }
}

// Expose collection editing functions to window
window.delFromCol = delFromCol
window.toggleCelebrations = function(checked){ localStorage.setItem('hs_celebrations', checked ? 'on' : 'off') }
window.editColItem = editColItem
window.saveColEdit = saveColEdit
window.closeColEdit = closeColEdit
window._checkAchievements = checkAndEarnAchievements

// Expose utility functions to window
window.clearScanHistory = clearScanHistory
window.addToWantList = addToWantList
window.removeFromWantList = removeFromWantList
window.renderWantList = renderWantList
window.exportCollectionCSV = exportCollectionCSV
window.resetAchievements = resetAchievements

// DOMContentLoaded: file input event listeners + mobile dock touch
document.addEventListener('DOMContentLoaded', function () {
  // Mobile dock: tap dock background to expand, tap outside to collapse
  var dock = document.querySelector('.nav-dock')
  if (dock) {
    var _dockOpen = false
    var _dockTimer = null
    dock.addEventListener('touchstart', function (e) {
      if (!_dockOpen) {
        _dockOpen = true
        dock.classList.add('touch-open')
        clearTimeout(_dockTimer)
        _dockTimer = setTimeout(function () {
          _dockOpen = false
          dock.classList.remove('touch-open')
        }, 3500)
      }
    }, { passive: true })
    document.addEventListener('touchstart', function (e) {
      if (_dockOpen && !dock.contains(e.target)) {
        _dockOpen = false
        dock.classList.remove('touch-open')
        clearTimeout(_dockTimer)
      }
    }, { passive: true })
  }

  var fc = document.getElementById('fc')
  var fg = document.getElementById('fg')
  var fcFake = document.getElementById('fc-fake')
  var fgFake = document.getElementById('fg-fake')
  var fgMulti = document.getElementById('fg-multi')
  if (fc) fc.addEventListener('change', function (e) {
    state.multiImages = []
    var mp = document.getElementById('multi-preview'); if(mp) mp.style.display = 'none'
    if (e.target.files[0]) handleFile(e.target.files[0], 'photo')
  })
  if (fg) fg.addEventListener('change', function (e) {
    state.multiImages = []
    var mp = document.getElementById('multi-preview'); if(mp) mp.style.display = 'none'
    if (e.target.files[0]) handleFile(e.target.files[0], 'photo')
  })
  if (fcFake) fcFake.addEventListener('change', function (e) { if (e.target.files[0]) handleFile(e.target.files[0], 'fake') })
  if (fgFake) fgFake.addEventListener('change', function (e) { if (e.target.files[0]) handleFile(e.target.files[0], 'fake') })
  if (fgMulti) fgMulti.addEventListener('change', function (e) {
    // Copy the list, then clear the input. Without the reset, picking the same
    // files again fires no change event — so a user who removed a photo by
    // mistake could not re-add it without reloading the page.
    var files = Array.prototype.slice.call(e.target.files || [])
    e.target.value = ''
    if (files.length === 1) {
      state.multiImages = []
      var mp = document.getElementById('multi-preview'); if(mp) mp.style.display = 'none'
      handleFile(files[0], 'photo')
    } else if (files.length > 1) {
      handleMultiFiles(files)
    }
  })

  // Swipe-to-dismiss for result card
  var resultEl = document.getElementById('result')
  if (resultEl) {
    var _swipeStartY = 0
    resultEl.addEventListener('touchstart', function (e) { _swipeStartY = e.touches[0].clientY }, { passive: true })
    resultEl.addEventListener('touchend', function (e) {
      if (e.changedTouches[0].clientY - _swipeStartY > 60) window.resetScan()
    }, { passive: true })
  }
})

// window.load: app init
window.addEventListener('load', function () {
  // Restore cached profile for instant header UI
  try {
    var _cp = JSON.parse(localStorage.getItem('hs_profile_cache') || 'null')
    if (_cp && _cp.data && (Date.now() - _cp.ts) < 3600000) {
      state.userProfile = _cp.data
      if (_cp.data.is_pro || _cp.data.is_developer) localStorage.setItem('hs_pro', 'true')
    }
  } catch (e) {}

  // Init Supabase
  try {
    if (window.supabase && window.supabase.createClient) {
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

  // App init
  var kc = document.getElementById('key-card')
  if (kc) kc.style.display = 'none'
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  var sa = window.matchMedia('(display-mode:standalone)').matches
  var _ib = document.getElementById('ib')
  if (_ib && (!ios || sa)) _ib.style.display = 'none'

  renderCol()
  renderAlerts()
  renderEvents()
  renderHunt('mainline')
  renderProfilePage()
  initAuth()
  updateRefUI()
  updateScanCounter()
  // Sync server-side scan count after short delay (auth needs to initialize first)
  setTimeout(syncScanCountFromServer, 3000)

  // ── Onboarding — show to first-time users ────────────────────────────
  if (!localStorage.getItem('hs_onboarded')) {
    var ob = document.getElementById('hs-onboard')
    if (ob) ob.style.display = 'flex'
  }

  // ── Offline detection ────────────────────────────────────────────────
  function updateOnlineStatus() {
    var banner = document.getElementById('hs-offline')
    if (!banner) return
    if (!navigator.onLine) {
      banner.style.display = 'block'
      document.body.style.paddingTop = '40px'
    } else {
      banner.style.display = 'none'
      document.body.style.paddingTop = ''
    }
  }
  window.addEventListener('online',  updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  updateOnlineStatus()

  // Alert check loop
  var _alertInterval = null
  setTimeout(function () { runAlertCheck(); if (!_alertInterval) { _alertInterval = setInterval(runAlertCheck, 300000) } }, 15000)

  // Hide ref banner if Pro or closed
  setTimeout(function () {
    var b = document.getElementById('ref-banner')
    if (b && (isPro() || localStorage.getItem('hs_ref_banner_closed'))) b.style.display = 'none'
  }, 2000)
})

// ── Onboarding steps ──────────────────────────────────────────────────
var _obStep = 0
var _obSteps = [
  { icon:'📷', title:'Scan Any Hot Wheels', body:'Point your camera at any Hot Wheels car — or upload a photo from your gallery. Works on any phone.' },
  { icon:'₹', title:'Get Live Indian Prices', body:'AI identifies the exact car and shows real Indian market prices — retail, collector, OLX, Instagram swap meets.' },
  { icon:'📦', title:'Build Your Collection', body:'Add scanned cars to your collection. Track total value, spot Treasure Hunts, and share with other collectors.' },
]
window.obNext = function() {
  _obStep++
  if (_obStep >= _obSteps.length) { window.obSkip(); return }
  var s = _obSteps[_obStep]
  document.getElementById('hs-ob-step').textContent = s.icon
  document.getElementById('hs-ob-title').textContent = s.title
  document.getElementById('hs-ob-body').textContent  = s.body
  document.querySelectorAll('.ob-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === _obStep)
  })
  if (_obStep === _obSteps.length - 1) {
    document.getElementById('hs-ob-next').textContent = '🚗 Start Scanning!'
  }
}
window.obSkip = function() {
  localStorage.setItem('hs_onboarded', '1')
  var ob = document.getElementById('hs-onboard')
  if (ob) { ob.style.opacity = '0'; ob.style.transition = 'opacity .3s'; setTimeout(function(){ ob.style.display = 'none' }, 300) }
}
document.addEventListener('keydown', function(e) {
  var tag = (e.target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return
  var map = { s:'scan', c:'collection', m:'marketplace', t:'market', p:'profile' }
  var page = map[e.key.toLowerCase()]
  if (page) { e.preventDefault(); window.goPage(page) }
})
window.showSkeleton = function(containerId, count) {
  var el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = Array(count || 3).fill(0).map(function() {
    return '<div class="skeleton-card"><div class="skeleton skeleton-thumb"></div><div style="flex:1;display:flex;flex-direction:column;gap:8px"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line sm"></div><div class="skeleton skeleton-line xs"></div></div></div>'
  }).join('')
}

window.submitScanFeedback = async function(accurate) {
  var fb = document.getElementById('scan-feedback')
  if (fb) fb.style.display = 'none'
  showToast(accurate ? '👍 Thanks!' : '👎 Noted — we will improve.', 'success')
  if (!state._sb || !state.currentUser) return
  try {
    await state._sb.from('scan_feedback').insert({
      user_id: state.currentUser.id,
      car_name: (state.lastResult && state.lastResult.name) || 'Unknown',
      accurate: accurate,
      model: VISION_MODEL,
      created_at: new Date().toISOString()
    })
  } catch(e) {}
}
// Background collection sync every 30s when logged in
// Supabase Realtime — instant sync when collection changes on any device
function _setupRealtimeSync() {
  if (!window.state || !window.state._sb || !window.state.currentUser) return
  if (window._realtimeChannel) window._realtimeChannel.unsubscribe()
  window._realtimeChannel = window.state._sb
    .channel('collection-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'collection',
      filter: 'user_id=eq.' + window.state.currentUser.id
    }, function() {
      window.fullCloudSync().then(function(ok) {
        if (ok) window.renderCol()
      }).catch(function(){})
    })
    .subscribe()
}
// Set up realtime after auth resolves
setTimeout(_setupRealtimeSync, 3000)
// Fallback poll every 30s in case realtime disconnects
setInterval(function() {
  if (document.hidden) return
  if (window.state && window.state.currentUser && window.state._sb) {
    window.fullCloudSync().then(function(ok) {
      if (ok) window.renderCol()
    }).catch(function(){})
  }
}, 30000)


// Pull to refresh on collection page
;(function(){
  var startY = 0, pulling = false
  document.addEventListener('touchstart', function(e) {
    var pg = document.getElementById('page-collection')
    if (!pg || !pg.classList.contains('active')) return
    if (pg.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true }
  }, {passive: true})
  document.addEventListener('touchend', function(e) {
    if (!pulling) return
    var dy = e.changedTouches[0].clientY - startY
    if (dy > 80 && window.state && window.state.currentUser) {
      window.showToast('Refreshing collection...', 'info')
      window.fullCloudSync().then(function(ok) {
        if (ok) { window.renderCol(); window.showToast('Collection updated', 'success') }
      })
    }
    pulling = false
  }, {passive: true})
})()

// Keep Supabase connection warm — prevents cold start timeouts
setInterval(function() {
  if (window.state && window.state._sb) {
    window.state._sb.from('profiles').select('id').limit(1).then(function(){}).catch(function(){})
  }
}, 240000) // every 4 minutes
