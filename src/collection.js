import { state } from './state.js'
import { cleanINR, parseINR, escHtml, showToast, rcls, captureException } from './utils.js'

// Prevents concurrent fullCloudSync() calls racing against Supabase.
// Both onAuthStateChange(INITIAL_SESSION) and getSession() fire on page load,
// which caused two simultaneous queries — the second would hit DB_TIMEOUT.
var _syncInFlight = false
var _syncRetryCount = 0
var _syncMaxRetries = 3

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
  state.collection.unshift(item)
  localStorage.setItem('hs_col', JSON.stringify(state.collection))
  if (state._sb && state.currentUser) {
    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; localStorage.setItem('hs_col', JSON.stringify(state.collection)) } }catch(e){} })()
  }
  renderCol(); window.goPage('collection')
}

export function delFromCol(id) {
  // Find the item first to get its cloud UUID (if it has one)
  var item = state.collection.find(function(c) { return c.id === id })
  // Only delete from cloud if it has a real UUID (not a local numeric id)
  if (item && state._sb && state.currentUser) {
    var cloudId = (typeof item.id === 'string' && item.id.includes('-')) ? item.id : null
    if (cloudId) deleteFromCloud(cloudId)
  }
  state.collection = state.collection.filter(function(c) { return c.id !== id })
  localStorage.setItem('hs_col', JSON.stringify(state.collection))
  renderCol()
}

export function editColItem(id) {
  var item = state.collection.find(function(c) { return c.id === id })
  if (!item) { showToast('Car not found', 'error'); return }
  window._editingItem = item
  window._editingItemId = id
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
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
}

export function saveColEdit() {
  if (!window._editingItem) return
  var item = window._editingItem
  item.name = document.getElementById('col-edit-name').value || item.name
  item.rarity = document.getElementById('col-edit-rarity').value || item.rarity
  item.condition = document.getElementById('col-edit-condition').value || item.condition
  item.india_collector_inr = '₹' + document.getElementById('col-edit-price').value
  item.notes = document.getElementById('col-edit-notes').value || ''
  localStorage.setItem('hs_col', JSON.stringify(state.collection))
  if (state._sb && state.currentUser && typeof item.id === 'string' && item.id.includes('-')) {
    saveToCloud(item)
  }
  closeColEdit()
  renderCol()
  showToast('Car updated!', 'success')
}

export function closeColEdit() {
  var modal = document.getElementById('col-edit-modal')
  if (modal) modal.classList.remove('open')
  document.body.style.overflow = ''
  window._editingItem = null
  window._editingItemId = null
}

function createEditModal() {
  var html = '<div id="col-edit-modal" class="modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:2000;align-items:center;justify-content:center;padding:20px">' +
    '<div class="card" style="max-width:500px;width:100%;max-height:90vh;overflow-y:auto">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
    '<div style="font-size:18px;font-weight:800">Edit Car</div>' +
    '<button onclick="closeColEdit()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:24px">✕</button>' +
    '</div>' +
    '<div style="margin-bottom:15px"><label style="display:block;font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:700">Car Name</label><input id="col-edit-name" type="text" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:#fff;box-sizing:border-box"></div>' +
    '<div style="margin-bottom:15px"><label style="display:block;font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:700">Rarity</label><select id="col-edit-rarity" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:#fff;box-sizing:border-box"><option>Common</option><option>Uncommon</option><option>Rare</option><option>Premium</option><option>Treasure Hunt</option><option>Super Treasure Hunt</option><option>Error Car</option><option>Vintage</option></select></div>' +
    '<div style="margin-bottom:15px"><label style="display:block;font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:700">Condition</label><select id="col-edit-condition" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:#fff;box-sizing:border-box"><option>Mint on Card</option><option>Near Mint</option><option>Very Good</option><option>Good</option><option>Fair</option></select></div>' +
    '<div style="margin-bottom:15px"><label style="display:block;font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:700">Price (₹)</label><input id="col-edit-price" type="number" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:#fff;box-sizing:border-box"></div>' +
    '<div style="margin-bottom:15px"><label style="display:block;font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:700">Notes</label><textarea id="col-edit-notes" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:#fff;box-sizing:border-box;height:80px;resize:none;font-family:inherit"></textarea></div>' +
    '<div style="display:flex;gap:8px"><button class="btn-red" onclick="saveColEdit()" style="flex:1;padding:12px;border-radius:8px;font-weight:700">Save Changes</button><button onclick="closeColEdit()" style="flex:1;padding:12px;border-radius:8px;background:var(--surface3);border:1px solid var(--border);color:#fff;cursor:pointer;font-weight:700">Cancel</button></div>' +
    '</div></div>'
  var div = document.createElement('div')
  div.innerHTML = html
  document.body.appendChild(div.firstChild)
  var style = document.createElement('style')
  style.textContent = '.modal { display: none !important; } .modal.open { display: flex !important; }'
  document.head.appendChild(style)
}

export function sCol(by, el) { state.sortBy = by; document.querySelectorAll('#sc .chip').forEach(function(b){b.classList.remove('active')}); el.classList.add('active'); renderCol() }
export function fCol(f, el) { state.filterBy = f; document.querySelectorAll('#fc2 .chip').forEach(function(b){b.classList.remove('active')}); el.classList.add('active'); renderCol() }

export function renderCol() {
  var items = state.collection.slice()
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

  // #7 — micro sparkline: last 6 months of car additions
  var sparkEl = document.getElementById('val-sparkline')
  if (sparkEl) {
    var now = new Date()
    var months = []
    for (var mi = 5; mi >= 0; mi--) {
      var d = new Date(now.getFullYear(), now.getMonth() - mi, 1)
      months.push({label: d.toLocaleString('default', {month:'short'}), count: 0})
    }
    state.collection.forEach(function(c) {
      if (!c.added) return
      var added = new Date(c.added)
      for (var i = 0; i < 6; i++) {
        var ref = new Date(now.getFullYear(), now.getMonth() - (5-i), 1)
        if (added.getMonth() === ref.getMonth() && added.getFullYear() === ref.getFullYear()) {
          months[i].count++; break
        }
      }
    })
    var maxCount = Math.max.apply(null, months.map(function(m){return m.count})) || 1
    sparkEl.innerHTML = ''
    months.forEach(function(m, idx) {
      var h = Math.max(Math.round((m.count / maxCount) * 28), m.count > 0 ? 4 : 2)
      var col = document.createElement('div'); col.className = 'val-spark-col'
      var bar = document.createElement('div'); bar.className = 'val-spark-bar' + (idx === 5 ? ' now' : '')
      bar.style.height = h + 'px'
      var lbl = document.createElement('div'); lbl.className = 'val-spark-lbl'; lbl.textContent = m.label
      col.appendChild(bar); col.appendChild(lbl)
      sparkEl.appendChild(col)
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
            '<button onclick="editColItem(\'+c.id+\')" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:16px;transition:color .2s" onmouseenter="this.style.color=\'var(--gold)\'" onmouseleave="this.style.color=\'var(--text2)\'">✏️</button>'+
            '<button onclick="delFromCol(\'+c.id+\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s" onmouseenter="this.style.color=\'var(--red)\'" onmouseleave="this.style.color=\'var(--text3)\'">🗑</button>'+
          '</div>'+
        '</div>'
    } else {
      div.style.cssText = 'background:var(--surface);border-radius:14px;padding:11px;border:1px solid var(--border);border-left:3px solid '+bc+';transition:transform .15s,box-shadow .15s'
      div.onmouseenter=function(){this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.5)'}
      div.onmouseleave=function(){this.style.transform='';this.style.boxShadow=''}
      var valBar = pct>0?'<div style="height:3px;background:var(--surface3);border-radius:2px;margin-top:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+bc+';border-radius:2px"></div></div>':''
      div.innerHTML='<div style="display:flex;align-items:flex-start;gap:10px">'+
        '<div style="width:50px;height:50px;border-radius:10px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'+thumbHtml+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(c.name||'Unknown')+'</div>'+
          '<div style="font-size:11px;color:var(--text2);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(c.series||'')+'</div>'+
          '<div style="display:flex;align-items:center;margin-top:4px;gap:6px">'+
            '<span style="font-size:10px;font-weight:700;color:'+bc+'">'+icon+' '+colRarity+'</span>'+
            (c.india_collector_inr?'<span style="font-size:12px;font-weight:800;margin-left:auto">₹'+cleanINR(c.india_collector_inr)+'</span>':'')+
          '</div>'+valBar+
        '</div>'+
        '<div style="display:flex;gap:4px;flex-shrink:0">'+
          '<button data-editid="'+c.id+'" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:13px;opacity:0;transition:opacity .2s">✏️</button>'+
          '<button data-delid="'+c.id+'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;opacity:0;transition:opacity .2s">🗑</button>'+
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
  
  // Handle edit and delete clicks
  list.addEventListener('click', function(e) {
    var editBtn = e.target.closest('[data-editid]')
    var delBtn = e.target.closest('[data-delid]')
    if (editBtn) editColItem(editBtn.dataset.editid)
    if (delBtn) delFromCol(delBtn.dataset.delid)
  })
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
  localStorage.setItem('hs_col', JSON.stringify(state.collection))
  if (state._sb && state.currentUser) {
    ;(async function(){ try{ var cloudId = await saveToCloud(item); if(cloudId){ item.id=cloudId; localStorage.setItem('hs_col', JSON.stringify(state.collection)) } }catch(e){} })()
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
  ms = ms || 12000  // Increased from 8000 to 12000ms default
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
        .select('*')
        .eq('user_id', state.currentUser.id)
        .order('added_at', { ascending: false }),
      12000  // Increased from 8000ms to 12000ms
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
    var cloudNames = cloudItems.map(function(c) { return (c.name || '').toLowerCase() })
    var localOnly = state.collection.filter(function(c) {
      // Cloud IDs are UUIDs (strings with dashes), local IDs are numbers
      var isLocalId = typeof c.id === 'number' || String(c.id).indexOf('-') === -1
      return isLocalId && !cloudNames.includes((c.name || '').toLowerCase())
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
          .select('*')
          .eq('user_id', state.currentUser.id)
          .order('added_at', { ascending: false }),
        12000  // Increased from 8000ms to 12000ms
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

    if (cloudItems.length > 0 || localOnly.length > 0) {
      if (cloudItems.length > 0) {
        state.collection = cloudItems
        localStorage.setItem('hs_col', JSON.stringify(state.collection))
        renderCol()
      }
      return true
    }
  } catch(e) {
    captureException(e)
  }
  return false
}

// Alias — kept for compatibility, routes to fullCloudSync
export async function syncCollectionFromCloud() {
  return fullCloudSync()
}

export async function saveToCloud(item) {
  if (!state.currentUser || !state._sb) return null
  try {
    var thumb = item.image || null
    if (thumb && thumb.length > 8000) thumb = null
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
      // New item — check if name already exists first, then insert
      var existing = await state._sb.from('collection')
        .select('id').eq('user_id', state.currentUser.id)
        .ilike('name', item.name).limit(1)
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

export async function deleteFromCloud(id) {
  if (!state.currentUser || !state._sb) return
  try { await state._sb.from('collection').delete().eq('id', id).eq('user_id', state.currentUser.id) } catch(e) {}
}

export function searchCol(query) {
  state.searchQuery = (query || '').toLowerCase().trim()
  renderCol()
}


