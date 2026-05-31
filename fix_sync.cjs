const fs = require('fs');

// Fix 1: auth.js - clear collection on signout + sync toast
let auth = fs.readFileSync('src/auth.js', 'utf8');

auth = auth.replace(
  "localStorage.removeItem('hs_profile_cache')",
  "localStorage.removeItem('hs_profile_cache')\n  localStorage.removeItem('hs_col')\n  state.collection = []\n  if(window.renderCol) window.renderCol()"
);

auth = auth.replace(
  "try{ await window.fullCloudSync(); window.renderCol() }catch(e){} })()\n          if(window.syncScanCountFromServer) setTimeout(window.syncScanCountFromServer, 1000)",
  "try{ var _sok = await window.fullCloudSync(); window.renderCol(); if(_sok && event==='SIGNED_IN') window.showToast('Collection synced \u2705', 'success') }catch(e){} })()\n          if(window.syncScanCountFromServer) setTimeout(window.syncScanCountFromServer, 1000)"
);

fs.writeFileSync('src/auth.js', auth, 'utf8');
console.log('signout clears collection:', auth.includes("localStorage.removeItem('hs_col')") ? 'OK' : 'FAILED');
console.log('sync toast:', auth.includes('Collection synced') ? 'OK' : 'FAILED');

// Fix 2: collection.js - increase timeout to 12s
let col = fs.readFileSync('src/collection.js', 'utf8');
col = col.replace('ms = ms || 6000', 'ms = ms || 12000');
col = col.replace(', 6000\n    )', ', 12000\n    )');
fs.writeFileSync('src/collection.js', col, 'utf8');
console.log('timeout 12s:', col.includes('12000') ? 'OK' : 'FAILED');

// Fix 3: spotlight delete button - inline onclick to data-delid
let lines = col.split('\n');
for (var i = 0; i < lines.length; i++) {
  if (lines[i].includes('onclick=') && lines[i].includes('delFromCol') && lines[i].includes('button')) {
    console.log('Found spotlight delete at line', i+1);
    lines[i] = "            '<button data-delid=\"'+c.id+'\" style=\"background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s\" onmouseenter=\"this.style.color=\\'var(--red)\\'\" onmouseleave=\"this.style.color=\\'var(--text3)\\'\">🗑</button>'+";
    console.log('Replaced with data-delid');
  }
}
fs.writeFileSync('src/collection.js', lines.join('\n'), 'utf8');
console.log('inline onclick gone:', !lines.some(l => l.includes('onclick') && l.includes('delFromCol') && l.includes('button')) ? 'OK' : 'FAILED');

