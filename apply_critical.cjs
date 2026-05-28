// Run from ~/hotscan: node apply_critical.cjs
var fs = require('fs'), path = require('path')

// ── SCANNER: Anti-hallucination + verified years ──────────────────────
var sc = fs.readFileSync('src/scanner.js', 'utf8')
var sysStart = sc.indexOf("  var sys = [\n    'You are the world most precise")
var sysEnd = sc.indexOf(".join('\\n')\n\n  var usr", sysStart) + ".join('\\n')".length
if (sysStart > -1 && sysEnd > sysStart) {
  sc = sc.slice(0, sysStart) + `  var sys = [
    'You are a Hot Wheels die-cast identifier. CRITICAL RULE: NEVER hallucinate dates, years, or facts.',
    '',
    '⛔ ANTI-HALLUCINATION — NON-NEGOTIABLE:',
    '- NEVER guess casting years. Use ONLY the verified list below, else return Unknown',
    '- NEVER state a car is one of the original 16 Hot Wheels unless confirmed (1968 originals: Custom Camaro, Custom Mustang, Custom Firebird, Custom Corvette, Custom VW Bug, Deora, Beatnik Bandit, Hot Heap, Python, Silhouette, Ford J-Car, Fleetside, Normandie, Chaparral 2G, Custom Cougar, Custom T-Bird)',
    '- Fun facts: ONLY state what you are 100% certain of. If uncertain: \\"A popular Hot Wheels casting.\\"',
    '- NEVER invent production numbers, series details, or market history',
    '',
    '📅 VERIFIED CASTING YEARS — use EXACTLY these:',
    'Volkswagen Beach Bomb / VW Beach Bomb = 1969',
    'Hot Wheels Deora / Deora = 1968',
    'Custom Camaro / 69 Camaro = 1968',
    'Twin Mill = 1969',
    'Beatnik Bandit = 1968',
    'Silhouette = 1968',
    'Bone Shaker = 2006',
    'Dodge Viper = 1994',
    '69 Dodge Charger Daytona = 1969',
    'Nissan Skyline GT-R (R34) = 2002',
    'Toyota Supra (A80) = 1995',
    'Rodger Dodger = 1974',
    'Boss Hoss = 1971',
    'Sand Crab = 1970',
    'For ALL other castings → casting_year: \\"Unknown\\"',
    '',
    '⚠️ CHECK FIRST: Is this a genuine Mattel Hot Wheels die-cast?',
    'If NOT → return: {\\"identified\\":false,\\"is_hot_wheels\\":false,\\"reason\\":\\"what you actually see\\"}',
    '',
    'IDENTIFICATION (only if confirmed Hot Wheels):',
    '1. NAME: Exact casting name. VW Van/Bus → Volkswagen Beach Bomb. 69 Camaro → 69 Camaro.',
    '2. SERIES: Exact series if readable on card/base, else Unknown',
    '3. COLOR: Exact finish — Spectraflame/Matte/Pearl/Flat/Chrome + color',
    '4. TAMPO: Every visible graphic. None visible if none.',
    '5. WHEELS: Black plastic 5-spoke / Real Riders rubber / PR5 / MC5 / OH5 / 10-Spoke',
    '6. BASE: Malaysia|China|Thailand|Unknown',
    '',
    'RARITY — only assign elevated rarity with VISIBLE proof:',
    '- Super Treasure Hunt: MUST see Spectraflame paint + Real Riders rubber + TH logo',
    '- Treasure Hunt: MUST see metalflake paint + flame TH logo on card',
    '- Vintage Redlines: MUST see red stripe on tires',
    '- Default to Common. Do not guess elevated rarity.',
    '',
    'CONFIDENCE: 90-100% all details clear / 70-89% model clear but details uncertain / 50-69% blurry / Below 50% return identified:false'
  ].join('\\n')` + sc.slice(sysEnd)
  console.log('✅ Scanner: Anti-hallucination prompt applied')
} else {
  console.log('⚠️  Scanner sys prompt not found - already updated or different version')
}

// Fix casting_year instruction
sc = sc.replace(
  '"casting_year":"first year this casting was produced",',
  '"casting_year":"VERIFIED year from list above ONLY, or Unknown — never guess",'
)
sc = sc.replace(
  '"fun_fact":"one specific interesting fact about this exact casting",',
  '"fun_fact":"one VERIFIED fact, certain knowledge only — never invent history",'
)
fs.writeFileSync('src/scanner.js', sc)

// ── COLLECTION: Full fix ──────────────────────────────────────────────
var col = fs.readFileSync('src/collection.js', 'utf8')

// Fix delFromCol
col = col.replace(
  "export function delFromCol(id) {\n  // Find the item first to get its cloud UUID (if it has one)\n  var item = state.collection.find(function(c) { return c.id === id })\n  // Only delete from cloud if it has a real UUID (not a local numeric id)\n  if (item && state._sb && state.currentUser) {",
  "export function delFromCol(id) {\n  id = String(id)\n  var item = state.collection.find(function(c) { return String(c.id) === id })\n  if (!item) { showToast('Car not found', 'error'); return }\n  if (state._sb && state.currentUser) {"
)
col = col.replace(
  "  state.collection = state.collection.filter(function(c) { return c.id !== id })",
  "  state.collection = state.collection.filter(function(c) { return String(c.id) !== id })"
)
// Add toast after filter
col = col.replace(
  "  state.collection = state.collection.filter(function(c) { return String(c.id) !== id })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  renderCol()\n}",
  "  state.collection = state.collection.filter(function(c) { return String(c.id) !== id })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  showToast('🗑 Car removed', 'success')\n  renderCol()\n}"
)

// Fix editColItem ID cast
col = col.replace(
  "export function editColItem(id) {\n  var item = state.collection.find(function(c) { return c.id === id })",
  "export function editColItem(id) {\n  id = String(id)\n  var item = state.collection.find(function(c) { return String(c.id) === id })"
)
// Fix modal display
col = col.replace("modal.classList.add('open')", "if (modal) { modal.style.display = 'flex'")
col = col.replace("if (modal) modal.classList.remove('open')", "if (modal) modal.style.display = 'none'")

// Fix spotlight card buttons syntax
col = col.replace(
  "'<button data-editid=\"'+c.id+'\"' style=",
  "'<button data-editid=\"'+c.id+'\" style="
)
col = col.replace(
  "'<button data-delid=\"'+c.id+'\"' style=",
  "'<button data-delid=\"'+c.id+'\" style="
)

// Fix modal to use addEventListener - find and rebuild
var modalIdx = col.indexOf('function createEditModal() {')
if (modalIdx > -1) {
  var depth = 0, i = modalIdx
  while (i < col.length) {
    if (col[i] === '{') depth++
    else if (col[i] === '}' && --depth === 0) { var modalEnd = i + 1; break }
    i++
  }
  var oldModal = col.slice(modalIdx, modalEnd)
  if (oldModal.includes('onclick="saveColEdit()"') || oldModal.includes("onclick=\"closeColEdit()\"")) {
    var newModal = `function createEditModal() {
  if (document.getElementById('col-edit-modal')) return
  var el = document.createElement('div')
  el.id = 'col-edit-modal'
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;align-items:center;justify-content:center;padding:16px;box-sizing:border-box'
  var R = ['Common','Uncommon','Rare','Premium','Treasure Hunt','Super Treasure Hunt','Error Car','Vintage'].map(function(o){return '<option>'+o+'</option>'}).join('')
  var C = ['Mint on Card','Near Mint','Very Good','Good','Fair'].map(function(o){return '<option>'+o+'</option>'}).join('')
  var S = 'width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.15);border-radius:8px;background:rgba(255,255,255,.07);color:#fff;box-sizing:border-box;font-size:14px;margin-bottom:12px'
  var L = 'display:block;font-size:11px;color:rgba(255,255,255,.5);margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em'
  el.innerHTML = '<div style="background:#131320;border-radius:18px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;padding:22px;box-sizing:border-box;border:1px solid rgba(255,255,255,.1)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">' +
      '<div style="font-size:17px;font-weight:800">✏️ Edit Car</div>' +
      '<button id="cem-x" style="background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;font-size:18px;width:32px;height:32px;border-radius:8px">✕</button>' +
    '</div>' +
    '<label style="'+L+'">Car Name</label>' +
    '<input id="col-edit-name" type="text" placeholder="e.g. Bone Shaker" style="'+S+'">' +
    '<label style="'+L+'">Rarity</label>' +
    '<select id="col-edit-rarity" style="'+S+'">'+R+'</select>' +
    '<label style="'+L+'">Condition</label>' +
    '<select id="col-edit-condition" style="'+S+'">'+C+'</select>' +
    '<label style="'+L+'">Collector Price (₹)</label>' +
    '<input id="col-edit-price" type="number" placeholder="e.g. 350" style="'+S+'">' +
    '<label style="'+L+'">Notes</label>' +
    '<textarea id="col-edit-notes" placeholder="Any notes..." style="'+S+';height:70px;resize:none;font-family:inherit;margin-bottom:16px"></textarea>' +
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
}`
    col = col.replace(oldModal, newModal)
    console.log('✅ Collection: createEditModal rebuilt')
  } else {
    console.log('✅ Collection: createEditModal already uses addEventListener')
  }
}

fs.writeFileSync('src/collection.js', col)
console.log('✅ Collection: all fixes applied')

// ── MAIN.JS: Window exports ───────────────────────────────────────────
var main = fs.readFileSync('src/main.js', 'utf8')
if (!main.includes('window.delFromCol')) {
  main = main.replace('window.editColItem = editColItem', 'window.delFromCol = delFromCol\nwindow.editColItem = editColItem')
  console.log('✅ main.js: window.delFromCol added')
}
if (!main.includes('shareCollection, updateStreak')) {
  main = main.replace('copyRefLink, shareViaWA,\n  renderProfilePage,', 'copyRefLink, shareViaWA,\n  shareCollection, updateStreak,\n  renderProfilePage,')
  console.log('✅ main.js: shareCollection + updateStreak added')
}
fs.writeFileSync('src/main.js', main)

// ── STYLE.CSS: PC Layout ──────────────────────────────────────────────
var css = fs.readFileSync('src/style.css', 'utf8')
css = css.replace(
  'body{ display:grid; grid-template-columns:220px 1fr; grid-template-rows:auto 1fr; min-height:100vh; }',
  'body{ display:grid; grid-template-columns:220px 1fr; min-height:100vh; }'
)
css = css.replace(
  '.hs-content{ grid-column:2; overflow-y:auto; height:calc(100vh - 60px); }',
  '.hs-content{ grid-column:2; overflow-y:auto; height:100vh; min-height:0; }'
)
css = css.replace(
  '.hs-sidebar{ grid-column:1; position:sticky; top:60px; height:calc(100vh - 60px);',
  '.hs-sidebar{ grid-column:1; position:sticky; top:0; height:100vh;'
)
fs.writeFileSync('src/style.css', css)
console.log('✅ style.css: PC layout fixed')

console.log('\n🎉 All critical fixes applied!')
console.log('Run: git add -A && git commit -m "Critical fixes: scanner, collection, PC layout" && git push origin main')
