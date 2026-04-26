import { state } from './state.js'
import { VISION_MODEL, CODEX_MODEL, HAIKU_MODEL } from './config.js'
import { groqVision, groqText, parseJSON } from './groq.js'
import { escHtml, cleanINR, parseINR, rcls, showToast } from './utils.js'
import { addCarToCollection } from './collection.js'

async function identifyCar(imageData) {
  var sys = [
    'You are the world most precise Hot Wheels die-cast car identification expert with 30 years experience and complete knowledge of every Hot Wheels casting, color variation, tampo, series, and price from 1968 to 2026.',
    '',
    '⚠️ CRITICAL — FIRST CHECK BEFORE ANYTHING ELSE:',
    'Is the object in the image a genuine Mattel Hot Wheels die-cast car (or its packaging/card)?',
    'If NO — return IMMEDIATELY: {"identified":false,"is_hot_wheels":false,"reason":"<describe what you actually see>"}',
    'Do NOT attempt to match it to any Hot Wheels model. Do NOT guess.',
    '',
    'IDENTIFICATION RULES (only if object IS a Hot Wheels die-cast):',
    '1. CASTING: Identify the exact vehicle model (e.g. "69 Camaro" not just "Camaro"). Note year of car, make, model.',
    '2. SERIES: Name exact series e.g. "Hot Wheels 2023 Mainline #087/250" or "Car Culture Japan Historics 3".',
    '3. COLOR: Exact color e.g. "Spectraflame Blue", "Pearl White", "Matte Black", "Kmart Exclusive Red".',
    '4. TAMPO: Every graphic/decoration visible — sponsor logos, racing numbers, flames, stripes, text.',
    '5. WHEELS: Exact wheel type — "5-Spoke", "OH5 (Open Hole 5-Spoke)", "Real Riders rubber", "PR5", "10-Spoke", "MC5", "Gold Lace".',
    '6. BASE: Look for Malaysia/China/Thailand/Thailand+China base — indicates era and variation.',
    '',
    'RARITY DETECTION — only assign elevated rarity when physical evidence is visible:',
    '- Super Treasure Hunt (STH): MUST see Spectraflame metallic paint + Real Riders rubber tires + TH logo',
    '- Treasure Hunt (TH): MUST see metalflake/special paint + TH flame logo on card',
    '- Real Riders without TH = Premium series',
    '- Error Car: MUST see obvious wrong tampo/color/part — do not guess',
    '- Vintage Redlines (pre-1977): MUST see red stripe on tires',
    '- Default to Common unless you can clearly see evidence for higher rarity',
    '',
    'CONFIDENCE RULES — be honest:',
    '- 90-100%: You can clearly read series number, tampo, and wheel type',
    '- 70-89%: Model clearly visible but some details unclear',
    '- 50-69%: Partially visible or image is blurry',
    '- Below 50%: Return identified:false — do not guess',
    '',
    'AUTHENTICITY: Check Hot Wheels logo sharpness, Mattel base markings, wheel quality, paint consistency.'
  ].join('\n')

  var usr = [
    'Examine this image carefully.',
    'STEP 1: Is this a Mattel Hot Wheels die-cast car? If not, stop and return {"identified":false,"is_hot_wheels":false,"reason":"..."}.',
    'STEP 2: If yes, identify it with precision. Only describe what you can actually see — do not guess or invent details.',
    'Return ONLY valid JSON — no explanation, no markdown:',
    '{"identified":true,"is_hot_wheels":true,',
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
    '"rarity_reason":"specific VISIBLE evidence for this rarity rating — e.g. can see TH logo + rubber tires",',
    '"condition":"Mint on Card|Near Mint|Very Good|Good|Fair",',
    '"investment":"Low|Medium|High|Very High",',
    '"investment_reason":"specific market reasoning based on this exact casting and rarity",',
    '"fun_fact":"one specific interesting fact about this exact casting",',
    '"india_insight":"specific Indian collector demand for this car",',
    '"us_retail_usd":"1.49",',
    '"us_collector_usd":"5-12",',
    '"is_authentic":true,',
    '"authenticity_confidence":"High|Medium|Low",',
    '"authenticity_notes":"specific observations about logo, base, paint, wheels"}'
  ].join('')

  var d = await groqVision(imageData, sys, usr)
  if (!d.identified) {
    if (d.is_hot_wheels === false) {
      var what = d.reason ? d.reason : 'not a Hot Wheels die-cast car'
      throw new Error('Not a Hot Wheels car — AI sees: ' + what + '. Please photograph a Hot Wheels die-cast car.')
    }
    throw new Error('Could not identify. Try: white surface · bright light · side view · include card')
  }
  if (d.confidence && d.confidence < 40) {
    throw new Error('Image too unclear to identify (confidence ' + d.confidence + '%). Try: brighter light · less blur · closer shot.')
  }
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
    'You are an India Hot Wheels price analyst. Your job is to give REALISTIC, CONSERVATIVE pricing for Indian collectors.',
    '⚠️ STRICT RULES:',
    '1. You MUST stay within or close to the stated price bands. Do NOT inflate prices.',
    '2. Do NOT invent sale data. Only comment on market trends you are confident about.',
    '3. India retail = what stores like Hamleys / Flipkart charge. India collector = OLX / Instagram resale.',
    '4. If you are unsure about trend, use "Stable".',
    '',
    'Car: "' + carName + '"',
    'Rarity: ' + rarity,
    'Casting Year: ' + castingYear,
    'REQUIRED price bands (stay within these ranges):',
    '  India retail: ₹' + p.r,
    '  India collector: ₹' + p.c,
    '  US retail: $' + p.ur,
    '  US collector: $' + p.uc,
    '',
    'Factors to consider:',
    '- JDM cars (Skyline, Supra, RX-7) and US muscle have higher demand in India',
    '- Most mainline cars never reach Indian stores — OLX prices reflect import costs',
    '- Be specific about which Indian collector communities want this car and why',
    '',
    'Return ONLY valid JSON with numbers strictly inside the bands above:',
    '{"india_retail_inr":"' + p.r + '",',
    '"india_collector_inr":"' + p.c + '",',
    '"us_retail_usd":"' + p.ur + '",',
    '"us_collector_usd":"' + p.uc + '",',
    '"price_trend":"Rising|Stable|Falling",',
    '"price_trend_reason":"specific reason — or Stable if uncertain",',
    '"india_insight":"2-3 sentences about Indian demand for this exact model based on known collector interest",',
    '"sell_platforms":["OLX","Instagram collector groups","Maido"],',
    '"buy_tip":"best way to find this car in India at good price"}'
  ].join('\n')
  try { return await groqText(prompt, CODEX_MODEL) } catch(e) { return null }
}

export async function analyzePhoto() {
  if (!state.img64) return
  if (!window.checkLimit()) return
  var btn = document.getElementById('analyze-btn')
  btn.disabled = true; btn.textContent = '⏳ Scanning...'; btn.classList.remove('sticky-btn')
  document.getElementById('pipeline').style.display = 'block'
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  var skel = document.getElementById('result-skeleton'); if (skel) skel.style.display = 'block'
  window.resetSteps(); window.startTimer('Identifying car...')
  try {
    window.setStep(1, 'active')
    var multiResult = await identifyMultipleCars(state.img64)
    var carData

    // Reject non-Hot Wheels images
    if (multiResult && multiResult.is_hot_wheels === false) {
      var what = multiResult.scan_notes || 'not a Hot Wheels die-cast car'
      throw new Error('Not a Hot Wheels car — AI sees: ' + what + '. Please photograph a Hot Wheels die-cast car.')
    }

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
    var skel2 = document.getElementById('result-skeleton'); if (skel2) skel2.style.display = 'none'
    if (navigator.vibrate) navigator.vibrate(200)
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
      var eb = document.getElementById('err-box')
      eb.textContent = ''
      eb.appendChild(document.createTextNode('⚠️ ' + (err.message || '')))
      var hintDiv = document.createElement('div')
      hintDiv.style.cssText = 'margin-top:5px;font-size:11px;color:#cc5555'
      hintDiv.textContent = '📸 Tips: bright light · white surface · clear side view'
      eb.appendChild(hintDiv)
      eb.style.cssText = 'display:block;background:#180808;border:1px solid #4a1a1a;color:#ff8080'
    }
  } finally {
    btn.disabled = false; btn.textContent = '🔎 Identify & Get Live Prices'
    document.getElementById('pipeline').style.display = 'none'
    var skelF = document.getElementById('result-skeleton'); if (skelF) skelF.style.display = 'none'
  }
}

export async function analyzeDeal() {
  var asking = parseFloat(document.getElementById('deal-price').value)
  var carName = (document.getElementById('deal-car-name').value.trim() || (state.lastResult && state.lastResult.name) || '').trim()
  if (!asking || asking <= 0) { window.showToast("Enter the seller's asking price", 'error'); return }
  if (asking < 50 || asking > 200000) { window.showToast('Enter a realistic price between ₹50 and ₹2,00,000', 'error'); return }
  if (!carName) { window.showToast('Enter the car name or scan it first with Photo mode', 'error'); return }
  if (carName.length < 3) { window.showToast('Enter a more specific car name (at least 3 characters)', 'error'); return }
  var btn = document.getElementById('analyze-btn')
  btn.disabled = true; btn.textContent = '⏳ Checking deal...'
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('deal-result').style.display = 'none'
  window.startTimer('Checking deal...')
  var prompt = [
    'You are an India Hot Wheels deal checker. Give realistic, honest advice.',
    '⚠️ RULES: Only use real Indian market price knowledge. Do not inflate or deflate prices.',
    '  Common mainline = ₹150-250 India retail, ₹200-400 collector.',
    '  Treasure Hunt = ₹500-2500. Super Treasure Hunt = ₹4000-15000.',
    '  If the car name is vague or you are unsure, say so in verdict_reason.',
    '',
    'Question: Is ₹' + asking + ' a good price for "' + carName + '" in India?',
    '',
    'Return ONLY valid JSON with these EXACT keys:',
    '{"verdict":"Steal|Fair Price|Slightly High|Overpriced",',
    '"fair_india_price":"realistic INR range e.g. 300-500",',
    '"verdict_reason":"1-2 sentences explaining why at this price",',
    '"suggestion":"specific actionable advice e.g. offer ₹X or walk away",',
    '"market_retail":"India store price e.g. 150-200",',
    '"market_collector":"India resale price e.g. 350-600",',
    '"savings_or_overpay":"saving ₹X or overpaying ₹X",',
    '"confidence":"High|Medium|Low — how sure you are about this car\'s India price"}'
  ].join('\n')
  try {
    var d = await groqText(prompt, HAIKU_MODEL)
    window.stopTimer()
    // Validate response has expected fields
    if (!d.verdict || !['Steal','Fair Price','Slightly High','Overpriced'].includes(d.verdict)) {
      d.verdict = 'Fair Price'
    }
    var cfg = {
      'Steal':        {icon:'🤑', cls:'vd-steal'},
      'Fair Price':   {icon:'👍', cls:'vd-fair'},
      'Slightly High':{icon:'🤔', cls:'vd-high'},
      'Overpriced':   {icon:'❌', cls:'vd-over'}
    }
    var c = cfg[d.verdict] || cfg['Fair Price']
    document.getElementById('deal-verdict-area').className = 'deal-verdict ' + c.cls
    document.getElementById('dv-icon').textContent = c.icon
    document.getElementById('dv-label').textContent = d.verdict
    var sub = d.verdict_reason || ''
    if (d.confidence && d.confidence !== 'High') sub += (sub ? ' ' : '') + '(Price confidence: ' + d.confidence + ')'
    document.getElementById('dv-sub').textContent = sub
    var rows = [
      ['Car', carName],
      ['Seller asking', '₹' + asking],
      ['Fair India price', '₹' + (d.fair_india_price || '?')],
      ['India retail', '₹' + (d.market_retail || '?')],
      ['India collector', '₹' + (d.market_collector || '?')],
      [d.savings_or_overpay && d.savings_or_overpay.includes('saving') ? 'You save' : 'You overpay', d.savings_or_overpay || '?']
    ]
    document.getElementById('deal-rows').innerHTML = rows.map(function(r) {
      return '<div class="deal-row"><span class="deal-k">' + escHtml(String(r[0])) + '</span><span class="deal-v">' + escHtml(String(r[1])) + '</span></div>'
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
    'You are a Hot Wheels authentication specialist. Your job is to give HONEST verdicts based only on what you can clearly see in the image.',
    '',
    '⚠️ CRITICAL RULES:',
    '1. If the image is blurry, dark, or key features are not visible → return "Cannot Determine".',
    '2. Do NOT guess "Authentic" unless you can CLEARLY see at least 3 genuine markers.',
    '3. Do NOT say "Likely Fake" without specific visible evidence of faking.',
    '4. Default to "Cannot Determine" when in doubt — it is better than a wrong verdict.',
    '5. Only include items in good_signs / red_flags that you can actually see in THIS image.',
    '',
    'GENUINE Hot Wheels markers (must be clearly visible to count):',
    '- Hot Wheels logo: crisp, correct flame font — can you read it clearly?',
    '- Mattel base: "HOT WHEELS MATTEL INC." text + country of origin',
    '- Wheels: properly seated, consistent size, smooth hub',
    '- Paint: even coverage, no drips or bare spots',
    '- Tampo: sharp clean edges, correct alignment',
    '- Window plastic: clear / tinted, properly fitted',
    '',
    'FAKE markers (only flag if you actually see this):',
    '- Blurry/distorted Hot Wheels logo font',
    '- Generic base or missing Mattel text',
    '- Wheels that look mismatched or plastic-quality off',
    '- Paint drips, bubbles, or obvious uneven coverage',
    '- Fuzzy tampo edges or visibly wrong colors',
    '- Brand name "Motor Wheels", "Speed Wheels", "Hot Whees" etc.',
    '- Wrong proportions compared to known Hot Wheels casting'
  ].join('\n')
  var usr = [
    'Examine this image for Hot Wheels authenticity.',
    'LIST only what you can ACTUALLY see — do not assume.',
    'If image quality is poor and you cannot clearly see key markers, return verdict "Cannot Determine".',
    'Return ONLY valid JSON:',
    '{"identified":true,"is_authentic":true,"authenticity_score":85,',
    '"verdict":"Authentic|Likely Authentic|Cannot Determine|Uncertain|Likely Fake|Definitely Fake",',
    '"image_quality":"Good|Fair|Poor — affects confidence",',
    '"features_checked":["list each feature you could actually examine"],',
    '"good_signs":["only genuine markers you can clearly see"],',
    '"red_flags":["only fake markers you can clearly see"],',
    '"recommendation":"specific advice based on what you saw",',
    '"india_fake_note":"brief note on common India counterfeits if relevant"}'
  ].join('')
  try {
    var d = await groqVision(state.fakeImg64, sys, usr)
    window.stopTimer()
    // Validate verdict is within allowed set
    var allowed = ['Authentic','Likely Authentic','Cannot Determine','Uncertain','Likely Fake','Definitely Fake']
    if (!d.verdict || !allowed.includes(d.verdict)) d.verdict = 'Cannot Determine'
    var bg = {
      'Authentic':'vd-steal',
      'Likely Authentic':'vd-steal',
      'Cannot Determine':'vd-fair',
      'Uncertain':'vd-high',
      'Likely Fake':'vd-over',
      'Definitely Fake':'vd-over'
    }
    document.getElementById('deal-verdict-area').className = 'deal-verdict ' + (bg[d.verdict] || 'vd-fair')
    var iconMap = {
      'Authentic':'✅','Likely Authentic':'✅',
      'Cannot Determine':'❓','Uncertain':'🤔',
      'Likely Fake':'⚠️','Definitely Fake':'🚫'
    }
    document.getElementById('dv-icon').textContent = iconMap[d.verdict] || '❓'
    document.getElementById('dv-label').textContent = d.verdict
    var scoreNote = d.authenticity_score ? 'Authenticity score: ' + d.authenticity_score + '/100' : ''
    var qualNote = d.image_quality ? ' · Image quality: ' + d.image_quality : ''
    document.getElementById('dv-sub').textContent = scoreNote + qualNote
    var rows = []
    var goodSigns = Array.isArray(d.good_signs) ? d.good_signs : []
    var redFlags = Array.isArray(d.red_flags) ? d.red_flags : []
    var featChecked = Array.isArray(d.features_checked) ? d.features_checked : []
    if (featChecked.length) rows.push(['🔍 Checked', featChecked.join(' · ')])
    if (goodSigns.length) rows.push(['✓ Genuine markers', goodSigns.join(' · ')])
    if (redFlags.length) rows.push(['⚠️ Red flags', redFlags.join(' · ')])
    if (!goodSigns.length && !redFlags.length) rows.push(['ℹ️ Note', 'Could not clearly see enough markers to give a definitive verdict.'])
    if (d.india_fake_note) rows.push(['🇮🇳 India note', d.india_fake_note])
    document.getElementById('deal-rows').innerHTML = rows.map(function(r) {
      return '<div class="deal-row" style="flex-direction:column;gap:3px"><span class="deal-k">' + escHtml(String(r[0])) + '</span><span class="deal-v" style="text-align:left;font-weight:400;color:#ccc">' + escHtml(String(r[1])) + '</span></div>'
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
  if (!code) { window.showToast('Enter a barcode, collector number, or car name', 'error'); return }
  document.getElementById('err-box').style.display = 'none'
  document.getElementById('result').style.display = 'none'
  window.startTimer('Looking up...')
  var isBarcode = /^\d{8,14}$/.test(code)
  var prompt
  if (isBarcode) {
    var isMattel = /^027084/.test(code)
    prompt = [
      'You are a Hot Wheels barcode lookup assistant.',
      '⚠️ RULES:',
      '1. Only return identified:true if you have genuine knowledge of this specific barcode.',
      '2. Hot Wheels UPCs start with 027084. If this barcode does NOT start with 027084, return identified:false.',
      '3. If you do not have a confident match for this exact barcode, return identified:false.',
      '4. Do NOT invent or guess a car name. Do NOT default to a random Hot Wheels car.',
      '5. Rarity MUST reflect only the most common version associated with this barcode.',
      '',
      'Barcode: ' + code,
      isMattel ? 'Note: This has the correct Mattel Hot Wheels UPC prefix (027084).' : '⚠️ This barcode does NOT start with 027084 — it may not be a genuine Hot Wheels product.',
      '',
      'Return ONLY valid JSON:',
      '{"identified":true,"confidence":75,"name":"exact car name from this barcode","series":"series and year","casting_year":"year","color":"color","tampo":"tampo","wheel_type":"wheel type","rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt","rarity_reason":"why","condition":"Mint on Card","investment":"Low|Medium|High|Very High","investment_reason":"why","fun_fact":"fact","us_retail_usd":"1.49","us_collector_usd":"5-12","india_retail_inr":"150-200","india_collector_inr":"300-600","price_trend":"Stable","price_trend_reason":"reason","india_insight":"Indian market insight","barcode_note":"what this barcode tells us"}',
      'If not found: {"identified":false,"reason":"barcode not in database or not a Hot Wheels product"}'
    ].join('\n')
  } else {
    prompt = [
      'You are a Hot Wheels car name lookup assistant.',
      '⚠️ RULES:',
      '1. Only return identified:true if "' + code + '" closely matches a real Hot Wheels casting name.',
      '2. If the query is vague, too short, or does not match any known Hot Wheels car, return identified:false.',
      '3. Report the MOST COMMON version of this casting — do not default to rarest/most expensive.',
      '4. If multiple versions exist, note the most representative one. Do not inflate rarity.',
      '5. Set confidence honestly: 90+ only if the name is an exact casting match.',
      '',
      'Search query: "' + code + '"',
      '',
      'Return ONLY valid JSON:',
      '{"identified":true,"confidence":80,"name":"exact Hot Wheels casting name","series":"most common series","casting_year":"year first produced","color":"most common color","tampo":"typical tampo","wheel_type":"standard wheel type for this casting","rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt|Vintage|Premium","rarity_reason":"specific reason based on the standard version","condition":"Mint on Card","investment":"Low|Medium|High|Very High","investment_reason":"honest investment case for the standard version","fun_fact":"one interesting fact","us_retail_usd":"1.49","us_collector_usd":"5-12","india_retail_inr":"150-200","india_collector_inr":"300-600","price_trend":"Stable","price_trend_reason":"reason","india_insight":"Indian collector demand","also_look_for":"notable valuable variants worth knowing about"}',
      'If no match: {"identified":false,"reason":"no Hot Wheels car matches this search"}'
    ].join('\n')
  }
  try {
    var d = await groqText(prompt, CODEX_MODEL)
    window.stopTimer()
    if (!d || !d.identified) {
      var reason = (d && d.reason) ? d.reason : 'Not found. Try the full car name e.g. "Hot Wheels Bone Shaker"'
      throw new Error(reason)
    }
    if (d.confidence && d.confidence < 40) {
      throw new Error('Low confidence match (' + d.confidence + '%). Try a more specific name.')
    }
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
    'You are a Hot Wheels multi-car identification expert.',
    '',
    '⚠️ CRITICAL — CHECK FIRST:',
    'Is this image showing Mattel Hot Wheels die-cast cars?',
    'If NO Hot Wheels cars are visible, return: {"total_cars_found":0,"is_hot_wheels":false,"scan_notes":"<describe what you actually see>","cars":[]}',
    'Do NOT invent cars. Do NOT match non-Hot Wheels objects to Hot Wheels castings.',
    '',
    'If Hot Wheels cars ARE visible:',
    '1. Count every die-cast car you can clearly see (do not count blurry or barely-visible items)',
    '2. Identify EACH car individually based only on what is visible',
    '3. Never group or generalize — each car gets its own entry',
    '4. Scan systematically: top-left to bottom-right, or front-to-back',
    '',
    'For EACH car identify only what you can clearly see:',
    '- Exact casting name and model year (say "Unknown casting" if unsure)',
    '- Color (Spectraflame/metallic = higher value)',
    '- Wheel type (Real Riders rubber = Premium or TH)',
    '- Any visible tampo/graphics',
    '- Rarity: only upgrade from Common if you see CLEAR evidence (e.g. TH logo, rubber tires, redline)',
    '',
    'RARITY — only assign elevated rarity when you can clearly see the evidence:',
    '- Super Treasure Hunt (STH): MUST see Spectraflame paint + rubber tires + TH logo',
    '- Treasure Hunt (TH): MUST see special paint + TH flame logo',
    '- Real Riders rubber tires WITHOUT TH = Premium at most',
    '- Vintage Redline: MUST see red stripe on tires',
    '- Default to Common unless evidence is clear'
  ].join('\n')

  var usr = [
    'Examine this image carefully.',
    'STEP 1: Are there any Mattel Hot Wheels die-cast cars? If not, return {"total_cars_found":0,"is_hot_wheels":false,"scan_notes":"describe what you see","cars":[]}.',
    'STEP 2: Count and identify each Hot Wheels car you can CLEARLY see. Do not include partially visible or unidentifiable objects.',
    'Only describe what you can actually observe — do not invent details.',
    'Return ONLY valid JSON:',
    '{"total_cars_found":N,"is_hot_wheels":true,',
    '"scan_notes":"brief note about image quality and cars visible",',
    '"cars":[{',
    '"car_number":1,',
    '"name":"EXACT model name or Unknown casting if unsure",',
    '"series":"series name and year or Unknown",',
    '"casting_year":"year first made or Unknown",',
    '"color":"exact color",',
    '"tampo":"all visible graphics — or None visible",',
    '"wheel_type":"exact wheel type",',
    '"rarity":"Common|Uncommon|Rare|Treasure Hunt|Super Treasure Hunt|Error Car|Vintage|Premium",',
    '"rarity_reason":"specific VISIBLE evidence — e.g. can see TH logo + rubber tires",',
    '"condition":"Mint on Card|Near Mint|Very Good|Good",',
    '"investment":"Low|Medium|High|Very High",',
    '"investment_reason":"why",',
    '"india_retail_inr":"150-200",',
    '"india_collector_inr":"300-600",',
    '"us_retail_usd":"1.49",',
    '"us_collector_usd":"5-12",',
    '"confidence":80,',
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
      temperature: 0.02, max_tokens: 2500
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
      if (result && result.is_hot_wheels === false) {
        // Skip this image silently — show a note in scan_notes
        window.setStep(1, 'done')
        continue
      }
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
    var eb2 = document.getElementById('err-box')
    eb2.textContent = '⚠️ ' + (err.message || '')
    eb2.style.display = 'block'
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
    addBtn.onclick = (function(c) { return function() { addCarToCollection(c, c._sourceImage); window.showToast(c.name + ' added to collection! 🚗', 'success') } })(car)
    var shareBtn = document.createElement('button'); shareBtn.className = 'multi-add-btn'; shareBtn.textContent = '📤 Share'
    shareBtn.onclick = (function(c) { return function() { state.lastResult=c; state.imgThumb=c._sourceImage; window.showShare() } })(car)
    actRow.appendChild(addBtn); actRow.appendChild(shareBtn)
    body.appendChild(actRow)

    card.appendChild(headerDiv); card.appendChild(body)
    resultEl.appendChild(card)
  })

  resultEl.scrollIntoView({behavior:'smooth', block:'start'})
}
