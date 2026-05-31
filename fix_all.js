const fs = require('fs');

// ── Fix 1: collection.js spotlight delete button ──────────────────────────
let col = fs.readFileSync('src/collection.js', 'utf8');

// Find the exact spotlight delete button line and replace with data-delid
const oldBtn = `'<button onclick="delFromCol(\\'+c.id+\\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s" onmouseenter="this.style.color=\\'var(--red)\\'" onmouseleave="this.style.color=\\'var(--text3)\\'">\uD83D\uDDD1\uFE0F</button>'+`;
const newBtn = `'<button data-delid="\\'+c.id+\'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s" onmouseenter="this.style.color=\\'var(--red)\\'" onmouseleave="this.style.color=\\'var(--text3)\\'">\uD83D\uDDD1\uFE0F</button>'+`;

if (col.includes(oldBtn)) {
  col = col.replace(oldBtn, newBtn);
  console.log('Spotlight delete button: FIXED');
} else {
  // Try finding by partial match
  const idx = col.indexOf('onclick="delFromCol(\\\'');
  if (idx > -1) {
    const lineStart = col.lastIndexOf('\n', idx) + 1;
    const lineEnd = col.indexOf('\n', idx);
    const oldLine = col.substring(lineStart, lineEnd);
    const newLine = oldLine.replace(/onclick="delFromCol\(\\''\+c\.id\+\\''\)"/, 'data-delid="\'+c.id+\'"');
    col = col.substring(0, lineStart) + newLine + col.substring(lineEnd);
    console.log('Fixed via partial match');
  } else {
    console.log('ERROR: Could not find spotlight delete button');
    // Show what we have
    const allDel = col.split('\n').filter(l => l.includes('delFromCol') && l.includes('button'));
    allDel.forEach(l => console.log('  Found:', l.trim().substring(0, 100)));
  }
}

// Also fix the edit button on spotlight card to use data-editid
col = col.replace(
  /onclick="editColItem\(\\''\+c\.id\+\\''\)"/g,
  'data-editid="\'+c.id+\'"'
);

fs.writeFileSync('src/collection.js', col, 'utf8');
console.log('Still has inline delFromCol onclick:', col.split('\n').some(l => l.includes('onclick') && l.includes('delFromCol') && l.includes('button')));
console.log('Has data-delid on spotlight:', col.includes('data-delid="\'+c.id'));

