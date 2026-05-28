var fs = require('fs')
var path = require('path')

function fix(file, find, replace, label) {
  var c = fs.readFileSync(file, 'utf8')
  var idx = c.indexOf(find)
  if (idx === -1) { console.log('SKIP (already done):', label); return }
  fs.writeFileSync(file, c.replace(find, replace))
  console.log('FIXED:', label)
}

// ── 1. index.html: Remove OLX Check panel ──────────────────────────────
var html = fs.readFileSync('index.html', 'utf8')

// Remove OLX tab
html = html.replace(/\s*<div class="mp-tab" id="mp-tab-olx"[^>]*>.*?<\/div>/g, '')

// Remove OLX Check panel block
var olxStart = html.indexOf('<!-- OLX CHECK -->')
var olxEnd   = html.indexOf('</div>\n</div>\n\n\n<!-- ═══ MARKET', olxStart)
if (olxStart > -1 && olxEnd > -1) {
  html = html.slice(0, olxStart) + html.slice(olxEnd + 6)
  console.log('FIXED: OLX Check panel removed')
} else {
  console.log('SKIP: OLX Check panel already removed')
}

// Remove "Search More on OLX" button
html = html.replace(/\s*<div style="text-align:center;margin-top:8px">\s*<button[^>]*olx\.in\/items[^>]*>.*?<\/button>\s*<\/div>/gs, '')

// Remove OLX settings link
html = html.replace(/\s*<div class="more-item"[^>]*onclick="ol\('https:\/\/www\.olx\.in\/items[^']*'\)"[^>]*>.*?<\/div>/gs, '')

fs.writeFileSync('index.html', html)
console.log('FIXED: index.html OLX cleanup done')

// ── 2. marketplace.js: Fix mpMode crash ───────────────────────────────
var mp = fs.readFileSync('src/marketplace.js', 'utf8')
mp = mp.replace("['buy','sell','olx']", "['buy','sell']")
mp = mp.replace(
  "document.getElementById('mp-tab-'+t).classList.toggle('active', t===tab)",
  "var te=document.getElementById('mp-tab-'+t);if(te)te.classList.toggle('active',t===tab)"
)
mp = mp.replace(
  "document.getElementById('mp-'+t).style.display = t===tab ? 'block' : 'none'",
  "var pe=document.getElementById('mp-'+t);if(pe)pe.style.display=t===tab?'block':'none'"
)
fs.writeFileSync('src/marketplace.js', mp)
console.log('FIXED: mpMode OLX crash')

// ── 3. main.js: Add missing window exports ────────────────────────────
var main = fs.readFileSync('src/main.js', 'utf8')

// Add delFromCol to window if missing
if (main.indexOf('window.delFromCol') === -1) {
  main = main.replace(
    'window.editColItem = editColItem',
    'window.delFromCol = delFromCol\nwindow.editColItem = editColItem'
  )
  console.log('FIXED: window.delFromCol added')
}

// Remove checkOLX from Object.assign if present
if (main.indexOf('checkOLX,') > -1) {
  main = main.replace('checkOLX, ', '').replace(', checkOLX', '').replace('checkOLX,\n', '')
  console.log('FIXED: checkOLX removed from window')
}

// Add shareCollection and updateStreak if missing from Object.assign
if (main.indexOf('shareCollection') === -1 || main.indexOf('updateStreak') === -1) {
  main = main.replace(
    'copyRefLink, shareViaWA,',
    'copyRefLink, shareViaWA,\n  shareCollection, updateStreak,'
  )
  console.log('FIXED: shareCollection + updateStreak added to window')
}
fs.writeFileSync('src/main.js', main)

// ── 4. collection.js: Fix edit modal (no onclick strings) ─────────────
var col = fs.readFileSync('src/collection.js', 'utf8')

// Fix spotlight card buttons - replace broken onclick with data attrs
col = col.replace(
  /<button onclick="editColItem\(\\''\+c\.id\+\\''\)"[^>]*>✏️<\/button>/g,
  '<button data-editid=\'"+c.id+"\' style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:16px;padding:4px">✏️</button>'
)
col = col.replace(
  /<button onclick="delFromCol\(\\''\+c\.id\+\\''\)"[^>]*>🗑<\/button>/g,
  '<button data-delid=\'"+c.id+"\' style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:4px">🗑</button>'
)

// Fix closeColEdit - use style.display not classList
col = col.replace(
  "if (modal) modal.classList.remove('open')",
  "if (modal) modal.style.display = 'none'"
)
col = col.replace(
  "modal.classList.add('open')",
  "modal.style.display = 'flex'"
)

// Fix stacking event listener
var oldListener = "list.addEventListener('click', function(e) {\n    var editBtn = e.target.closest('[data-editid]')\n    var delBtn = e.target.closest('[data-delid]')\n    if (editBtn) editColItem(editBtn.dataset.editid)\n    if (delBtn) delFromCol(delBtn.dataset.delid)\n  })"
var newListener = "  var oh = list._ch\n  if (oh) list.removeEventListener('click', oh)\n  list._ch = function(e) {\n    var eb = e.target.closest('[data-editid]')\n    var db = e.target.closest('[data-delid]')\n    if (eb) { e.stopPropagation(); editColItem(eb.dataset.editid) }\n    if (db) { e.stopPropagation(); delFromCol(db.dataset.delid) }\n  }\n  list.addEventListener('click', list._ch)"

if (col.indexOf(oldListener) > -1) {
  col = col.replace(oldListener, newListener)
  console.log('FIXED: stacking event listener')
}

// Add delFromCol toast if missing
col = col.replace(
  "state.collection = state.collection.filter(function(c) { return c.id !== id })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  renderCol()",
  "state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  showToast('🗑 Car removed', 'success')\n  renderCol()"
)

fs.writeFileSync('src/collection.js', col)
console.log('FIXED: collection.js')

console.log('\n✅ ALL FIXES APPLIED - run: git add -A && git commit -m "Complete bug fixes" && git push origin main')
