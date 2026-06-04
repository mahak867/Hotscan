const fs = require('fs');

// FIX 1: collection.js sync block — never wipe on empty result
let col = fs.readFileSync('src/collection.js', 'utf8');

col = col.replace(
  "    if (cloudItems.length > 0 || localOnly.length > 0) {\n      if (cloudItems.length > 0) {\n        state.collection = cloudItems\n        localStorage.setItem('hs_col', JSON.stringify(state.collection))\n        renderCol()\n      }\n      return true\n    }",
  "    if (cloudItems.length > 0) {\n      state.collection = cloudItems\n      var _nh = cloudItems.map(function(x){return String(x.id)}).join(',')\n      var _oh = localStorage.getItem('hs_col_hash') || ''\n      localStorage.setItem('hs_col', JSON.stringify(cloudItems))\n      localStorage.setItem('hs_col_hash', _nh)\n      if (_nh !== _oh) renderCol()\n      return true\n    } else if (localOnly.length > 0) {\n      return true\n    }\n    return false"
);
console.log('Fix 1 never wipe:', col.includes('hs_col_hash') ? 'OK' : 'FAILED');

// FIX 2: deleteFromCloud name fallback
const oldDel = "export async function deleteFromCloud(id) {\n  if (!state.currentUser || !state._sb) return\n  try { await state._sb.from('collection').delete().eq('id', id).eq('user_id', state.currentUser.id) } catch(e) {}\n}";
const newDel = "export async function deleteFromCloud(id, name) {\n  if (!state.currentUser || !state._sb) return\n  try {\n    if (id && typeof id === 'string' && id.includes('-')) {\n      await state._sb.from('collection').delete().eq('id', id).eq('user_id', state.currentUser.id)\n    } else if (name) {\n      await state._sb.from('collection').delete().eq('user_id', state.currentUser.id).ilike('name', name)\n    }\n  } catch(e) { captureException(e) }\n}";
if (col.includes(oldDel)) { col = col.replace(oldDel, newDel); console.log('Fix 2 delete fallback: OK'); }
else { console.log('Fix 2: already patched or not found'); }

// FIX 3: pass name to deleteFromCloud
col = col.replace(
  "    var cloudId = (typeof item.id === 'string' && item.id.includes('-')) ? item.id : null\n    if (cloudId) deleteFromCloud(cloudId)",
  "    var cloudId = (typeof item.id === 'string' && item.id.includes('-')) ? item.id : null\n    deleteFromCloud(cloudId, item.name)"
);
console.log('Fix 3 pass name:', col.includes('deleteFromCloud(cloudId, item.name)') ? 'OK' : 'FAILED');

// FIX 4: clear hash on delete
col = col.replace(
  "  state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  showToast",
  "  state.collection = state.collection.filter(function(c) { return String(c.id) !== String(id) })\n  localStorage.setItem('hs_col', JSON.stringify(state.collection))\n  localStorage.removeItem('hs_col_hash')\n  showToast"
);
console.log('Fix 4 clear hash:', col.includes("removeItem('hs_col_hash')") ? 'OK' : 'FAILED');

fs.writeFileSync('src/collection.js', col, 'utf8');

// FIX 5: rarity guide in index.html
let h = fs.readFileSync('index.html', 'utf8');
const rgStart = h.indexOf('<div class="rg-row"><div class="rg-badge rc"');
const rgEnd = h.lastIndexOf('</div>', h.lastIndexOf('Factory mistake')) + 6;
if (rgStart > -1 && rgEnd > rgStart) {
  const newGuide =
    '<div class="rg-row"><div class="rg-badge rc" style="background:#1e1e1e;color:#666">Common</div><div class="rg-info">RS150-200 retail RS200-350 collector - Plastic wheels</div></div>' +
    '<div class="rg-row"><div class="rg-badge ru" style="background:#0a1a0a;color:#2dc653">Uncommon</div><div class="rg-info">RS200-350 retail RS350-600 collector</div></div>' +
    '<div class="rg-row"><div class="rg-badge rr" style="background:#0a0a1a;color:#4cc9f0">Rare</div><div class="rg-info">RS300-500 retail RS600-1500 collector - Limited run</div></div>' +
    '<div class="rg-row"><div class="rg-badge" style="background:#0a0a1a;color:#4cc9f0;border:1px solid #4cc9f0">Premium</div><div class="rg-info">RS800-1500 retail RS1500-3500 collector - Real Riders Car Culture</div></div>' +
    '<div class="rg-row"><div class="rg-badge rt" style="background:#1a1000;color:#ffd60a">Treasure Hunt</div><div class="rg-info">RS500-800 retail RS1200-3500 collector - TH flame logo</div></div>' +
    '<div class="rg-row"><div class="rg-badge rs">Super TH</div><div class="rg-info">RS700-1000 retail RS4000-15000 collector - Real Riders Spectraflame</div></div>' +
    '<div class="rg-row"><div class="rg-badge" style="background:#1a0a1a;color:#c084fc;border:1px solid #c084fc">Vintage</div><div class="rg-info">RS500-2000 retail RS1000-8000 collector - Pre-1977 Redline</div></div>' +
    '<div class="rg-row"><div class="rg-badge re" style="background:#1a0808;color:#ff6b6b">Error Car</div><div class="rg-info">RS1000-3000 retail RS5000-30000 collector - Factory mistake</div></div>';
  h = h.substring(0, rgStart) + newGuide + h.substring(rgEnd);
  console.log('Fix 5 rarity guide: OK');
} else {
  console.log('Fix 5 rarity guide: NOT FOUND start=' + rgStart + ' end=' + rgEnd);
}
fs.writeFileSync('index.html', h, 'utf8');

// FIX 6: username save timeout
let ui = fs.readFileSync('src/ui.js', 'utf8');
if (!ui.includes('Save timed out')) {
  ui = ui.replace(
    "    var res = await state._sb.from('profiles').upsert({\n      id: state.currentUser.id,\n      email: state.currentUser.email,\n      username: username,\n      display_name: username\n    }, { onConflict: 'id' })",
    "    var res = await Promise.race([\n      state._sb.from('profiles').upsert({\n        id: state.currentUser.id,\n        email: state.currentUser.email,\n        username: username,\n        display_name: username\n      }, { onConflict: 'id' }),\n      new Promise(function(_, rej) { setTimeout(function(){ rej(new Error('Save timed out')) }, 10000) })\n    ])"
  );
  console.log('Fix 6 username timeout:', ui.includes('Save timed out') ? 'OK' : 'FAILED');
} else {
  console.log('Fix 6 username timeout: already present');
}
fs.writeFileSync('src/ui.js', ui, 'utf8');

console.log('\nDone. Run: npm run build');
