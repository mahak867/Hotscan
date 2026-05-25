with open('src/scanner.js', encoding='utf-8') as f:
    c = f.read()

# Fix 1: Authenticity score visual bar
OLD1 = """    var scoreNote = d.authenticity_score ? 'Authenticity score: ' + d.authenticity_score + '/100' : ''
    var qualNote = d.image_quality ? ' · Image quality: ' + d.image_quality : ''
    document.getElementById('dv-sub').textContent = scoreNote + qualNote"""
NEW1 = """    var score = d.authenticity_score || 0
    var qualNote = d.image_quality ? 'Image quality: ' + d.image_quality : ''
    var scoreColor = score >= 80 ? '#2dc653' : score >= 55 ? '#FF9500' : '#E63946'
    document.getElementById('dv-sub').innerHTML =
      (score ? '<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:4px"><span>Authenticity Score</span><span style="color:'+scoreColor+';font-weight:700">'+score+'/100</span></div><div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+score+'%;background:'+scoreColor+';border-radius:3px;transition:width .6s"></div></div></div>' : '') +
      (qualNote ? '<span style="font-size:12px;color:#888">'+qualNote+'</span>' : '')"""
print('auth score:', 'FOUND' if OLD1 in c else 'NOT FOUND')
c = c.replace(OLD1, NEW1)

# Fix 2: OLX links after deal verdict
OLD2 = """    if (d.suggestion) document.getElementById('deal-tip').textContent = '💡 ' + d.suggestion
    document.getElementById('deal-result').style.display = 'block'"""
NEW2 = """    if (d.suggestion) document.getElementById('deal-tip').textContent = '💡 ' + d.suggestion
    var dealLinks = document.getElementById('deal-quick-links')
    if (dealLinks) {
      var olxQ = encodeURIComponent('hot wheels ' + carName)
      dealLinks.innerHTML = '<a href="https://www.olx.in/items/q-'+olxQ+'" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 8px;color:#fff;text-decoration:none;font-size:12px;font-weight:600">💸 OLX India</a>' +
        '<a href="https://www.instagram.com/explore/tags/hotwheelsindiasale" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 8px;color:#fff;text-decoration:none;font-size:12px;font-weight:600">📸 Instagram</a>' +
        '<a href="https://www.maido.in/search?q='+encodeURIComponent(carName)+'" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 8px;color:#fff;text-decoration:none;font-size:12px;font-weight:600">🏪 Maido</a>'
      dealLinks.style.display = 'flex'
    }
    document.getElementById('deal-result').style.display = 'block'"""
print('olx links:', 'FOUND' if OLD2 in c else 'NOT FOUND')
c = c.replace(OLD2, NEW2)

with open('src/scanner.js', 'w', encoding='utf-8') as f:
    f.write(c)
print('done')
