// Spotter's guide: the interactive fake-spotting checklist.
// The items are the checks Indian sellers and collector guides agree on. None
// of them proves a car genuine by itself, which is why the result is worded as
// "N of M checked" and never as a verdict.

var KEY = 'hs_fake_checklist'

var ITEMS = [
  { id: 'base',    t: 'Base text is cast in, sharp and complete',
    s: 'Hot Wheels logo, MATTEL, the casting name, a copyright year and a country (Malaysia, Thailand, Indonesia, China). Blank, shallow or misspelled bases are the commonest tell.' },
  { id: 'spell',   t: 'No spelling mistakes anywhere',
    s: '"Hot Wheel", "Hot Wheal", "Matel". Check the base, the card front and the card back.' },
  { id: 'card',    t: 'Card is stiff with crisp printing',
    s: 'Genuine cards carry a Mattel copyright line, the age mark, an assortment and collector number. Thin board and soft, blurry art point to a reprint.' },
  { id: 'blister', t: 'Blister is factory sealed',
    s: 'Look along the edge for glue residue, lifted corners or a cloudy re-glued seam. A resealed card usually hides a swapped car.' },
  { id: 'rivets',  t: 'Base rivets are untouched',
    s: 'Drill marks or glue on the two posts under the car mean it has been opened: a wheel swap, a repaint, or a custom sold as a Super.' },
  { id: 'wheels',  t: 'Wheels match the release and roll straight',
    s: 'Compare with a photo of the same year\'s release. Premium and Super Treasure Hunt cars have rubber Real Riders, mainlines have plastic.' },
  { id: 'paint',   t: 'Tampo is aligned and paint is even',
    s: 'Smudged decals, paint runs and colour that looks slightly off from the real release suggest a repaint.' },
  { id: 'price',   t: 'Price makes sense',
    s: 'A Premium far under retail, or a Super Treasure Hunt at mainline money, is almost never a lucky find. Scan it or run a Deal check first.' },
]

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) { return {} }
}

export function renderFakeChecklist() {
  var wrap = document.getElementById('fake-checklist')
  if (!wrap) return
  var done = load()
  wrap.innerHTML = ''
  ITEMS.forEach(function (it) {
    var label = document.createElement('label')
    label.className = 'check-item' + (done[it.id] ? ' done' : '')
    var cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = !!done[it.id]
    cb.addEventListener('change', function () {
      var d = load()
      if (cb.checked) d[it.id] = 1; else delete d[it.id]
      try { localStorage.setItem(KEY, JSON.stringify(d)) } catch (e) {}
      renderFakeChecklist()
    })
    var body = document.createElement('div')
    var t = document.createElement('div'); t.className = 'check-t'; t.textContent = it.t
    var s = document.createElement('div'); s.className = 'check-s'; s.textContent = it.s
    body.appendChild(t); body.appendChild(s)
    label.appendChild(cb); label.appendChild(body)
    wrap.appendChild(label)
  })
  var n = ITEMS.filter(function (it) { return done[it.id] }).length
  var score = document.getElementById('fake-check-score')
  if (score) {
    score.textContent = n === 0 ? 'Nothing checked yet'
      : n === ITEMS.length ? 'All ' + n + ' checks passed. Still buy from a seller you can reach afterwards.'
      : n + ' of ' + ITEMS.length + ' checked'
  }
}

export function resetFakeChecklist() {
  try { localStorage.removeItem(KEY) } catch (e) {}
  renderFakeChecklist()
}
