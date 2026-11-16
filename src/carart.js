// Car artwork: an original side-profile illustration for any car that has no
// photo of its own. The body style is picked from the casting name and the paint
// from the car's recorded colour, so a red Camaro and a white Porsche look like
// themselves at a glance. These are HotScan's own drawings — no Mattel product
// photography is bundled or hot-linked.

var PAINT = [
  [/black/, '#30343c'], [/white|pearl/, '#e9ecf1'], [/silver|grey|gray|chrome|zamac/, '#a9b1bc'],
  [/red|crimson/, '#e03a2f'], [/orange/, '#f47a1f'], [/yellow/, '#f1c232'], [/gold/, '#d4a73a'],
  [/green|lime/, '#2fa862'], [/teal|turquoise|aqua|cyan/, '#22b3ad'], [/blue|navy/, '#2f6fe4'],
  [/purple|violet/, '#8658e6'], [/pink|magenta/, '#ea5fa3'], [/brown|bronze|copper/, '#8f5f38'],
]
var FALLBACK = ['#e03a2f', '#2f6fe4', '#f47a1f', '#2fa862', '#8658e6', '#f1c232', '#22b3ad', '#a9b1bc']

var STYLE = [
  ['f1', /formula|\bf1\b|indy|grand prix/],
  ['van', /\bvan\b|\bbus\b|kombi|beach bomb|transporter|tuk|vanagon|deora/],
  ['truck', /truck|pickup|\bram\b|f-?150|silverado|land cruiser|jeep|bronco|hummer|defender|raptor|hilux|baja|tacoma|\bsuv\b|4x4/],
  ['rod', /bone shaker|twin mill|rodger dodger|hot rod|\brod\b|'?32 ford|deuce|rat fink|roadster|dragster|gasser/],
  ['muscle', /camaro|mustang|charger|challenger|'?cuda|chevelle|\bgto\b|nova|firebird|impala|bel air|dart|torino|javelin|el camino/],
  ['super', /porsche|ferrari|lamborghini|mclaren|bugatti|pagani|koenigsegg|corvette|gt40|ford gt|lotus|aston|\bnsx\b|viper|countach|huracan|aventador|\b911\b/],
]

// body, glass, front wheel [x, y, r], rear wheel [x, y, r]
var SHAPES = {
  coupe:  ['M10 44V35q1-5 9-6l19-2 10-10q2-2 6-2h33q5 0 8 4l9 10q7 2 7 7v8z', 'M45 26l7-7.500h34q3 0 5 2.500l5 5z', [31, 44, 9], [90, 44, 9]],
  super:  ['M6 44v-5q2-6 15-8l19-4q12-10 30-10 14 0 26 9l13 4q6 2 6 9v5z', 'M46 27q10-7 24-7 11 0 19 7z', [29, 44, 9], [92, 44, 9]],
  muscle: ['M5 44V34q1-3 8-4l31-2 10-10q2-2 6-2h24q4 0 8 4l8 8 10 2q5 1 5 6v8z', 'M50 27l7-7.500h25q3 0 6 3.500l5 4z', [28, 44, 9.500], [92, 44, 9.500]],
  truck:  ['M5 43V30q0-3 4-3h37l6-14q1-2 5-2h25q4 0 5 4l3 12h22q4 0 4 4v12z', 'M51 25l4.500-11h26q2 0 2.500 2l2.500 9z', [28, 43, 11], [93, 43, 11]],
  van:    ['M7 44V21q0-7 8-7h76q8 0 12 8l9 12q3 2 3 6v4z', 'M15 19h73q5 0 8 5l4 7H15z', [30, 44, 9], [91, 44, 9]],
  rod:    ['M26 43l6-12 26-3 6-12q2-3 8-3h16q6 0 8 5l8 16 9 2v7z', 'M68 26l4-9h15q3 0 4 3l3 6z', [20, 47, 6.500], [94, 42, 12]],
  f1:     ['M5 43v-3l35-5 16-7q8-5 18 0l18 7h12V22h13v4h-6v17z', 'M58 30q8-5 16 0z', [25, 44, 9.500], [95, 44, 9.500]],
}

export function carStyle(name) {
  var n = String(name || '').toLowerCase()
  for (var i = 0; i < STYLE.length; i++) if (STYLE[i][1].test(n)) return STYLE[i][0]
  return 'coupe'
}

export function carPaint(car) {
  var c = String((car && car.color) || '').toLowerCase()
  for (var i = 0; i < PAINT.length; i++) if (PAINT[i][0].test(c)) return PAINT[i][1]
  var n = String((car && car.name) || ''), h = 0
  for (var j = 0; j < n.length; j++) h = (h * 31 + n.charCodeAt(j)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

function wheel(w, tier) {
  var x = w[0], y = w[1], r = w[2]
  // Tyre detail follows the rarity: a red sidewall line for vintage Redlines,
  // a bright rim for the rubber-tyred chase cars.
  var ring = tier === 'vintage' ? '<circle cx="' + x + '" cy="' + y + '" r="' + (r - 1.800) + '" fill="none" stroke="#e03a2f" stroke-width="1.100"/>'
           : tier === 'chase' ? '<circle cx="' + x + '" cy="' + y + '" r="' + (r - 3.200) + '" fill="none" stroke="#f7c948" stroke-width="1"/>' : ''
  var spokes = ''
  for (var a = 0; a < 5; a++) {
    var t = a * 1.2566 - 1.5708
    spokes += 'M' + x + ' ' + y + 'L' + (x + Math.cos(t) * (r - 3.600)).toFixed(1) + ' ' + (y + Math.sin(t) * (r - 3.600)).toFixed(1)
  }
  return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#0c0d10"/>' + ring +
    '<circle cx="' + x + '" cy="' + y + '" r="' + (r - 3.600) + '" fill="#c9ced6"/>' +
    '<path d="' + spokes + '" stroke="#6d737d" stroke-width="1.300" stroke-linecap="round"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="1.400" fill="#3a3e46"/>'
}

var _uid = 0
// Returns an <svg> string. `car` needs only name, color and rarity.
export function carArt(car) {
  var s = SHAPES[carStyle(car && car.name)]
  var paint = carPaint(car)
  var r = String((car && car.rarity) || '').toLowerCase()
  var tier = r.indexOf('vintage') > -1 ? 'vintage' : (r.indexOf('super') > -1 || r.indexOf('premium') > -1) ? 'chase' : ''
  var id = 'ca' + (++_uid)
  return '<svg class="car-art" viewBox="0 0 120 60" role="img" aria-label="Illustration" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>' +
    '<ellipse cx="60" cy="54.500" rx="50" ry="2.600" fill="#000" opacity=".45"/>' +
    '<path d="' + s[0] + '" fill="' + paint + '"/>' +
    '<path d="' + s[0] + '" fill="url(#' + id + ')"/>' +
    '<path d="' + s[1] + '" fill="#0d1117" opacity=".9"/>' +
    '<path d="' + s[1] + '" fill="#9cc7ff" opacity=".12"/>' +
    wheel(s[2], tier) + wheel(s[3], tier) +
    '</svg>'
}

// Photo if the car has one, otherwise its illustration.
export function carMedia(car, src) {
  var img = src || (car && car.image)
  if (img) return '<img src="' + String(img).replace(/"/g, '&quot;') + '" alt="" loading="lazy">'
  return carArt(car)
}
