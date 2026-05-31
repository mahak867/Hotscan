const fs = require('fs');
let lines = fs.readFileSync('src/collection.js', 'utf8').split('\n');

for (var i = 0; i < lines.length; i++) {
  if (lines[i].includes('onclick=') && lines[i].includes('delFromCol') && lines[i].includes('c.id')) {
    console.log('FOUND at line', i+1, ':', lines[i].trim().substring(0, 80));
    // Replace entire line with data-delid version
    lines[i] = "            '<button data-delid=\"'+c.id+'\" style=\"background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;transition:color .2s\" onmouseenter=\"this.style.color=\\'var(--red)\\'\" onmouseleave=\"this.style.color=\\'var(--text3)\\'\">🗑</button>'+";
    console.log('REPLACED with data-delid version');
  }
}

var result = lines.join('\n');
fs.writeFileSync('src/collection.js', result, 'utf8');
console.log('Still has inline onclick:', result.includes("onclick=\"delFromCol"));
console.log('Has data-delid:', result.includes('data-delid'));
