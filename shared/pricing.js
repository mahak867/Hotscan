// HotScan pricing rules — the single source of truth, imported by the browser
// bundle (src/) and by the price endpoint (api/prices.js).
//
// Everything here is a pure function with no I/O, so it is unit-tested directly
// (tests/pricing.spec.js). Change a number here and both sides move together;
// the client and server used to keep separate, disagreeing copies.
//
// Calibration (checked Nov 2026 against Indian retailer listings):
//   • Basic mainline MRP is ₹169 (₹179 before the 22 Sep 2025 revision).
//   • A Treasure Hunt and a Super Treasure Hunt ship in mainline cases, so their
//     SHELF price is the mainline MRP. Only the resale price differs.
//   • Regular Treasure Hunts resell around ₹1,000.
//   • Super Treasure Hunts resell from about ₹3,500 for an unloved casting to
//     ₹19,000+ for a Ferrari or Porsche.
// Revisit MAINLINE_MRP whenever Mattel India revises it.

export var MAINLINE_MRP = '169-179'

// Rarities that are sold from the mainline peg at mainline MRP.
var MAINLINE_FAMILY = ['Common', 'Uncommon', 'Rare', 'Treasure Hunt', 'Super Treasure Hunt']

// retail = what a shop charges, collector = Indian resale for a mint carded car.
// `max` is the highest collector price accepted from any live source before it
// is treated as a mismatch (a lot, a different car, a typo) and clamped.
export var BANDS = {
  'Common':              { r: MAINLINE_MRP, c: '180-350',    max: 1500,   ur: '1.25', uc: '1-4'    },
  'Uncommon':            { r: MAINLINE_MRP, c: '250-500',    max: 2000,   ur: '1.25', uc: '2-6'    },
  'Rare':                { r: MAINLINE_MRP, c: '400-1000',   max: 4000,   ur: '1.25', uc: '4-12'   },
  'Premium':             { r: '599-999',    c: '900-2500',   max: 8000,   ur: '6.99', uc: '8-25'   },
  'Treasure Hunt':       { r: MAINLINE_MRP, c: '600-1500',   max: 5000,   ur: '1.25', uc: '5-15'   },
  'Super Treasure Hunt': { r: MAINLINE_MRP, c: '3500-9000',  max: 40000,  ur: '1.25', uc: '25-90'  },
  'Vintage':             { r: '',           c: '1500-8000',  max: 200000, ur: '',     uc: '15-80'  },
  'Error Car':           { r: MAINLINE_MRP, c: '800-5000',   max: 60000,  ur: '1.25', uc: '10-80'  },
}

// Licensed castings Indian collectors chase. A match moves a car to the upper
// part of its band; it never changes the car's rarity or line.
var HIGH_DEMAND = [
  'skyline', 'gt-r', 'gtr', 'supra', 'rx-7', 'rx7', 'nsx', 'civic', 'ae86', 'silvia', 'lancer evo', 'impreza', '2jz',
  'porsche', 'ferrari', 'lamborghini', 'mclaren', 'bugatti', 'pagani', 'koenigsegg', 'aston martin', 'bmw m', 'mercedes',
  'camaro', 'mustang', 'charger', 'challenger', 'corvette', 'ford gt', 'gt40', 'viper',
  'formula 1', ' f1', 'batmobile', 'fast & furious', 'fast and furious',
]

export function isHighDemand(name) {
  var n = ' ' + String(name || '').toLowerCase()
  return HIGH_DEMAND.some(function (k) { return n.indexOf(k) > -1 })
}

// "₹1,200 - 1,800" → [1200, 1800]; "450" → [450, 450]; junk → null.
export function parseRange(v) {
  if (v == null) return null
  var nums = String(v).replace(/[₹,\s]/g, '').match(/\d+(\.\d+)?/g)
  if (!nums || !nums.length) return null
  var vals = nums.slice(0, 2).map(Number).filter(function (n) { return isFinite(n) && n > 0 })
  if (!vals.length) return null
  return [Math.min.apply(null, vals), Math.max.apply(null, vals)]
}

// Prices are quoted in round figures. ₹212-287 is false precision; ₹210-290 is
// how a seller would say it.
export function roundPrice(n) {
  var step = n < 1000 ? 10 : n < 5000 ? 50 : n < 20000 ? 100 : 500
  return Math.max(step, Math.round(n / step) * step)
}

export function formatRange(lo, hi) {
  lo = roundPrice(lo); hi = roundPrice(Math.max(hi, lo))
  return lo === hi ? String(lo) : lo + '-' + hi
}

export function bandFor(rarity) { return BANDS[rarity] || BANDS['Common'] }

// The typical resale range for a rarity, nudged by demand: sought-after licensed
// castings sit in the upper half of the band, everything else in the lower two
// thirds. Used when there is no live or community price.
export function typicalCollector(rarity, name) {
  var b = parseRange(bandFor(rarity).c)
  var span = b[1] - b[0]
  return isHighDemand(name)
    ? formatRange(b[0] + span * 0.35, b[1] + span * 0.25)
    : formatRange(b[0], b[0] + span * 0.65)
}

export function retailFor(rarity) { return bandFor(rarity).r }

// Is this car from a premium line? Decided ONLY by evidence on the car or card.
// The scanner used to mark anything named Porsche, Ferrari, Lamborghini, McLaren
// and a dozen other brands as Premium and price it at ₹1,500-3,500 — but those
// are among the most common ₹169 mainline castings on Indian pegs.
var PREMIUM_SERIES = ['car culture', 'boulevard', 'team transport', 'pop culture', 'retro entertainment', 'replica entertainment',
  'premium', 'real riders', 'red line club', 'rlc', 'elite 64', 'silver series', 'fast & furious premium', 'hw 1:43']
export function hasPremiumEvidence(car) {
  if (!car) return false
  var wheels = String(car.wheel_type || '').toLowerCase()
  var series = String(car.series || '').toLowerCase()
  var rubber = /real ?riders|rubber/.test(wheels) && !/not rubber|no rubber|plastic/.test(wheels)
  return rubber || PREMIUM_SERIES.some(function (s) { return series.indexOf(s) > -1 })
}

// Final rarity for pricing. Chase and vintage tiers are left alone (they carry
// their own evidence rules upstream); otherwise Premium requires evidence, and a
// "Premium" claim without any is priced as the mainline car it probably is.
export function settleRarity(car) {
  var r = (car && car.rarity) || 'Common'
  if (r === 'Treasure Hunt' || r === 'Super Treasure Hunt' || r === 'Vintage' || r === 'Error Car') return r
  if (hasPremiumEvidence(car)) return 'Premium'
  if (r === 'Premium') return isHighDemand(car && car.name) ? 'Uncommon' : 'Common'
  return BANDS[r] ? r : 'Common'
}

// Robust summary of reported prices. One "lot of 20 cars ₹4,000" listing or a
// fat-fingered extra zero used to drag the average; anything more than 3× away
// from the median is dropped, and the quoted range is the middle half of what
// remains rather than a tidy ±15% around a single number.
export function summarizeReports(prices) {
  var p = (prices || []).map(Number).filter(function (n) { return isFinite(n) && n >= 50 && n <= 500000 }).sort(function (a, b) { return a - b })
  if (!p.length) return null
  var q = function (arr, f) { return arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * f)))] }
  var med = q(p, 0.5)
  var kept = p.filter(function (n) { return n >= med / 3 && n <= med * 3 })
  return { count: kept.length, dropped: p.length - kept.length, median: q(kept, 0.5), low: q(kept, 0.25), high: q(kept, 0.75), min: kept[0], max: kept[kept.length - 1] }
}

// Can a community summary be trusted for THIS scan? Reports are stored by car
// name only, so a mainline Bone Shaker's ₹250 reports would otherwise be applied
// to a Super Treasure Hunt Bone Shaker (and the reverse). The median has to land
// inside what is plausible for the scanned rarity.
export function reportsFitRarity(summary, rarity) {
  if (!summary || summary.count < 3) return false
  var b = bandFor(rarity), c = parseRange(b.c)
  return summary.median >= c[0] * 0.5 && summary.median <= b.max
}

// Make a price pair coherent for a given car. `raw` is whatever a model, the
// web search or the reference table produced.
//   • Shelf price for anything sold from the mainline peg is the MRP — a model
//     must not invent a ₹500-800 "retail" for a Treasure Hunt.
//   • Collector price is kept if it is plausible for the rarity, otherwise it is
//     pulled back inside the rarity's limits. `clamped` reports that it happened.
export function reconcile(car, raw) {
  var rarity = settleRarity(car)
  var b = bandFor(rarity)
  var out = { rarity: rarity, clamped: false }

  var retail = parseRange(raw && raw.india_retail_inr)
  if (MAINLINE_FAMILY.indexOf(rarity) > -1 || rarity === 'Error Car') out.india_retail_inr = b.r
  else if (rarity === 'Vintage') out.india_retail_inr = ''
  else {
    var br = parseRange(b.r)
    out.india_retail_inr = retail && retail[0] >= br[0] * 0.6 && retail[1] <= br[1] * 2.5 ? formatRange(retail[0], retail[1]) : b.r
  }

  var col = parseRange(raw && raw.india_collector_inr)
  var bc = parseRange(b.c)
  if (!col) {
    out.india_collector_inr = typicalCollector(rarity, car && car.name)
    out.estimated = true
    return out
  }
  var floor = Math.max(bc[0] * 0.5, 50)
  var lo = Math.min(Math.max(col[0], floor), b.max)
  var hi = Math.min(Math.max(col[1], lo), b.max)
  // A range whose top is many times its bottom says nothing; tighten it around
  // the lower two thirds, which is where real sales cluster.
  if (hi > lo * 4) hi = lo * 4
  if (lo !== col[0] || hi !== col[1]) out.clamped = true
  out.india_collector_inr = formatRange(lo, hi)
  return out
}

// What condition does to a carded-mint price. Rules of thumb used by Indian
// sellers; shown to the user as a choice rather than applied silently, because a
// photo cannot reliably tell a soft card corner from a mint one.
export var CONDITIONS = [
  { id: 'carded', label: 'Carded, mint', factor: 1 },
  { id: 'card-wear', label: 'Carded, worn card', factor: 0.8 },
  { id: 'loose', label: 'Loose, mint', factor: 0.6 },
  { id: 'played', label: 'Loose, played', factor: 0.3 },
]

export function conditionFromScan(condition) {
  var c = String(condition || '').toLowerCase()
  if (c.indexOf('card') > -1 && c.indexOf('mint') > -1) return 'carded'
  if (c.indexOf('near') > -1) return 'card-wear'
  if (c.indexOf('fair') > -1 || c.indexOf('play') > -1 || c === 'good') return 'played'
  if (c.indexOf('loose') > -1 || c.indexOf('very good') > -1) return 'loose'
  return 'carded'
}

export function applyCondition(range, conditionId) {
  var r = parseRange(range)
  var c = CONDITIONS.filter(function (x) { return x.id === conditionId })[0]
  if (!r || !c) return range
  return formatRange(r[0] * c.factor, r[1] * c.factor)
}

// Does an OLX-style listing title describe ONE example of this casting? Used
// before a scraped asking price is stored against a car.
var LOT_WORDS = /\b(lot|set|pack|combo|bundle|collection|bulk|pcs|pieces|cars|track|garage|playset|launcher)\b|\b\d+\s*(pc|pcs|cars|pieces)\b|\bx\s*\d+\b/i
export function listingMatchesCar(title, carName) {
  var t = String(title || '').toLowerCase()
  if (!/hot\s*wheels?/.test(t) || LOT_WORDS.test(t)) return false
  var tokens = String(carName || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length >= 3 && ['hot', 'wheels', 'the', 'and'].indexOf(w) === -1 })
  if (!tokens.length) return false
  var hit = tokens.filter(function (w) { return t.indexOf(w) > -1 }).length
  return hit >= Math.min(tokens.length, 2) && hit / tokens.length >= 0.6
}
