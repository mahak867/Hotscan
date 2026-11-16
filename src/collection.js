import { state } from './state.js'
// hsConfirm was used in addToCol() without ever being imported, so scanning a
// car already in the collection threw ReferenceError instead of offering to add
// a second copy — the duplicate flow was dead for every user.
import { cleanINR, parseINR, fmtINR, escHtml, showToast, rcls, hsConfirm, captureException } from './utils.js'

// Prevents concurrent fullCloudSync() calls racing against Supabase.
// Both onAuthStateChange(INITIAL_SESSION) and getSession() fire on page load,
// which caused two simultaneous queries — the second would hit DB_TIMEOUT.
var _syncInFlight = false
var _syncRetryCount = 0
var _syncMaxRetries = 3

// Column list for collection syncs. image_thumb holds a base64 data URI capped
// at 8000 chars per row (see saveToCloud), so selecting it makes the payload
// scale with collection size — roughly 800KB at 100 cars. Since fullCloudSync
// runs on a 30s poll and on every realtime change event, that was re-downloading
// every thumb continuously and blowing the query timeout on mobile connections.
// Routine syncs now omit the column and reuse the images already in memory; only
// the first sync of a session pays for the full set, with a targeted backfill
// (_backfillThumbs) for individual rows we have no local image for.
var _COL_FIELDS = 'id,name,series,casting_year,rarity,color,tampo,wheel_type,india_retail_inr,india_collector_inr,us_retail_usd,us_collector_usd,investment,investment_reason,fun_fact,india_insight,added_at'
var _COL_FIELDS_WITH_THUMBS = _COL_FIELDS + ',image_thumb'
var _thumbsFetched = false
// Rows already asked about. A thumb that was too large for the column is stored
// as null (saveToCloud), so without this we'd re-request those nulls every poll.
var _thumbBackfillTried = {}
var _editingItem = null
var _editingItemId = null

// Writes the in-memory collection to localStorage. Until now only a non-empty
// cloud merge ever wrote hs_col, so for guests, offline users, or anyone whose
// sync had not yet run, every add / edit / delete lived in memory only and was
// gone on reload — and a deleted car came back from the stale saved copy.
// Called after every local mutation. If storage is full, retry without photos
// (they are the bulk of the payload) rather than losing the cars themselves.
var _persistWarned = false
export function persistCollection() {
  try {
    localStorage.setItem('hs_col', JSON.stringify(state.collection))
    return true
  } catch (e) {
    try {
      var slim = state.collection.map(function(c) {
        var copy = Object.assign({}, c)
        if (copy.image && String(copy.image).startsWith('data:')) delete copy.image
        return copy
      })
      localStorage.setItem('hs_col', JSON.stringify(slim))
      if (!_persistWarned) { _persistWarned = true; showToast('Storage almost full — photos are kept for this session only. Sign in to back them up.', 'error') }
      return true
    } catch (e2) {
      captureException(e2)
      showToast('Could not save your collection on this device — storage is full', 'error')
      return false
    }
  }
}

export function addToCol() {
  if(!state.lastResult){ showToast('Scan a car first to add to collection', 'error'); return }
  var item = {
    id: Date.now(),
    name: state.lastResult.name, series: state.lastResult.series,
    casting_year: state.lastResult.casting_year,
    rarity: state.lastResult.rarity, color: state.lastResult.color,
    tampo: state.lastResult.tampo, wheel_type: state.lastResult.wheel_type,
    india_retail_inr: state.lastResult.india_retail_inr,
    india_collector_inr: state.lastResult.india_collector_inr,
    us_retail_usd: state.lastResult.us_retail_usd,
    us_collector_usd: state.lastResult.us_collector_usd,
    investment: state.lastResult.investment,
    investment_reason: state.lastResult.investment_reason,
    fun_fact: state.lastResult.fun_fact,
    india_insight: state.lastResult.india_insight,
    image: state.imgThumb, added: new Date().toISOString()
  }
  var isDupe = state.collection.some(function(x){ return x.name && item.name && x.name.toLowerCase()===item.name.toLowerCase() && x.color===item.color })
  if (isDupe) {
    hsConfirm('Already in your collection', item.name + ' is already in your collection. Add another copy?', 'Add copy').then(function(ok) {
      if (ok) _doAddToCol(item)
    })
    return
  }
  _doAddToCol(item)
}
function _doAddToCol(item) {
  state.collection.unshift(item)
  persistCollection()
  if (window.pruneWantList) window.pruneWantList(item.name)
  if (navigator.vibrate) navigator.vibrate(30)
  // Snapshot collection value for history chart
  try {
    var _vh = JSON.parse(localStorage.getItem('hs_val_hist') || '[]')
    var _tv = 0; state.collection.forEach(function(c){ _tv += parseINR(c.india_collector_inr) })
    _vh.push({ts: Date.now(), val: _tv})
    if (_vh.length > 90) _vh = _vh.slice(-90)
    localStorage.setItem('hs_val_hist', JSON.stringify(_vh))
  } catch(e) {}
  if (state._sb && state.currentUser) {
    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; localStorage.setItem('hs_col_hash',''); persistCollection() } }catch(e){} })()
  }
  renderCol()
  // Stay on the result: at a store you scan several cars in a row, and being
  // thrown to the collection page after each one breaks that flow.
  showToast(item.name + ' added to your collection', 'success')
  var oc = document.getElementById('r-owned')
  if (oc) { var n = state.collection.filter(function (c) { return (c.name || '').toLowerCase() === (item.name || '').toLowerCase() }).length; oc.textContent = 'In your collection' + (n > 1 ? ' ×' + n : ''); oc.classList.add('show') }
}

export async function delFromCol(id) {
  id = String(id)
  var item = state.collection.find(function(c) { return String(c.id) === String(id) })
  if (!item) {
    if (window.renderCol) window.renderCol()
    showToast('That card was already updated — list refreshed', 'error')
    return
  }
  var sure = await hsConfirm('Remove this car?', (item.name || 'This car') + ' will be removed from your collection.', 'Remove')
  if (!sure) return
  closeColEdit()
  if (item && state._sb && state.currentUser) {
    var cloudId = (typeof item.id === 'string' && item.id.includes('-')) ? item.id : null
    var ok = await deleteFromCloud(cloudId, item.name, item.color, item.series)
    if (!ok) {
      // Don't remove it locally if the cloud delete failed — that's exactly
      // what caused a deleted car to "come back" after a refresh: the local
      // list said it was gone while the cloud row was untouched, and the
      // next sync pulled it right back in. Keeping it visible on failure
      // keeps local and cloud state from silently drifting apart.
      showToast('Could not delete — check your connection and try again', 'error')
      return
    }
  }
  state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })
  persistCollection()
  localStorage.removeItem('hs_col_hash')
  if (navigator.vibrate) navigator.vibrate([20, 30, 20])
  showToast('Car removed', 'success')
  renderCol()
}

export function editColItem(id) {
  id = String(id)
  var item = state.collection.find(function(c) { return String(c.id) === id })
  if (!item) {
    renderCol()
    showToast('That car changed on another device. List refreshed.', 'info')
    return
  }
  _editingItem = item
  _editingItemId = id
  var modal = document.getElementById('col-edit-modal') || createEditModal()
  document.getElementById('col-edit-name').value = item.name || ''
  document.getElementById('col-edit-rarity').value = item.rarity || 'Common'
  document.getElementById('col-edit-condition').value = item.condition || 'Near Mint'
  document.getElementById('col-edit-price').value = cleanINR(item.india_collector_inr) || ''
  document.getElementById('col-edit-paid').value = item.paid != null ? item.paid : ''
  document.getElementById('col-edit-notes').value = item.notes || ''
  document.getElementById('col-edit-source').value = item.source || ''
  document.getElementById('col-edit-forsale').checked = !!item.forSale
  document.getElementById('col-edit-ask').value = item.ask != null ? item.ask : ''
  var facts = [['Series', item.series], ['Colour', item.color], ['Casting year', item.casting_year], ['Wheels', item.wheel_type], ['Tampo', item.tampo], ['India retail', item.india_retail_inr ? '₹' + cleanINR(item.india_retail_inr) : '']]
    .filter(function (f) { return f[1] })
  document.getElementById('col-edit-facts').innerHTML =
    (item.image ? '<img src="' + escHtml(item.image) + '" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin-bottom:12px">' : '') +
    facts.map(function (f) { return '<div class="det" style="padding:8px 0"><span class="det-k">' + f[0] + '</span><span class="det-v">' + escHtml(String(f[1])) + '</span></div>' }).join('') +
    (item.fun_fact ? '<p class="hint">' + escHtml(item.fun_fact) + '</p>' : '')
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
}

export async function saveColEdit() {
  if (!_editingItem) return
  var item = _editingItem
  var priceRaw = document.getElementById('col-edit-price').value.trim()
  var paidRaw = document.getElementById('col-edit-paid').value.trim()
  var okNum = function (v) { var n = Number(v); return isFinite(n) && n >= 0 && n <= 10000000 }
  // The price field holds a range like "600-900" for scanned cars; only a value
  // the user actually changed to a plain number is validated and rewritten.
  var priceChanged = priceRaw !== (cleanINR(item.india_collector_inr) || '')
  if (priceChanged && priceRaw && !/^\d+(\s*-\s*\d+)?$/.test(priceRaw)) { showToast('Enter a price like 450 or 400-600', 'error'); return }
  if (paidRaw && !okNum(paidRaw)) { showToast('Enter what you paid as a number', 'error'); return }
  var askRaw = document.getElementById('col-edit-ask').value.trim()
  if (askRaw && !okNum(askRaw)) { showToast('Enter your asking price as a number', 'error'); return }
  item.name = document.getElementById('col-edit-name').value.trim() || item.name
  item.rarity = document.getElementById('col-edit-rarity').value || item.rarity
  item.condition = document.getElementById('col-edit-condition').value || item.condition
  if (priceChanged && priceRaw) item.india_collector_inr = priceRaw.replace(/\s+/g, '')
  if (paidRaw) item.paid = Math.round(Number(paidRaw)); else delete item.paid
  item.notes = document.getElementById('col-edit-notes').value || ''
  var src = document.getElementById('col-edit-source').value
  if (src) item.source = src; else delete item.source
  if (document.getElementById('col-edit-forsale').checked) { item.forSale = true; if (askRaw) item.ask = Math.round(Number(askRaw)); else delete item.ask }
  else { delete item.forSale; delete item.ask }
  // Local first, so the edit survives a reload whatever the network does.
  persistCollection()
  closeColEdit()
  renderCol()
  if (state._sb && state.currentUser && typeof item.id === 'string' && item.id.includes('-')) {
    var cloudOk = null
    try { cloudOk = await saveToCloud(item) } catch (e) { captureException(e) }
    if (!cloudOk) {
      // _dirty makes the next sync push this edit instead of overwriting it
      // with the stale cloud row.
      item._dirty = true
      persistCollection()
      showToast('Saved on this device. Cloud sync failed and will retry.', 'error')
      return
    }
    if (item._dirty) { delete item._dirty; persistCollection() }
  }
  showToast('Car updated', 'success')
}

export function closeColEdit() {
  var modal = document.getElementById('col-edit-modal')
  if (modal) modal.classList.remove('open')
  document.body.style.overflow = ''
  _editingItem = null
  _editingItemId = null
}

function createEditModal() {
  var el = document.createElement('div')
  el.id = 'col-edit-modal'
  el.className = 'modal-overlay'
  var opts = function (a) { return a.map(function (o) { return '<option>' + o + '</option>' }).join('') }
  el.innerHTML =
    '<div class="sheet" role="dialog" aria-label="Car details">' +
      '<button class="icon-btn sheet-x" id="cem-x" aria-label="Close"><svg class="ic"><use href="#i-x"/></svg></button>' +
      '<div class="card-title">Car details</div>' +
      '<div id="col-edit-facts"></div>' +
      '<label class="field-label" for="col-edit-name">Name</label><input class="inp" id="col-edit-name" type="text">' +
      '<div class="grid-2">' +
        '<div><label class="field-label" for="col-edit-rarity">Rarity</label><select class="inp" id="col-edit-rarity">' + opts(['Common','Uncommon','Rare','Premium','Treasure Hunt','Super Treasure Hunt','Error Car','Vintage']) + '</select></div>' +
        '<div><label class="field-label" for="col-edit-condition">Condition</label><select class="inp" id="col-edit-condition">' + opts(['Mint on Card','Near Mint','Very Good','Good','Fair']) + '</select></div>' +
      '</div>' +
      '<div class="grid-2">' +
        '<div><label class="field-label" for="col-edit-price">Value now</label><div class="inp-affix"><span>₹</span><input class="inp" id="col-edit-price" type="text" inputmode="numeric" placeholder="450"></div></div>' +
        '<div><label class="field-label" for="col-edit-paid">You paid</label><div class="inp-affix"><span>₹</span><input class="inp" id="col-edit-paid" type="number" inputmode="numeric" placeholder="179"></div></div>' +
      '</div>' +
      '<label class="field-label" for="col-edit-source">Bought from</label><select class="inp" id="col-edit-source"><option value="">Not recorded</option>' + opts(['Retail store','Quick commerce','Amazon / Flipkart','Instagram seller','WhatsApp group','OLX','Swap meet','Import','Gift or trade']) + '</select>' +
      '<div class="row between setting-row"><div><div class="setting-t">For sale or trade</div><div class="hint">Adds it to your WhatsApp sale list</div></div><label class="hs-switch"><input type="checkbox" id="col-edit-forsale"><span class="hs-switch-track"></span></label></div>' +
      '<label class="field-label" for="col-edit-ask">Asking price</label><div class="inp-affix"><span>₹</span><input class="inp" id="col-edit-ask" type="number" inputmode="numeric" placeholder="Leave empty for “DM for price”"></div>' +
      '<p class="hint">Price paid, source, sale status, condition and notes are saved on this device.</p>' +
      '<label class="field-label" for="col-edit-notes">Notes</label><textarea class="inp" id="col-edit-notes" rows="2" placeholder="Where you found it, card condition"></textarea>' +
      '<button class="btn btn-primary btn-lg btn-block" id="cem-save">Save</button>' +
      '<button class="btn btn-danger btn-block" id="cem-del">Remove from collection</button>' +
    '</div>'
  document.body.appendChild(el)
  document.getElementById('cem-save').addEventListener('click', saveColEdit)
  document.getElementById('cem-x').addEventListener('click', closeColEdit)
  document.getElementById('cem-del').addEventListener('click', function () { if (_editingItemId) delFromCol(_editingItemId) })
  el.addEventListener('click', function(e) { if (e.target === el) closeColEdit() })
  return el
}

// Counts the valuation up to its new figure instead of snapping to it — the
// total is the reason people reopen the app, and counting reads as the number
// being worked out rather than merely printed.
//
// Deliberately cheap and self-limiting: it only animates when the value actually
// changed, bails out entirely under prefers-reduced-motion, caps at ~30 frames,
// and cancels any in-flight roll so repeated renders cannot stack timers.
var _rollTimer = null
var _rollLast = null
function _rollValue(el, target) {
  if (!el) return
  var fmt = function(v) { return v > 0 ? '₹' + Math.round(v).toLocaleString('en-IN') : '₹0' }
  var reduce = false
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch(e) {}
  if (_rollTimer) { clearInterval(_rollTimer); _rollTimer = null }
  // No animation on first paint, when nothing changed, or when the user has
  // asked for less motion.
  if (reduce || _rollLast === null || _rollLast === target) {
    _rollLast = target
    el.textContent = fmt(target)
    return
  }
  var from = _rollLast
  var steps = 26
  var i = 0
  _rollLast = target
  el.classList.add('hs-rolling')
  _rollTimer = setInterval(function() {
    i++
    // Ease-out so it decelerates into the final figure.
    var t = 1 - Math.pow(1 - i / steps, 3)
    el.textContent = fmt(from + (target - from) * t)
    if (i >= steps) {
      clearInterval(_rollTimer); _rollTimer = null
      el.textContent = fmt(target)
      el.classList.remove('hs-rolling')
    }
  }, 16)
}

// 'list' or 'grid'. Persisted because a view preference that resets every
// session is worse than not offering the choice at all.
export function setColView(v) {
  state.colView = (v === 'grid') ? 'grid' : 'list'
  try { localStorage.setItem('hs_col_view', state.colView) } catch(e) {}
  var lb = document.getElementById('cv-list'), gb = document.getElementById('cv-grid')
  if (lb) lb.classList.toggle('active', state.colView === 'list')
  if (gb) gb.classList.toggle('active', state.colView === 'grid')
  renderCol()
}

export function sCol(by, el) { state.sortBy = by; document.querySelectorAll('#sc .chip').forEach(function(b){b.classList.remove('active')}); el.classList.add('active'); renderCol() }
export function fCol(f, el) { state.filterBy = f; document.querySelectorAll('#fc2 .chip').forEach(function(b){b.classList.remove('active')}); el.classList.add('active'); renderCol() }

// Garage / Wishlist switch on the collection page.
export function setColTab(tab) {
  var want = tab === 'want'
  var g = document.getElementById('col-garage'), w = document.getElementById('col-want')
  if (g) g.hidden = want
  if (w) w.hidden = !want
  ;[['seg-garage', !want], ['seg-want', want]].forEach(function (p) {
    var b = document.getElementById(p[0])
    if (b) { b.classList.toggle('active', p[1]); b.setAttribute('aria-selected', p[1] ? 'true' : 'false') }
  })
  if (want && window.renderWantList) window.renderWantList()
}

// The message Indian sellers post in WhatsApp groups and Instagram stories:
// a numbered list with condition and price. Built from cars marked for sale.
export function shareSaleList() {
  var cars = state.collection.filter(function (c) { return c.forSale })
  if (!cars.length) { showToast('Open a car and switch on “For sale or trade” to build a sale list', 'info', 4500); return }
  var short = { 'Super Treasure Hunt': 'STH', 'Treasure Hunt': 'TH' }
  var text = '*Hot Wheels for sale* (' + cars.length + ')\n' +
    cars.map(function (c, i) {
      var bits = [c.name + (short[c.rarity] ? ' ' + short[c.rarity] : '')]
      if (c.color) bits.push(c.color)
      if (c.condition) bits.push(c.condition)
      bits.push(c.ask != null ? _inr(c.ask) : 'DM for price')
      return (i + 1) + '. ' + bits.join(' · ')
    }).join('\n') +
    '\n\nShipping extra. Timestamp photos on request.\nList made with HotScan · hotscan.in'
  if (window.shareText) window.shareText(text)
}

var TIER_ORDER = ['Super Treasure Hunt','Treasure Hunt','Error Car','Vintage','Premium','Rare','Uncommon','Common']
var TIER_COLOR = {
  'super treasure hunt': '#ff6a3d', 'treasure hunt': '#f7c948', 'error car': '#b69cff', 'vintage': '#f7c948',
  'premium': '#5cc8f5', 'rare': '#5cc8f5', 'uncommon': '#34d17c', 'common': 'transparent'
}
var CHASE = ['super treasure hunt', 'treasure hunt', 'error car', 'vintage']
var CAR_ICON = '<svg class="ic"><use href="#i-garage"/></svg>'
function _inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN') }
function _plHtml(c) {
  if (c.paid == null) return ''
  var diff = parseINR(c.india_collector_inr) - c.paid
  if (!diff) return '<div class="car-pl">at cost</div>'
  return '<div class="car-pl ' + (diff > 0 ? 'up' : 'down') + '">' + (diff > 0 ? '+' : '−') + _inr(Math.abs(diff)) + '</div>'
}

export function renderCol() {
  var list = document.getElementById('col-list')
  if (!list) return
  // Only show the sign-in prompt once auth has resolved and there is nothing local.
  if (window._authResolved && !state.currentUser && state.collection.length === 0) {
    list.className = ''
    list.innerHTML = '<div class="empty"><div class="empty-t">Your garage is empty</div><div class="empty-s">Scan a car to start. It is saved on this device; sign in to back it up.</div>' +
      '<button class="btn btn-primary" onclick="goPage(\'scan\')">Scan your first car</button> <button class="btn btn-ghost" onclick="openAuth()">Sign in</button></div>'
  } else if (window._colSyncing && state.collection.length === 0) {
    list.className = ''
    list.innerHTML = '<div class="empty"><div class="empty-t">Syncing your collection…</div><div class="empty-s">Loading from the cloud</div></div>'
  }

  var all = state.collection
  var items = all.slice()
  var q = (state.searchQuery || '').trim().toLowerCase()
  if (q) {
    items = items.filter(function (c) {
      return [c.name, c.series, c.rarity, c.color, c.casting_year, c.notes, c.source].some(function (f) { return String(f || '').toLowerCase().includes(q) })
    })
  }
  if (state.filterBy === 'forsale') items = items.filter(function (c) { return c.forSale })
  else if (state.filterBy !== 'all') items = items.filter(function (c) { return (c.rarity || '').toLowerCase().includes(state.filterBy.toLowerCase()) })
  if (state.sortBy === 'value') items.sort(function (a, b) { return parseINR(b.india_collector_inr) - parseINR(a.india_collector_inr) })
  else if (state.sortBy === 'name' || state.sortBy === 'casting') items.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '') })
  else if (state.sortBy === 'rarity') items.sort(function (a, b) { return TIER_ORDER.indexOf(a.rarity || 'Common') - TIER_ORDER.indexOf(b.rarity || 'Common') })

  // ── Summary ──
  var total = all.length
  var isRare = function (c) { var r = (c.rarity || '').toLowerCase(); return r.includes('rare') || r.includes('treasure') || r.includes('error') || r.includes('vintage') || r.includes('premium') }
  var val = 0, paid = 0, valOfPaid = 0, paidCount = 0
  all.forEach(function (c) {
    var v = parseINR(c.india_collector_inr); val += v
    if (c.paid != null) { paid += c.paid; valOfPaid += v; paidCount++ }
  })
  _rollValue(document.getElementById('val-total'), val)
  document.getElementById('v-cars').textContent = total
  document.getElementById('v-rare').textContent = all.filter(isRare).length
  document.getElementById('v-sth').textContent = all.filter(function (c) { return (c.rarity || '').toLowerCase().includes('treasure') }).length
  document.getElementById('v-avg').textContent = total ? _inr(val / total) : '₹0'

  // Gain or loss against what was actually paid, counted only over the cars
  // that have a purchase price so a half-filled garage does not look like profit.
  var plEl = document.getElementById('val-pl')
  if (plEl) {
    if (!paidCount) {
      plEl.className = 'val-pl'
      plEl.textContent = total ? 'Add what you paid to a car to track gain or loss.' : ''
    } else {
      var diff = valOfPaid - paid
      plEl.className = 'val-pl ' + (diff >= 0 ? 'up' : 'down')
      plEl.textContent = (diff >= 0 ? '+' : '−') + _inr(Math.abs(diff)) + (paid ? ' (' + (diff >= 0 ? '+' : '−') + Math.abs(Math.round(diff / paid * 100)) + '%)' : '') +
        ' on ' + paidCount + (paidCount === total ? '' : ' of ' + total) + ' car' + (paidCount === 1 ? '' : 's') + ' with a purchase price'
    }
  }

  // Spend, total and this calendar month — a hobby budget is the number most
  // collectors actually have to answer for.
  var spendEl = document.getElementById('val-spend')
  if (spendEl) {
    var nowD = new Date(), monthSpend = 0
    all.forEach(function (c) {
      var ad = c.added ? new Date(c.added) : null
      if (c.paid != null && ad && ad.getFullYear() === nowD.getFullYear() && ad.getMonth() === nowD.getMonth()) monthSpend += c.paid
    })
    spendEl.textContent = paidCount ? 'Spent ' + _inr(paid) + ' in total · ' + _inr(monthSpend) + ' in ' + nowD.toLocaleString('en-IN', { month: 'long' }) : ''
  }

  // Value history: one bar per month that has a real snapshot. Months without
  // one are drawn empty — they used to be filled in with today's value, which
  // made a brand-new collection look like six months of steady history.
  var sparkEl = document.getElementById('val-sparkline')
  if (sparkEl) {
    var hist = []
    try { hist = JSON.parse(localStorage.getItem('hs_val_hist') || '[]') } catch (e) {}
    var now = new Date(), months = []
    for (var mi = 5; mi >= 0; mi--) {
      var md = new Date(now.getFullYear(), now.getMonth() - mi, 1)
      months.push({ y: md.getFullYear(), m: md.getMonth(), label: md.toLocaleString('en-IN', { month: 'short' }), val: null })
    }
    hist.forEach(function (snap) {
      var sd = new Date(snap.ts)
      months.forEach(function (mo) { if (sd.getFullYear() === mo.y && sd.getMonth() === mo.m) mo.val = snap.val })
    })
    if (total) months[5].val = val
    var real = months.filter(function (mo) { return mo.val != null })
    sparkEl.innerHTML = ''
    if (real.length >= 2) {
      var maxV = Math.max.apply(null, real.map(function (mo) { return mo.val })) || 1
      months.forEach(function (mo, idx) {
        var col = document.createElement('div'); col.className = 'val-spark-col'
        var bar = document.createElement('div')
        bar.className = 'val-spark-bar' + (idx === 5 ? ' now' : '') + (mo.val == null ? ' none' : '')
        bar.style.height = (mo.val == null ? 2 : Math.max(Math.round(mo.val / maxV * 26), 3)) + 'px'
        bar.title = mo.label + ': ' + (mo.val == null ? 'no record' : _inr(mo.val))
        var lbl = document.createElement('div'); lbl.className = 'val-spark-lbl'; lbl.textContent = mo.label
        col.appendChild(bar); col.appendChild(lbl); sparkEl.appendChild(col)
      })
    }
  }

  var isGrid = state.colView === 'grid'
  var lb = document.getElementById('cv-list'), gb = document.getElementById('cv-grid')
  if (lb) lb.classList.toggle('active', !isGrid)
  if (gb) gb.classList.toggle('active', isGrid)
  var cntEl = document.getElementById('col-count')
  if (cntEl) cntEl.textContent = !total ? '' : items.length === total ? total + (total === 1 ? ' car' : ' cars') : items.length + ' of ' + total + ' cars'

  if (!total) {
    if (!list.innerHTML) list.innerHTML = '<div class="empty"><div class="empty-t">Your garage is empty</div><div class="empty-s">Scan your first car to start building your collection.</div><button class="btn btn-primary" onclick="goPage(\'scan\')">Scan a car</button></div>'
    return
  }
  list.innerHTML = ''
  // Rows rise in on arriving at the page, not on every keystroke of a search.
  list.className = (isGrid ? 'col-grid' : '') + (window._colStagger ? ' stagger' : '')
  window._colStagger = false
  if (!items.length) {
    list.className = ''
    list.innerHTML = '<div class="empty"><div class="empty-t">No matches</div><div class="empty-s">' + (q ? 'Nothing matches “' + escHtml(q) + '”.' : 'No cars in this rarity tier.') + '</div></div>'
    return
  }

  // How many of each casting are owned, for the ×N marker.
  var copies = {}
  all.forEach(function (c) { var k = (c.name || '').toLowerCase(); copies[k] = (copies[k] || 0) + 1 })

  function tierOf(c) { return (c.rarity || 'Common').toLowerCase() }
  function thumb(c) { return c.image ? '<img src="' + escHtml(c.image) + '" alt="" loading="lazy">' : CAR_ICON }
  function meta(c) { return [c.series, c.color, c.casting_year].filter(Boolean).map(function (x) { return escHtml(String(x)) }).join(' · ') }

  function makeRow(c) {
    var t = tierOf(c), n = copies[(c.name || '').toLowerCase()] || 1
    var d = document.createElement('div')
    d.className = 'car-row' + (CHASE.indexOf(t) > -1 ? ' is-chase' : '')
    d.style.setProperty('--tier', TIER_COLOR[t] || 'transparent')
    d.dataset.editid = c.id
    d.tabIndex = 0
    d.setAttribute('role', 'button')
    d.innerHTML =
      '<div class="car-thumb">' + thumb(c) + '</div>' +
      '<div class="car-body">' +
        '<div class="car-name">' + escHtml(c.name || 'Unknown') + '</div>' +
        '<div class="car-meta">' + (meta(c) || '&nbsp;') + '</div>' +
        '<div class="car-tags"><span class="rar ' + rcls(c.rarity) + '">' + escHtml(c.rarity || 'Common') + '</span>' +
          (n > 1 ? '<span class="car-qty">×' + n + ' owned</span>' : '') +
          (c.condition ? '<span class="car-qty">' + escHtml(c.condition) + '</span>' : '') +
          (c.forSale ? '<span class="car-sale">For sale' + (c.ask != null ? ' ' + _inr(c.ask) : '') + '</span>' : '') + '</div>' +
      '</div>' +
      '<div class="car-side">' + (c.india_collector_inr ? '<div class="car-price">' + escHtml(fmtINR(c.india_collector_inr)) + '</div>' : '') + _plHtml(c) + '</div>'
    return d
  }

  function makeGridCard(c) {
    var t = tierOf(c)
    var short = { 'Super Treasure Hunt': 'STH', 'Treasure Hunt': 'TH', 'Error Car': 'Error' }[c.rarity] || c.rarity || 'Common'
    var d = document.createElement('div')
    d.className = 'col-gcard' + (CHASE.indexOf(t) > -1 ? ' is-chase' : '')
    d.style.setProperty('--tier', TIER_COLOR[t] || 'transparent')
    d.dataset.editid = c.id
    d.tabIndex = 0
    d.setAttribute('role', 'button')
    d.innerHTML =
      '<div class="col-gcard-img">' + thumb(c) + '<div class="col-gcard-scrim"></div>' +
        '<span class="col-gcard-rar"><span class="rar ' + rcls(c.rarity) + '">' + escHtml(short) + '</span></span>' +
        (c.india_collector_inr ? '<div class="col-gcard-price">' + escHtml(fmtINR(c.india_collector_inr)) + '</div>' : '') +
      '</div>' +
      '<div class="col-gcard-body"><div class="col-gcard-nm">' + escHtml(c.name || 'Unknown') + '</div><div class="col-gcard-sr">' + (meta(c) || '—') + '</div></div>'
    return d
  }

  function sectionHeader(label, count, color) {
    var h = document.createElement('div')
    h.className = 'col-section'
    h.innerHTML = '<span class="col-section-t"' + (color && color !== 'transparent' ? ' style="color:' + color + '"' : '') + '>' + escHtml(label) + '</span><span class="col-section-c">' + count + '</span><span class="col-section-r"></span>'
    return h
  }

  // Grouped views put a header in each time the group key changes. "By casting"
  // keeps every colour and year of one model together, which is how collectors
  // check which variants they still lack.
  var groupKey = state.sortBy === 'rarity' ? function (c) { return c.rarity || 'Common' }
               : state.sortBy === 'casting' ? function (c) { return c.name || 'Unknown' }
               : null
  var groupCounts = {}
  if (groupKey) items.forEach(function (c) { var k = groupKey(c); groupCounts[k] = (groupCounts[k] || 0) + 1 })
  var current = null
  items.forEach(function (c) {
    if (groupKey) {
      var k = groupKey(c)
      if (k !== current) {
        current = k
        list.appendChild(sectionHeader(k, groupCounts[k], state.sortBy === 'rarity' ? TIER_COLOR[k.toLowerCase()] : null))
      }
    }
    list.appendChild(isGrid ? makeGridCard(c) : makeRow(c))
  })

  // One delegated listener; a tap or Enter on a car opens its details, where
  // it can be edited or removed. (List rows used to hide their delete button
  // behind :hover, so on a phone there was no way to remove a car at all.)
  if (!list._bound) {
    list._bound = true
    var open = function (e) { var el = e.target.closest('[data-editid]'); if (el) editColItem(el.dataset.editid) }
    list.addEventListener('click', open)
    list.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e) } })
  }
}

export function exportVal() {
  if (!state.collection.length) { showToast('Add some cars first!', 'error'); return }

  setTimeout(function() {
    var val = 0
    state.collection.forEach(function(c) { val += parseINR(c.india_collector_inr) })
    var date = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})
    var collector = state.currentUser ? (state.currentUser.name || state.currentUser.email) : 'Collector'
    var rareCars  = state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('rare')||r.includes('treasure')||r.includes('error')||r.includes('vintage')})
    var thCars    = state.collection.filter(function(c){return(c.rarity||'').toLowerCase().includes('treasure')})

    var rows = state.collection.map(function(c, i) {
      var r = c.rarity || 'Common'
      var rCol = r.toLowerCase().includes('super') ? '#ffd60a' : r.toLowerCase().includes('treasure') ? '#ff9500' : r.toLowerCase().includes('rare')||r.toLowerCase().includes('vintage')||r.toLowerCase().includes('error') ? '#4cc9f0' : '#aaa'
      return '<tr style="border-bottom:1px solid #1f1f1f">'
        + '<td style="padding:8px 10px;color:#aaa;font-size:12px">' + (i+1) + '</td>'
        + '<td style="padding:8px 10px;font-weight:600;color:#f0ede8;font-size:13px">' + escHtml(c.name||'Unknown') + (c.color?'<br><span style="font-size:11px;color:#666">'+escHtml(c.color)+'</span>':'') + '</td>'
        + '<td style="padding:8px 10px"><span style="color:'+rCol+';font-size:12px;font-weight:700">'+escHtml(r)+'</span></td>'
        + '<td style="padding:8px 10px;font-weight:700;color:#ffd60a;font-size:13px">₹' + (cleanINR(c.india_collector_inr)||'N/A') + '</td>'
        + '<td style="padding:8px 10px;font-size:11px;color:'+(c.investment==='📈 Rising'?'#2dc653':c.investment==='📉 Falling'?'#e63946':'#aaa')+'">'+(c.investment||'—')+'</td>'
        + '</tr>'
    }).join('')

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<title>HotScan Valuation Certificate</title>'
      + '<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#f0ede8;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;padding:40px}'
      + '@media print{body{padding:20px}}'
      + '.cert{max-width:800px;margin:0 auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden}'
      + '.cert-header{background:linear-gradient(135deg,#1B3A5C,#0a0a0a);padding:36px 40px;border-bottom:1px solid #222}'
      + '.cert-logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:2px;margin-bottom:4px}'
      + '.cert-logo span{color:#e63946}'
      + '.cert-title{font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:2px}'
      + '.cert-body{padding:32px 40px}'
      + '.cert-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:32px}'
      + '.meta-box{background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:16px}'
      + '.meta-label{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}'
      + '.meta-val{font-size:20px;font-weight:800;color:#f0ede8}'
      + '.meta-val.gold{color:#ffd60a}'
      + 'table{width:100%;border-collapse:collapse;margin-top:8px}'
      + 'th{padding:10px;text-align:left;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #222}'
      + '.cert-footer{padding:20px 40px;border-top:1px solid #1a1a1a;font-size:11px;color:#555;display:flex;justify-content:space-between}'
      + '</style></head><body>'
      + '<div class="cert">'
      + '<div class="cert-header"><div class="cert-logo">HOT<span>SCAN</span> INDIA</div><div class="cert-title">Collection Valuation Certificate · ' + date + '</div></div>'
      + '<div class="cert-body">'
      + '<div class="cert-meta">'
      + '<div class="meta-box"><div class="meta-label">Collector</div><div class="meta-val" style="font-size:15px">'+escHtml(collector)+'</div></div>'
      + '<div class="meta-box"><div class="meta-label">Total Cars</div><div class="meta-val">'+state.collection.length+'</div></div>'
      + '<div class="meta-box"><div class="meta-label">Estimated Value</div><div class="meta-val gold">₹'+val.toLocaleString('en-IN')+'</div></div>'
      + '<div class="meta-box"><div class="meta-label">Rare+ Cars</div><div class="meta-val">'+rareCars.length+'</div></div>'
      + '<div class="meta-box"><div class="meta-label">Treasure Hunts</div><div class="meta-val" style="color:#ff9500">'+thCars.length+'</div></div>'
      + '<div class="meta-box"><div class="meta-label">Avg Value</div><div class="meta-val gold" style="font-size:16px">₹'+(state.collection.length?Math.round(val/state.collection.length).toLocaleString('en-IN'):'0')+'</div></div>'
      + '</div>'
      + '<table><thead><tr><th>#</th><th>Car</th><th>Rarity</th><th>India Value</th><th>Trend</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '</div>'
      + '<div class="cert-footer"><span>HotScan India v5.0 · hotscan.in · India\'s First Hot Wheels Scanner</span><span>Values are AI-estimated · Not for insurance/legal use</span></div>'
      + '</div></body></html>'

    var win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { showToast('Allow popups to export PDF', 'error'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(function() { win.print() }, 600)
    showToast('PDF ready — use "Save as PDF" in the print dialog', 'success')
  }, 120)
}

export function addCarToCollection(car, thumb) {
  var item = {
    id: Date.now() + Math.random(),
    name: car.name, series: car.series,
    casting_year: car.casting_year,
    rarity: car.rarity, color: car.color,
    tampo: car.tampo, wheel_type: car.wheel_type,
    india_retail_inr: car.india_retail_inr,
    india_collector_inr: car.india_collector_inr,
    us_retail_usd: car.us_retail_usd,
    us_collector_usd: car.us_collector_usd,
    investment: car.investment,
    investment_reason: car.investment_reason,
    fun_fact: car.fun_fact,
    india_insight: car.india_insight,
    image: thumb || state.imgThumb,
    added: new Date().toISOString()
  }
  state.collection.unshift(item)
  persistCollection()
  if (window.pruneWantList) window.pruneWantList(item.name)
  if (state._sb && state.currentUser) {
    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; persistCollection() } }catch(e){} })()
  }
  renderCol()
  return item
}

export async function fullCloudSync(retryCount) {
  // Lock: if a sync is already running, bail out immediately.
  // onAuthStateChange(INITIAL_SESSION) and getSession() both fire on page load
  // nearly simultaneously — letting both proceed causes concurrent Supabase
  // queries that starve each other, producing DB_TIMEOUT errors.
  if (_syncInFlight) return false
  _syncInFlight = true
  try {
    return await _doFullCloudSync(retryCount)
  } finally {
    _syncInFlight = false
  }
}

// Wraps any Supabase query promise in a hard timeout with exponential backoff.
// Avoids duplicate new Promise(timeout) boilerplate and ensures
// ALL queries (including the re-fetch after uploading local items) are guarded.
function _timedQuery(queryPromise, ms) {
  ms = ms || 12000
  return Promise.race([
    queryPromise,
    new Promise(function(_, rej) {
      setTimeout(function() { rej(new Error('DB_TIMEOUT: Query exceeded ' + ms + 'ms')) }, ms)
    })
  ])
}

// Retry helper with exponential backoff
async function _backfillThumbs(items) {
  var missing = items.filter(function(c) {
    return !c.image && c.id && !_thumbBackfillTried[c.id]
  })
  if (missing.length === 0) return
  var ids = missing.map(function(c) { return c.id })
  ids.forEach(function(id) { _thumbBackfillTried[id] = true })
  try {
    var res = await _timedQuery(
      state._sb.from('collection').select('id,image_thumb').in('id', ids)
    )
    if (!res.data) return
    var thumbById = {}
    res.data.forEach(function(d) { if (d.image_thumb) thumbById[d.id] = d.image_thumb })
    items.forEach(function(c) {
      if (!c.image && thumbById[c.id]) c.image = thumbById[c.id]
    })
  } catch(e) {
    // Allow a later sync to try these again.
    ids.forEach(function(id) { delete _thumbBackfillTried[id] })
  }
}

async function _doFullCloudSync(retryCount) {
  if (!state._sb || !state.currentUser) {
    if ((retryCount || 0) < 3) {
      await new Promise(function(r){ setTimeout(r, 600) })
      return _doFullCloudSync((retryCount || 0) + 1)
    }
    throw new Error('Not signed in — sign out and back in, then try again')
  }
  try {
    // Initial fetch — guarded by _timedQuery's 12s default. Thumbs come along
    // only on the first sync of the session; later syncs stay small.
    var withThumbs = !_thumbsFetched
    var res = await _timedQuery(
      state._sb.from('collection')
        .select(withThumbs ? _COL_FIELDS_WITH_THUMBS : _COL_FIELDS)
        .eq('user_id', state.currentUser.id)
        .order('added_at', { ascending: false })
    )

    var cloudItems = []
    if (res.error) {
      var errMsg = res.error.message || ''
      if (errMsg.includes('does not exist') || errMsg.includes('relation')) {
        throw new Error('Database tables not set up — run SQL migration in Supabase')
      }
      captureException(new Error('fullCloudSync fetch error: ' + errMsg))
      return false
    }
    // Only latch after a clean response — a failed first sync must retry with thumbs.
    if (withThumbs) _thumbsFetched = true
    if (res.data && res.data.length > 0) {
      cloudItems = res.data.map(function(d) {
        return {
          id: d.id, name: d.name, series: d.series,
          casting_year: d.casting_year, rarity: d.rarity,
          color: d.color, tampo: d.tampo,
          wheel_type: d.wheel_type,
          india_retail_inr: d.india_retail_inr,
          india_collector_inr: d.india_collector_inr,
          us_retail_usd: d.us_retail_usd,
          us_collector_usd: d.us_collector_usd,
          investment: d.investment,
          investment_reason: d.investment_reason,
          fun_fact: d.fun_fact,
          india_insight: d.india_insight,
          // Don't use truncated image from cloud — keep local if available
          image: d.image_thumb || null,
          added: d.added_at,
          _synced: true
        }
      })
    }

    // 1b. Carry local state across the merge.
    // condition and notes are edited in the app but are not cloud columns yet,
    // so every sync used to replace them with nothing. And a local edit whose
    // cloud save failed is pushed now instead of being overwritten by the stale
    // cloud copy.
    var _localById = {}
    state.collection.forEach(function(c) { if (c && c.id != null) _localById[String(c.id)] = c })
    for (var _ci = 0; _ci < cloudItems.length; _ci++) {
      var _loc = _localById[String(cloudItems[_ci].id)]
      if (!_loc) continue
      if (_loc.condition) cloudItems[_ci].condition = _loc.condition
      if (_loc.notes) cloudItems[_ci].notes = _loc.notes
      if (_loc.paid != null) cloudItems[_ci].paid = _loc.paid
      if (_loc.source) cloudItems[_ci].source = _loc.source
      if (_loc.forSale) { cloudItems[_ci].forSale = true; cloudItems[_ci].ask = _loc.ask }
      if (_loc._dirty) {
        var _merged = Object.assign({}, cloudItems[_ci], _loc)
        var _saved = null
        try { _saved = await saveToCloud(_merged) } catch (e) { captureException(e) }
        if (_saved) delete _merged._dirty
        cloudItems[_ci] = _merged
      }
    }

    // 2. Get local items that are NOT yet in cloud (have numeric/float IDs from Date.now())
    // Keyed on name+color+series (not name alone) — matches the same key addToCol()
    // uses for its own duplicate-copy check, so a second copy of the same casting
    // in a different color (or a genuine duplicate not yet synced) doesn't get
    // silently treated as "already uploaded" and dropped.
    var dupeKey = function(c) { return (c.name||'').toLowerCase()+'|'+(c.color||'').toLowerCase()+'|'+(c.series||'').toLowerCase() }
    var cloudKeys = cloudItems.map(dupeKey)
    var localOnly = state.collection.filter(function(c) {
      // Cloud IDs are UUIDs (strings with dashes), local IDs are numbers
      var isLocalId = typeof c.id === 'number' || String(c.id).indexOf('-') === -1
      return isLocalId && !cloudKeys.includes(dupeKey(c))
    })

    // 3. Upload local-only items to cloud, TRACKING which ones failed.
    //
    // This used to discard saveToCloud's return value. Step 4 then replaced
    // state.collection wholesale with cloud rows and rewrote localStorage — so
    // an item whose upload failed was erased from the device having never
    // reached the cloud. Silent, permanent data loss.
    //
    // It fires because the client and the database disagree about what a
    // duplicate is: saveToCloud checks name + series + colour, while
    // idx_collection_user_name is unique on (user_id, lower(name)) alone. A
    // second car sharing a name but not a colour looks new to the client and is
    // rejected by the index.
    var failedUploads = []
    for (var i = 0; i < localOnly.length; i++) {
      var item = localOnly[i]
      var savedId = await saveToCloud(item)
      if (!savedId) failedUploads.push(item)
    }

    // 4. Merge: cloud items + any local-only items not yet uploaded
    // Prefer cloud data (authoritative), keep local images if cloud image is missing
    var localImageMap = {}
    state.collection.forEach(function(c) {
      if (c.image && c.name) localImageMap[(c.name || '').toLowerCase()] = c.image
    })

    // Re-fetch after uploading local items — also timeout-guarded
    if (localOnly.length > 0) {
      var res2 = await _timedQuery(
        state._sb.from('collection')
          .select(withThumbs ? _COL_FIELDS_WITH_THUMBS : _COL_FIELDS)
          .eq('user_id', state.currentUser.id)
          .order('added_at', { ascending: false })
      )
      if (res2.data) {
        cloudItems = res2.data.map(function(d) {
          var nameKey = (d.name || '').toLowerCase()
          return {
            id: d.id, name: d.name, series: d.series,
            casting_year: d.casting_year, rarity: d.rarity,
            color: d.color, tampo: d.tampo,
            wheel_type: d.wheel_type,
            india_retail_inr: d.india_retail_inr,
            india_collector_inr: d.india_collector_inr,
            us_retail_usd: d.us_retail_usd,
            us_collector_usd: d.us_collector_usd,
            investment: d.investment,
            investment_reason: d.investment_reason,
            fun_fact: d.fun_fact,
            india_insight: d.india_insight,
            // Restore local image if cloud image is truncated/missing
            image: localImageMap[nameKey] || d.image_thumb || null,
            added: d.added_at,
            _synced: true
          }
        })
      }
    } else {
      // Restore local images into cloud items
      cloudItems = cloudItems.map(function(c) {
        var nameKey = (c.name || '').toLowerCase()
        if (!c.image && localImageMap[nameKey]) c.image = localImageMap[nameKey]
        return c
      })
    }

    // Any row still without an image is one this device has never rendered —
    // a car added on another device, or a fresh session. Fetch just those thumbs
    // by id so the saving above doesn't cost us missing artwork.
    if (!withThumbs) await _backfillThumbs(cloudItems)

    // Carry forward anything that could not be uploaded. These cars exist only
    // on this device, so dropping them here is what destroyed them before.
    // They stay local and will retry on the next sync; a car that never syncs
    // is a far smaller problem than a car that silently disappears.
    if (failedUploads.length > 0) {
      // Only carry forward cars the cloud does not already have. The first
      // version of this appended unconditionally, which produced a visible
      // duplicate: a car that failed to upload was kept locally, then uploaded
      // successfully on a later sync, and the stale local copy was re-appended
      // alongside the new cloud row.
      var haveKeys = {}
      cloudItems.forEach(function(c){ haveKeys[dupeKey(c)] = true })
      var stillMissing = failedUploads.filter(function(c){ return !haveKeys[dupeKey(c)] })
      if (stillMissing.length > 0) {
        cloudItems = cloudItems.concat(stillMissing)
        captureException(new Error(
          'fullCloudSync: kept ' + stillMissing.length + ' local car(s) that failed to upload'
        ))
      }
    }

    // Collapse any duplicate that already exists.
    //
    // Migration 22 dropped the unique index on (user_id, lower(name)) because it
    // contradicted the "Add another copy?" flow — but it was also the last thing
    // stopping a re-upload from creating a genuine second row. Deduplication is
    // now entirely the client's job, so it has to actually happen here rather
    // than be assumed.
    //
    // Cloud rows win over local ones: a uuid id means the row is real and
    // synced, so keeping it preserves the id that edits and deletes reference.
    var seenKeys = {}
    cloudItems = cloudItems.filter(function(c) {
      var k = dupeKey(c)
      if (!seenKeys[k]) { seenKeys[k] = c; return true }
      var kept = seenKeys[k]
      var keptIsCloud = String(kept.id).indexOf('-') > -1
      var thisIsCloud = String(c.id).indexOf('-') > -1
      // Swap in the cloud copy if the one already kept is only local.
      if (thisIsCloud && !keptIsCloud) {
        var at = cloudItems.indexOf(kept)
        if (at > -1) cloudItems[at] = c
        seenKeys[k] = c
      }
      return false
    })

    // never wipe existing collection on empty sync
    if (cloudItems.length > 0) {
      state.collection = cloudItems
      var _nh = cloudItems.map(function(x){return String(x.id)}).join(',')
      var _oh = localStorage.getItem('hs_col_hash') || ''
      localStorage.setItem('hs_col', JSON.stringify(cloudItems))
      localStorage.setItem('hs_col_hash', _nh)
      if (_nh !== _oh) renderCol()
      return true
    } else if (localOnly.length > 0) {
      return true
    }
    return false
  } catch(e) {
    captureException(e)
  }
  return false
}

// Alias — kept for compatibility, routes to fullCloudSync
// Last-resort shrink for an oversized data URL. Returns null on failure so the
// caller can fall back to the original rather than losing the image.
function _shrinkDataUrl(dataUrl, size, quality) {
  return new Promise(function(resolve) {
    var img = new Image()
    img.onload = function() {
      try {
        var s = Math.min(img.width, img.height)
        var c = document.createElement('canvas')
        c.width = size; c.height = size
        c.getContext('2d').drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, size, size)
        resolve(c.toDataURL('image/jpeg', quality))
      } catch(e) { resolve(null) }
    }
    img.onerror = function(){ resolve(null) }
    img.src = dataUrl
  })
}

// Reported once per session, not per car: if the bucket is missing every save
// fails the same way, and 30 identical Sentry events tell you nothing extra.
var _storageWarned = false

async function uploadImageToStorage(imageDataUrl, itemId) {
  if (!imageDataUrl || !state._sb || !state.currentUser) return null
  try {
    // Convert base64 to blob
    var arr = imageDataUrl.split(',')
    var mime = arr[0].match(/:(.*?);/)[1]
    var bstr = atob(arr[1])
    var n = bstr.length
    var u8arr = new Uint8Array(n)
    while(n--) u8arr[n] = bstr.charCodeAt(n)
    var blob = new Blob([u8arr], {type: mime})
    var ext = mime === 'image/png' ? 'png' : 'jpg'
    var path = state.currentUser.id + '/' + itemId + '.' + ext
    var up = await state._sb.storage.from('car-images').upload(path, blob, {
      contentType: mime, upsert: true
    })
    // This used to `return null` silently. A missing bucket or absent storage
    // policy therefore looked identical to "no image", which is how every car
    // silently lost its photo with nothing in the logs to explain it.
    if (up.error) {
      if (!_storageWarned) {
        _storageWarned = true
        captureException(new Error('car-images upload failed: ' + (up.error.message || 'unknown')))
      }
      return null
    }
    var urlData = state._sb.storage.from('car-images').getPublicUrl(path)
    return urlData.data && urlData.data.publicUrl ? urlData.data.publicUrl : null
  } catch(e) {
    if (!_storageWarned) { _storageWarned = true; captureException(e) }
    return null
  }
}

export async function saveToCloud(item) {
  if (!state.currentUser || !state._sb) return null
  try {
    var thumb = item.image || null
    // Upload to Supabase Storage if image is base64 (not already a URL).
    // If Storage is unavailable we keep the base64 rather than discarding it.
    //
    // This previously did `thumb = null // too large for DB column` for anything
    // over 8000 chars, which threw the user's photo away for good. There is no
    // such column limit: image_thumb is `text`, which Postgres does not bound.
    // compressThumb output straddles 8000 chars depending on how busy the photo
    // is, so most cars silently lost their picture while the occasional simple
    // one survived — exactly the pattern seen in production.
    if (thumb && thumb.startsWith('data:') && thumb.length > 100) {
      var storageUrl = await uploadImageToStorage(thumb, item.id || Date.now())
      if (storageUrl) thumb = storageUrl
      else if (thumb.length > 400000) {
        // Only a genuinely pathological payload gets touched, and even then it
        // is shrunk rather than dropped — a smaller picture beats no picture.
        thumb = await _shrinkDataUrl(thumb, 96, 0.6) || thumb
      }
    }
    var payload = {
      user_id: state.currentUser.id,
      name: item.name,
      series: item.series,
      casting_year: item.casting_year,
      rarity: item.rarity,
      color: item.color,
      tampo: item.tampo,
      wheel_type: item.wheel_type,
      india_retail_inr: item.india_retail_inr,
      india_collector_inr: item.india_collector_inr,
      us_retail_usd: item.us_retail_usd,
      us_collector_usd: item.us_collector_usd,
      investment: item.investment,
      investment_reason: item.investment_reason,
      fun_fact: item.fun_fact,
      india_insight: item.india_insight,
      image_thumb: thumb,
      added_at: item.added
    }
    var hasCloudId = item.id && typeof item.id === 'string' && item.id.includes('-')
    if (hasCloudId) {
      // Update existing cloud row
      payload.id = item.id
      var upd = await state._sb.from('collection').upsert(payload, { onConflict: 'id' }).select('id').single()
      if (upd.data && upd.data.id) return upd.data.id
      if (upd.error) captureException(new Error('saveToCloud update: ' + upd.error.message))
    } else {
      // New item — check if name+color+series already exists first, then insert
      var existing = await state._sb.from('collection')
        .select('id').eq('user_id', state.currentUser.id)
        .ilike('name', item.name)
        .eq('series', item.series || '')
        .eq('color', item.color || '')
        .limit(1)
      if (existing.data && existing.data.length > 0) {
        // Already in cloud — return existing id
        return existing.data[0].id
      }
      var ins = await state._sb.from('collection').insert(payload).select('id').single()
      if (ins.data && ins.data.id) return ins.data.id
      if (ins.error) captureException(new Error('saveToCloud insert: ' + ins.error.message))
    }
  } catch(e) { captureException(e) }
  return null
}

export async function deleteFromCloud(id, name, color, series) {
  if (!state.currentUser || !state._sb) return false
  try {
    if (id && typeof id === 'string' && id.includes('-')) {
      var r = await state._sb.from('collection').delete().eq('id', id).eq('user_id', state.currentUser.id)
      if (r.error) { captureException(new Error('deleteFromCloud: ' + r.error.message)); return false }
      return true
    } else if (name) {
      // Name-only match would delete EVERY row with that name (e.g. all copies
      // of a duplicate casting) — narrow by color+series, and cap at one row
      // via a select-then-delete-by-id so at most the single matching copy goes.
      var q = state._sb.from('collection').select('id')
        .eq('user_id', state.currentUser.id).ilike('name', name)
      if (color) q = q.eq('color', color)
      if (series) q = q.eq('series', series)
      var found = await q.limit(1)
      if (found.data && found.data.length > 0) {
        var r2 = await state._sb.from('collection').delete().eq('id', found.data[0].id)
        if (r2.error) { captureException(new Error('deleteFromCloud by name: ' + r2.error.message)); return false }
        return true
      }
      return true // nothing matched — already gone, nothing to fail on
    }
    return true // no cloud id and no name to match on — nothing to delete cloud-side
  } catch(e) { captureException(e); return false }
}

export function searchCol(query) {
  state.searchQuery = (query || '').toLowerCase().trim()
  renderCol()
}


