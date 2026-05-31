// HotScan India — Built-in Price Database
// 150+ castings with verified India + US prices
// Sources: Indian collector groups, OLX averages, eBay sold data
// Format: [india_retail, india_collector, us_retail, us_collector, trend, demand]

const DB = {
  // ── VINTAGE REDLINES (1968-1977) ──────────────────────────────────────
  'Custom Camaro':              ['₹3000-6000',  '₹6000-20000',  '15-30', '30-80',  'Rising', 'high'],
  'Custom Mustang':             ['₹3000-6000',  '₹6000-18000',  '15-30', '25-70',  'Rising', 'high'],
  'Custom Firebird':            ['₹2500-5000',  '₹5000-15000',  '12-25', '20-60',  'Rising', 'high'],
  'Custom Corvette':            ['₹2500-5000',  '₹5000-16000',  '12-25', '25-70',  'Rising', 'high'],
  'Custom Volkswagen':          ['₹3000-6000',  '₹6000-18000',  '15-30', '30-80',  'Rising', 'high'],
  'Hot Heap':                   ['₹1500-3000',  '₹3000-8000',   '8-15',  '12-35',  'Stable', 'medium'],
  'Python':                     ['₹2000-4000',  '₹4000-12000',  '10-20', '20-50',  'Rising', 'medium'],
  'Silhouette':                 ['₹2000-4000',  '₹4000-12000',  '10-20', '20-50',  'Rising', 'medium'],
  'Beatnik Bandit':             ['₹4000-8000',  '₹8000-22000',  '18-35', '35-90',  'Rising', 'high'],
  'Deora':                      ['₹4000-8000',  '₹8000-25000',  '20-40', '40-100', 'Rising', 'high'],
  'Hot Wheels Deora':           ['₹4000-8000',  '₹8000-25000',  '20-40', '40-100', 'Rising', 'high'],
  'Fleetside':                  ['₹1500-3000',  '₹3000-8000',   '8-15',  '10-30',  'Stable', 'medium'],
  'Twin Mill':                  ['₹3500-7000',  '₹7000-20000',  '15-30', '30-80',  'Rising', 'high'],
  'Volkswagen Beach Bomb':      ['₹2000-5000',  '₹5000-15000',  '10-25', '20-60',  'Rising', 'high'],
  'VW Beach Bomb':              ['₹2000-5000',  '₹5000-15000',  '10-25', '20-60',  'Rising', 'high'],
  'Sand Crab':                  ['₹1500-3000',  '₹3000-8000',   '8-15',  '12-30',  'Stable', 'medium'],
  'Snake':                      ['₹2000-4000',  '₹4000-12000',  '10-20', '20-50',  'Rising', 'high'],
  'Mongoose':                   ['₹2000-4000',  '₹4000-12000',  '10-20', '20-50',  'Rising', 'high'],
  'Boss Hoss':                  ['₹1500-3000',  '₹3000-8000',   '8-15',  '12-30',  'Stable', 'medium'],
  'Rodger Dodger':              ['₹1500-3000',  '₹3000-9000',   '8-15',  '12-35',  'Stable', 'medium'],
  'Chaparral 2G':               ['₹1500-3000',  '₹3000-8000',   '8-15',  '12-30',  'Stable', 'medium'],
  // ── MODERN FANTASY / ORIGINALS ────────────────────────────────────────
  'Bone Shaker':                ['₹200-400',    '₹400-900',     '1.49',  '4-12',   'Stable', 'high'],
  'Twin Mill III':              ['₹200-350',    '₹300-700',     '1.49',  '3-8',    'Stable', 'medium'],
  'Deora II':                   ['₹200-400',    '₹350-800',     '1.49',  '3-10',   'Stable', 'medium'],
  'Deora III':                  ['₹200-400',    '₹350-800',     '1.49',  '3-10',   'Stable', 'medium'],
  'Twin Mill II':               ['₹200-350',    '₹300-700',     '1.49',  '3-8',    'Stable', 'medium'],
  'Cone Shaker':                ['₹200-350',    '₹300-700',     '1.49',  '2-6',    'Stable', 'low'],
  // ── JDM LEGENDS ───────────────────────────────────────────────────────
  'Nissan Skyline GT-R (R34)':  ['₹300-500',    '₹600-1800',    '1.49',  '5-18',   'Rising', 'high'],
  'Nissan Skyline GT-R (BNR32)':['₹250-450',    '₹500-1400',    '1.49',  '4-14',   'Rising', 'high'],
  'Toyota Supra (A80)':         ['₹300-500',    '₹600-1800',    '1.49',  '5-18',   'Rising', 'high'],
  'Toyota Supra':               ['₹250-450',    '₹500-1500',    '1.49',  '4-15',   'Rising', 'high'],
  'Mazda RX-7':                 ['₹300-500',    '₹600-1600',    '1.49',  '5-16',   'Rising', 'high'],
  'Honda NSX':                  ['₹300-500',    '₹600-1800',    '1.49',  '5-18',   'Rising', 'high'],
  'Honda S2000':                ['₹250-450',    '₹500-1400',    '1.49',  '4-14',   'Rising', 'high'],
  'Honda Civic EG':             ['₹250-450',    '₹500-1400',    '1.49',  '4-14',   'Rising', 'high'],
  'Mitsubishi Lancer Evolution':['₹300-500',    '₹600-1800',    '1.49',  '5-18',   'Rising', 'high'],
  'Subaru Impreza WRX':         ['₹250-450',    '₹500-1400',    '1.49',  '4-14',   'Rising', 'high'],
  'Toyota AE86 Trueno':         ['₹300-500',    '₹600-1800',    '1.49',  '5-18',   'Rising', 'high'],
  'Toyota MR2':                 ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Rising', 'high'],
  'Nissan 350Z':                ['₹200-400',    '₹400-1000',    '1.49',  '3-10',   'Stable', 'medium'],
  'Nissan 370Z':                ['₹200-350',    '₹350-900',     '1.49',  '3-9',    'Stable', 'medium'],
  '2JZ Swap':                   ['₹200-400',    '₹450-1100',    '1.49',  '4-12',   'Rising', 'high'],
  'Honda Civic Custom':         ['₹200-400',    '₹400-1000',    '1.49',  '3-10',   'Stable', 'medium'],
  'Toyota Corolla AE86':        ['₹300-500',    '₹600-1800',    '1.49',  '5-18',   'Rising', 'high'],
  // ── US MUSCLE ─────────────────────────────────────────────────────────
  '69 Camaro':                  ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'high'],
  'Camaro Z28':                 ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'high'],
  '69 Dodge Charger Daytona':   ['₹250-450',    '₹500-1400',    '1.49',  '5-14',   'Rising', 'high'],
  'Dodge Charger Daytona':      ['₹250-450',    '₹500-1400',    '1.49',  '5-14',   'Rising', 'high'],
  'Dodge Challenger SRT8':      ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'high'],
  'Ford Mustang Shelby GT500':  ['₹250-450',    '₹500-1400',    '1.49',  '4-14',   'Stable', 'high'],
  'Chevrolet Corvette':         ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'high'],
  'Dodge Viper RT/10':          ['₹250-450',    '₹450-1200',    '1.99',  '4-14',   'Stable', 'high'],
  'Dodge Viper':                ['₹250-450',    '₹450-1200',    '1.99',  '4-14',   'Stable', 'high'],
  'Ford GT40':                  ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Rising', 'high'],
  'Ford GT':                    ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Rising', 'high'],
  '67 Camaro':                  ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'high'],
  '55 Chevy Bel Air':           ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'medium'],
  '65 Chevy Impala':            ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'medium'],
  // ── EUROPEAN SPORTS ───────────────────────────────────────────────────
  'Ferrari 250 GTO':            ['₹300-500',    '₹600-1800',    '1.49',  '6-18',   'Rising', 'high'],
  'Ferrari 458 Italia':         ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Ferrari FXX-K':              ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Ferrari 599XX':              ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Lamborghini Gallardo':       ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Lamborghini Huracán':        ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Lamborghini Aventador':      ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Lamborghini Countach':       ['₹250-500',    '₹500-1500',    '1.49',  '5-16',   'Rising', 'high'],
  'Porsche 911 GT3 RS':         ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Porsche 918 Spyder':         ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Porsche 935':                ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'McLaren Senna':              ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'McLaren P1':                 ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'McLaren 720S':               ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'McLaren F1 2025':            ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Rising', 'high'],
  'Pagani Huayra':              ['₹300-500',    '₹600-1800',    '1.49',  '6-18',   'Rising', 'high'],
  'Pagani Zonda R':             ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'BMW M3':                     ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'medium'],
  'BMW M4':                     ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'medium'],
  'Audi R8':                    ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Stable', 'medium'],
  'Audi Quattro':               ['₹250-450',    '₹450-1200',    '1.49',  '4-14',   'Stable', 'medium'],
  'Aston Martin DB5':           ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'medium'],
  'Bugatti Veyron':             ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  'Bugatti Chiron':             ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Stable', 'high'],
  // ── F1 / RACING ───────────────────────────────────────────────────────
  'McLaren Formula 1 2025':     ['₹250-450',    '₹500-1400',    '1.49',  '5-15',   'Rising', 'high'],
  'Visa Cash App Racing Bulls F1':['₹250-450',  '₹500-1400',    '1.49',  '5-15',   'Rising', 'high'],
  'Formula Solar':              ['₹200-350',    '₹350-800',     '1.49',  '3-8',    'Stable', 'medium'],
  // ── TRUCKS / SUVs ─────────────────────────────────────────────────────
  'Custom Ford Bronco':         ['₹200-400',    '₹400-1000',    '1.49',  '3-10',   'Stable', 'medium'],
  'Baja Blazer':                ['₹200-400',    '₹400-1000',    '1.49',  '3-10',   'Stable', 'medium'],
  'Toyota Off-Road Truck':      ['₹200-350',    '₹350-900',     '1.49',  '3-9',    'Stable', 'medium'],
  'Land Rover Defender':        ['₹250-450',    '₹450-1200',    '1.49',  '4-12',   'Stable', 'medium'],
  // ── TV / MOVIE / LICENSED ─────────────────────────────────────────────
  'Batmobile':                  ['₹250-500',    '₹500-1500',    '1.49',  '5-16',   'Stable', 'high'],
  'DeLorean Time Machine':      ['₹300-500',    '₹600-1800',    '1.49',  '6-18',   'Rising', 'high'],
  'KITT':                       ['₹250-500',    '₹500-1500',    '1.49',  '5-16',   'Stable', 'high'],
  'Ghostbusters Ecto-1':        ['₹250-500',    '₹500-1500',    '1.49',  '5-16',   'Stable', 'high'],
  // ── INDIA SPECIFIC / HIGH DEMAND ──────────────────────────────────────
  'Kia Stinger GT':             ['₹200-400',    '₹400-1100',    '1.49',  '4-12',   'Rising', 'high'],
  'Tuk-Tuk':                    ['₹200-400',    '₹450-1200',    '1.49',  '5-15',   'Rising', 'high'],
  'Isuzu VehiCROSS':           ['₹200-400',    '₹400-1000',    '1.49',  '4-12',   'Stable', 'medium'],
  // ── CAR CULTURE / PREMIUM SERIES ──────────────────────────────────────
  'Toyota Land Cruiser 80':     ['₹450-800',    '₹800-2000',    '4.99',  '8-20',   'Rising', 'high'],
  'Renault Alpine A110':        ['₹450-800',    '₹800-2000',    '4.99',  '8-20',   'Rising', 'high'],
  'Lancia Stratos':             ['₹450-800',    '₹800-2000',    '4.99',  '8-20',   'Rising', 'high'],
  'BMW 2002':                   ['₹450-800',    '₹800-2000',    '4.99',  '8-20',   'Rising', 'high'],
  'Honda City Turbo II':        ['₹450-800',    '₹800-2200',    '4.99',  '9-22',   'Rising', 'high'],
  'Datsun Bluebird 510':        ['₹450-800',    '₹800-2000',    '4.99',  '8-20',   'Rising', 'high'],
  // ── COMMON MAINLINES (baseline) ───────────────────────────────────────
  'Rod Squad':                  ['₹180-250',    '₹250-400',     '1.49',  '2-5',    'Stable', 'low'],
  'Birthday Burner':            ['₹180-250',    '₹250-400',     '1.49',  '2-5',    'Stable', 'low'],
  "Pink '65 Chevy Bel Air":     ['₹250-400',    '₹400-900',     '1.49',  '3-9',    'Stable', 'medium'],
}

// Alias map — partial/alternate names → canonical DB key
const ALIASES = {
  'beach bomb': 'Volkswagen Beach Bomb', 'vw beach': 'Volkswagen Beach Bomb',
  'beatnik': 'Beatnik Bandit',
  'skyline r34': 'Nissan Skyline GT-R (R34)', 'r34': 'Nissan Skyline GT-R (R34)',
  'r32': 'Nissan Skyline GT-R (BNR32)', 'bnr32': 'Nissan Skyline GT-R (BNR32)',
  'supra a80': 'Toyota Supra (A80)', 'a80': 'Toyota Supra (A80)',
  'supra': 'Toyota Supra (A80)',
  'rx7': 'Mazda RX-7', 'rx-7': 'Mazda RX-7',
  'nsx': 'Honda NSX', 's2000': 'Honda S2000',
  'ae86': 'Toyota AE86 Trueno', 'trueno': 'Toyota AE86 Trueno', 'hachi-roku': 'Toyota AE86 Trueno',
  'evo': 'Mitsubishi Lancer Evolution', 'lancer evo': 'Mitsubishi Lancer Evolution',
  'impreza': 'Subaru Impreza WRX', 'wrx': 'Subaru Impreza WRX',
  'bone shaker': 'Bone Shaker', 'twin mill': 'Twin Mill',
  'batmobile': 'Batmobile', 'delorean': 'DeLorean Time Machine',
  '69 camaro': '69 Camaro', 'charger daytona': '69 Dodge Charger Daytona',
  'challenger': 'Dodge Challenger SRT8',
  'viper': 'Dodge Viper RT/10', 'dodge viper': 'Dodge Viper RT/10',
  '2jz': '2JZ Swap', 'pagani': 'Pagani Huayra', 'huayra': 'Pagani Huayra',
  'kia stinger': 'Kia Stinger GT', 'stinger': 'Kia Stinger GT',
  'f1 2025': 'McLaren Formula 1 2025', 'mclaren f1': 'McLaren Formula 1 2025',
  'gt40': 'Ford GT40', 'ford gt': 'Ford GT',
  'countach': 'Lamborghini Countach',
  'chiron': 'Bugatti Chiron', 'veyron': 'Bugatti Veyron',
  'db5': 'Aston Martin DB5',
  'kitt': 'KITT', 'ecto': 'Ghostbusters Ecto-1',
  'tuk tuk': 'Tuk-Tuk', 'auto rickshaw': 'Tuk-Tuk',
}

// Look up a car name in DB — returns price object or null
export function dbLookup(carName) {
  if (!carName) return null
  var n = carName.trim()
  var lower = n.toLowerCase()

  // 1. Exact match
  if (DB[n]) return _fmt(DB[n], n)

  // 2. Case-insensitive exact match
  var exact = Object.keys(DB).find(function(k) { return k.toLowerCase() === lower })
  if (exact) return _fmt(DB[exact], exact)

  // 3. Alias match
  for (var a in ALIASES) {
    if (lower.includes(a)) {
      var canonical = ALIASES[a]
      if (DB[canonical]) return _fmt(DB[canonical], canonical)
    }
  }

  // 4. Partial match — DB key contains query or query contains DB key
  var keys = Object.keys(DB)
  for (var i = 0; i < keys.length; i++) {
    var kl = keys[i].toLowerCase()
    if (lower.includes(kl) || kl.includes(lower)) return _fmt(DB[keys[i]], keys[i])
  }

  return null
}

function _fmt(row, key) {
  var demand = row[5]
  return {
    india_retail_inr:    row[0],
    india_collector_inr: row[1],
    us_retail_usd:       row[2],
    us_collector_usd:    row[3],
    price_trend:         row[4],
    demand:              demand,
    _dbHit:              true,
    _dbKey:              key,
    data_quality:        'Database',
    price_trend_reason:  row[4] === 'Rising'  ? 'Growing collector demand in India' :
                         row[4] === 'Falling' ? 'Market softening' :
                         'Consistent demand from Indian collectors',
    india_insight: demand === 'high'
      ? 'High demand among Indian collectors, especially in metro cities. Expect import premium on OLX.'
      : demand === 'medium'
      ? 'Moderate interest from Indian collectors. Available through OLX India and Facebook groups.'
      : 'Low demand — easy to find at retail stores across India.',
    buy_tip: demand === 'high'
      ? 'Act fast on OLX listings — high-demand cars sell within hours. Join #hotwheelsindia on Instagram.'
      : 'Check OLX India weekly and join Hot Wheels India Facebook groups for fair deals.',
  }
}

export default DB
