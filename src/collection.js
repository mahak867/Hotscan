import { state } from './state.js'
import { cleanINR, parseINR, escHtml, showToast, rcls } from './utils.js'

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
  if (state._sb && state.currentUser) saveToCloud(item).then(function(cloudId) {
    if (cloudId) { item.id = cloudId; localStorage.setItem('hs_col', JSON.stringify(state.collection)) }
  })
  renderCol(); window.goPage('collection')
}

export function delFromCol(id) {
  if (state._sb && state.currentUser) deleteFromCloud(id)
  state.collection = state.collection.filter(function(c) { return c.id !== id })
  localStorage.setItem('hs_col', JSON.stringify(state.collection))
  renderCol()
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
  items.forEach(function(c) {
    var div = document.createElement('div'); div.className = 'col-item'
    // #8 — rarity dot
    var dot = document.createElement('div'); dot.className = 'col-dot'
    var rv = (c.rarity||'common').toLowerCase()
    dot.style.background = dotColors[rv] || '#444'
    var thumb = document.createElement('div'); thumb.className = 'col-thumb'
    if (c.image) { var img = document.createElement('img'); img.src = c.image; img.alt = ''; thumb.appendChild(img) } else thumb.textContent = '🚗'
    var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0'
    var name = document.createElement('div'); name.className = 'col-name'; name.textContent = c.name||'Unknown'
    var meta = document.createElement('div'); meta.className = 'col-meta'; meta.textContent = c.series||''
    var bottom = document.createElement('div'); bottom.style.cssText = 'display:flex;gap:5px;align-items:center'
    var rar = document.createElement('span'); rar.className = 'rar ' + rcls(c.rarity); rar.style.cssText = 'font-size:11px;padding:3px 8px'
    var rarIcons = {'Super Treasure Hunt':'⭐','Treasure Hunt':'🔥','Error Car':'⚡','Vintage':'🏆','Premium':'💎','Rare':'💫','Uncommon':'🔶'}
    var colRarity = c.rarity || 'Common'
    rar.textContent = (rarIcons[colRarity] ? rarIcons[colRarity] + ' ' : '') + colRarity
    var price = document.createElement('span'); price.className = 'col-price'; price.textContent = c.india_collector_inr ? '₹'+cleanINR(c.india_collector_inr) : ''
    bottom.appendChild(rar); bottom.appendChild(price)
    info.appendChild(name); info.appendChild(meta); info.appendChild(bottom)
    var del = document.createElement('button'); del.className = 'col-del'; del.style.cssText = 'background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;margin-left:auto;flex-shrink:0'; del.textContent = '🗑'
    del.onclick = (function(id) { return function() { delFromCol(id) } })(c.id)
    div.appendChild(dot); div.appendChild(thumb); div.appendChild(info); div.appendChild(del)
    list.appendChild(div)
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
  if (state._sb && state.currentUser) saveToCloud(item).then(function(cloudId) {
    if (cloudId) { item.id = cloudId; localStorage.setItem('hs_col', JSON.stringify(state.collection)) }
  })
  renderCol()
  return item
}

export async function fullCloudSync() {
  if (!state.currentUser || !state._sb) return false
  try {
    // 1. Fetch cloud items
    var res = await state._sb.from('collection')
      .select('*')
      .eq('user_id', state.currentUser.id)
      .order('added_at', { ascending: false })

    var cloudItems = []
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

    // Re-fetch after uploading local items
    if (localOnly.length > 0) {
      var res2 = await state._sb.from('collection')
        .select('*')
        .eq('user_id', state.currentUser.id)
        .order('added_at', { ascending: false })
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

    if (cloudItems.length > 0) {
      state.collection = cloudItems
      localStorage.setItem('hs_col', JSON.stringify(state.collection))
      renderCol()
      return true
    }
  } catch(e) {
    console.warn('Cloud sync error:', e)
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
    // Store up to 8KB of the thumbnail — enough for a compressed 64px JPEG
    // If image is larger (unlikely after compress()), skip it to avoid DB errors
    var thumb = item.image || null
    if (thumb && thumb.length > 8000) thumb = null
    var res = await state._sb.from('collection').insert({
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
    }).select('id').single()
    if (res.data && res.data.id) return res.data.id
  } catch(e) { console.warn('Cloud save error:', e) }
  return null
}

export async function deleteFromCloud(id) {
  if (!state.currentUser || !state._sb) return
  try { await state._sb.from('collection').delete().eq('id', id).eq('user_id', state.currentUser.id) } catch(e) {}
}
