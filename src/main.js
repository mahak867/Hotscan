import './style.css'
import { state } from './state.js'
import { SUPA_URL, SUPA_KEY } from './config.js'
import { ol, showToast } from './utils.js'
import {
  openAuth, closeAuth, toggleAuthMode, authContinue, signInWithGoogle,
  sendPasswordReset, openAccountModal, closeAccountModal, signOutUser,
  updateHeaderUI, startPayment, loadProfile, initAuth
} from './auth.js'
import {
  addToCol, delFromCol, sCol, fCol, renderCol, exportVal,
  addCarToCollection, fullCloudSync
} from './collection.js'
import {
  mpMode, mpFilter, loadAndRenderListings, deleteListing, submitListing,
  quickSell, checkOLX
} from './marketplace.js'
import {
  goPage, saveKey, showKeySetup, setMode, resetScan,
  openCam, openGal, openFakeCam, openFakeGal, openMulti,
  handleFile, handleMultiFiles,
  submitPrice, addAlert, delAlert, clearAlerts,
  showShare, closeShare, shareWA, shareNative, shareApp, shareResultToGroup,
  submitEvent, selectSeries, toggleHunt,
  showProModal, closeProModal, isPro, getTodayScans, incScans, updateScanCounter,
  checkLimit,
  renderProfilePage, saveProfilePhone, saveProfileUsername, saveOLXAccount,
  renderPriceHistory, renderAlerts, renderHunt,
  getRefCode, getRefLink, updateRefUI, copyRefLink, shareViaWA,
  runAlertCheck, handleUpgrade, whatsappSupport,
  startTimer, stopTimer, setStep, resetSteps, runAnalyze, showResult, loadCommunityPrices,
  saveToHist
} from './ui.js'
import {
  analyzePhoto, analyzeDeal, analyzeFake, scanBarcode,
  analyzeMultiPhoto
} from './scanner.js'

// OAuth callback — catches Google redirect token
if (window.location.hash && window.location.hash.includes('access_token')) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

// Expose all onclick-callable functions on window
Object.assign(window, {
  openAuth, closeAuth, toggleAuthMode, authContinue, signInWithGoogle,
  sendPasswordReset, closeAccountModal, signOutUser, openAccountModal,
  startPayment, handleUpgrade, updateHeaderUI, loadProfile,
  goPage, setMode, saveKey, showKeySetup, resetScan,
  openCam, openGal, openFakeCam, openFakeGal, openMulti, runAnalyze,
  analyzePhoto, analyzeDeal, analyzeFake, scanBarcode,
  addToCol, delFromCol, sCol, fCol, exportVal, addCarToCollection,
  fullCloudSync, renderCol,
  submitPrice, addAlert, delAlert, clearAlerts, renderAlerts,
  showShare, closeShare, shareWA, shareNative, shareApp, shareResultToGroup,
  submitEvent, selectSeries, toggleHunt,
  showProModal, closeProModal, isPro, checkLimit,
  mpMode, mpFilter, loadAndRenderListings, deleteListing, submitListing,
  quickSell, checkOLX,
  copyRefLink, shareViaWA,
  renderProfilePage, saveProfilePhone, saveProfileUsername, saveOLXAccount,
  whatsappSupport,
  ol, showToast,
  getTodayScans, incScans, updateScanCounter,
  showResult, loadCommunityPrices, startTimer, stopTimer, setStep, resetSteps, saveToHist,
  analyzeMultiPhoto,
})

// DOMContentLoaded: file input event listeners
document.addEventListener('DOMContentLoaded', function () {
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
    if (e.target.files && e.target.files.length === 1) {
      state.multiImages = []
      var mp = document.getElementById('multi-preview'); if(mp) mp.style.display = 'none'
      handleFile(e.target.files[0], 'photo')
    } else if (e.target.files && e.target.files.length > 1) {
      handleMultiFiles(e.target.files)
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
  } catch (e) { console.warn('Supabase init error:', e) }

  // App init
  var kc = document.getElementById('key-card')
  if (kc) kc.style.display = 'none'
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  var sa = window.matchMedia('(display-mode:standalone)').matches
  var _ib = document.getElementById('ib')
  if (_ib && (!ios || sa)) _ib.style.display = 'none'

  renderCol()
  renderAlerts()
  renderHunt('mainline')
  renderProfilePage()
  initAuth()
  updateRefUI()
  updateScanCounter()

  // Alert check loop
  setTimeout(function () { runAlertCheck(); setInterval(runAlertCheck, 300000) }, 15000)

  // Hide ref banner if Pro or closed
  setTimeout(function () {
    var b = document.getElementById('ref-banner')
    if (b && (isPro() || localStorage.getItem('hs_ref_banner_closed'))) b.style.display = 'none'
  }, 2000)
})
