// What stands in for a car that has no photo yet: a paint chip.
// A tile in the car's own colour carrying the casting's initials — the way a
// collector's box label or a paint swatch identifies a car. It is deliberately
// not a drawing of a car: the real picture is the owner's own photo, which can
// be added from the car's detail sheet.

var PAINT = [
  [/black/, '#23262c'], [/white|pearl/, '#e8eaee'], [/silver|grey|gray|chrome|zamac/, '#9aa2ad'],
  [/red|crimson/, '#c8322a'], [/orange/, '#e56f1c'], [/yellow/, '#e3b62b'], [/gold/, '#c39a36'],
  [/green|lime/, '#2a9156'], [/teal|turquoise|aqua|cyan/, '#1f9c97'], [/blue|navy/, '#2a60c8'],
  [/purple|violet/, '#7449cc'], [/pink|magenta/, '#d4528f'], [/brown|bronze|copper/, '#7d5331'],
]
var FALLBACK = ['#c8322a', '#2a60c8', '#e56f1c', '#2a9156', '#7449cc', '#e3b62b', '#1f9c97', '#9aa2ad']

export function carPaint(car) {
  var c = String((car && car.color) || '').toLowerCase()
  for (var i = 0; i < PAINT.length; i++) if (PAINT[i][0].test(c)) return PAINT[i][1]
  var n = String((car && car.name) || ''), h = 0
  for (var j = 0; j < n.length; j++) h = (h * 31 + n.charCodeAt(j)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

// "Porsche 911 GT3 RS" → "P9", "'69 Camaro" → "69", "Bone Shaker" → "BS"
export function carInitials(name) {
  var words = String(name || '').replace(/['’"()]/g, '').split(/[\s\-/]+/).filter(Boolean)
  if (!words.length) return '?'
  if (/^\d{2,4}$/.test(words[0])) return words[0].slice(-2)
  return (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase()
}

function isLight(hex) {
  var n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150
}

export function paintChip(car) {
  var paint = carPaint(car)
  return '<span class="paint-chip' + (isLight(paint) ? ' is-light' : '') + '" style="--paint:' + paint + '" aria-hidden="true">' +
    carInitials(car && car.name).replace(/[<>&]/g, '') + '</span>'
}

// The car's photo if it has one, otherwise its paint chip.
export function carMedia(car, src) {
  var img = src || (car && car.image)
  if (img) return '<img src="' + String(img).replace(/"/g, '&quot;') + '" alt="" loading="lazy">'
  return paintChip(car)
}
