import { state } from './state.js'
import { SUPA_URL, SUPA_KEY, RZP_KEY, DEV_EMAIL } from './config.js'
import { escHtml, sanitize, showToast } from './utils.js'

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
  var _to=setTimeout(function(){ setAuthLoading(false); showAuthErr('Request timed out — try again') },15000)
  try{
    if(_authMode==='signin'){
      var signInEmail = rawInput
      if(!rawInput.includes('@')){
        var lu = await state._sb.from('profiles').select('email').eq('username', rawInput).single()
        if(lu.error || !lu.data || !lu.data.email){
          clearTimeout(_to); setAuthLoading(false)
          showAuthErr('No account found for that username. Try your email instead.')
          return
        }
        signInEmail = lu.data.email
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
          state._sb.from('profiles').upsert({id:sr.data.user.id,email:signUpEmail,display_name:displayName,username:usernameVal},{onConflict:'id'}).catch(function(){})
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

export async function initAuth(){
  if(!state._sb){ updateHeaderUI(); return }
  var am=document.getElementById('auth-modal'); if(am) am.classList.remove('open')
  document.body.style.overflow=''
  try{
    state._sb.auth.onAuthStateChange(async function(event,session){
      if(session&&session.user){
        var u=session.user
        state.currentUser={id:u.id,email:u.email||'',name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||u.email.split('@')[0]}
        await loadProfile()
        if(event==='SIGNED_IN'){ closeAuth(); setTimeout(showSuccessCelebration,300) }
        if(event==='INITIAL_SESSION'||event==='SIGNED_IN'){
          window.fullCloudSync().then(function(){window.renderCol()}).catch(function(){})
        }
        updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
      } else {
        state.currentUser=null; state.userProfile=null
        localStorage.removeItem('hs_pro')
        updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
      }
    })
    var sr=await state._sb.auth.getSession()
    if(sr.data&&sr.data.session&&sr.data.session.user&&!state.currentUser){
      var u=sr.data.session.user
      state.currentUser={id:u.id,email:u.email||'',name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||u.email.split('@')[0]}
      await loadProfile()
      window.fullCloudSync().then(function(){window.renderCol()}).catch(function(){})
      updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
    }
    // Layer 3: force-refresh expired token — fixes "logged out on reload" in normal tabs
    if(!state.currentUser){
      try{
        var rr=await state._sb.auth.refreshSession()
        if(rr.data&&rr.data.session&&rr.data.session.user){
          var u=rr.data.session.user
          state.currentUser={id:u.id,email:u.email||'',name:(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||u.email.split('@')[0]}
          await loadProfile()
          window.fullCloudSync().then(function(){window.renderCol()}).catch(function(){})
          updateHeaderUI(); window.renderProfilePage(); window.updateScanCounter()
        }
      }catch(e){}
    }
  }catch(e){ console.warn('initAuth:',e) }
  updateHeaderUI()
}

export async function loadProfile(){
  if(!state.currentUser||!state._sb) return
  if(state.currentUser.email===DEV_EMAIL){
    state.userProfile=Object.assign(state.userProfile||{},{is_pro:true,is_developer:true,email:state.currentUser.email})
    localStorage.setItem('hs_pro','true')
    updateHeaderUI(); window.renderProfilePage()
  }
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
      await state._sb.from('profiles').upsert({id:state.currentUser.id,email:state.currentUser.email,
        display_name:metaUsername||state.currentUser.name||state.currentUser.email.split('@')[0],
        username:metaUsername||null,
        is_pro:state.currentUser.email===DEV_EMAIL,is_developer:state.currentUser.email===DEV_EMAIL
      },{onConflict:'id'})
      var q2=await state._sb.from('profiles').select('*').eq('id',state.currentUser.id).single()
      state.userProfile=q2.data||{id:state.currentUser.id,email:state.currentUser.email,is_pro:false,is_developer:false}
    }
    if(state.currentUser.email===DEV_EMAIL){
      await state._sb.from('profiles').update({is_pro:true,is_developer:true,pro_since:new Date().toISOString()}).eq('id',state.currentUser.id)
      state.userProfile=Object.assign({},state.userProfile,{is_pro:true,is_developer:true})
      localStorage.setItem('hs_pro','true')
    } else if(state.userProfile&&state.userProfile.is_pro){
      localStorage.setItem('hs_pro','true')
    }
    try{ localStorage.setItem('hs_profile_cache',JSON.stringify({data:state.userProfile,ts:Date.now()})) }catch(e){}
  }catch(e){
    console.warn('loadProfile:',e)
    try{
      var c=JSON.parse(localStorage.getItem('hs_profile_cache')||'null')
      if(c&&c.data&&(Date.now()-c.ts)<7200000) state.userProfile=c.data
    }catch(e2){}
  }
  updateHeaderUI(); window.renderProfilePage()
}

export function updateHeaderUI(){
  var btn=document.getElementById('user-hdr-btn')
  if(!btn) return
  btn.onclick=function(){ state.currentUser?openAccountModal():openAuth() }
  if(!state.currentUser){ btn.innerHTML='<div class="app-user-inner">Sign In</div>'; return }
  var prefs={}; try{ prefs=JSON.parse(localStorage.getItem('hs_prefs')||'{}') }catch(e){}
  var name=prefs.displayName||(state.userProfile&&state.userProfile.username)||state.currentUser.name||state.currentUser.email.split('@')[0]||'?'
  var initial=escHtml((name.length > 0 ? name[0] : '?').toUpperCase())
  var safeName=escHtml(name)
  var isDev=!!(state.userProfile&&state.userProfile.is_developer)||(state.currentUser.email===DEV_EMAIL)
  var isProUser=!isDev&&!!(state.userProfile&&state.userProfile.is_pro)
  var bg=isDev?'linear-gradient(135deg,#7c3aed,#4f46e5)':isProUser?'linear-gradient(135deg,#e63946,#ff6b35)':(prefs.avatarColor||'linear-gradient(135deg,#374151,#4b5563)')
  var badge=isDev?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;margin-left:4px;white-space:nowrap">&#x1F451; Dev</span>':isProUser?'<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:linear-gradient(90deg,#e63946,#ffd60a);color:#000;margin-left:4px;white-space:nowrap">&#x2B50; Pro</span>':''
  btn.innerHTML='<div style="display:flex;align-items:center;gap:6px;cursor:pointer"><div style="width:30px;height:30px;border-radius:50%;background:'+bg+';border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0">'+initial+'</div><span style="font-size:12px;font-weight:600;color:var(--text);max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+safeName+'</span>'+badge+'</div>'
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
  state.currentUser = null
  state.userProfile = null
  localStorage.removeItem('hs_pro')
  localStorage.removeItem('hs_profile_cache')
  try { localStorage.removeItem('hs_auth_v2') } catch(e) {}
  closeAccountModal()
  window.closeProModal()
  try{ if(state._sb) await state._sb.auth.signOut() }catch(e){}
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

export async function startPayment() {
  await loadRazorpay()
  if(!window.Razorpay){ alert('Payment unavailable. Try again.'); return }
  if (!state.currentUser) { closeAccountModal(); openAuth(); return }
  var options = {
    key: RZP_KEY, amount: 9900, currency: 'INR',
    name: 'HotScan India', description: 'Pro Subscription — Unlimited Scans',
    prefill: {email: state.currentUser.email},
    notes: {user_id: state.currentUser.id},
    theme: {color: '#e63946'},
    handler: async function(response) {
      localStorage.setItem('hs_pro', 'true')
      try {
        if (state._sb) {
          await state._sb.from('profiles').update({is_pro:true, pro_since:new Date().toISOString(), razorpay_subscription_id:response.razorpay_payment_id}).eq('id', state.currentUser.id)
          await loadProfile()
        }
      } catch(e) { console.warn('Pro DB update error:', e) }
      closeAccountModal(); window.closeProModal(); updateHeaderUI(); window.renderProfilePage()
      setTimeout(function() { alert('🎉 Welcome to HotScan Pro!\nUnlimited scans activated!') }, 500)
    }
  }
  var rzp = new window.Razorpay(options)
  rzp.on('payment.failed', function(r) { alert('Payment failed: ' + r.error.description) })
  closeAccountModal(); window.closeProModal(); rzp.open()
}
