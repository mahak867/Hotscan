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
  if (!items.length) {
    document.getElementById('col-list').innerHTML = '<div class="empty"><div class="empty-icon">🗂</div><div class="empty-t">' + (state.filterBy==='all'?'No cars yet':'No '+state.filterBy+' cars') + '</div><div class="empty-s">' + (state.filterBy==='all'?'Scan a car and tap "Add"':'Try a different filter') + '</div></div>'
    return
  }
  var list = document.getElementById('col-list')
  list.innerHTML = ''
  items.forEach(function(c) {
    var div = document.createElement('div'); div.className = 'col-item'
    var thumb = document.createElement('div'); thumb.className = 'col-thumb'
    if (c.image) { var img = document.createElement('img'); img.src = c.image; img.alt = ''; thumb.appendChild(img) } else thumb.textContent = '🚗'
    var info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0'
    var name = document.createElement('div'); name.className = 'col-name'; name.textContent = c.name||'Unknown'
    var meta = document.createElement('div'); meta.className = 'col-meta'; meta.textContent = c.series||''
    var bottom = document.createElement('div'); bottom.style.cssText = 'display:flex;gap:5px;align-items:center'
    var rar = document.createElement('span'); rar.className = 'rar ' + rcls(c.rarity); rar.style.cssText = 'font-size:10px;padding:2px 7px'; rar.textContent = c.rarity||'Common'
    var price = document.createElement('span'); price.className = 'col-price'; price.textContent = c.india_collector_inr ? '₹'+cleanINR(c.india_collector_inr) : ''
    bottom.appendChild(rar); bottom.appendChild(price)
    info.appendChild(name); info.appendChild(meta); info.appendChild(bottom)
    var del = document.createElement('button'); del.className = 'col-del'; del.style.cssText = 'background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;margin-left:auto;flex-shrink:0'; del.textContent = '🗑'
    del.onclick = (function(id) { return function() { delFromCol(id) } })(c.id)
    div.appendChild(thumb); div.appendChild(info); div.appendChild(del)
    list.appendChild(div)
  })
}

export function exportVal() {
  if (!state.collection.length) { alert('Add some cars first!'); return }
  var val = 0; state.collection.forEach(function(c) { val += parseINR(c.india_collector_inr) })
  var date = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})
  var txt = [
    'HOTSCAN INDIA - COLLECTION VALUATION CERTIFICATE',
    '='.repeat(50),
    'Generated: ' + date,
    'App: HotScan India v5.0 (hotscan.in)',
    'Collector: ' + (state.currentUser ? state.currentUser.email : 'Guest'),
    '',
    'COLLECTION SUMMARY',
    'Total Cars: ' + state.collection.length,
    'Rare+ Cars: ' + state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('rare')||r.includes('treasure')||r.includes('error')||r.includes('vintage')}).length,
    'Treasure Hunts: ' + state.collection.filter(function(c){return (c.rarity||'').toLowerCase().includes('treasure')}).length,
    'Estimated Total Value: Rs.' + val.toLocaleString('en-IN') + ' INR',
    'Average Car Value: Rs.' + (state.collection.length?Math.round(val/state.collection.length).toLocaleString('en-IN'):'0') + ' INR',
    '',
    'CAR LIST',
    state.collection.map(function(c,i){
      return (i+1)+'. '+(c.name||'Unknown')+' | '+(c.rarity||'Common')+' | Rs.'+(cleanINR(c.india_collector_inr)||'N/A')+(c.color?' | '+c.color:'')
    }).join('\n'),
    '',
    '='.repeat(50),
    'DISCLAIMER: Values are AI-estimated based on Indian collector market data.',
    'For insurance or legal purposes, obtain a professional appraisal.',
    '',
    'HotScan India v5.0 - hotscan.in',
    'India first Hot Wheels Scanner'
  ].join('\n')
  var blob = new Blob([txt], {type:'text/plain'})
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a'); a.href = url; a.download = 'HotScan_Valuation_' + new Date().toISOString().split('T')[0] + '.txt'; a.click()
  URL.revokeObjectURL(url)
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
  if (!state.currentUser || !state._sb) return
  try {
    var res = await state._sb.from('collection').select('*').eq('user_id', state.currentUser.id).order('added_at', {ascending:false})
    if (res.data && res.data.length > 0) {
      state.collection = res.data.map(function(d) {
        return {
          id: d.id, name: d.name, series: d.series,
          casting_year: d.casting_year, rarity: d.rarity,
          color: d.color, tampo: d.tampo,
          wheel_type: d.wheel_type,
          condition_grade: d.condition_grade,
          india_retail_inr: d.india_retail_inr,
          india_collector_inr: d.india_collector_inr,
          us_retail_usd: d.us_retail_usd,
          us_collector_usd: d.us_collector_usd,
          investment: d.investment,
          investment_reason: d.investment_reason,
          fun_fact: d.fun_fact,
          india_insight: d.india_insight,
          purchase_price: d.purchase_price,
          purchase_platform: d.purchase_platform,
          notes: d.notes,
          image: d.image_thumb,
          added: d.added_at
        }
      })
      localStorage.setItem('hs_col', JSON.stringify(state.collection))
      renderCol()
      return true
    }
  } catch(e) { console.warn('Cloud sync error:', e) }
  return false
}

export async function syncCollectionFromCloud() {
  if (!state.currentUser || !state._sb) return
  try {
    var res = await state._sb.from('collection').select('*').eq('user_id', state.currentUser.id).order('added_at', {ascending:false})
    if (res.data && res.data.length > 0) {
      state.collection = res.data.map(function(d) { return {id:d.id, name:d.name, series:d.series, rarity:d.rarity, color:d.color, india_collector_inr:d.india_collector_inr, investment:d.investment, image:d.image_thumb, added:d.added_at} })
      localStorage.setItem('hs_col', JSON.stringify(state.collection))
      renderCol()
    }
  } catch(e) { console.warn('Sync error:', e) }
}

export async function saveToCloud(item) {
  if (!state.currentUser || !state._sb) return null
  try {
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
      image_thumb: item.image ? item.image.substring(0, 4000) : null,
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
