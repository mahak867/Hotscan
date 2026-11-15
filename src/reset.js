// Password reset. Supabase puts the recovery token in the URL hash; the client
// picks it up on creation, after which updateUser can set the new password.
import { SUPA_URL, SUPA_KEY } from './config.js'

var form = document.getElementById('reset-form')
var invalid = document.getElementById('invalid-state')
var msg = document.getElementById('form-msg')
var btn = document.getElementById('btn-reset')
var hash = window.location.hash
var sb = null

if (!SUPA_URL || !window.supabase || (!hash.includes('access_token') && !hash.includes('type=recovery'))) {
  form.hidden = true
  invalid.hidden = false
} else {
  // Same storage key as the app, so the user is signed in when they land back on it.
  sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { storageKey: 'hs_auth_v2', detectSessionInUrl: true, flowType: 'implicit' } })
}

async function doReset() {
  var pw1 = document.getElementById('pw1').value
  var pw2 = document.getElementById('pw2').value
  msg.style.color = ''
  if (pw1.length < 8) { msg.textContent = 'Use at least 8 characters.'; return }
  if (pw1 !== pw2) { msg.textContent = 'The two passwords do not match.'; return }
  btn.disabled = true
  msg.textContent = ''
  try {
    var res = await sb.auth.updateUser({ password: pw1 })
    if (res.error) throw res.error
    msg.style.color = 'var(--green)'
    msg.textContent = 'Password updated. Taking you to HotScan…'
    setTimeout(function () { window.location.href = '/' }, 1500)
  } catch (err) {
    btn.disabled = false
    msg.textContent = (err && err.message) || 'Could not update the password. Try again.'
  }
}
if (btn) btn.addEventListener('click', doReset)
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && sb) doReset() })
