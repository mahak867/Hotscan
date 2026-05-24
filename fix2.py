with open('src/collection.js', encoding='utf-8') as f:
    c = f.read()

# Fix both broken delete buttons by using data attributes instead of inline onclick
BAD1 = """'<button onclick="delFromCol('"+c.id+"')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;flex-shrink:0">\U0001f5d1</button>'+"""
GOOD1 = """'<button data-delid="'+c.id+'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;flex-shrink:0">\U0001f5d1</button>'+"""

BAD2 = """'<button onclick="delFromCol('"+c.id+"')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;flex-shrink:0;opacity:0;transition:opacity .2s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">\U0001f5d1</button>'+"""
GOOD2 = """'<button data-delid="'+c.id+'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;flex-shrink:0;opacity:0;transition:opacity .2s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">\U0001f5d1</button>'+"""

print('bad1:', 'FOUND' if BAD1 in c else 'NOT FOUND')
print('bad2:', 'FOUND' if BAD2 in c else 'NOT FOUND')
c = c.replace(BAD1, GOOD1).replace(BAD2, GOOD2)

# Add event delegation for data-delid after list is built
OLD_END = "  regular.forEach(function(c){list.appendChild(makeCard(c,false))})"
NEW_END = """  regular.forEach(function(c){list.appendChild(makeCard(c,false))})
  list.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-delid]')
    if (btn) delFromCol(btn.dataset.delid)
  }, {once: true})"""

c = c.replace(OLD_END, NEW_END)
with open('src/collection.js', 'w', encoding='utf-8') as f:
    f.write(c)
print('done')
