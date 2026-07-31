import { state } from './state.js'
import { SUPA_URL, SUPA_KEY, RZP_KEY } from './config.js'
import { escHtml, sanitize, showToast, captureException } from './utils.js'

export var _authMode = 'signin'
export var _authStep = 'email'
export var _authEmail = ''

export function openAuth(){
  if(state.currentUser){ openAccountModal(); return }
  _authMode='signin'; _authStep='email'; _authEmail=''
  var modal=document.getElementById('auth-modal')
  if(!modal) return
  modal.classList.add('open')
  document.body.style.overflow='hidden'
  resetAuthForm()
  setTimeout(function(){ var i=document.getElementById('auth-email-inp'); if(i) i.focus() }, 200)
}

export function closeAuth(){
  var modal = document.getElementById('auth-modal')
  if(modal) modal.classList.remove('open')
  document.body.style.overflow = ''
}

export function resetAuthForm(){
  var e=document.getElementById('auth-email-inp')
  var p=document.getElementById('auth-pass-inp')
  var pf=document.getElementById('auth-pass-field')
  var em=document.getElementById('auth-err-msg')
  var bt=document.getElementById('auth-btn-txt')
  var sp=document.getElementById('auth-spinner')
  var bn=document.getElementById('auth-continue-btn')
  var uf=document.getElementById('auth-username-field')
  var vs=document.getElementById('auth-verify-step')
  var ef=document.getElementById('auth-email-form')
  if(e) e.value=''
  if(p) p.value=''
  if(pf) pf.style.display='none'
  if(em) em.textContent=''
  if(bt){ bt.textContent='Continue'; bt.style.display='block' }
  if(sp) sp.style.display='none'
  if(bn){ bn.disabled=false }
  if(uf) uf.style.display='none'
  if(vs) vs.style.display='none'
  if(ef) ef.style.display='block'
}

export function toggleAuthMode(){
  _authMode = _authMode === 'signin' ? 'signup' : 'signin'
  _authStep = 'email'
  document.getElementById('auth-pass-field').style.display = 'none'
  document.getElementById('auth-err-msg').textContent = ''
  document.getElementById('auth-btn-txt').textContent = 'Continue'
  updateAuthSwitchUI()
}

export function updateAuthSwitchUI(){
  var switchTxt = document.getElementById('auth-switch-txt')
  var switchBtn = document.getElementById('auth-switch-btn')
  var headline = document.querySelector('.auth-headline')
  var usernameField = document.getElementById('auth-username-field')
  var forgotBtn = document.querySelector('.auth-forgot')
  if(_authMode === 'signin'){
    if(switchTxt) switchTxt.textContent = 'No account?'
    if(switchBtn) switchBtn.textContent = 'Sign up free'
    if(headline) headline.textContent = 'Sign in'
    if(usernameField && _authStep === 'password') usernameField.style.display = 'none'
    if(forgotBtn) forgotBtn.style.display = 'block'
  } else {
    if(switchTxt) switchTxt.textContent = 'Already have an account?'
    if(switchBtn) switchBtn.textContent = 'Sign in'
    if(headline) headline.textContent = 'Create account'
    if(usernameField && _authStep === 'password') usernameField.style.display = 'block'
    if(forgotBtn) forgotBtn.style.display = 'none'
  }
}

export function setAuthLoading(loading){
  var btn = document.getElementById('auth-continue-btn')
  var txt = document.getElementById('auth-btn-txt')
  var spin = document.getElementById('auth-spinner')
  btn.disabled = loading
  txt.style.display = loading ? 'none' : 'block'
  spin.style.display = loading ? 'block' : 'none'
}

export function showAuthErr(msg){
  document.getElementById('auth-err-msg').textContent = msg
}

export async function authContinue(){
  var rawInput=document.getElementById('auth-email-inp').value.trim()
  if(!rawInput){ showAuthErr('Enter your email or username'); return }
  var looksLikeEmail = rawInput.includes('@')
  if(looksLikeEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(rawInput)){ showAuthErr('Enter a valid email'); return }
  if(_authStep==='email'){
    _authEmail=rawInput; _authStep='password'
    document.getElementById('auth-pass-field').style.display='block'
    var uf=document.getElementById('auth-username-field')
    if(uf&&_authMode==='signup') uf.style.display='block'
    var bt=document.getElementById('auth-btn-txt')
    if(bt) bt.textContent=_authMode==='signin'?'Sign In':'Create Account'
    document.getElementById('auth-err-msg').textContent=''
    setTimeout(function(){ var p=document.getElementById('auth-pass-inp'); if(p) p.focus() },80)
    return
  }
  if(!rawInput) rawInput = _authEmail
  var pass=document.getElementById('auth-pass-inp').value
  if(!pass){ showAuthErr('Enter your password'); return }
  if(_authMode==='signup'&&pass.length<6){ showAuthErr('Password must be at least 6 characters'); return }
  if(!state._sb){ showAuthErr('Service unavailable — please refresh the page'); return }
  setAuthLoading(true); showAuthErr('')
  var _to=setTimeout(function(){ setAuthLoading(false); showAuthErr('Connection timed out — check your internet and try again') },25000)
  try{
    if(_authMode==='signin'){
      var signInEmail = rawInput
      if(!rawInput.includes('@')){
        var lu = await Promise.race([state._sb.rpc('get_email_by_username', { p_username: rawInput }), new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'))},8000)})])
        // get_email_by_username returns plain text (a bare email string),
        // not an object — lu.data IS the email itself in the normal case.
        // The old check here tested lu.data.email, which is undefined on a
        // string, so it always failed even when the RPC worked correctly.
        var foundEmail = typeof lu.data === 'string' ? lu.data : (lu.data && lu.data.email) ? lu.data.email : ''
        if(lu.error || !foundEmail){
          clearTimeout(_to); setAuthLoading(false)
          showAuthErr('No account found for that username. Try your email instead.')
          return
        }
        signInEmail = foundEmail
      }
      var r=await state._sb.auth.signInWithPassword({email:signInEmail,password:pass})
      clearTimeout(_to)
      if(r.error){
        var m=r.error.message||''
        if(m.toLowerCase().includes('invalid')||m.toLowerCase().includes('wrong')||m.toLowerCase().includes('credentials')) m='Wrong email/username or password'
        else if(m.toLowerCase().includes('confirm')||m.toLowerCase().includes('verif')) m='Verify your email first — check inbox'
        else if(m.toLowerCase().includes('not found')||m.toLowerCase().includes('no user')) m='No account found — sign up first'
        showAuthErr(m); setAuthLoading(false)
      } else {
        setAuthLoading(false); closeAuth()
        setTimeout(showSuccessCelebration,300)
      }
    } else {
      var usernameVal = (document.getElementById('auth-username-inp')||{}).value
      usernameVal = usernameVal ? usernameVal.trim() : ''
      if(usernameVal && !/^[a-zA-Z0-9_]{3,30}$/.test(usernameVal)){
        clearTimeout(_to); setAuthLoading(false)
        showAuthErr('Username must be 3–30 characters: letters, numbers, underscores only')
        return
      }
      if(usernameVal){
        var ucheck = await state._sb.from('profiles').select('id').eq('username', usernameVal).single()
        if(ucheck.data){
          clearTimeout(_to); setAuthLoading(false)
          showAuthErr('That username is already taken. Please choose another.')
          return
        }
      }
      var signUpEmail = rawInput.includes('@') ? rawInput : ''
      if(!signUpEmail){ clearTimeout(_to); setAuthLoading(false); showAuthErr('Enter a valid email address to create an account'); return }
      var displayName = usernameVal || signUpEmail.split('@')[0]
      var sr=await state._sb.auth.signUp({email:signUpEmail,password:pass,options:{emailRedirectTo:window.location.origin,data:{full_name:displayName,username:usernameVal||null}}})
      clearTimeout(_to)
      if(sr.error){
        var sm=sr.error.message||''
        if(sm.toLowerCase().includes('already')||sm.toLowerCase().includes('registered')) sm='Account already exists — sign in instead'
        showAuthErr(sm)
      } else {
        if(sr.data&&sr.data.user&&usernameVal){
          ;(async function(){ try{ await state._sb.from('profiles').upsert({id:sr.data.user.id,email:signUpEmail,display_name:displayName,username:usernameVal},{onConflict:'id'}) }catch(e){} })()
        }
        if(!sr.data||!sr.data.session){
          var ef=document.getElementById('auth-email-form')
          var vs=document.getElementById('auth-verify-step')
          if(ef) ef.style.display='none'
          if(vs) vs.style.display='block'
        }
      }
      setAuthLoading(false)
    }
  }catch(e){ clearTimeout(_to); showAuthErr('Something went wrong — please try again'); setAuthLoading(false) }
}

// Handle Enter key
document.addEventListener('keydown', function(e){
  if(e.key === 'Enter'){
    var modal = document.getElementById('auth-modal')
    if(modal && modal.classList.contains('open')) authContinue()
  }
})

export function signInWithGoogle(){
  if(!state._sb){ showAuthErr('Service unavailable'); return }
  var redirectTo = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? window.location.origin
    : 'https://hotscan.in'
  state._sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo + '/index.html',
      queryParams: { access_type: 'offline', prompt: 'select_account' }
    }
  }).catch(function(e){ showAuthErr('Google sign-in failed. Try email instead.') })
}

export async function sendPasswordReset(){
  var email = document.getElementById('auth-email-inp').value.trim() || _authEmail
  if(!email){ showAuthErr('Enter your email address first'); return }
  if(!state._sb){ showAuthErr('Service unavailable'); return }
  var r = await state._sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://hotscan.in/reset-password.html' })
  if(r.error){ showAuthErr(r.error.message) }
  else{
    var errEl = document.getElementById('auth-err-msg')
    errEl.style.color = 'var(--green)'
    errEl.textContent = '✓ Reset link sent! Check your email inbox.'
  }
}

export function showSuccessCelebration(){
  if(!state.currentUser) return
  if(localStorage.getItem('hs_celebrations') === 'off') return
  var overlay = document.getElementById('auth-success-overlay')
  var nameEl = document.getElementById('auth-success-name')
  if(!overlay) return

  if(nameEl) nameEl.textContent = state.currentUser ? (state.currentUser.name || state.currentUser.email.split('@')[0]) : ''

  overlay.style.display = 'block'
  overlay.style.background = 'rgba(0,0,0,.75)'

  var canvas = document.getElementById('cars-canvas')
  if(!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  var ctx = canvas.getContext('2d')

  var emojis = ['🚗','🏎️','🚕','🏁','🚗','🏎️','🚗']
  var cars = []
  for(var i=0; i<18; i++){
    cars.push({
      x: -100 - Math.random()*window.innerWidth,
      y: Math.random()*window.innerHeight,
      speed: 3 + Math.random()*5,
      size: 20 + Math.random()*28,
      emoji: emojis[Math.floor(Math.random()*emojis.length)],
      opacity: 0.4 + Math.random()*0.6,
      wave: Math.random()*Math.PI*2,
      waveSpeed: 0.02 + Math.random()*0.03,
    })
  }

  var startTime = Date.now()
  var duration = 2800

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height)
    var elapsed = Date.now() - startTime
    var progress = elapsed / duration

    if(progress >= 1){
      overlay.style.display = 'none'
      return
    }

    var alpha = progress > 0.7 ? 1 - (progress-0.7)/0.3 : 1

    cars.forEach(function(car){
      car.x += car.speed
      car.wave += car.waveSpeed
      var yOffset = Math.sin(car.wave) * 12

      ctx.save()
      ctx.globalAlpha = car.opacity * alpha
      ctx.font = car.size + 'px serif'
      ctx.fillText(car.emoji, car.x, car.y + yOffset)
      ctx.restore()

      if(car.x > canvas.width + 100){
        car.x = -120
        car.y = Math.random()*canvas.height
      }
    })

    requestAnimationFrame(animate)
  }
  animate()
}

var _authInitialized = false
export async function initAuth(){
  if (_authInitialized) return  // Prevent double-init lock contention
  _authInitialized = true
  if(!state._sb){ updateHeaderUI(); return }
  var am=document.getElementById('auth-modal'); if(am) am.classList.remove('open')
  document.body.style.overflow=''
  try{
    state._sb.auth.onAuthStateChange(async function(event,session){
      if(session&&session.user){
        var u=session.user
        // supabase-js re-fires SIGNED_IN (not just token refresh events) whenever
        // the tab regains focus/visibility, even for an already-active session.
        // Only treat it as a genuine new login if we weren't already signed in
        // as this same user — otherwise the welcome celebration and sync toast
        // fire every single time you switch back to the tab.
        var wasAlreadySignedIn = !!(state.currentUser && state.currentUser.id === u.id)
        state.currentUser={id:u.id,email:u.email||'',name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||u.email.split('@')[0]}
        await loadProfile()
        var isFreshSignIn = event==='SIGNED_IN' && !wasAlreadySignedIn
        if(isFreshSignIn){ closeAuth(); if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(showSuccessCelebration,300) }
        window._authResolved = true
        if(event==='INITIAL_SESSION'||event==='SIGNED_IN'){
          ;(async function(){ window._colSyncing = true; try{ var _sok = await window.fullCloudSync(); window._colSyncing = false; window.renderCol(); if(_sok && isFreshSignIn) window.showToast('Collection synced ✅', 'success') }catch(e){} })()
          if(window.syncScanCountFromServer) setTimeout(window.syncScanCountFromServer, 1000)
        }
        updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
      } else {
        state.currentUser=null; state.userProfile=null; state.collection=[]
  if(window.renderCol) window.renderCol()
        localStorage.removeItem('hs_pro')
        updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
      }
    })
    // Wait 100ms after subscribing before calling getSession
    // Prevents lock contention: onAuthStateChange fires INITIAL_SESSION simultaneously
    await new Promise(function(r){ setTimeout(r, 100) })
    var sr = await state._sb.auth.getSession()
    if(sr.data && sr.data.session && sr.data.session.user && !state.currentUser){
      var u = sr.data.session.user
      state.currentUser = {id:u.id, email:u.email||'', name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||u.email.split('@')[0]}
      await loadProfile()
      ;(async function(){ try{ await window.fullCloudSync(); window.renderCol() }catch(e){} })()
      if(window.syncScanCountFromServer) setTimeout(window.syncScanCountFromServer, 2000)
      updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
    }
    // Note: removed refreshSession() — it fought getSession() for the same lock.
    // onAuthStateChange with INITIAL_SESSION event handles expired token refresh automatically.
  }catch(e){ captureException(e) }
  updateHeaderUI(); window.renderProfilePage && window.renderProfilePage()
}

export async function loadProfile(){
  if(!state.currentUser||!state._sb) return
  try{
    var q=await state._sb.from('profiles').select('*').eq('id',state.currentUser.id).single()
    if(q.data){ state.userProfile=q.data }
    else{
      var metaUsername = null
      try {
        var sess = await state._sb.auth.getSession()
        var meta = sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.user_metadata
        if(meta && meta.username) metaUsername = meta.username
      }catch(e2){}
      await state._sb.from('profiles').upsert({
        id: state.currentUser.id,
        email: state.currentUser.email,
        display_name: metaUsername || state.currentUser.name || state.currentUser.email.split('@')[0],
        username: metaUsername || null,
        is_pro: false,
        is_developer: false
      }, { onConflict: 'id', ignoreDuplicates: true }) // ignoreDuplicates:true = only insert, never overwrite existing
      var q2=await state._sb.from('profiles').select('*').eq('id',state.currentUser.id).single()
      state.userProfile=q2.data||{id:state.currentUser.id,email:state.currentUser.email,is_pro:false,is_developer:false}
    }
    if(state.userProfile&&state.userProfile.is_pro){
      localStorage.setItem('hs_pro','true')
    }
    try{ localStorage.setItem('hs_profile_cache',JSON.stringify({data:state.userProfile,ts:Date.now()})) }catch(e){}
  }catch(e){
    captureException(e)
    try{
      var c=JSON.parse(localStorage.getItem('hs_profile_cache')||'null')
      if(c&&c.data&&(Date.now()-c.ts)<7200000) state.userProfile=c.data
    }catch(e2){}
  }
  updateHeaderUI(); window.renderProfilePage()
}

export function updateHeaderUI(){
  var btn=document.getElementById('user-hdr-btn')
  var dd=document.getElementById('profile-dd-menu')
  if(!btn) return
  if(!state.currentUser){
    btn.innerHTML='<div class="app-user-inner">Sign In</div>'
    btn.onclick=function(){ openAuth() }
    if(dd){ dd.classList.remove('open'); dd.innerHTML='' }
    return
  }
  var prefs={}; try{ prefs=JSON.parse(localStorage.getItem('hs_prefs')||'{}') }catch(e){}
  var name=prefs.displayName||(state.userProfile&&state.userProfile.username)||state.currentUser.name||state.currentUser.email.split('@')[0]||'?'
  var initial=escHtml((name.length > 0 ? name[0] : '?').toUpperCase())
  var safeName=escHtml(name)
  var isDev=!!(state.userProfile&&state.userProfile.is_developer)
  var isProUser=!isDev&&!!(state.userProfile&&state.userProfile.is_pro)
  var bg=isDev?'linear-gradient(135deg,#7c3aed,#4f46e5)':isProUser?'linear-gradient(135deg,#e63946,#ff6b35)':(prefs.avatarColor||'linear-gradient(135deg,#374151,#4b5563)')
  var badge=isDev?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;margin-left:4px;white-space:nowrap">&#x1F451; Dev</span>':isProUser?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:linear-gradient(90deg,#e63946,#ffd60a);color:#000;margin-left:4px;white-space:nowrap">&#x2B50; Pro</span>':''
  // Just the avatar. The old chip stacked three things — gradient circle, the
  // truncated username, and a loud Pro/Dev pill — which read as cluttered and
  // ate ~90px of a header where the search field only has ~215px to work with.
  //
  // Plan is now a ring colour rather than a text badge: gold for Pro, violet for
  // Dev, neutral otherwise. The name, email and plan are all one tap away in the
  // dropdown, which already shows them, so nothing is actually lost.
  var av=avatarUrl()
  var avInner=av
    ? '<img src="'+escHtml(av)+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block">'
    : initial
  var ring=isDev?'#7c3aed':isProUser?'var(--gold)':'rgba(255,255,255,.18)'
  var planLabel=isDev?'Developer':isProUser?'Pro':'Free'
  btn.innerHTML='<button type="button" class="hs-avatar-btn'+(isDev||isProUser?' is-plan':'')+'" style="--ring:'+ring+';background:'+bg+'" '+
    'aria-label="'+safeName+' — '+planLabel+' account. Open account menu" title="'+safeName+' · '+planLabel+'">'+avInner+'</button>'
  btn.onclick=function(e){ e.stopPropagation(); if(dd) dd.classList.toggle('open') }
  if(dd){
    dd.innerHTML =
      '<div class="profile-dd-head"><div class="profile-dd-name">'+safeName+'</div><div class="profile-dd-email">'+escHtml(state.currentUser.email)+'</div></div>'+
      '<div class="profile-dd-item" id="pdd-profile">👤 Profile</div>'+
      '<div class="profile-dd-item" id="pdd-collection">🚗 My Collection</div>'+
      '<div class="profile-dd-divider"></div>'+
      '<div class="profile-dd-item" id="pdd-settings">⚙️ Account Settings</div>'+
      '<div class="profile-dd-item danger" id="pdd-signout">↪ Sign Out</div>'
    document.getElementById('pdd-profile').onclick=function(){ dd.classList.remove('open'); window.goPage('profile') }
    document.getElementById('pdd-collection').onclick=function(){ dd.classList.remove('open'); window.goPage('collection') }
    document.getElementById('pdd-settings').onclick=function(){ dd.classList.remove('open'); openAccountModal() }
    document.getElementById('pdd-signout').onclick=function(){ dd.classList.remove('open'); signOutUser() }
  }
}
// Close the dropdown on any outside click — attached once, not per-render
if(typeof document!=='undefined' && !document._pddOutsideClickBound){
  document._pddOutsideClickBound = true
  document.addEventListener('click', function(e){
    var dd=document.getElementById('profile-dd-menu')
    if(dd && dd.classList.contains('open') && !e.target.closest('.profile-dd')) dd.classList.remove('open')
  })
}

// ── Profile picture ─────────────────────────────────────────────────────────
// Avatars live in Storage, not base64 in the profiles row: the header renders
// one on every page, so inlining would bloat every profile read.
// Path is <user-id>/avatar.jpg, which is what the storage RLS policies key on.

// Squares and downsizes to 256px before upload. Users pick full-resolution
// camera photos; without this a 4MB JPEG would be pushed to Storage and pulled
// back on every page load.
function _squareAvatar(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image()
    img.onload = function() {
      try {
        var s = Math.min(img.width, img.height)
        var c = document.createElement('canvas')
        c.width = 256; c.height = 256
        c.getContext('2d').drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, 256, 256)
        c.toBlob(function(b){ resolve(b) }, 'image/jpeg', 0.85)
      } catch(e) { resolve(null) }
    }
    img.onerror = function(){ resolve(null) }
    img.src = dataUrl
  })
}

export async function uploadAvatar(input) {
  var file = input && input.files && input.files[0]
  if (!file) return
  if (!state.currentUser || !state._sb) { showToast('Sign in to set a profile picture', 'error'); return }
  if (!/^image\//.test(file.type)) { showToast('Pick an image file', 'error'); return }
  // Guard before decoding — a huge file would otherwise be read into memory
  // in full just to be thrown away by the resize.
  if (file.size > 8 * 1024 * 1024) { showToast('Image too large — pick one under 8MB', 'error'); return }

  showToast('Uploading picture…', 'info')
  try {
    var raw = await new Promise(function(res, rej) {
      var rd = new FileReader()
      rd.onload = function(e){ res(e.target.result) }
      rd.onerror = function(){ rej(new Error('Could not read that file')) }
      rd.readAsDataURL(file)
    })
    var blob = await _squareAvatar(raw)
    if (!blob) throw new Error('Could not process that image')

    var path = state.currentUser.id + '/avatar.jpg'
    var up = await state._sb.storage.from('avatars')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (up.error) throw up.error

    var pub = state._sb.storage.from('avatars').getPublicUrl(path)
    // Cache-bust: the path is stable across uploads (upsert), so without a
    // changing query string the browser keeps showing the previous picture.
    var url = pub.data.publicUrl + '?v=' + Date.now()

    var upd = await state._sb.from('profiles').update({ avatar_url: url }).eq('id', state.currentUser.id)
    if (upd.error) throw upd.error

    if (!state.userProfile) state.userProfile = {}
    state.userProfile.avatar_url = url
    updateHeaderUI()
    if (window.renderProfilePage) window.renderProfilePage()
    showToast('Profile picture updated ✅', 'success')
  } catch(e) {
    // A missing bucket/column means the migration hasn't been run yet — say so
    // rather than showing a raw Postgres error.
    var m = (e && e.message) || ''
    if (m.indexOf('avatar_url') > -1 || m.indexOf('Bucket not found') > -1 || m.indexOf('column') > -1) {
      showToast('Profile pictures not set up yet — run the latest SQL migration', 'error')
    } else {
      showToast('Upload failed — ' + (m || 'try again'), 'error')
    }
    captureException(e)
  } finally {
    if (input) input.value = ''
  }
}

export async function removeAvatar() {
  if (!state.currentUser || !state._sb) return
  try {
    await state._sb.storage.from('avatars').remove([state.currentUser.id + '/avatar.jpg'])
    await state._sb.from('profiles').update({ avatar_url: null }).eq('id', state.currentUser.id)
    if (state.userProfile) state.userProfile.avatar_url = null
    updateHeaderUI()
    if (window.renderProfilePage) window.renderProfilePage()
    showToast('Profile picture removed', 'success')
  } catch(e) { showToast('Could not remove picture', 'error') }
}

// Single source of truth for "does this user have a usable avatar".
export function avatarUrl() {
  return (state.userProfile && state.userProfile.avatar_url) || ''
}

export function openAccountModal() {
  document.getElementById('account-modal').classList.add('open')
  document.body.style.overflow = 'hidden'
  if (!state.currentUser) return
  var displayName = (state.userProfile && state.userProfile.username) || state.currentUser.name || state.currentUser.email.split('@')[0]
  var initials = displayName[0].toUpperCase()
  document.getElementById('acc-avatar').textContent = initials
  document.getElementById('acc-name').textContent = displayName
  document.getElementById('acc-email').textContent = (state.userProfile && state.userProfile.username) ? '@' + state.userProfile.username + ' · ' + state.currentUser.email : state.currentUser.email
  var planEl = document.getElementById('acc-plan')
  var upSec = document.getElementById('acc-upgrade')
  var sinceEl = document.getElementById('acc-since')
  if (state.userProfile && state.userProfile.is_developer) {
    planEl.textContent = '👑 Developer — Lifetime Pro'; planEl.className = 'plan-badge plan-dev'
    upSec.style.display = 'none'; sinceEl.textContent = 'You built this app 🚗'
  } else if (state.userProfile && state.userProfile.is_pro) {
    planEl.textContent = '⭐ Pro Member'; planEl.className = 'plan-badge plan-pro'
    upSec.style.display = 'none'
    if (state.userProfile.pro_since) sinceEl.textContent = 'Pro since ' + new Date(state.userProfile.pro_since).toLocaleDateString('en-IN')
  } else {
    planEl.textContent = 'Free Plan'; planEl.className = 'plan-badge plan-free'
    upSec.style.display = 'block'
  }
}

export function closeAccountModal() { document.getElementById('account-modal').classList.remove('open'); document.body.style.overflow = '' }

export async function signOutUser(){
  // Local-scope signOut clears the Supabase client's session (in-memory AND
  // persisted) immediately, with no network round-trip. Doing this FIRST is
  // what actually prevents the session from silently restoring itself on the
  // next tab-focus or reload — clearing our own localStorage key manually
  // isn't enough, since the client keeps its own in-memory copy of the
  // session that only auth.signOut() itself knows how to invalidate.
  try{ if(state._sb) await state._sb.auth.signOut({ scope: 'local' }) }catch(e){}
  state.currentUser = null
  state.userProfile = null
  localStorage.removeItem('hs_pro')
  localStorage.removeItem('hs_profile_cache')
  localStorage.removeItem('hs_col')
  state.collection = []
  if(window.renderCol) window.renderCol()
  try { localStorage.removeItem('hs_auth_v2') } catch(e) {}
  closeAccountModal()
  window.closeProModal()
  updateHeaderUI()
  window.renderProfilePage()
  window.updateScanCounter()
}

export async function loadRazorpay(){
  return new Promise(function(resolve){
    if(window.Razorpay){ resolve(); return }
    var s=document.createElement('script')
    s.src='https://checkout.razorpay.com/v1/checkout.js'
    s.onload=resolve; s.onerror=function(){resolve()}
    document.head.appendChild(s)
  })
}

export async function startPayment(btn) {
  if (!state.currentUser) { closeAccountModal(); openAuth(); return }
  // Visible progress while the SDK loads and the order is created. This used to
  // be a dead button for a second or two on a slow connection, which reads as a
  // broken upgrade — the worst possible moment to look broken.
  var _label = btn && btn.textContent
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Opening secure checkout…' }
  var _restore = function() { if (btn) { btn.disabled = false; btn.textContent = _label } }

  await loadRazorpay()
  if(!window.Razorpay){ _restore(); showToast('Payment unavailable. Try again.', 'error'); return }

  // Create the order server-side. The amount and the user it is for are set
  // there from a verified session, so neither can be edited in the console —
  // previously both were client-supplied and a ₹1 payment bought Pro.
  var order = null
  try {
    var tok = ''
    try {
      var sess = await state._sb.auth.getSession()
      tok = (sess && sess.data && sess.data.session && sess.data.session.access_token) || ''
    } catch(e) {}
    var ores = await fetch('/api/razorpay-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-token': tok },
    })
    order = await ores.json()
    if (!ores.ok || !order.order_id) throw new Error(order && order.error ? order.error : 'Could not start checkout')
  } catch(e) {
    _restore()
    showToast((e && e.message) || 'Could not start checkout — try again', 'error')
    captureException(e)
    return
  }
  _restore()

  var options = {
    key: RZP_KEY,
    order_id: order.order_id,
    amount: order.amount, currency: order.currency || 'INR',
    name: 'HotScan India', description: 'Pro — Unlimited scans, no daily limit',
    image: '/icon-192.png',
    prefill: {email: state.currentUser.email},
    theme: {color: '#e63946'},
    modal: {
      // Without this the button stays disabled and the user is stuck if they
      // dismiss the sheet.
      ondismiss: function() { showToast('Checkout closed — you have not been charged', 'info') }
    },
    handler: async function(response) {
      // Pro status is granted server-side via the Razorpay webhook (/api/razorpay-webhook).
      // The webhook verifies the HMAC signature and uses the Supabase service role key
      // to update is_pro — the client NEVER writes is_pro directly, preventing bypass.
      // We poll the profile for up to 10 seconds to pick up the webhook update.
      closeAccountModal(); window.closeProModal(); updateHeaderUI(); window.renderProfilePage()
      showToast('⏳ Activating Pro — please wait…', 'success')
      var attempts = 0
      var poll = setInterval(async function() {
        attempts++
        await loadProfile()
        if ((state.userProfile && state.userProfile.is_pro) || attempts >= 10) {
          clearInterval(poll)
          updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
          if (state.userProfile && state.userProfile.is_pro) {
            setTimeout(function() { showToast('🎉 Welcome to HotScan Pro! Unlimited scans activated.', 'success') }, 100)
          } else {
            showToast('Payment received — Pro will activate within 60 seconds. Refresh if needed.', 'success')
          }
        }
      }, 1000)
    }
  }
  var rzp = new window.Razorpay(options)
  rzp.on('payment.failed', function(r) { showToast('Payment failed: ' + r.error.description, 'error') })
  closeAccountModal(); window.closeProModal(); rzp.open()
}
