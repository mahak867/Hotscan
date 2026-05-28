// Run this from your ~/hotscan directory: node apply_fixes.cjs
var fs = require('fs')

function patch(file, find, replace, label) {
  var c = fs.readFileSync(file, 'utf8')
  if (c.indexOf(find) === -1) { console.log('SKIP (already done):', label); return false }
  fs.writeFileSync(file, c.replace(find, replace))
  console.log('✅ FIXED:', label)
  return true
}

// ── main.js: Add shareCollection + updateStreak to window ────────────────
patch('src/main.js',
  "  copyRefLink, shareViaWA,\n  renderProfilePage,",
  "  copyRefLink, shareViaWA,\n  shareCollection, updateStreak,\n  renderProfilePage,",
  'shareCollection + updateStreak on window'
)
patch('src/main.js',
  "window.editColItem = editColItem",
  "window.delFromCol = delFromCol\nwindow.editColItem = editColItem",
  'delFromCol on window'
)

// ── collection.js: Fix search ────────────────────────────────────────────
patch('src/collection.js',
  "export function renderCol() {\n  var items = state.collection.slice()\n  if (state.filterBy !== 'all')",
  "export function renderCol() {\n  var items = state.collection.slice()\n  if (state.searchQuery && state.searchQuery.trim()) {\n    var q = state.searchQuery.toLowerCase()\n    items = items.filter(function(c) {\n      return (c.name||'').toLowerCase().includes(q) ||\n             (c.series||'').toLowerCase().includes(q) ||\n             (c.rarity||'').toLowerCase().includes(q) ||\n             (c.color||'').toLowerCase().includes(q)\n    })\n  }\n  if (state.filterBy !== 'all')",
  'Collection search filter'
)

// ── collection.js: Fix delFromCol - add String() cast + toast ────────────
patch('src/collection.js',
  "  var item = state.collection.find(function(c) { return c.id === id })\n  // Only delete from cloud if it has a real UUID (not a local numeric id)\n  if (item && state._sb && state.currentUser) {",
  "  id = String(id)\n  var item = state.collection.find(function(c) { return String(c.id) === id })\n  if (!item) return\n  if (item && state._sb && state.currentUser) {",
  'delFromCol String() cast'
)
patch('src/collection.js',
  "  state.collection = state.collection.filter(function(c) { return c.id !== id })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  renderCol()\n}",
  "  state.collection = state.collection.filter(function(c) { return String(c.id) !== id })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  showToast('🗑 Car removed', 'success')\n  renderCol()\n}",
  'delFromCol filter + toast'
)

// ── collection.js: Fix editColItem - add String() cast ───────────────────
patch('src/collection.js',
  "export function editColItem(id) {\n  var item = state.collection.find(function(c) { return c.id === id })",
  "export function editColItem(id) {\n  id = String(id)\n  var item = state.collection.find(function(c) { return String(c.id) === id })",
  'editColItem String() cast'
)

// ── collection.js: Fix modal display (classList → style.display) ─────────
patch('src/collection.js',
  "modal.classList.add('open')\n  document.body.style.overflow = 'hidden'",
  "modal.style.display = 'flex'\n  document.body.style.overflow = 'hidden'",
  'Modal open: classList → style.display'
)
patch('src/collection.js',
  "if (modal) modal.classList.remove('open')",
  "if (modal) modal.style.display = 'none'",
  'Modal close: classList → style.display'
)

// ── collection.js: Fix spotlight card onclick buttons → data attrs ────────
patch('src/collection.js',
  "'<button onclick=\"editColItem(\\'+c.id+\\')'",
  "'<button data-editid=\"'+c.id+'\"'",
  'Spotlight edit button: onclick → data-editid'
)
patch('src/collection.js',
  "'<button onclick=\"delFromCol(\\'+c.id+\\')'",
  "'<button data-delid=\"'+c.id+'\"'",
  'Spotlight delete button: onclick → data-delid'
)

// ── collection.js: Fix modal buttons - use addEventListener not onclick ───
var col = fs.readFileSync('src/collection.js', 'utf8')
var modalHasOnclick = col.indexOf("onclick=\"saveColEdit()\"") > -1 || col.indexOf('onclick="closeColEdit()"') > -1
if (modalHasOnclick) {
  // Rebuild createEditModal to use addEventListener
  var oldModal = col.slice(col.indexOf('function createEditModal()'), col.indexOf('\nexport function sCol'))
  var newModal = `function createEditModal() {
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
`
  col = col.replace(oldModal, newModal)
  fs.writeFileSync('src/collection.js', col)
  console.log('✅ FIXED: Edit modal rebuilt with addEventListener')
} else {
  console.log('SKIP (already done): Edit modal')
}

// ── collection.js: Fix event listener stacking ───────────────────────────
patch('src/collection.js',
  "  list.addEventListener('click', function(e) {\n    var editBtn = e.target.closest('[data-editid]')\n    var delBtn = e.target.closest('[data-delid]')\n    if (editBtn) editColItem(editBtn.dataset.editid)\n    if (delBtn) delFromCol(delBtn.dataset.delid)\n  })",
  "  var oh = list._ch\n  if (oh) list.removeEventListener('click', oh)\n  list._ch = function(e) {\n    var eb = e.target.closest('[data-editid]')\n    var db = e.target.closest('[data-delid]')\n    if (eb) { e.stopPropagation(); editColItem(eb.dataset.editid) }\n    if (db) { e.stopPropagation(); delFromCol(db.dataset.delid) }\n  }\n  list.addEventListener('click', list._ch)",
  'Deduplicate click listener'
)

// ── index.html: Remove massive Share section ─────────────────────────────
var html = fs.readFileSync('index.html', 'utf8')
var shareStart = html.indexOf('\n  <!-- Share app -->')
var shareEnd = html.indexOf('\n</div>\n\n<!-- ═══ PROFILE PAGE', shareStart)
if (shareStart > -1 && shareEnd > -1) {
  html = html.slice(0, shareStart) + '\n</div>\n\n<!-- ═══ PROFILE PAGE' + html.slice(shareEnd + '\n</div>\n\n<!-- ═══ PROFILE PAGE'.length)
  fs.writeFileSync('index.html', html)
  console.log('✅ FIXED: Removed massive Share section')
} else {
  console.log('SKIP (already removed): Share section')
}

console.log('\n🎉 All fixes applied!')
console.log('Run: git add -A && git commit -m "Complete fix" && git push origin main')
