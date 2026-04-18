// HotScan India Chrome Extension — Popup Logic

var HAIKU_MODEL = 'llama-3.1-8b-instant'
var apiKey = ''
var lastResult = null

// ── Boot ──
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['hs_key'], function(data) {
    if (data.hs_key) {
      apiKey = data.hs_key
      showSearch()
    } else {
      showKeySetup()
    }
  })

  // Allow Enter key in search input
  var inp = document.getElementById('search-inp')
  if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch() })

  // Allow Enter key in API key input
  var keyInp = document.getElementById('key-inp')
  if (keyInp) keyInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') saveKey() })
})

function showKeySetup() {
  document.getElementById('key-section').style.display = 'block'
  document.getElementById('search-section').style.display = 'none'
  document.getElementById('key-change-btn').style.display = 'none'
}

function showSearch() {
  document.getElementById('key-section').style.display = 'none'
  document.getElementById('search-section').style.display = 'block'
  document.getElementById('key-change-btn').style.display = 'inline'
  document.getElementById('search-inp').focus()
}

function showKeyChange() {
  var keyInp = document.getElementById('key-inp')
  keyInp.value = apiKey
  showKeySetup()
}

function saveKey() {
  var val = document.getElementById('key-inp').value.trim()
  if (!val || !val.startsWith('gsk_')) {
    showStatus('Enter a valid Groq key (starts with gsk_)', true)
    return
  }
  apiKey = val
  chrome.storage.local.set({ hs_key: val })
  chrome.action.setBadgeText({ text: '' })
  showSearch()
}

// ── Status ──
function showStatus(msg, isError) {
  var el = document.getElementById('status')
  el.textContent = msg
  el.className = 'status' + (isError ? ' error' : '')
  el.style.display = 'block'
}
function hideStatus() {
  document.getElementById('status').style.display = 'none'
}

// ── Search ──
async function doSearch() {
  var query = document.getElementById('search-inp').value.trim()
  if (!query) return
  if (!apiKey) { showKeySetup(); return }

  var btn = document.getElementById('search-btn')
  btn.disabled = true
  btn.textContent = '⏳'
  document.getElementById('result-card').style.display = 'none'
  showStatus('Searching Hot Wheels database…')

  try {
    var prompt = 'Hot Wheels database search: "' + query + '". Find the best matching car — if it looks like a barcode/number find the car that barcode belongs to, else treat it as a name search. Prioritize the most valuable/collectible version. Return ONLY valid JSON with no markdown:\n' +
      '{"identified":true,"confidence":90,"name":"exact full name","series":"series and year","casting_year":"year","color":"color","rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt|Vintage|Premium","rarity_reason":"why collectors want this","investment":"Low|Medium|High|Very High","investment_reason":"specific investment case","fun_fact":"notable fact","us_retail_usd":"1.49","us_collector_usd":"5-50","india_retail_inr":"150-500","india_collector_inr":"300-5000","india_insight":"Indian collector demand note"}'

    var res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 600
      })
    })

    if (res.status === 401) throw new Error('Invalid API key — update it below')
    if (res.status === 429) throw new Error('Rate limit — wait a moment and try again')
    if (!res.ok) throw new Error('API error ' + res.status)

    var data = await res.json()
    var content = data.choices && data.choices[0] && data.choices[0].message.content
    if (!content) throw new Error('Empty response — try again')

    var d = parseJSON(content)
    if (!d || !d.identified) throw new Error('Car not found — try a different name')

    lastResult = d
    hideStatus()
    renderResult(d)
  } catch(e) {
    showStatus(e.message || 'Search failed — try again', true)
  } finally {
    btn.disabled = false
    btn.textContent = '🔍'
  }
}

function parseJSON(str) {
  try {
    var m = str.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch(e) { return null }
}

// ── Render result ──
function renderResult(d) {
  document.getElementById('r-name').textContent = d.name || '—'
  document.getElementById('r-meta').textContent = [d.series, d.casting_year, d.color].filter(Boolean).join(' · ')

  // Rarity badge
  var rarity = d.rarity || 'Common'
  var badgeCls = rarity.toLowerCase().includes('super') ? 'badge-sth'
    : rarity.toLowerCase().includes('treasure') ? 'badge-th'
    : (rarity === 'Rare' || rarity === 'Vintage' || rarity === 'Premium') ? 'badge-rare'
    : 'badge-common'
  document.getElementById('r-badges').innerHTML =
    '<span class="badge ' + badgeCls + '">' + rarity + '</span>'

  // Prices
  document.getElementById('r-prices').innerHTML =
    '<div class="price-box"><div class="price-label">🇮🇳 India Collector</div><div class="price-val">₹' + (d.india_collector_inr || '?') + '</div></div>' +
    '<div class="price-box"><div class="price-label">🇺🇸 US Collector</div><div class="price-val">$' + (d.us_collector_usd || '?') + '</div></div>'

  // Investment
  var inv = (d.investment || 'Medium').toLowerCase()
  var dotCls = (inv === 'high' || inv === 'very high') ? 'high' : inv === 'medium' ? 'medium' : 'low'
  document.getElementById('r-invest').innerHTML =
    '<div class="invest-dot ' + dotCls + '"></div>' +
    '<div><div class="invest-text">' + (d.investment || '—') + ' Investment Potential</div>' +
    '<div class="invest-reason">' + (d.investment_reason || '') + '</div></div>'

  // Insight
  var insightEl = document.getElementById('r-insight')
  if (d.india_insight) {
    insightEl.textContent = '🇮🇳 ' + d.india_insight
    insightEl.style.display = 'block'
  } else {
    insightEl.style.display = 'none'
  }

  // WhatsApp share button
  document.getElementById('r-wa-btn').style.display = 'block'

  document.getElementById('result-card').style.display = 'flex'
}

// ── WhatsApp share ──
function shareOnWA() {
  if (!lastResult) return
  var lines = [
    '🚗 *' + lastResult.name + '*',
    '⭐ ' + lastResult.rarity,
    '🇮🇳 India: ₹' + (lastResult.india_collector_inr || '?'),
    '🇺🇸 US: $' + (lastResult.us_collector_usd || '?'),
    '📈 ' + (lastResult.investment || '') + ' Investment',
    '',
    '_Looked up with HotScan India 🔍 — hotscan.in_'
  ]
  chrome.tabs.create({ url: 'https://wa.me/?text=' + encodeURIComponent(lines.join('\n')) })
}

// ── Open full app to sell ──
function openSell() {
  chrome.tabs.create({ url: 'https://hotscan.in' })
}
