const fs = require('fs');
let c = fs.readFileSync('src/collection.js', 'utf8');
let lines = c.split('\n');

for (var i = 0; i < lines.length; i++) {
  if (lines[i].includes('onclick=') && lines[i].includes('delFromCol') && lines[i].includes('c.id')) {
    console.log('Found at line', i+1);
    console.log('Before:', lines[i]);
    // Remove the onclick and onmouseenter/leave, keep only data-delid
    lines[i] = "            '<button data-delid=\"'+c.id+'\" style=\"background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s\" onmouseenter=\"this.style.color=\\'var(--red)\\'\" onmouseleave=\"this.style.color=\\'var(--text3)\\'\">🗑</button>'+";
    console.log('After:', lines[i]);
  }
}

fs.writeFileSync('src/collection.js', lines.join('\n'), 'utf8');
console.log('Done. inline onclick remains:', c.includes('onclick=') && c.split('\n').some(l => l.includes('onclick=') && l.includes('delFromCol')));
