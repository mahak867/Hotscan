import { state } from './state.js'
import { VISION_MODEL, CODEX_MODEL, HAIKU_MODEL } from './config.js'
import { groqVision, groqText, parseJSON } from './groq.js'
import { escHtml, cleanINR, parseINR, rcls, showToast } from './utils.js'
import { addCarToCollection } from './collection.js'

async function identifyCar(imageData) {
  var sys = [
    'You are the world most precise Hot Wheels die-cast car identification expert with 30 years experience and complete knowledge of every Hot Wheels casting, color variation, tampo, series, and price from 1968 to 2026.',
    '',
    'IDENTIFICATION RULES — follow precisely:',
    '1. CASTING: Identify the exact vehicle model (e.g. "69 Camaro" not just "Camaro"). Note year of car, make, model.',
    '2. SERIES: Name exact series e.g. "Hot Wheels 2023 Mainline #087/250" or "Car Culture Japan Historics 3".',
    '3. COLOR: Exact color e.g. "Spectraflame Blue", "Pearl White", "Matte Black", "Kmart Exclusive Red".',
    '4. TAMPO: Every graphic/decoration visible — sponsor logos, racing numbers, flames, stripes, text.',
    '5. WHEELS: Exact wheel type — "5-Spoke", "OH5 (Open Hole 5-Spoke)", "Real Riders rubber", "PR5", "10-Spoke", "MC5", "Gold Lace".',
    '6. BASE: Look for Malaysia/China/Thailand/Thailand+China base — indicates era and variation.',
    '',
    'RARITY DETECTION — critical:',
    '- Super Treasure Hunt (STH): Spectraflame metallic paint + Real Riders rubber tires + TH logo = VERY RARE ₹4000-15000 India',
    '- Treasure Hunt (TH): Metalflake/special paint + TH flame logo on card = RARE ₹1000-3000 India',
    '- Real Riders without TH = Premium series ₹500-1200 India',
    '- Error Car: wrong tampo/color/part = EXTREMELY VALUABLE ₹5000-50000 India',
    '- Vintage Redlines (pre-1977): Red stripe on tires = ₹3000-20000 India',
    '- Basic mainline: Standard 5-spoke plastic wheels = Common ₹150-200 India',
    '',
    'AUTHENTICITY: Check Hot Wheels logo sharpness, Mattel base markings, wheel quality, paint consistency.',
    'CONFIDENCE: Be precise. 95%+ only if you can clearly read tampo/series. 70-80% if partially visible.'
  ].join('\n')

  var usr = [
    'Examine this Hot Wheels car image with extreme precision.',
    'Look at: casting shape, color, ALL tampo graphics, wheel type, base plate, card if visible.',
    'Return ONLY valid JSON — no explanation, no markdown:',
    '{"identified":true,',
    '"confidence":92,',
    '"name":"EXACT Hot Wheels model name e.g. 69 Dodge Charger Daytona",',
    '"series":"EXACT series e.g. Hot Wheels 2023 Mainline #142/250",',
    '"casting_year":"first year this casting was produced",',
    '"color":"exact color name e.g. Spectraflame Blue",',
    '"tampo":"describe every graphic visible e.g. #5 racing number, sponsor logos, flames on hood",',
    '"wheel_type":"exact wheel type e.g. Real Riders rubber 5-spoke",',
    '"base_color":"color of the base plate",',
    '"base_origin":"Malaysia|China|Thailand|Unknown",',
    '"rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt|Error Car|Vintage|Premium",',
    '"rarity_reason":"specific visual evidence for this rarity rating",',
    '"condition":"Mint on Card|Near Mint|Very Good|Good|Fair",',
    '"investment":"Low|Medium|High|Very High",',
    '"investment_reason":"specific market reasoning",',
    '"fun_fact":"one specific interesting fact about this exact casting",',
    '"india_insight":"specific Indian collector demand for this car",',
    '"us_retail_usd":"1.49",',
    '"us_collector_usd":"5-12",',
    '"is_authentic":true,',
    '"authenticity_confidence":"High|Medium|Low",',
    '"authenticity_notes":"specific authenticity observations"}'
  ].join('')

  var d = await groqVision(imageData, sys, usr)
  if (!d.identified) throw new Error('Could not identify. Try: white surface · bright light · side view · include card')
  return d
}

async function searchPrices(carName, rarity, castingYear) {
  var rp = {
    'Common':{r:'150-200',c:'200-350',ur:'1.49',uc:'2-5'},
    'Uncommon':{r:'200-350',c:'350-600',ur:'1.49',uc:'3-8'},
    'Rare':{r:'300-500',c:'600-1500',ur:'1.99',uc:'5-15'},
    'Premium':{r:'450-800',c:'700-1500',ur:'4.99',uc:'8-20'},
    'Treasure Hunt':{r:'500-800',c:'1200-3500',ur:'1.99',uc:'10-30'},
    'Super Treasure Hunt':{r:'700-1000',c:'4000-15000',ur:'1.99',uc:'30-100'},
    'Vintage':{r:'500-2000',c:'1000-8000',ur:'5-20',uc:'10-50'},
    'Error Car':{r:'1000-3000',c:'5000-30000',ur:'10+',uc:'50-500'}
  }
  var p = rp[rarity] || rp['Common']
  var prompt = [
    'You are India top Hot Wheels market analyst with deep knowledge of:',
    '- OLX India pricing trends',
    '- Instagram collector group prices in India',
    '- Mumbai, Delhi, Bangalore, Chennai swap meet prices',
    '- Amazon India and Flipkart availability',
    '- Maido.in and other specialty retailers',
    '- Import duty impact on US models coming to India',
    '',
    'Price this specific car for Indian collectors:',
    'Car: "' + carName + '"',
    'Rarity: ' + rarity,
    'Casting Year: ' + castingYear,
    'Base India price range: Retail ₹' + p.r + ', Collector ₹' + p.c,
    '',
    'Consider:',
    '1. How popular is this specific model with Indian collectors?',
    '2. JDM cars (Skyline, Supra, RX-7) and muscle cars (Camaro, Charger) = high demand India',
    '3. How rare is it to find in India? (most cars never make it to Indian stores)',
    '4. Has its Indian OLX price been going up or down recently?',
    '5. Are there active Indian Instagram sellers listing this car?',
    '',
    'Return ONLY valid JSON:',
    '{"india_retail_inr":"' + p.r + '",',
    '"india_collector_inr":"' + p.c + '",',
    '"us_retail_usd":"' + p.ur + '",',
    '"us_collector_usd":"' + p.uc + '",',
    '"price_trend":"Rising|Stable|Falling",',
    '"price_trend_reason":"specific reason for this car trend in India",',
    '"india_insight":"2-3 specific sentences about Indian collector demand for this exact model, why they want it, market activity",',
    '"sell_platforms":["OLX","Instagram collector groups","Maido"],',
    '"buy_tip":"best way to find this car in India at good price"}'
  ].join('\n')
  try { return await groqText(prompt, CODEX_MODEL) } catch(e) { return null }
}

export async function analyzePhoto() {
  if (!state.img64) return
  if (!window.checkLimit()) return
  var btn = document.getElementById('analyze-btn')
  btn.disabled = true; btn.textContent = '⏳ Scanning...'
  document.getElementById('pipeline').style.display = 'block'
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  window.resetSteps(); window.startTimer('Identifying car...')
  try {
    window.setStep(1, 'active')
    var multiResult = await identifyMultipleCars(state.img64)
    var carData

    if (multiResult && multiResult.cars && multiResult.cars.length > 1) {
      window.setStep(1, 'done'); window.setStep(2, 'active')
      document.getElementById('timer-lbl').textContent = 'Found ' + multiResult.cars.length + ' cars — fetching prices...'
      var pricePromises = multiResult.cars.map(function(car) {
        return searchPrices(car.name, car.rarity, car.casting_year)
      })
      var prices = await Promise.all(pricePromises)
      var allCars = multiResult.cars.map(function(car, i) {
        car._sourceImage = state.imgThumb
        return Object.assign({}, car, prices[i] || {})
      })
      window.setStep(2, 'done'); window.setStep(3, 'done')
      window.stopTimer()
      window.incScans()
      allCars.forEach(function(c) { window.saveToHist(c) })
      showMultiResults(allCars)
      return
    }

    carData = (multiResult && multiResult.cars && multiResult.cars.length === 1)
      ? Object.assign({identified: true}, multiResult.cars[0])
      : await identifyCar(state.img64)

    window.setStep(1, 'done'); window.setStep(2, 'active')
    document.getElementById('timer-lbl').textContent = 'Fetching Indian prices...'
    var priceData = await searchPrices(carData.name, carData.rarity, carData.casting_year)
    window.setStep(2, 'done'); window.setStep(3, 'done')
    window.stopTimer()
    var result = Object.assign({}, carData, priceData || {})
    state.lastResult = result
    window.incScans()
    window.saveToHist(result)
    window.showResult(result)
    window.updateScanCounter()
    if (!window.isPro()) {
      var rem = window.FREE_SCANS - window.getTodayScans()
      if (rem <= 2 && rem > 0) {
        setTimeout(function() {
          var el = document.getElementById('err-box')
          el.textContent = rem + ' free scan' + (rem===1?'':'s') + ' remaining today. Tap your profile to upgrade.'
          el.style.cssText = 'display:block;background:#1a1500;border:1px solid rgba(255,214,10,.3);color:var(--gold)'
        }, 2000)
      }
    }
  } catch(err) {
    window.stopTimer(); window.setStep(1, 'err')
    var isRateLimit = err.message && (err.message.includes('rate-limit') || err.message.includes('Rate limit') || err.message.includes('Too many') || err.message.includes('rate limit'))
    if (isRateLimit) {
      document.getElementById('err-box').innerHTML = '⚡ <strong>Shared scan limit reached.</strong><br><span style="font-size:12px;color:#cc9900">Add your own free key at <a href="https://console.groq.com" target="_blank" style="color:#ffd60a">console.groq.com</a> for unlimited personal access, or upgrade to Pro.</span><br><button onclick="startPayment()" style="margin-top:8px;background:linear-gradient(90deg,#e63946,#ffd60a);color:#000;border:none;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer">⭐ Get Pro — ₹99/month</button>'
      document.getElementById('err-box').style.cssText = 'display:block;background:#1a1000;border:1px solid rgba(255,214,10,.4);color:var(--gold);border-radius:12px;padding:14px;margin-bottom:11px;font-size:13px;line-height:1.7'
    } else {
      document.getElementById('err-box').innerHTML = '⚠️ ' + escHtml(err.message) + '<div style="margin-top:5px;font-size:11px;color:#cc5555">📸 Tips: bright light · white surface · clear side view</div>'
      document.getElementById('err-box').style.cssText = 'display:block;background:#180808;border:1px solid #4a1a1a;color:#ff8080'
    }
  } finally {
    btn.disabled = false; btn.textContent = '🔎 Identify & Get Live Prices'
    document.getElementById('pipeline').style.display = 'none'
  }
}

export async function analyzeDeal() {
  var asking = parseFloat(document.getElementById('deal-price').value)
  var carName = document.getElementById('deal-car-name').value.trim() || (state.lastResult && state.lastResult.name) || ''
  if (!asking) { alert("Enter the seller's asking price"); return }
  if (!carName) { alert('Enter the car name or scan it first with Photo mode'); return }
  var btn = document.getElementById('analyze-btn')
  btn.disabled = true; btn.textContent = '⏳ Checking deal...'
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  window.startTimer('Checking deal...')
  var prompt = 'India Hot Wheels deal expert. Is ₹' + asking + ' a good price for "' + carName + '"?\nReturn ONLY valid JSON:\n{"verdict":"Steal|Fair Price|Slightly High|Overpriced","fair_india_price":"300-500","verdict_reason":"specific why","suggestion":"exact counter-offer or action","market_retail":"150-200","market_collector":"350-600","savings_or_overpay":"saving ₹X or overpaying ₹X"}'
  try {
    var d = await groqText(prompt, HAIKU_MODEL)
    window.stopTimer()
    var cfg = {
      'Steal':       {icon:'🤑', cls:'vd-steal'},
      'Fair Price':  {icon:'👍', cls:'vd-fair'},
      'Slightly High':{icon:'🤔',cls:'vd-high'},
      'Overpriced':  {icon:'❌', cls:'vd-over'}
    }
    var c = cfg[d.verdict] || cfg['Fair Price']
    document.getElementById('deal-verdict-area').className = 'deal-verdict ' + c.cls
    document.getElementById('dv-icon').textContent = c.icon
    document.getElementById('dv-label').textContent = d.verdict
    document.getElementById('dv-sub').textContent = d.verdict_reason || ''
    var rows = [
      ['Car', carName],
      ['Seller asking', '₹' + asking],
      ['Fair India price', '₹' + (d.fair_india_price || '?')],
      ['India retail', '₹' + (d.market_retail || '?')],
      ['India collector', '₹' + (d.market_collector || '?')],
      [d.savings_or_overpay && d.savings_or_overpay.includes('saving') ? 'You save' : 'You overpay', d.savings_or_overpay || '?']
    ]
    document.getElementById('deal-rows').innerHTML = rows.map(function(r) {
      return '<div class="deal-row"><span class="deal-k">' + r[0] + '</span><span class="deal-v">' + r[1] + '</span></div>'
    }).join('')
    if (d.suggestion) document.getElementById('deal-tip').textContent = '💡 ' + d.suggestion
    document.getElementById('deal-result').style.display = 'block'
    document.getElementById('deal-result').scrollIntoView({behavior:'smooth', block:'start'})
  } catch(err) {
    window.stopTimer()
    document.getElementById('err-box').textContent = '⚠️ ' + err.message
    document.getElementById('err-box').style.display = 'block'
  } finally {
    btn.disabled = false; btn.textContent = '💰 Check This Deal'
  }
}

export async function analyzeFake() {
  if (!state.fakeImg64) return
  var btn = document.getElementById('analyze-btn')
  btn.disabled = true; btn.textContent = '⏳ Checking...'
  document.getElementById('err-box').style.display = 'none'
  window.startTimer('Checking authenticity...')
  var sys = [
    'You are the world leading Hot Wheels authentication specialist with 25 years experience.',
    'You have examined thousands of genuine and counterfeit Hot Wheels cars.',
    '',
    'GENUINE Hot Wheels signs:',
    '- Hot Wheels logo: crisp, clean, exact font with the red/yellow flame design',
    '- Mattel logo on base: sharp, properly spaced',
    '- Base markings: "HOT WHEELS MATTEL INC." with country of origin',
    '- Wheels: consistent, smooth rolling, proper fitment',
    '- Paint: even, no drips, proper metallic flake if applicable',
    '- Tampo: sharp edges, correct colors, properly aligned',
    '- Windshield/interior: proper plastic color, correctly fitted',
    '',
    'FAKE Hot Wheels signs:',
    '- Blurry or wrong font on Hot Wheels logo',
    '- Missing or incorrect Mattel markings on base',
    '- Wheels that look different from standard Hot Wheels',
    '- Paint drips, bubbles, uneven coverage',
    '- Tampo with fuzzy edges or wrong colors',
    '- Wrong proportions or plastic quality',
    '- Generic base without proper markings',
    '- Very common in India: Chinese counterfeits, "Motor Wheels" or "Speed Wheels" brands'
  ].join('\n')
  var usr = 'Authenticate this Hot Wheels. Return ONLY valid JSON:\n{"identified":true,"is_authentic":true,"authenticity_score":85,"verdict":"Authentic|Likely Authentic|Uncertain|Likely Fake|Definitely Fake","red_flags":[],"good_signs":[],"recommendation":"advice","india_fake_note":"note about fakes in India"}'
  try {
    var d = await groqVision(state.fakeImg64, sys, usr)
    window.stopTimer()
    var bg = {'Authentic':'vd-steal','Likely Authentic':'vd-steal','Uncertain':'vd-high','Likely Fake':'vd-over','Definitely Fake':'vd-over'}
    document.getElementById('deal-verdict-area').className = 'deal-verdict ' + (bg[d.verdict] || 'vd-fair')
    document.getElementById('dv-icon').textContent = d.is_authentic ? '✅' : '🚫'
    document.getElementById('dv-label').textContent = d.verdict || 'Unknown'
    document.getElementById('dv-sub').textContent = 'Authenticity score: ' + (d.authenticity_score || '?') + '/100'
    var rows = []
    if (d.good_signs && d.good_signs.length) rows.push(['✓ Good signs', d.good_signs.join(' · ')])
    if (d.red_flags && d.red_flags.length) rows.push(['⚠️ Red flags', d.red_flags.join(' · ')])
    if (d.india_fake_note) rows.push(['🇮🇳 India note', d.india_fake_note])
    document.getElementById('deal-rows').innerHTML = rows.map(function(r) {
      return '<div class="deal-row" style="flex-direction:column;gap:3px"><span class="deal-k">' + r[0] + '</span><span class="deal-v" style="text-align:left;font-weight:400;color:#ccc">' + r[1] + '</span></div>'
    }).join('')
    if (d.recommendation) document.getElementById('deal-tip').textContent = '💡 ' + d.recommendation
    document.getElementById('deal-result').style.display = 'block'
    document.getElementById('deal-result').scrollIntoView({behavior:'smooth', block:'start'})
  } catch(err) {
    window.stopTimer()
    document.getElementById('err-box').textContent = '⚠️ ' + err.message
    document.getElementById('err-box').style.display = 'block'
  } finally {
    btn.disabled = false; btn.textContent = '🕵️ Check If Fake'
  }
}

export async function scanBarcode() {
  var code = document.getElementById('barcode-input').value.trim()
  if (!code) { alert('Enter a barcode, collector number, or car name'); return }
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  window.startTimer('Looking up...')
  var isBarcode = /^\d{8,14}$/.test(code)
  var prompt
  if (isBarcode) {
    prompt = 'Hot Wheels UPC barcode: ' + code + '. UPC 027084XXXXXX = Mattel Hot Wheels. Identify the specific car and return ONLY valid JSON:\n{"identified":true,"confidence":80,"name":"car name","series":"series year","casting_year":"year","color":"color","tampo":"tampo","wheel_type":"wheels","rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt","rarity_reason":"why","condition":"Mint on Card","investment":"Low|Medium|High|Very High","investment_reason":"why","fun_fact":"fact","us_retail_usd":"1.49","us_collector_usd":"5-12","india_retail_inr":"150-200","india_collector_inr":"300-600","price_trend":"Stable","price_trend_reason":"reason","india_insight":"Indian market insight","barcode_note":"what this barcode tells us"}'
  } else {
    prompt = 'Hot Wheels database search: "' + code + '". Find the best matching car, prioritize the most valuable/collectible version. Return ONLY valid JSON:\n{"identified":true,"confidence":88,"name":"exact name","series":"series year","casting_year":"year","color":"most iconic color","tampo":"tampo","wheel_type":"best version wheels","rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt|Vintage|Premium","rarity_reason":"why collectors want this","condition":"Mint on Card","investment":"Low|Medium|High|Very High","investment_reason":"specific investment case","fun_fact":"why notable","us_retail_usd":"1.49","us_collector_usd":"5-50","india_retail_inr":"150-500","india_collector_inr":"300-5000","price_trend":"Rising|Stable|Falling","price_trend_reason":"trend reason","india_insight":"Indian collector demand","also_look_for":"related valuable variants"}'
  }
  try {
    var d = await groqText(prompt, CODEX_MODEL)
    window.stopTimer()
    if (!d || !d.identified) throw new Error('Not found. Try the full car name e.g. "Hot Wheels Bone Shaker"')
    state.lastResult = d
    window.showResult(d)
  } catch(err) {
    window.stopTimer()
    document.getElementById('err-box').textContent = '⚠️ ' + err.message
    document.getElementById('err-box').style.display = 'block'
  }
}

export async function identifyMultipleCars(imageData) {
  var b64 = imageData.split(',')[1]
  var mime = imageData.split(';')[0].split(':')[1]

  var sys = [
    'You are the world most precise Hot Wheels multi-car identification expert.',
    'When shown an image with MULTIPLE Hot Wheels cars you MUST:',
    '1. Count every single car visible, even partially',
    '2. Identify EACH car individually with complete precision',
    '3. Never group or generalize — each car gets its own detailed entry',
    '4. Scan systematically: top-left to bottom-right, or front-to-back',
    '',
    'For EACH car identify:',
    '- Exact casting name and model year',
    '- Color (Spectraflame/metallic = higher value)',
    '- Wheel type (Real Riders rubber = Premium or TH)',
    '- Any visible tampo/graphics',
    '- Rarity: STH > TH > Vintage > Rare > Premium > Uncommon > Common',
    '',
    'RARITY CLUES:',
    '- Spectraflame paint + rubber wheels + TH logo = Super Treasure Hunt (STH)',
    '- Metalflake paint + TH logo = Treasure Hunt (TH)',
    '- Real Riders rubber tires = at minimum Premium',
    '- Red line on tires = Vintage Redline (pre-1977), very valuable',
    '- Obvious paint/tampo error = Error Car, extremely valuable'
  ].join('\n')

  var usr = [
    'Carefully examine this image. Count and identify EVERY Hot Wheels car you can see.',
    'For each car provide complete identification. Return ONLY valid JSON:',
    '{"total_cars_found":N,',
    '"scan_notes":"brief note about image quality and what you see",',
    '"cars":[{',
    '"car_number":1,',
    '"name":"EXACT model name",',
    '"series":"series name and year",',
    '"casting_year":"year first made",',
    '"color":"exact color",',
    '"tampo":"all visible graphics and decorations",',
    '"wheel_type":"exact wheel type",',
    '"rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt|Error Car|Vintage|Premium",',
    '"rarity_reason":"specific visual evidence",',
    '"condition":"Mint on Card|Near Mint|Very Good|Good",',
    '"investment":"Low|Medium|High|Very High",',
    '"investment_reason":"why",',
    '"india_retail_inr":"150-200",',
    '"india_collector_inr":"300-600",',
    '"us_retail_usd":"1.49",',
    '"us_collector_usd":"5-12",',
    '"confidence":90,',
    '"is_authentic":true,',
    '"fun_fact":"one interesting fact about this casting"',
    '}]}'
  ].join('')

  var url2 = state.KEY ? 'https://api.groq.com/openai/v1/chat/completions' : '/api/groq'
  var hdrs2 = state.KEY
    ? {'Authorization':'Bearer '+state.KEY, 'Content-Type':'application/json'}
    : {'Content-Type':'application/json'}
  var res = await fetch(url2, {
    method: 'POST',
    headers: hdrs2,
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{role:'system',content:sys},{role:'user',content:[{type:'image_url',image_url:{url:'data:'+mime+';base64,'+b64}},{type:'text',text:usr}]}],
      temperature: 0.05, max_tokens: 2000
    })
  })
  if (!res.ok) {
    var e = await res.json().catch(function(){return{}})
    if (res.status === 401) throw new Error('Invalid API key')
    if (res.status === 429) throw new Error('Rate limit — wait 30 seconds')
    throw new Error((e.error&&e.error.message)||'Vision error')
  }
  var data = await res.json()
  return parseJSON(data.choices[0].message.content)
}

export async function analyzeMultiPhoto() {
  if (!state.multiImages.length) return
  if (!window.checkLimit()) return
  var btn = document.getElementById('analyze-btn')
  btn.disabled = true; btn.textContent = '⏳ Identifying all cars...'
  document.getElementById('pipeline').style.display = 'block'
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  window.resetSteps(); window.startTimer('Scanning ' + state.multiImages.length + ' images...')

  var allCars = []
  try {
    for (var i = 0; i < state.multiImages.length; i++) {
      window.setStep(1, 'active')
      document.getElementById('timer-lbl').textContent = 'Scanning image ' + (i+1) + ' of ' + state.multiImages.length + '...'
      var result = await identifyMultipleCars(state.multiImages[i].img64)
      if (result && result.cars) {
        result.cars.forEach(function(car) {
          car._sourceImage = state.multiImages[i].thumb
          car._imageIndex = i
          allCars.push(car)
        })
      }
      window.setStep(1, 'done')
    }

    window.setStep(2, 'active')
    document.getElementById('timer-lbl').textContent = 'Fetching prices for ' + allCars.length + ' cars...'
    var pricePromises = allCars.map(function(car) {
      return searchPrices(car.name, car.rarity, car.casting_year)
    })
    var prices = await Promise.all(pricePromises)
    prices.forEach(function(p, i) { if (p) allCars[i] = Object.assign({}, allCars[i], p) })

    window.setStep(2, 'done'); window.setStep(3, 'done')
    window.stopTimer()
    window.incScans()
    showMultiResults(allCars)
  } catch(err) {
    window.stopTimer(); window.setStep(1, 'err')
    document.getElementById('err-box').innerHTML = '⚠️ ' + escHtml(err.message)
    document.getElementById('err-box').style.display = 'block'
  } finally {
    btn.disabled = false; btn.textContent = '🔎 Identify All Cars (' + state.multiImages.length + ' photos)'
    document.getElementById('pipeline').style.display = 'none'
  }
}

export function showMultiResults(cars) {
  var resultEl = document.getElementById('result')
  resultEl.style.display = 'block'
  resultEl.innerHTML = ''

  var header = document.createElement('div')
  header.className = 'multi-results-header'
  header.style.cssText = 'padding:14px 14px 0'
  header.innerHTML = '<span style="font-size:20px">🚗</span><span>' + cars.length + ' car' + (cars.length===1?'':'s') + ' identified</span>'
  resultEl.appendChild(header)

  var totalVal = 0
  cars.forEach(function(c) { totalVal += parseINR(c.india_collector_inr) })
  var valBar = document.createElement('div')
  valBar.style.cssText = 'padding:0 14px 12px;font-size:13px;color:var(--text2)'
  valBar.innerHTML = 'Total estimated value: <strong style="color:var(--gold)">₹' + totalVal.toLocaleString('en-IN') + '</strong>'
  resultEl.appendChild(valBar)

  var addAllBtn = document.createElement('button')
  addAllBtn.style.cssText = 'margin:0 14px 12px;background:var(--green);color:#000;border:none;padding:11px;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;width:calc(100% - 28px)'
  addAllBtn.textContent = '➕ Add All ' + cars.length + ' Cars to Collection'
  addAllBtn.onclick = function() {
    cars.forEach(function(car) {
      addCarToCollection(car, car._sourceImage)
    })
    window.goPage('collection')
  }
  resultEl.appendChild(addAllBtn)

  cars.forEach(function(car, idx) {
    var card = document.createElement('div')
    card.className = 'multi-car-result'
    card.style.cssText = 'margin:0 14px 10px'

    var headerDiv = document.createElement('div')
    headerDiv.className = 'multi-car-header'
    headerDiv.onclick = function() {
      var body = card.querySelector('.multi-car-body')
      var arrow = card.querySelector('.multi-car-expand')
      body.classList.toggle('open')
      arrow.classList.toggle('open')
    }

    var thumb = document.createElement('div'); thumb.className = 'multi-car-thumb'
    if (car._sourceImage) { var img=document.createElement('img'); img.src=car._sourceImage; img.alt=''; thumb.appendChild(img) } else thumb.textContent = '🚗'

    var info = document.createElement('div'); info.className = 'multi-car-info'
    var nm = document.createElement('div'); nm.className = 'multi-car-name'; nm.textContent = car.name || 'Unknown'
    var ser = document.createElement('div'); ser.className = 'multi-car-series'; ser.textContent = car.series || ''
    var prices = document.createElement('div'); prices.className = 'multi-car-prices'
    var rarSpan = document.createElement('span'); rarSpan.className = 'rar ' + rcls(car.rarity); rarSpan.style.cssText='font-size:10px;padding:2px 7px'; rarSpan.textContent = car.rarity||'Common'
    var priceSpan = document.createElement('span'); priceSpan.className = 'multi-car-inr'; priceSpan.textContent = car.india_collector_inr ? '₹'+cleanINR(car.india_collector_inr) : ''
    prices.appendChild(rarSpan); prices.appendChild(priceSpan)
    info.appendChild(nm); info.appendChild(ser); info.appendChild(prices)

    var arrow = document.createElement('span'); arrow.className = 'multi-car-expand'; arrow.textContent = '▾'
    headerDiv.appendChild(thumb); headerDiv.appendChild(info); headerDiv.appendChild(arrow)

    var body = document.createElement('div'); body.className = 'multi-car-body'
    var detailRows = [['Color',car.color],['Wheels',car.wheel_type],['Condition',car.condition],['US Retail','$'+(car.us_retail_usd||'?')],['US Collector','$'+(car.us_collector_usd||'?')],['Investment',car.investment],['Fun Fact',car.fun_fact]]
    body.innerHTML = detailRows.filter(function(r){return r[1]&&r[1]!=='undefined'}).map(function(r){return '<div class="det"><span class="det-k">'+r[0]+'</span><span class="det-v">'+r[1]+'</span></div>'}).join('')
    if (car.india_insight) body.innerHTML += '<div style="background:var(--surface2);border-left:3px solid var(--gold);border-radius:0 8px 8px 0;padding:9px 11px;margin-top:8px;font-size:12px;color:#ccc;line-height:1.6">'+car.india_insight+'</div>'

    var actRow = document.createElement('div'); actRow.style.cssText = 'display:flex;gap:6px;margin-top:8px'
    var addBtn = document.createElement('button'); addBtn.className = 'multi-add-btn'; addBtn.textContent = '➕ Add to Collection'
    addBtn.onclick = (function(c) { return function() { addCarToCollection(c, c._sourceImage); alert(c.name + ' added to collection!') } })(car)
    var shareBtn = document.createElement('button'); shareBtn.className = 'multi-add-btn'; shareBtn.textContent = '📤 Share'
    shareBtn.onclick = (function(c) { return function() { state.lastResult=c; state.imgThumb=c._sourceImage; window.showShare() } })(car)
    actRow.appendChild(addBtn); actRow.appendChild(shareBtn)
    body.appendChild(actRow)

    card.appendChild(headerDiv); card.appendChild(body)
    resultEl.appendChild(card)
  })

  resultEl.scrollIntoView({behavior:'smooth', block:'start'})
}
