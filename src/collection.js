import { state } from './state.js'
import { cleanINR, parseINR, escHtml, showToast, rcls, captureException } from './utils.js'

// Prevents concurrent fullCloudSync() calls racing against Supabase.
// Both onAuthStateChange(INITIAL_SESSION) and getSession() fire on page load,
// which caused two simultaneous queries — the second would hit DB_TIMEOUT.
var _syncInFlight = false
var _syncRetryCount = 0
var _syncMaxRetries = 3
var _editingItem = null
var _editingItemId = null

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
    hsConfirm('Already in Collection', item.name + ' is already in your collection. Add another copy?', 'Add Copy', '➕').then(function(ok) {
      if (ok) _doAddToCol(item)
    })
    return
  }
  _doAddToCol(item)
}
function _doAddToCol(item) {
  state.collection.unshift(item)
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
    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; localStorage.setItem('hs_col_hash','') } }catch(e){} })()
  }
  renderCol(); window.goPage('collection')
}

export function delFromCol(id) {
  id = String(id)
  var item = state.collection.find(function(c) { return String(c.id) === String(id) })
  if (!item) {
    if (window.renderCol) window.renderCol()
    showToast('That card was already updated — list refreshed', 'error')
    return
  }
  if (item && state._sb && state.currentUser) {
    var cloudId = (typeof item.id === 'string' && item.id.includes('-')) ? item.id : null
    deleteFromCloud(cloudId, item.name, item.color, item.series)
  }
  state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })
  localStorage.removeItem('hs_col_hash')
  if (navigator.vibrate) navigator.vibrate([20, 30, 20])
  showToast('🗑 Car removed', 'success')
  renderCol()
}

export function editColItem(id) {
  if (document.getElementById('col-edit-modal')) return // prevent double-open
  id = String(id)
  var item = state.collection.find(function(c) { return String(c.id) === id })
  if (!item) {
    if (window.renderCol) window.renderCol()
    showToast('That card was already updated — list refreshed', 'error')
    return
  }
  _editingItem = item
  _editingItemId = id
  // Show edit modal
  var modal = document.getElementById('col-edit-modal')
  if (!modal) {
    // Create modal if it doesn't exist
    createEditModal()
    modal = document.getElementById('col-edit-modal')
  }
  // Populate form with item data
  document.getElementById('col-edit-name').value = item.name || ''
  document.getElementById('col-edit-rarity').value = item.rarity || 'Common'
  document.getElementById('col-edit-condition').value = item.condition || 'Good'
  document.getElementById('col-edit-price').value = cleanINR(item.india_collector_inr) || ''
  document.getElementById('col-edit-notes').value = item.notes || ''
  modal.style.display = 'flex'
  document.body.style.overflow = 'hidden'
}

export function saveColEdit() {
  if (!_editingItem) return
  var item = _editingItem
  item.name = document.getElementById('col-edit-name').value || item.name
  item.rarity = document.getElementById('col-edit-rarity').value || item.rarity
  item.condition = document.getElementById('col-edit-condition').value || item.condition
  item.india_collector_inr = '₹' + document.getElementById('col-edit-price').value
  item.notes = document.getElementById('col-edit-notes').value || ''
  if (state._sb && state.currentUser && typeof item.id === 'string' && item.id.includes('-')) {
    saveToCloud(item)
  }
  closeColEdit()
  renderCol()
  showToast('Car updated!', 'success')
}

export function closeColEdit() {
  var modal = document.getElementById('col-edit-modal')
  if (modal) modal.style.display = 'none'
  document.body.style.overflow = ''
  _editingItem = null
  _editingItemId = null
}

function createEditModal() {
  var el = document.createElement('div')
  el.id = 'col-edit-modal'
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;align-items:center;justify-content:center;padding:16px;box-sizing:border-box'
  var rarOpts = ['Common','Uncommon','Rare','Premium','Treasure Hunt','Super Treasure Hunt','Error Car','Vintage'].map(function(o){return '<option>'+o+'</option>'}).join('')
  var condOpts = ['Mint on Card','Near Mint','Very Good','Good','Fair'].map(function(o){return '<option>'+o+'</option>'}).join('')
  var S = 'width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.06);color:#fff;box-sizing:border-box;font-size:14px;margin-bottom:12px'
  var L = 'display:block;font-size:11px;color:rgba(255,255,255,.5);margin-bottom:4px;font-weight:700;text-transform:uppercase'
  el.innerHTML =
    '<div style="background:#131320;border-radius:18px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;padding:22px;box-sizing:border-box;border:1px solid rgba(255,255,255,.1)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">' +
        '<div style="font-size:17px;font-weight:800">✏️ Edit Car</div>' +
        '<button id="cem-x" style="background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;font-size:18px;width:32px;height:32px;border-radius:8px">✕</button>' +
      '</div>' +
      '<label style="'+L+'">Car Name</label><input id="col-edit-name" type="text" placeholder="e.g. Bone Shaker" style="'+S+'">' +
      '<label style="'+L+'">Rarity</label><select id="col-edit-rarity" style="'+S+'">'+rarOpts+'</select>' +
      '<label style="'+L+'">Condition</label><select id="col-edit-condition" style="'+S+'">'+condOpts+'</select>' +
      '<label style="'+L+'">Collector Price (₹)</label><input id="col-edit-price" type="number" placeholder="e.g. 350" style="'+S+'">' +
      '<label style="'+L+'">Notes</label>' +
      '<textarea id="col-edit-notes" style="'+S+';height:70px;resize:none;font-family:inherit;margin-bottom:16px"></textarea>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="cem-save" style="flex:1;padding:13px;background:#e63946;border:none;color:#fff;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Save Changes</button>' +
        '<button id="cem-cancel" style="flex:1;padding:13px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#fff;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Cancel</button>' +
      '</div>' +
    '</div>'
  document.body.appendChild(el)
  document.getElementById('cem-save').addEventListener('click', saveColEdit)
  document.getElementById('cem-cancel').addEventListener('click', closeColEdit)
  document.getElementById('cem-x').addEventListener('click', closeColEdit)
  el.addEventListener('click', function(e) { if (e.target === el) closeColEdit() })
}

export function sCol(by, el) { state.sortBy = by; document.querySelectorAll('#sc .chip').forEach(function(b){b.classList.remove('active')}); el.classList.add('active'); renderCol() }
export function fCol(f, el) { state.filterBy = f; document.querySelectorAll('#fc2 .chip').forEach(function(b){b.classList.remove('active')}); el.classList.add('active'); renderCol() }

export function renderCol() {
  // Only show sign-in prompt if auth has fully resolved AND user is not logged in
  if (window._authResolved && !state.currentUser && state.collection.length === 0) {
    var _list = document.getElementById('col-list')
    if (_list) _list.innerHTML = '<div style="text-align:center;padding:40px 20px"><div style="font-size:40px;margin-bottom:12px">🔐</div><div style="font-size:15px;font-weight:700;margin-bottom:6px">Sign in to see your collection</div><div style="font-size:12px;color:var(--text2);margin-bottom:16px;line-height:1.6">Your collection syncs across all devices when signed in</div><button class="btn-red" style="padding:12px 24px;border-radius:12px;font-size:14px" onclick="window.openAuth()">Sign In / Create Account</button></div>'
    return
  }
  if (window._colSyncing) {
    var list = document.getElementById('col-list')
    if (list && state.collection.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text2)"><div style="font-size:32px;margin-bottom:12px">☁️</div><div style="font-size:14px;font-weight:600">Syncing your collection...</div><div style="font-size:12px;margin-top:6px;opacity:.6">Loading from cloud</div></div>'
      return
    }
  }
  var items = state.collection.slice()
  if (state.searchQuery && state.searchQuery.trim()) {
    var q = state.searchQuery.toLowerCase()
    items = items.filter(function(c) {
      return (c.name||'').toLowerCase().includes(q) || (c.series||'').toLowerCase().includes(q) || (c.rarity||'').toLowerCase().includes(q)
    })
  }
  if (state.filterBy !== 'all') items = items.filter(function(c) { return (c.rarity||'').toLowerCase().includes(state.filterBy.toLowerCase()) })
  var order = ['Super Treasure Hunt','Treasure Hunt','Error Car','Vintage','Premium','Rare','Uncommon','Common']
  if (state.sortBy === 'value') items.sort(function(a,b) { return parseINR(b.india_collector_inr) - parseINR(a.india_collector_inr) })
  else if (state.sortBy === 'name') items.sort(function(a,b) { return (a.name||'').localeCompare(b.name||'') })
  else if (state.sortBy === 'rarity') items.sort(function(a,b) { return order.indexOf(a.rarity) - order.indexOf(b.rarity) })
  var total = state.collection.length
  var rare = state.collection.filter(function(c) { var r=(c.rarity||'').toLowerCase(); return r.includes('rare')||r.includes('treasure')||r.includes('error')||r.includes('vintage') }).length
  var sth = state.collection.filter(function(c) { return (c.rarity||'').toLowerCase().includes('treasure') }).length
  var val = 0; state.collection.forEach(function(c) { val += parseINR(c.india_collector_inr) })
  document.getElementById('val-total').textContent = val > 0 ? '₹' + val.toLocaleString('en-IN') : '₹0'
  document.getElementById('v-cars').textContent = total
  document.getElementById('v-rare').textContent = rare
  document.getElementById('v-sth').textContent = sth
  document.getElementById('v-avg').textContent = total > 0 ? '₹' + Math.round(val/total).toLocaleString('en-IN') : '₹0'

  // Sparkline: show value history over last 6 months
  var sparkEl = document.getElementById('val-sparkline')
  if (sparkEl) {
    var _vh = []
    try { _vh = JSON.parse(localStorage.getItem('hs_val_hist') || '[]') } catch(e) {}
    var now = new Date()
    var months = []
    for (var mi = 5; mi >= 0; mi--) {
      var md = new Date(now.getFullYear(), now.getMonth() - mi, 1)
      months.push({label: md.toLocaleString('default', {month:'short'}), val: 0})
    }
    // Use latest snapshot per month
    _vh.forEach(function(snap) {
      var sd = new Date(snap.ts)
      for (var i = 0; i < 6; i++) {
        var ref = new Date(now.getFullYear(), now.getMonth() - (5-i), 1)
        if (sd.getMonth() === ref.getMonth() && sd.getFullYear() === ref.getFullYear()) {
          months[i].val = Math.max(months[i].val, snap.val)
        }
      }
    })
    // Fill empty months with current value
    var currentVal = 0; state.collection.forEach(function(c){ currentVal += parseINR(c.india_collector_inr) })
    months.forEach(function(m) { if (!m.val && currentVal) m.val = currentVal })
    var maxVal = Math.max.apply(null, months.map(function(m){return m.val})) || 1
    sparkEl.innerHTML = ''
    months.forEach(function(m, idx) {
      var h = Math.max(Math.round((m.val / maxVal) * 28), m.val > 0 ? 4 : 2)
      var sc = document.createElement('div'); sc.className = 'val-spark-col'
      var bar = document.createElement('div'); bar.className = 'val-spark-bar' + (idx === 5 ? ' now' : '')
      bar.style.height = h + 'px'
      bar.title = m.label + ': ₹' + Math.round(m.val).toLocaleString('en-IN')
      var lbl = document.createElement('div'); lbl.className = 'val-spark-lbl'; lbl.textContent = m.label
      sc.appendChild(bar); sc.appendChild(lbl)
      sparkEl.appendChild(sc)
    })
  }

  if (!items.length) {
    var emptyMsg = state.filterBy === 'all' ? 'Your garage is empty' : 'No ' + state.filterBy + ' cars'
    var emptySub = state.filterBy === 'all' ? 'Scan your first car to start building your collection!' : 'Try a different filter'
    var ctaBtn = state.filterBy === 'all' ? '<button class="btn-red" onclick="goPage(\'scan\')" style="margin-top:14px;padding:11px 22px;border-radius:12px">📷 Scan Your First Car →</button>' : ''
    document.getElementById('col-list').innerHTML = '<div class="empty"><div class="empty-icon">🚗</div><div class="empty-t">' + emptyMsg + '</div><div class="empty-s">' + emptySub + '</div>' + ctaBtn + '</div>'
    return
  }
  var list = document.getElementById('col-list')
  list.innerHTML = ''
  // #8 — rarity dot color map
  var dotColors = {
    'super treasure hunt': '#e63946',
    'treasure hunt': '#ffd60a',
    'error car': '#ff6b6b',
    'vintage': '#ffd60a',
    'premium': '#4cc9f0',
    'rare': '#4cc9f0',
    'uncommon': '#2dc653',
    'common': '#444'
  }
  var maxVal = Math.max.apply(null, items.map(function(x){return parseINR(x.india_collector_inr)})) || 1
  var spotlightRarities = ['super treasure hunt','treasure hunt','error car','vintage']
  var spotlights = items.filter(function(x){return spotlightRarities.indexOf((x.rarity||'').toLowerCase())!==-1})
  var regular = items.filter(function(x){return spotlightRarities.indexOf((x.rarity||'').toLowerCase())===-1})
  var rarIcons = {'Super Treasure Hunt':'⭐','Treasure Hunt':'🔥','Error Car':'⚡','Vintage':'🏆','Premium':'💎','Rare':'💫','Uncommon':'🔶'}

  function makeCard(c, isSpotlight) {
    var rv = (c.rarity||'common').toLowerCase()
    var bc = dotColors[rv] || '#444'
    var glow = rv.includes('super treasure')?'rgba(255,214,10,.18)':rv.includes('treasure')?'rgba(255,150,0,.14)':rv.includes('error')||rv.includes('vintage')?'rgba(76,201,240,.12)':'transparent'
    var colRarity = c.rarity || 'Common'
    var icon = rarIcons[colRarity] || ''
    var priceVal = parseINR(c.india_collector_inr)
    var pct = Math.round((priceVal/maxVal)*100)
    var thumbHtml = c.image ? '<img src="'+c.image+'" style="width:100%;height:100%;object-fit:cover" alt="">' : (icon||'🚗')
    var div = document.createElement('div')

    if (isSpotlight) {
      div.style.cssText = 'background:var(--surface);border-radius:16px;padding:14px;margin-bottom:10px;border:1px solid '+bc+';box-shadow:0 0 24px '+glow+',0 4px 16px rgba(0,0,0,.4);position:relative;overflow:hidden;grid-column:1/-1'
      div.innerHTML = '<div style="position:absolute;top:0;left:0;width:3px;height:100%;background:'+bc+'"></div>'+
        '<div style="display:flex;align-items:center;gap:12px">'+
          '<div style="width:64px;height:64px;border-radius:12px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;border:1px solid '+bc+'">'+thumbHtml+'</div>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:10px;font-weight:800;color:'+bc+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">'+icon+' '+colRarity+'</div>'+
            '<div style="font-size:15px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(c.name||'Unknown')+'</div>'+
            '<div style="font-size:11px;color:var(--text2);margin-top:2px">'+escHtml(c.series||'')+(c.color?' · '+escHtml(c.color):'')+'</div>'+
            '<div style="font-size:17px;font-weight:800;color:'+bc+';margin-top:6px">₹'+cleanINR(c.india_collector_inr)+'</div>'+
          '</div>'+
          '<div style="display:flex;gap:4px;flex-shrink:0">'+
            '<button data-delid="'+c.id+'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s" onmouseenter="this.style.color=\'var(--red)\'" onmouseleave="this.style.color=\'var(--text3)\'">🗑</button>'+
          '</div>'+
        '</div>'
    } else {
      div.className = 'flip-card'
      div.style.cssText = 'border-radius:14px;transition:transform .15s'
      div.onmouseenter=function(){this.style.transform='translateY(-2px)'}
      div.onmouseleave=function(){this.style.transform=''}
      var valBar = pct>0?'<div style="height:3px;background:var(--surface3);border-radius:2px;margin-top:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+bc+';border-radius:2px"></div></div>':''
      var backFacts = []
      if (c.casting_year) backFacts.push(['Casting Year', c.casting_year])
      if (c.tampo) backFacts.push(['Tampo', c.tampo])
      if (c.wheel_type) backFacts.push(['Wheels', c.wheel_type])
      var backExtra = (c.fun_fact ? '<div style="font-size:11px;color:var(--text2);line-height:1.5;margin-top:8px">💡 '+escHtml(c.fun_fact)+'</div>' : '')
        + (c.investment_reason ? '<div style="font-size:11px;color:'+bc+';line-height:1.5;margin-top:6px">📈 '+escHtml(c.investment_reason)+'</div>' : '')
      div.innerHTML =
        '<div class="flip-card-inner">'+
          '<div class="flip-card-front" style="background:var(--surface);padding:11px;border:1px solid var(--border);border-left:3px solid '+bc+'">'+
            '<div style="display:flex;align-items:flex-start;gap:10px">'+
              '<div style="width:50px;height:50px;border-radius:10px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'+thumbHtml+'</div>'+
              '<div style="flex:1;min-width:0">'+
                '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:16px">'+escHtml(c.name||'Unknown')+'</div>'+
                '<div style="font-size:11px;color:var(--text2);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(c.series||'')+'</div>'+
                '<div style="display:flex;align-items:center;margin-top:4px;gap:6px">'+
                  '<span style="font-size:10px;font-weight:700;color:'+bc+'">'+icon+' '+colRarity+'</span>'+
                  (c.india_collector_inr?'<span style="font-size:12px;font-weight:800;margin-left:auto">₹'+cleanINR(c.india_collector_inr)+'</span>':'')+
                '</div>'+valBar+
              '</div>'+
              '<div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">'+
                '<button data-flipid="'+c.id+'" title="Show details" style="background:var(--surface3);border:1px solid var(--border2);color:var(--text2);cursor:pointer;font-size:11px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">ℹ</button>'+
                '<button data-delid="'+c.id+'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;opacity:0;transition:opacity .2s">🗑</button>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="flip-card-back">'+
            '<button class="flip-card-btn" data-flipid="'+c.id+'" title="Back to card">✕</button>'+
            '<div style="font-size:13px;font-weight:800;padding-right:16px">'+escHtml(c.name||'Unknown')+'</div>'+
            (backFacts.length ? '<div style="margin-top:8px">'+backFacts.map(function(f){return '<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text3)">'+f[0]+'</span><span style="color:var(--text2);font-weight:600">'+escHtml(String(f[1]))+'</span></div>'}).join('')+'</div>' : '<div style="font-size:11px;color:var(--text3);margin-top:8px">No extra details for this car yet</div>')+
            backExtra+
          '</div>'+
        '</div>'
    }
    return div
  }

  spotlights.forEach(function(c){list.appendChild(makeCard(c,true))})
  regular.forEach(function(c){list.appendChild(makeCard(c,false))})
  
  // Add hover effects to regular cards
  document.querySelectorAll('#col-list [data-editid], #col-list [data-delid]').forEach(function(btn) {
    btn.parentElement.parentElement.onmouseenter = function() {
      this.querySelectorAll('[data-editid], [data-delid]').forEach(function(b) { b.style.opacity = '1' })
    }
    btn.parentElement.parentElement.onmouseleave = function() {
      this.querySelectorAll('[data-editid], [data-delid]').forEach(function(b) { b.style.opacity = '0' })
    }
  })
  
  // Handle edit, delete, and flip clicks
  var oh=list._ch;if(oh)list.removeEventListener('click',oh);list._ch=function(e){var eb=e.target.closest('[data-editid]'),db=e.target.closest('[data-delid]'),fb=e.target.closest('[data-flipid]');if(eb){e.stopPropagation();editColItem(eb.dataset.editid)}if(db){e.stopPropagation();delFromCol(db.dataset.delid)}if(fb){e.stopPropagation();var fc=fb.closest('.flip-card');if(fc)fc.classList.toggle('flipped')}};list.addEventListener('click',list._ch)
}

export function exportVal() {
  if (!state.collection.length) { showToast('Add some cars first!', 'error'); return }
  var exportBtn = document.querySelector('[onclick="exportVal()"]')
  if (exportBtn) { exportBtn.disabled = true; exportBtn.textContent = '⏳ Generating PDF…' }

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
    if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = '📄 Export Valuation Certificate' }
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
  if (state._sb && state.currentUser) {
    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; } }catch(e){} })()
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
async function _retryWithBackoff(fn, maxAttempts, initialDelay) {
  maxAttempts = maxAttempts || 3
  initialDelay = initialDelay || 1000
  var lastError
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch(e) {
      lastError = e
      if (attempt < maxAttempts - 1) {
        var delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise(function(r) { setTimeout(r, delay) })
      }
    }
  }
  throw lastError
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
    // Initial fetch — guarded by _timedQuery with increased timeout
    var res = await _timedQuery(
      state._sb.from('collection')
        .select('id,name,series,casting_year,rarity,color,tampo,wheel_type,india_retail_inr,india_collector_inr,us_retail_usd,us_collector_usd,investment,investment_reason,fun_fact,india_insight,image_thumb,added_at')
        .eq('user_id', state.currentUser.id)
        .order('added_at', { ascending: false }),
      6000
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

    // 3. Upload local-only items to cloud
    for (var i = 0; i < localOnly.length; i++) {
      var item = localOnly[i]
      await saveToCloud(item)
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
          .select('id,name,series,casting_year,rarity,color,tampo,wheel_type,india_retail_inr,india_collector_inr,us_retail_usd,us_collector_usd,investment,investment_reason,fun_fact,india_insight,image_thumb,added_at')
          .eq('user_id', state.currentUser.id)
          .order('added_at', { ascending: false }),
        6000
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
export async function syncCollectionFromCloud() {
  return fullCloudSync()
}

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
    if (up.error) return null
    var urlData = state._sb.storage.from('car-images').getPublicUrl(path)
    return urlData.data && urlData.data.publicUrl ? urlData.data.publicUrl : null
  } catch(e) { return null }
}

export async function saveToCloud(item) {
  if (!state.currentUser || !state._sb) return null
  try {
    var thumb = item.image || null
    // Upload to Supabase Storage if image is base64 (not already a URL)
    if (thumb && thumb.startsWith('data:') && thumb.length > 100) {
      var storageUrl = await uploadImageToStorage(thumb, item.id || Date.now())
      if (storageUrl) thumb = storageUrl
      else if (thumb.length > 8000) thumb = null // too large for DB column
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
  if (!state.currentUser || !state._sb) return
  try {
    if (id && typeof id === 'string' && id.includes('-')) {
      var r = await state._sb.from('collection').delete().eq('id', id).eq('user_id', state.currentUser.id)
      if (r.error) captureException(new Error('deleteFromCloud: ' + r.error.message))
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
        if (r2.error) captureException(new Error('deleteFromCloud by name: ' + r2.error.message))
      }
    }
  } catch(e) { captureException(e) }
}

export function searchCol(query) {
  state.searchQuery = (query || '').toLowerCase().trim()
  renderCol()
}


