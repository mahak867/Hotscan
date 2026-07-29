import { state } from './state.js'
import { escHtml, cleanINR, parseINR, showToast, rcls, hsConfirm, hsPromptPrice, captureException } from './utils.js'
import { groqText, groqJSON } from './groq.js'
import { HAIKU_MODEL } from './config.js'

var _mpFilter = 'all'
var _mpListings = null

export function mpMode(tab) {
  ['buy','sell'].forEach(function(t) {
    var te=document.getElementById('mp-tab-'+t); if(te) te.classList.toggle('active', t===tab)
    var pe=document.getElementById('mp-'+t); if(pe) pe.style.display = t===tab ? 'block' : 'none'
  })
  if (tab === 'buy') loadAndRenderListings()
  if (tab === 'sell') {
    renderMyListings()
    var phoneEl = document.getElementById('sl-phone')
    if (phoneEl && !phoneEl.value && state.userProfile && state.userProfile.whatsapp_phone) {
      phoneEl.value = state.userProfile.whatsapp_phone
    }
    // Restore last-used city from localStorage
    var cityEl = document.getElementById('sl-city')
    if (cityEl && !cityEl.value) {
      try { var saved = localStorage.getItem('hs_sell_city'); if (saved) cityEl.value = saved } catch(e) {}
    }
    // Show OLX link hint if user has OLX linked
    var olxHint = document.getElementById('sl-olx-hint')
    if (olxHint) {
      if (state.userProfile && state.userProfile.olx_username) {
        var olxUrl = 'https://www.olx.in/profile/' + encodeURIComponent(state.userProfile.olx_username)
        olxHint.innerHTML = '🔗 Cross-post to <a href="' + olxUrl + '" target="_blank" rel="noopener noreferrer" style="color:#4cc9f0;font-weight:700">your OLX profile</a> after listing here for 3× more visibility'
        olxHint.style.display = 'block'
      } else {
        olxHint.innerHTML = '💡 <a onclick="goPage(\'profile\')" style="color:#4cc9f0;cursor:pointer">Link your OLX account</a> to cross-post listings automatically'
        olxHint.style.display = 'block'
      }
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
      var query = state._sb.from('public_listings').select('*').order('listed_at',{ascending:false}).limit(60)
      if (_mpFilter !== 'all') query = query.ilike('rarity', '%'+_mpFilter+'%')
      var res = await query
      if (res.error) {
        // Table might not exist yet — show empty state not stuck loader
        console.warn('Listings fetch error:', res.error.message)
        captureException(new Error('Listings table error: ' + res.error.message))
      } else if (res.data) {
        items = res.data
      }
    } catch(e) { captureException(e) }
  }
  _mpListings = items
  await loadSellerStats(items)
  renderListings()
}

// Reputation for every seller in the current result set, fetched in one query
// rather than per card. Kept in a map so renderListings stays synchronous.
var _sellerStats = {}

export async function loadSellerStats(items) {
  if (!state._sb || !items || !items.length) return
  var ids = []
  items.forEach(function(l){ if (l.seller_id && ids.indexOf(l.seller_id) === -1) ids.push(l.seller_id) })
  if (!ids.length) return
  try {
    var res = await state._sb.from('seller_stats').select('*').in('seller_id', ids)
    // Missing view means the migration hasn't been run. Reputation simply
    // doesn't render; listings still work exactly as they did before.
    if (res.error || !res.data) return
    res.data.forEach(function(s){ _sellerStats[s.seller_id] = s })
  } catch(e) { /* non-fatal — listings render without reputation */ }
}

// Half-stars would need partial glyphs; rounding to whole stars alongside the
// numeric average is honest enough and renders identically everywhere.
function starGlyphs(avg) {
  var full = Math.round(Number(avg) || 0)
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full)
}

export function sellerBadgeHtml(sellerId) {
  var s = _sellerStats[sellerId]
  if (!s || !Number(s.rating_count)) {
    return '<span style="font-size:10px;color:var(--text3)">No ratings yet</span>'
  }
  var avg = Number(s.avg_stars).toFixed(1)
  var col = avg >= 4 ? '#2dc653' : avg >= 3 ? '#ffd60a' : '#ff6b6b'
  return '<span style="font-size:10px;color:'+col+';font-weight:700">'+starGlyphs(s.avg_stars)+' '+avg+'</span>'+
         '<span style="font-size:10px;color:var(--text3)"> ('+s.rating_count+')</span>'
}

export function renderListings(arr) {
  var wrap = document.getElementById('mp-listings-wrap')
  if (!wrap) return
  var items = (arr || _mpListings || []).slice()
  // #13 — update active filter chip with result count
  var activeChip = document.querySelector('#mp-filter-chips .filter-chip.active')
  if (activeChip) {
    var base = activeChip.textContent.split(' (')[0]
    activeChip.textContent = items.length > 0 ? base + ' (' + items.length + ')' : base
  }
  if (!items.length) {
    // #14 — improved empty buy state
    wrap.innerHTML = [
      '<div class="card" style="text-align:center;padding:24px 18px">',
      '  <div style="font-size:36px;margin-bottom:10px">🏪</div>',
      '  <div style="font-size:15px;font-weight:700;margin-bottom:5px">No listings yet</div>',
      '  <div style="font-size:12px;color:var(--text2);margin-bottom:14px;line-height:1.6">Be the first collector to list a Hot Wheels for sale!</div>',
      '  <button class="btn-red" style="padding:11px 22px;border-radius:12px" onclick="mpMode(\'sell\')">💸 List a Car for Sale →</button>',
      '</div>'
    ].join('')
    return
  }
  wrap.innerHTML = ''
  // #11 — rarity stripe color map
  var rarityStripe = {
    'super treasure hunt': '#e63946',
    'treasure hunt': '#ffd60a',
    'error car': '#ff6b6b',
    'vintage': '#ffd60a',
    'premium': '#4cc9f0',
    'rare': '#4cc9f0',
    'uncommon': '#2dc653',
    'common': 'var(--border)'
  }
  items.forEach(function(l) {
    var listed = l.listed_at || l.listed
    var diff = Math.floor((Date.now() - new Date(listed)) / 60000)
    var ago = diff < 60 ? diff + 'm ago' : diff < 1440 ? Math.floor(diff/60) + 'h ago' : Math.floor(diff/1440) + 'd ago'
    var card = document.createElement('div'); card.className = 'listing-card'
    // #11 — left-border rarity stripe
    var rv = (l.rarity || 'common').toLowerCase()
    card.style.borderLeft = '3px solid ' + (rarityStripe[rv] || 'var(--border)')
    var thumb = document.createElement('div'); thumb.className = 'listing-thumb'
    if (l.image_thumb) { var img = document.createElement('img'); img.src = l.image_thumb; img.alt = ''; thumb.appendChild(img) } else thumb.textContent = '🚗'
    var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0'
    var nm = document.createElement('div'); nm.className = 'listing-name'; nm.textContent = l.name
    var meta = document.createElement('div'); meta.className = 'listing-meta'; meta.textContent = (l.rarity||'Common') + ' · ' + (l.condition||'N/A') + ' · ' + l.city + ' · ' + ago
    var priceRow = document.createElement('div'); priceRow.style.cssText = 'display:flex;align-items:center;gap:7px;margin:4px 0'
    var price = document.createElement('span'); price.className = 'listing-price'; price.textContent = '₹' + Number(l.price).toLocaleString('en-IN')
    var rar = document.createElement('span'); rar.className = 'rar ' + rcls(l.rarity); rar.style.cssText = 'font-size:10px;padding:2px 6px'; rar.textContent = l.rarity || 'Common'
    priceRow.appendChild(price); priceRow.appendChild(rar)
    // Seller line now carries reputation and opens the seller's profile.
    var seller = document.createElement('div')
    seller.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;color:var(--text3)'
    var sStat = _sellerStats[l.seller_id]
    seller.innerHTML = '<span style="cursor:pointer;text-decoration:underline;text-underline-offset:2px">👤 ' + escHtml(l.seller_name || 'Collector') + '</span>' +
      sellerBadgeHtml(l.seller_id) +
      (sStat && Number(sStat.listing_count) > 1 ? '<span style="font-size:10px;color:var(--text3)">· ' + sStat.listing_count + ' listings</span>' : '')
    if (l.seller_id) {
      seller.firstChild.onclick = (function(id, nm){ return function(){ openSellerSheet(id, nm) } })(l.seller_id, l.seller_name)
    }
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

// ── OLX deep links ──────────────────────────────────────────────────────────
// A search URL, not a scrape. OLX prohibits automated access, sits behind bot
// detection, and changes markup without notice — a scraper would break
// constantly and fail silently. A link costs nothing to maintain, carries no
// legal exposure, and gives the user the same thing they actually wanted:
// current asking prices for this casting, one tap away.
export function olxSearchUrl(carName) {
  var q = (carName || '').trim()
  if (!q) return ''
  // "hot wheels" narrows away unrelated listings that share a model name —
  // searching "Bugatti Chiron" alone returns actual cars.
  return 'https://www.olx.in/items/q-' + encodeURIComponent('hot wheels ' + q).replace(/%20/g, '-')
}

export function openOlxSearch(carName) {
  var url = olxSearchUrl(carName)
  if (!url) { showToast('No car name to search', 'error'); return }
  window.open(url, '_blank', 'noopener')
}

// No-arg wrapper for the result-page button. `state` is a module binding and is
// deliberately not on window, so the onclick cannot read it directly.
export function olxLastResult() {
  var r = state.lastResult
  if (!r || !r.name) { showToast('Scan a car first', 'error'); return }
  openOlxSearch(r.name)
}

// ── Seller profile sheet ────────────────────────────────────────────────────
var _sheetSellerId = null

export async function openSellerSheet(sellerId, sellerName) {
  if (!sellerId) return
  _sheetSellerId = sellerId
  var sheet = document.getElementById('seller-sheet')
  var body = document.getElementById('seller-sheet-body')
  if (!sheet || !body) return
  sheet.classList.add('open')
  document.body.style.overflow = 'hidden'
  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px">⏳ Loading seller…</div>'

  var stats = _sellerStats[sellerId] || null
  var reviews = []
  var myRating = null
  try {
    var rres = await state._sb.from('seller_ratings')
      .select('id,rater_id,stars,review,created_at')
      .eq('seller_id', sellerId).order('created_at', {ascending:false}).limit(20)
    if (!rres.error && rres.data) {
      reviews = rres.data
      if (state.currentUser) {
        myRating = reviews.filter(function(r){ return r.rater_id === state.currentUser.id })[0] || null
      }
    }
  } catch(e) { /* reputation is additive — the sheet still shows the basics */ }

  var isSelf = !!(state.currentUser && state.currentUser.id === sellerId)
  var since = stats && stats.selling_since ? new Date(stats.selling_since).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : null

  var head =
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'+
      '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#374151,#4b5563);display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:900;color:#fff;flex-shrink:0">'+
        escHtml(((sellerName||'C')[0]||'C').toUpperCase())+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:16px;font-weight:800">'+escHtml(sellerName||'Collector')+'</div>'+
        '<div style="margin-top:3px">'+sellerBadgeHtml(sellerId)+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'+
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:17px;font-weight:800;color:var(--gold)">'+(stats?stats.listing_count:0)+'</div><div style="font-size:9px;color:var(--text3);margin-top:2px">Listings</div></div>'+
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:17px;font-weight:800;color:var(--gold)">'+(stats?stats.rating_count:0)+'</div><div style="font-size:9px;color:var(--text3);margin-top:2px">Ratings</div></div>'+
      '<div style="background:var(--surface2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:12px;font-weight:800;color:var(--gold);margin-top:4px">'+(since||'—')+'</div><div style="font-size:9px;color:var(--text3);margin-top:2px">Since</div></div>'+
    '</div>'

  var rateBox = ''
  if (isSelf) {
    rateBox = '<div style="font-size:11px;color:var(--text3);padding:10px;background:var(--surface2);border-radius:10px;margin-bottom:14px">This is your seller profile — you can\'t rate yourself.</div>'
  } else if (!state.currentUser) {
    rateBox = '<div style="font-size:11px;color:var(--text3);padding:10px;background:var(--surface2);border-radius:10px;margin-bottom:14px">Sign in to rate this seller.</div>'
  } else {
    rateBox =
      '<div style="background:var(--surface2);border-radius:12px;padding:12px;margin-bottom:16px">'+
        '<div style="font-size:12px;font-weight:700;margin-bottom:8px">'+(myRating?'Update your rating':'Rate this seller')+'</div>'+
        '<div id="rate-stars" style="display:flex;gap:6px;margin-bottom:9px">'+
          [1,2,3,4,5].map(function(n){
            return '<button data-star="'+n+'" style="background:none;border:none;font-size:24px;cursor:pointer;padding:0;line-height:1;color:'+((myRating&&myRating.stars>=n)?'#ffd60a':'var(--text3)')+'">★</button>'
          }).join('')+
        '</div>'+
        '<textarea id="rate-review" maxlength="500" placeholder="How was the deal? (optional)" style="width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:9px;padding:9px;font-size:12px;color:#fff;box-sizing:border-box;resize:vertical;min-height:56px;font-family:inherit">'+escHtml(myRating&&myRating.review?myRating.review:'')+'</textarea>'+
        '<button id="rate-submit" class="btn-red" style="width:100%;margin-top:9px;padding:10px;border-radius:10px;font-size:13px">'+(myRating?'Update rating':'Submit rating')+'</button>'+
      '</div>'
  }

  var revList = reviews.length
    ? reviews.map(function(r){
        return '<div style="padding:10px 0;border-bottom:1px solid var(--border)">'+
          '<div style="font-size:12px;color:#ffd60a">'+starGlyphs(r.stars)+'</div>'+
          (r.review?'<div style="font-size:12px;color:var(--text2);margin-top:4px;white-space:pre-wrap">'+escHtml(r.review)+'</div>':'')+
          '<div style="font-size:10px;color:var(--text3);margin-top:4px">'+new Date(r.created_at).toLocaleDateString('en-IN')+'</div>'+
        '</div>'
      }).join('')
    : '<div style="font-size:12px;color:var(--text3);padding:10px 0">No reviews yet.</div>'

  body.innerHTML = head + rateBox +
    '<div style="font-size:12px;font-weight:700;margin-bottom:2px">Reviews</div>' + revList

  // Star picker
  var picked = myRating ? myRating.stars : 0
  var starWrap = document.getElementById('rate-stars')
  if (starWrap) {
    starWrap.addEventListener('click', function(e){
      var b = e.target.closest('[data-star]')
      if (!b) return
      picked = parseInt(b.dataset.star, 10)
      starWrap.querySelectorAll('[data-star]').forEach(function(el){
        el.style.color = parseInt(el.dataset.star,10) <= picked ? '#ffd60a' : 'var(--text3)'
      })
    })
  }
  var subBtn = document.getElementById('rate-submit')
  if (subBtn) {
    subBtn.onclick = function(){
      if (!picked) { showToast('Pick a star rating first', 'error'); return }
      var rv = document.getElementById('rate-review')
      submitSellerRating(sellerId, picked, rv ? rv.value : '', sellerName)
    }
  }
}

export function closeSellerSheet() {
  var sheet = document.getElementById('seller-sheet')
  if (sheet) sheet.classList.remove('open')
  document.body.style.overflow = ''
  _sheetSellerId = null
}

export async function submitSellerRating(sellerId, stars, review, sellerName) {
  if (!state.currentUser || !state._sb) { showToast('Sign in to rate sellers', 'error'); return }
  if (state.currentUser.id === sellerId) { showToast('You cannot rate yourself', 'error'); return }
  try {
    // Upsert on (seller_id, rater_id): re-rating replaces the previous score
    // rather than stacking, which is what the unique constraint enforces.
    var res = await state._sb.from('seller_ratings').upsert({
      seller_id: sellerId,
      rater_id: state.currentUser.id,
      stars: stars,
      review: (review || '').trim().slice(0, 500) || null
    }, { onConflict: 'seller_id,rater_id' })
    if (res.error) throw res.error
    showToast('Rating saved ✅', 'success')
    // Refresh aggregates, then re-open so the sheet shows the new average.
    await loadSellerStats(_mpListings || [])
    renderListings()
    openSellerSheet(sellerId, sellerName)
  } catch(e) {
    var m = (e && e.message) || ''
    if (m.indexOf('seller_ratings') > -1 || m.indexOf('does not exist') > -1) {
      showToast('Seller ratings not set up yet — run the latest SQL migration', 'error')
    } else {
      showToast('Could not save rating — ' + (m || 'try again'), 'error')
    }
    captureException(e)
  }
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
      var sold = document.createElement('button'); sold.style.cssText = 'background:none;border:none;color:var(--green);cursor:pointer;font-size:15px;flex-shrink:0'; sold.textContent = '✅'; sold.title = 'Mark as sold'
      sold.onclick = (function(id, name) { return function() { markListingSold(id, name) } })(l.id, l.name)
      var del = document.createElement('button'); del.style.cssText = 'background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;flex-shrink:0'; del.textContent = '🗑'; del.title = 'Remove listing'
      del.onclick = (function(id) { return function() { deleteListing(id) } })(l.id)
      row.appendChild(nm); row.appendChild(px); row.appendChild(sold); row.appendChild(del)
      wrap.appendChild(row)
    })
  } catch(e) { card.style.display = 'none' }
}

export async function deleteListing(id) {
  if (!state.currentUser || !state._sb) return
  var ok = await hsConfirm('Remove Listing', 'Buyers will no longer see this car for sale.', 'Remove', '🗑️')
  if (!ok) return
  try {
    await state._sb.from('listings').update({is_active: false}).eq('id', id).eq('seller_id', state.currentUser.id)
    showToast('Listing removed', 'success')
    renderMyListings()
    _mpListings = null
  } catch(e) { showToast('Could not remove listing', 'error') }
}

// This is the highest-value real price data Hotscan can capture: an actual
// closed transaction on its own marketplace, not a self-reported guess or an
// AI's web-search interpretation. Tagged via the `platform` field (no schema
// migration needed) so api/prices.js can weight it above regular community
// submissions when computing a car's collector price.
export async function markListingSold(id, carName) {
  if (!state.currentUser || !state._sb) return
  var price = await hsPromptPrice('Mark as Sold', 'What did "' + carName + '" actually sell for? This helps keep prices accurate for every collector.')
  if (!price) return
  try {
    await state._sb.from('community_prices').insert({
      car_name: carName,
      price_inr: price,
      platform: 'Hotscan Marketplace (Verified Sale)',
      user_id: state.currentUser.id,
      user_name: state.currentUser.name || state.currentUser.email.split('@')[0],
    })
  } catch(e) { captureException(e) }
  try {
    await state._sb.from('listings').update({is_active: false}).eq('id', id).eq('seller_id', state.currentUser.id)
  } catch(e) { captureException(e) }
  showToast('Marked as sold — thanks for keeping prices accurate! 🎉', 'success')
  renderMyListings()
  _mpListings = null
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

  // Rate limit: max 3 listings per hour
  var now = Date.now()
  var listTimes = JSON.parse(localStorage.getItem('hs_list_times') || '[]').filter(function(t) { return now - t < 3600000 })
  if (listTimes.length >= 3) {
    var wait = Math.ceil((3600000 - (now - listTimes[0])) / 60000)
    showToast('You can list up to 3 cars per hour. Try again in ' + wait + ' min.', 'error')
    return
  }
  var btn = document.getElementById('sl-submit-btn')
  var _listed = false
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Listing…' }
  try {
    var imgThumb = window._slImgThumb || (state.imgThumb ? state.imgThumb.substring(0, 8000) : null)
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
      image_thumb:  imgThumb,
      is_active:    true
    })
    _listed = true
    // Save city and rate limit timestamp
    try {
      if (city) localStorage.setItem('hs_sell_city', city)
      listTimes.push(Date.now())
      localStorage.setItem('hs_list_times', JSON.stringify(listTimes))
    } catch(e) {}
    window._slImgThumb = null
    ;['sl-name','sl-price','sl-city','sl-notes','sl-phone'].forEach(function(id){ document.getElementById(id).value = '' })
    // Reset preview
    var pw = document.getElementById('sl-preview-wrap'); if (pw) pw.style.display = 'none'
    var pi = document.getElementById('sl-preview-img'); if (pi) pi.src = ''
    var pl = document.getElementById('sl-photo-label'); if (pl) pl.style.display = ''
    var ph = document.getElementById('sl-price-hint'); if (ph) ph.style.display = 'none'
    var nc = document.getElementById('sl-notes-counter'); if (nc) nc.textContent = ''
    showToast('Listed! Buyers can now contact you on WhatsApp 🎉', 'success')
    // If OLX linked, show cross-post prompt
    if (state.userProfile && state.userProfile.olx_username) {
      setTimeout(function() {
        var olxHint = document.getElementById('sl-olx-hint')
        if (olxHint) {
          olxHint.style.display = 'block'
          olxHint.innerHTML = '🚀 <strong>Cross-post to OLX</strong> for 3× more reach — '
            + '<a href="https://www.olx.in/post-ad/" target="_blank" style="color:#4cc9f0;font-weight:700">Post on OLX now →</a>'
        }
      }, 1200)
    }
    _mpListings = null
    if (btn) {
      btn.disabled = false
      btn.style.background = 'var(--green)'
      btn.style.color = '#000'
      btn.textContent = '✅ Listed!'
      setTimeout(function() { mpMode('buy'); btn.style.background = ''; btn.style.color = '' }, 1500)
    } else {
      mpMode('buy')
    }
  } catch(e) { captureException(e); showToast('Could not save listing — try again', 'error') }
  finally { if (btn && !_listed) { btn.disabled = false; btn.textContent = '📤 List Now' } }
}

export function quickSell() {
  window.goPage('marketplace')
  mpMode('sell')
  var r = state.lastResult
  if (r && document.getElementById('sl-name')) {
    document.getElementById('sl-name').value = r.name || ''

    // Auto-fill rarity
    var rarEl = document.getElementById('sl-rarity')
    if (rarEl && r.rarity) {
      for (var i = 0; i < rarEl.options.length; i++) {
        if (rarEl.options[i].value === r.rarity) { rarEl.selectedIndex = i; break }
      }
    }

    // Auto-fill condition
    var condEl = document.getElementById('sl-cond')
    if (condEl && r.condition) {
      for (var j = 0; j < condEl.options.length; j++) {
        if (condEl.options[j].text.toLowerCase().includes(r.condition.toLowerCase().split(' ')[0])) {
          condEl.selectedIndex = j; break
        }
      }
    }

    // Show AI-suggested price hint
    var hint = document.getElementById('sl-price-hint')
    var priceEl = document.getElementById('sl-price')
    if (hint && r.india_collector_inr) {
      hint.textContent = '💡 Collector range: ₹' + r.india_collector_inr + ' · Retail: ₹' + (r.india_retail_inr || '150-200')
      hint.style.display = 'block'
      // Pre-fill with the lower bound of the collector range
      if (priceEl && !priceEl.value) {
        var low = parseInt(String(r.india_collector_inr).replace(/[^0-9]/g, ''), 10)
        if (low && low > 0) priceEl.value = low
      }
    }

    // Build auto-fill notes from scan data
    var notesEl = document.getElementById('sl-notes')
    if (notesEl && !notesEl.value) {
      var parts = []
      if (r.color) parts.push('Color: ' + r.color)
      if (r.wheel_type) parts.push('Wheels: ' + r.wheel_type)
      if (r.series) parts.push('Series: ' + r.series)
      if (r.casting_year) parts.push('Year: ' + r.casting_year)
      if (parts.length) {
        notesEl.value = parts.join(' · ')
        slNotesCounter(notesEl)
      }
    }

    // Show car image preview if available
    if (state.imgThumb) {
      var wrap = document.getElementById('sl-preview-wrap')
      var img = document.getElementById('sl-preview-img')
      if (wrap && img) {
        img.src = state.imgThumb
        wrap.style.display = 'block'
        window._slImgThumb = state.imgThumb
      }
    }
  }
}

// Helper: notes character counter
export function slNotesCounter(el) {
  var counter = document.getElementById('sl-notes-counter')
  if (!counter) return
  var len = el.value.length
  counter.textContent = len > 0 ? len + '/200' : ''
  counter.style.color = len > 180 ? 'var(--red)' : 'var(--text3)'
}

// Helper: clear price hint once user types their own price
export function slClearPriceHint() {
  var hint = document.getElementById('sl-price-hint')
  if (hint) hint.style.display = 'none'
}

// Helper: save city to localStorage
export function slSaveCity(city) {
  if (city && city.trim()) {
    try { localStorage.setItem('hs_sell_city', city.trim()) } catch(e) {}
  }
}

// Helper: handle photo selected directly in sell form
export function slPhotoSelected(input) {
  if (!input.files || !input.files[0]) return
  var file = input.files[0]
  var reader = new FileReader()
  reader.onload = function(e) {
    var wrap = document.getElementById('sl-preview-wrap')
    var img = document.getElementById('sl-preview-img')
    if (wrap && img) {
      img.src = e.target.result
      wrap.style.display = 'block'
      window._slImgThumb = e.target.result.substring(0, 8000)
    }
    var label = document.getElementById('sl-photo-label')
    if (label) label.style.display = 'none'
  }
  reader.readAsDataURL(file)
}

export async function checkOLX() {
  var inp = document.getElementById('olx-inp').value.trim()
  if (!inp) { showToast('Paste a listing title first', 'error'); return }
  var btn = document.querySelector('[onclick="checkOLX()"]')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analysing...' }
  var prompt = [
    'You are an Indian Hot Wheels market expert. Analyse this OLX listing title: "' + inp + '".',
    '⚠️ RULES:',
    '1. Only comment on Hot Wheels. If this is not a Hot Wheels listing, say so in car_name.',
    '2. Use REALISTIC Indian prices — Common: ₹150-350, TH: ₹500-2500, STH: ₹4000-15000.',
    '3. Extract the listing price from the title if present, else set listing_price_inr to null.',
    '4. verdict must be one of: Steal, Fair, Slightly High, Overpriced',
    '',
    'Return ONLY valid JSON:',
    '{"car_name":"exact car name or Not a Hot Wheels listing","rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt","fair_price_inr":"300-600","listing_price_inr":400,"verdict":"Steal|Fair|Slightly High|Overpriced","verdict_reason":"specific 1-2 sentence reason","buyer_advice":"specific actionable advice","red_flags":"specific concerns or empty string","confidence":"High|Medium|Low"}'
  ].join('\n')
  try {
    var d = await groqJSON(prompt, HAIKU_MODEL)
    if (!d) throw new Error('Could not analyse listing')
    document.getElementById('olx-fair-px').textContent = 'Fair: ₹' + (d.fair_price_inr || '?')
    var verdictIcon = {Steal:'🤑', Fair:'👍', 'Slightly High':'🤔', Overpriced:'❌'}[d.verdict] || '❓'
    document.getElementById('olx-verdict-txt').textContent = verdictIcon + ' ' + (d.verdict || '') + ' — ' + (d.verdict_reason || '')
    var rows = [
      ['Car', d.car_name],
      ['Rarity', d.rarity],
      ['Listed price', d.listing_price_inr ? '₹' + d.listing_price_inr : 'Not in title'],
      ['Fair India price', '₹' + (d.fair_price_inr || '?')],
      ['Confidence', d.confidence || 'Medium']
    ]
    document.getElementById('olx-rows').innerHTML = rows.filter(function(r){ return r[1] }).map(function(r) {
      return '<div class="deal-row"><span class="deal-k">' + escHtml(String(r[0])) + '</span><span class="deal-v">' + escHtml(String(r[1])) + '</span></div>'
    }).join('')
    var tip = ''
    if (d.buyer_advice) tip += d.buyer_advice
    if (d.red_flags) tip += (tip ? ' ⚠️ ' : '') + d.red_flags
    document.getElementById('olx-tip').textContent = tip ? '💡 ' + tip : ''
    document.getElementById('olx-result-box').style.display = 'block'
    document.getElementById('olx-result-box').scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch(e) { showToast('Error: ' + e.message, 'error') }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🔍 Analyse Listing' } }
}
