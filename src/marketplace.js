import { state } from './state.js'
import { escHtml, cleanINR, parseINR, showToast, rcls } from './utils.js'
import { groqText } from './groq.js'
import { HAIKU_MODEL } from './config.js'

var _mpFilter = 'all'
var _mpListings = null

export function mpMode(tab) {
  ['buy','sell','olx'].forEach(function(t) {
    document.getElementById('mp-tab-'+t).classList.toggle('active', t===tab)
    document.getElementById('mp-'+t).style.display = t===tab ? 'block' : 'none'
  })
  if (tab === 'buy') loadAndRenderListings()
  if (tab === 'sell') {
    renderMyListings()
    var phoneEl = document.getElementById('sl-phone')
    if (phoneEl && !phoneEl.value && state.userProfile && state.userProfile.whatsapp_phone) {
      phoneEl.value = state.userProfile.whatsapp_phone
    }
  }
}

export function mpFilter(rarity, el) {
  _mpFilter = rarity
  _mpListings = null
  document.querySelectorAll('#mp-filter-chips .filter-chip').forEach(function(c){c.classList.remove('active')})
  el.classList.add('active')
  loadAndRenderListings()
}

export async function loadAndRenderListings() {
  var wrap = document.getElementById('mp-listings-wrap')
  if (!wrap) return
  wrap.innerHTML = '<div style="text-align:center;padding:36px;color:var(--text3);font-size:13px">⏳ Loading listings…</div>'
  var items = []
  if (state._sb) {
    try {
      var query = state._sb.from('listings').select('*').eq('is_active', true).order('listed_at', {ascending: false}).limit(60)
      if (_mpFilter !== 'all') query = query.ilike('rarity', '%'+_mpFilter+'%')
      var res = await query
      if (res.data) items = res.data
    } catch(e) { console.warn('Listings fetch error:', e) }
  }
  _mpListings = items
  renderListings()
}

export function renderListings(arr) {
  var wrap = document.getElementById('mp-listings-wrap')
  if (!wrap) return
  var items = (arr || _mpListings || []).slice()
  if (!items.length) {
    wrap.innerHTML = '<div class="empty"><div class="empty-icon">🏪</div><div class="empty-t">No listings yet</div><div class="empty-s">Be the first — tap Sell above to list your Hot Wheels</div></div>'
    return
  }
  wrap.innerHTML = ''
  items.forEach(function(l) {
    var listed = l.listed_at || l.listed
    var diff = Math.floor((Date.now() - new Date(listed)) / 60000)
    var ago = diff < 60 ? diff + 'm ago' : diff < 1440 ? Math.floor(diff/60) + 'h ago' : Math.floor(diff/1440) + 'd ago'
    var card = document.createElement('div'); card.className = 'listing-card'
    var thumb = document.createElement('div'); thumb.className = 'listing-thumb'
    if (l.image_thumb) { var img = document.createElement('img'); img.src = l.image_thumb; img.alt = ''; thumb.appendChild(img) } else thumb.textContent = '🚗'
    var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0'
    var nm = document.createElement('div'); nm.className = 'listing-name'; nm.textContent = l.name
    var meta = document.createElement('div'); meta.className = 'listing-meta'; meta.textContent = (l.rarity||'Common') + ' · ' + (l.condition||'N/A') + ' · ' + l.city + ' · ' + ago
    var priceRow = document.createElement('div'); priceRow.style.cssText = 'display:flex;align-items:center;gap:7px;margin:4px 0'
    var price = document.createElement('span'); price.className = 'listing-price'; price.textContent = '₹' + Number(l.price).toLocaleString('en-IN')
    var rar = document.createElement('span'); rar.className = 'rar ' + rcls(l.rarity); rar.style.cssText = 'font-size:10px;padding:2px 6px'; rar.textContent = l.rarity || 'Common'
    priceRow.appendChild(price); priceRow.appendChild(rar)
    var seller = document.createElement('div'); seller.style.cssText = 'font-size:10px;color:var(--text3)'; seller.textContent = '👤 ' + (l.seller_name || 'Collector')
    info.appendChild(nm); info.appendChild(meta); info.appendChild(priceRow); info.appendChild(seller)
    if (l.notes) { var noteEl = document.createElement('div'); noteEl.style.cssText = 'font-size:11px;color:var(--text2);margin-top:3px;white-space:pre-wrap'; noteEl.textContent = l.notes; info.appendChild(noteEl) }
    var acts = document.createElement('div'); acts.className = 'listing-acts'
    var waBtn = document.createElement('button'); waBtn.className = 'l-btn l-btn-wa'; waBtn.textContent = '💬 Contact'
    waBtn.onclick = (function(listing) { return function() {
      if (!listing.seller_phone) { showToast('Seller has not shared a contact number', 'error'); return }
      var msg = 'Hi! I saw your Hot Wheels listing on HotScan India.\nCar: ' + listing.name + '\nAsking price: ₹' + listing.price + '\nIs it still available?'
      window.open('https://wa.me/91' + listing.seller_phone + '?text=' + encodeURIComponent(msg), '_blank')
    }})(l)
    var shBtn = document.createElement('button'); shBtn.className = 'l-btn l-btn-share'; shBtn.textContent = '📤 Share'
    shBtn.onclick = (function(listing) { return function() {
      var msg = ['For Sale: ' + listing.name, 'Price: ₹' + listing.price, 'City: ' + listing.city, '', 'Listed on HotScan India — hotscan.in'].join('\n')
      if (navigator.share) { navigator.share({title: 'Hot Wheels for Sale', text: msg}) }
      else if (navigator.clipboard) { navigator.clipboard.writeText(msg).then(function(){ showToast('Copied!', 'success') }) }
    }})(l)
    acts.appendChild(waBtn); acts.appendChild(shBtn)
    info.appendChild(acts)
    card.appendChild(thumb); card.appendChild(info)
    wrap.appendChild(card)
  })
}

export async function renderMyListings(arr) {
  var card = document.getElementById('my-listings-card')
  var wrap = document.getElementById('my-listings-wrap')
  if (!card || !wrap) return
  if (!state.currentUser || !state._sb) { card.style.display = 'none'; return }
  try {
    var res = await state._sb.from('listings').select('*').eq('seller_id', state.currentUser.id).eq('is_active', true).order('listed_at', {ascending: false})
    var items = res.data || []
    if (!items.length) { card.style.display = 'none'; return }
    card.style.display = 'block'
    wrap.innerHTML = ''
    items.forEach(function(l) {
      var row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)'
      var nm = document.createElement('div'); nm.style.cssText = 'flex:1;font-size:13px;font-weight:600'; nm.textContent = l.name
      var px = document.createElement('div'); px.style.cssText = 'font-size:12px;color:var(--text2);flex-shrink:0'; px.textContent = '₹' + Number(l.price).toLocaleString('en-IN')
      var del = document.createElement('button'); del.style.cssText = 'background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;flex-shrink:0'; del.textContent = '🗑'; del.title = 'Remove listing'
      del.onclick = (function(id) { return function() { deleteListing(id) } })(l.id)
      row.appendChild(nm); row.appendChild(px); row.appendChild(del)
      wrap.appendChild(row)
    })
  } catch(e) { card.style.display = 'none' }
}

export async function deleteListing(id) {
  if (!state.currentUser || !state._sb) return
  try {
    await state._sb.from('listings').update({is_active: false}).eq('id', id).eq('seller_id', state.currentUser.id)
    showToast('Listing removed', 'success')
    renderMyListings()
    _mpListings = null
  } catch(e) { showToast('Could not remove listing', 'error') }
}

export async function submitListing() {
  var name  = document.getElementById('sl-name').value.trim()
  var price = parseFloat(document.getElementById('sl-price').value)
  var cond  = document.getElementById('sl-cond').value
  var city  = document.getElementById('sl-city').value.trim()
  var phone = document.getElementById('sl-phone').value.trim().replace(/\D/g, '')
  if (!phone && state.userProfile && state.userProfile.whatsapp_phone) phone = state.userProfile.whatsapp_phone
  var rarity = document.getElementById('sl-rarity').value
  if (!name || !price || !city)      { showToast('Please fill in car name, price and city', 'error'); return }
  if (!phone || phone.length !== 10) { showToast('Enter a valid 10-digit WhatsApp number', 'error'); return }
  if (!state.currentUser)            { showToast('Sign in to list a car for sale', 'error'); window.openAuth(); return }
  if (!state._sb)                    { showToast('Connection error — try again', 'error'); return }
  var btn = document.getElementById('sl-submit-btn')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Listing…' }
  try {
    await state._sb.from('listings').insert({
      seller_id:    state.currentUser.id,
      seller_name:  (state.userProfile && state.userProfile.display_name) || state.currentUser.name || state.currentUser.email.split('@')[0],
      seller_phone: phone,
      name:         name,
      rarity:       rarity,
      price:        price,
      condition:    cond,
      city:         city,
      notes:        document.getElementById('sl-notes').value.trim() || null,
      image_thumb:  state.imgThumb ? state.imgThumb.substring(0, 4000) : null,
      is_active:    true
    })
    ;['sl-name','sl-price','sl-city','sl-notes','sl-phone'].forEach(function(id){ document.getElementById(id).value = '' })
    showToast('Listed! Buyers can now contact you on WhatsApp 🎉', 'success')
    _mpListings = null
    mpMode('buy')
  } catch(e) { console.error(e); showToast('Could not save listing — try again', 'error') }
  finally { if (btn) { btn.disabled = false; btn.textContent = '📤 List Now' } }
}

export function quickSell() {
  window.goPage('marketplace')
  mpMode('sell')
  if (state.lastResult && document.getElementById('sl-name')) {
    document.getElementById('sl-name').value = state.lastResult.name || ''
    var rarEl = document.getElementById('sl-rarity')
    if (rarEl && state.lastResult.rarity) {
      for (var i = 0; i < rarEl.options.length; i++) {
        if (rarEl.options[i].value === state.lastResult.rarity) { rarEl.selectedIndex = i; break }
      }
    }
  }
}

export async function checkOLX() {
  var inp = document.getElementById('olx-inp').value.trim()
  if (!inp) { alert('Paste a listing title'); return }
  var prompt = [
    'Indian Hot Wheels market expert. Analyse this OLX listing: "'+inp+'".',
    'Return ONLY valid JSON:',
    '{"car_name":"name","rarity":"rarity","fair_price_inr":"300-600","listing_price_inr":400,"verdict":"Steal|Fair|Overpriced","verdict_reason":"specific why","buyer_advice":"what to do","red_flags":"concerns or empty string"}'
  ].join(' ')
  try {
    var d = await groqText(prompt, HAIKU_MODEL)
    if (!d) throw new Error('Could not analyse')
    document.getElementById('olx-fair-px').textContent = 'Fair: Rs.'+d.fair_price_inr
    document.getElementById('olx-verdict-txt').textContent = (d.verdict||'') + ' — ' + (d.verdict_reason||'')
    var rows = [['Car',d.car_name],['Rarity',d.rarity],['Listed price','Rs.'+(d.listing_price_inr||'?')],['Fair price','Rs.'+(d.fair_price_inr||'?')]]
    document.getElementById('olx-rows').innerHTML = rows.filter(function(r){return r[1]}).map(function(r){
      return '<div class="deal-row"><span class="deal-k">'+r[0]+'</span><span class="deal-v">'+r[1]+'</span></div>'
    }).join('')
    var tip = ''
    if (d.buyer_advice) tip += 'Advice: '+d.buyer_advice
    if (d.red_flags) tip += (tip?' | ':'')+d.red_flags
    document.getElementById('olx-tip').textContent = tip ? '💡 '+tip : ''
    document.getElementById('olx-result-box').style.display = 'block'
    document.getElementById('olx-result-box').scrollIntoView({behavior:'smooth',block:'start'})
  } catch(e) { alert('Error: '+e.message) }
}
