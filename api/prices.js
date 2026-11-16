// HotScan India — Real-Time Pricing Engine (Vercel Edge Function)
// 3-source pipeline: Gemini + Google Search grounded web search + Supabase community + AI synthesis
// Same fix as api/groq.js — Edge's fixed 25s ceiling was a real risk here
// too, since grounded web search can genuinely
// take longer than a single completion call.
export const config = { runtime: 'nodejs', maxDuration: 60 }
import { MODELS } from './_models.js'
import { callGemini, hasGeminiKey } from './_gemini.js'
import { captureServerException } from './_sentry.js'
import { BANDS, MAINLINE_MRP, bandFor, reconcile, settleRarity, summarizeReports, reportsFitRarity, listingMatchesCar, formatRange, isHighDemand } from '../shared/pricing.js'

const ALLOWED_ORIGINS = ['https://hotscan.in','https://www.hotscan.in','https://hotscan-theta.vercel.app']

// Price bands, MRP and every clamp now live in shared/pricing.js so the browser
// and this endpoint cannot disagree.

const HIGH_VALUE_RARITIES = ['Rare','Premium','Treasure Hunt','Super Treasure Hunt','Vintage','Error Car']

// Bootstraps real OLX India listing data for high-value cars that don't have
// enough community data yet, via Apify's maintained OLX India Scraper
// (daddyapi/olx-india-scraper) — real listings instead of an LLM guessing at
// what a web search might contain. Needs its own APIFY_TOKEN env var (not
// set up yet — this quietly no-ops until it is, same pattern as this app's
// other optional integrations).
//
// Writes results straight into community_prices tagged 'OLX India
// (Auto-fetched)' — this doubles as the cache: a later request for the same
// car within 30 days finds these rows already there and skips calling Apify
// again, with zero new tables or migrations needed.
async function apifyBootstrap(carName, url, key) {
  var token = process.env.APIFY_TOKEN
  if (!token || !url || !key) return
  try {
    // Skip if we already auto-fetched this car recently (the cache check)
    var recent = await fetch(url+'/rest/v1/community_prices?car_name=ilike.*'+encodeURIComponent(carName.split(' ').slice(0,3).join(' '))+'*&platform=eq.OLX India (Auto-fetched)&created_at=gte.'+new Date(Date.now()-30*86400000).toISOString()+'&select=id&limit=1',
      {headers:{'apikey':key,'Authorization':'Bearer '+key}})
    var recentRows = recent.ok ? await recent.json() : []
    if (recentRows.length) return // already fetched within 30 days

    var searchUrl = 'https://www.olx.in/items/q-hot-wheels-' + encodeURIComponent(carName.toLowerCase().replace(/[^a-z0-9]+/g,'-'))
    var apifyRes = await fetch('https://api.apify.com/v2/acts/daddyapi~olx-india-scraper/run-sync-get-dataset-items?token='+token, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ startUrls: [{ url: searchUrl }], maxItems: 10 }),
      signal: AbortSignal.timeout(20000),
    })
    if (!apifyRes.ok) { captureServerException(new Error('Apify OLX fetch failed: '+apifyRes.status), {tags:{function:'apifyBootstrap'}}); return }
    var listings = await apifyRes.json()
    if (!Array.isArray(listings) || !listings.length) return

    var inserts = listings
      .map(function(l) { return { title: l.title||'', price: parseInt(String(l.price||'').replace(/[₹,\s]/g,'')) } })
      // A scraped OLX price is only kept when the title describes one example of
      // this casting. 'Hot Wheels lot of 20 cars ₹4000' used to be stored as a
      // ₹4,000 data point for whatever car was being scanned.
      .filter(function(l) { return l.price > 50 && l.price < 200000 && listingMatchesCar(l.title, carName) })
      .slice(0, 8)
      .map(function(l) { return { car_name: carName, price_inr: l.price, platform: 'OLX India (Auto-fetched)', user_id: null, user_name: 'Apify (OLX India)' } })
    if (!inserts.length) return

    await fetch(url+'/rest/v1/community_prices', {
      method: 'POST',
      headers: {'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify(inserts),
    })
  } catch (e) {
    captureServerException(e, {tags:{function:'apifyBootstrap'}})
  }
}
function getDemand(n) { return isHighDemand(n) ? 'high' : 'medium' }

function buildPool() {
  var pool = []
  var s = process.env.GROQ_API_KEY; if (s) pool.push(s)
  for (var i=1;i<=5;i++) { var k=process.env['GROQ_API_KEY_'+i]; if (k&&!pool.includes(k)) pool.push(k) }
  return pool
}

var rr = 0

async function callGroq(body, pool, timeoutMs) {
  timeoutMs = timeoutMs || 15000
  for (var a=0;a<pool.length;a++) {
    var idx=(rr+a)%pool.length, key=pool[idx]
    var ctrl = new AbortController()
    var timer = setTimeout(function(){ ctrl.abort() }, timeoutMs)
    try {
      var res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',
        signal: ctrl.signal,
        headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify(body)
      })
      clearTimeout(timer)
      if (res.status===429&&a<pool.length-1) continue
      rr=(idx+1)%pool.length
      if (!res.ok) {
        var errBody = await res.text().catch(function(){ return '' })
        console.error('Groq error:', res.status, errBody)
        // This is exactly the class of failure that let a deprecated model
        // silently break scanning for an unknown stretch of time — report
        // it so a model deprecation or API change surfaces immediately
        // instead of quietly degrading to the fallback band forever.
        captureServerException(new Error('Groq API error ' + res.status + ': ' + errBody.slice(0,300)), { tags: { model: body.model }, function: 'callGroq' })
        return null
      }
      var d=await res.json()
      return d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content
    } catch(e) {
      clearTimeout(timer)
      if (e.name === 'AbortError') { console.warn('Groq timeout after', timeoutMs, 'ms'); return null }
      if (a < pool.length-1) continue
      captureServerException(e, { tags: { model: body.model }, function: 'callGroq' })
      return null
    }
  }
  return null
}

async function webSearch(carName, rarity, pool) {
  var demand = getDemand(carName)
  var year = new Date().getFullYear()
  // Explicitly specify die-cast toy to avoid web search returning real car results
  var q = 'Find current ' + year + ' India market prices for the Mattel Hot Wheels die-cast toy car "' + carName + '" (' + rarity + ' rarity).\n' +
    'Search specifically: OLX.in "hot wheels" "' + carName + '" listings, Amazon.in Hot Wheels section, ' +
    'Flipkart Hot Wheels listings, Instagram #hotwheelsindia #hotwheelsindiasale posts.\n' +
    'This is a small ~7cm die-cast toy car made by Mattel, NOT the real vehicle.\n' +
    'India collector demand level for this casting: ' + demand + '\n\n' +
    'Report only prices you actually found for ONE single car of this exact casting and rarity. Ignore lots, multipacks, track sets, customs and listings for other variants. Prefer sold or currently listed prices from Indian sellers over converted US prices. If you find nothing for this exact car, set india_collector_inr to "" rather than guessing.\n' +
    'For reference, a basic mainline car costs ₹' + MAINLINE_MRP + ' at Indian retail; Treasure Hunts and Super Treasure Hunts have the same shelf price.\n\n' +
    'Return ONLY valid JSON (no markdown): {"india_retail_inr":"range","india_collector_inr":"range, or empty string if not found","us_retail_usd":"price","us_collector_usd":"range","price_trend":"Rising|Stable|Falling","price_trend_reason":"1 sentence","india_insight":"2 sentences about Indian collector demand for this specific casting","buy_tip":"actionable India buying advice"}'

  // Live search used to be groq/compound, which Groq retired in October 2026
  // (404 model_not_found, Sentry HOTSCAN-INDIA-11). Since then every price was
  // AI synthesis with no live data behind it. Gemini with Google Search
  // grounding is the replacement: it searches, then answers from the results.
  if (!hasGeminiKey()) return null
  var g = await callGemini({ messages:[{role:'user',content:q}], max_tokens:700, temperature:0 }, 20000, { googleSearch: true })
  if (!g.ok) {
    captureServerException(new Error('Price web search failed (Gemini grounded ' + g.status + '): ' + String(g.error||'').slice(0,200)), { tags: { endpoint: 'prices', provider: 'gemini' }, function: 'webSearch' })
    return null
  }
  var content = g.data && g.data.choices && g.data.choices[0] && g.data.choices[0].message.content
  if (!content) return null
  try {
    var s=content.indexOf('{'),e=content.lastIndexOf('}')
    var parsed = s>-1?JSON.parse(content.slice(s,e+1)):null
    // A grounded answer with no sources was not actually backed by a search.
    if (parsed && !(g.data._sources && g.data._sources.length)) return null
    if (parsed) parsed._sources = g.data._sources
    return parsed
  } catch { return null }
}

async function communityPrices(carName) {
  var url=process.env.VITE_SUPA_URL||process.env.SUPA_URL
  var key=process.env.VITE_SUPA_KEY||process.env.SUPA_KEY
  if (!url||!key) return null
  try {
    // Match the whole casting name. This used to match on the first three words,
    // so "Nissan Skyline GT-R (R34)" pulled in reports for every Skyline ever
    // priced, R32s and premium releases included.
    var q=encodeURIComponent(carName.replace(/[*%,()]/g,' ').replace(/\s+/g,' ').trim())
    var res=await fetch(url+'/rest/v1/community_prices?car_name=ilike.*'+q+'*&order=created_at.desc&limit=40',
      {headers:{'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'}})
    if (!res.ok) return null
    var rows=await res.json()
    if (!rows||!rows.length) return null
    var sum = summarizeReports(rows.map(function(r){ return parseInt((r.price_inr||'0').toString().replace(/[₹,\s]/g,'')) }))
    if (!sum || !sum.count) return null
    return {
      community_avg_inr: sum.median,
      community_median_inr: sum.median,
      community_min_inr: sum.min, community_max_inr: sum.max,
      community_count: sum.count,
      community_range_inr: sum.low+'-'+sum.high,
      _summary: sum
    }
  } catch { return null }
}

async function synthesize(carName, rarity, web, community, pool) {
  var band=bandFor(rarity)
  var ctx='Car: "'+carName+'" | Rarity: '+rarity+'\n'+
    (web?'✅ Live web search prices found:\n'+JSON.stringify(web)+'\n':'❌ No web data available\n')+
    (community?'✅ Real Indian collector community prices:\n'+JSON.stringify(community)+'\n':'❌ No community data\n')+
    'Typical range for this rarity in India: retail ₹'+(band.r||'n/a')+' | collector resale ₹'+band.c+' | US $'+band.ur+' / $'+band.uc+'\n\n'+
    'RULES:\n'+
    '1. Price ONE mint, carded example of this exact casting and rarity. Never a lot, a set or a different variant.\n'+
    '2. If web data is present and is clearly about this exact car, base the collector price on it.\n'+
    '3. If community data is present, use its range to check the collector price.\n'+
    '4. If the sources disagree by more than 3x, or look like they describe a different car, trust the typical range instead and say so in price_trend_reason.\n'+
    '5. With no web or community data, return the typical range unchanged. Do not invent a trend: use "Stable" and an empty price_trend_reason.\n'+
    '6. Give a range no wider than 2x from low to high. Do not round up, and do not inflate because the casting is popular.\n'+
    '7. india_retail_inr is the Indian shelf price. Treasure Hunts and Super Treasure Hunts are sold at mainline price.\n\n'+
    'Return ONLY JSON: {"india_retail_inr":"range","india_collector_inr":"range","us_retail_usd":"price","us_collector_usd":"range","price_trend":"Rising|Stable|Falling","price_trend_reason":"1 sentence","india_insight":"2 sentences","buy_tip":"actionable advice","data_quality":"Live+Community|Live Only|Community Only|Estimated"}'

  var content=await callGroq({model:MODELS.CODEX,messages:[
    {role:'system',content:'You are an India Hot Wheels die-cast toy price analyst. Return evidence-based JSON pricing for a single car. When the evidence is thin, say so and stay with the typical range; a confident wrong price costs a collector real money.'},
    {role:'user',content:ctx}
  ],max_tokens:600,temperature:0,response_format:{type:'json_object'}},pool)
  if (!content) return null
  try { return JSON.parse(content) } catch {
    try { var s=content.indexOf('{'),e=content.lastIndexOf('}'); return s>-1?JSON.parse(content.slice(s,e+1)):null } catch { return null }
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (origin.endsWith('.vercel.app')) return true
  return false
}

async function handler(req) {
  try {
    return await handleRequest(req)
  } catch (e) {
    captureServerException(e, { tags: { endpoint: 'prices' }, function: 'handler (uncaught)' })
    return new Response(JSON.stringify({ error: 'Server error — this has been reported. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Per-IP limiter, same Upstash fixed-window approach as api/groq.js but much
// tighter: a price check costs two Groq completions and sometimes a billed
// Apify run, so it is several times more expensive than a scan.
const PRICE_WINDOW_S = 60
const PRICE_MAX_REQS = 8
// Degraded-mode fallback when Upstash is missing/failing: per-instance, weaker
// than Redis, but a Redis outage now tightens rather than removes the cap on
// the most expensive endpoint (two Groq calls + optional billed Apify run).
var _priceLocalHits = new Map()
var _priceLimiterWarned = false
function priceLocalLimited(ip, reason) {
  if (!_priceLimiterWarned) {
    _priceLimiterWarned = true
    captureServerException(new Error('Upstash price limiter unavailable (' + reason + ') — using in-memory fallback'), { tags: { endpoint: 'prices', check: 'ratelimit' } })
  }
  var now = Date.now()
  var rec = _priceLocalHits.get(ip)
  if (!rec || now - rec.start > PRICE_WINDOW_S * 1000) {
    if (_priceLocalHits.size > 5000) _priceLocalHits.clear()
    _priceLocalHits.set(ip, { start: now, count: 1 })
    return false
  }
  rec.count++
  return rec.count > PRICE_MAX_REQS
}
async function isPriceRateLimited(ip) {
  var url = process.env.UPSTASH_KV_REST_API_URL
  var token = process.env.UPSTASH_KV_REST_API_TOKEN
  if (!url || !token) return priceLocalLimited(ip, 'not configured')
  try {
    var key = 'hs:price:' + ip
    var res = await fetch(url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(PRICE_WINDOW_S), 'NX']]),
    })
    if (!res.ok) return priceLocalLimited(ip, 'HTTP ' + res.status)
    var out = await res.json()
    var count = out && out[0] && Number(out[0].result)
    if (!Number.isFinite(count)) return priceLocalLimited(ip, 'malformed response')
    return count > PRICE_MAX_REQS
  } catch (e) { return priceLocalLimited(ip, 'network error') }
}

// Resolves the caller from their Supabase JWT. Identity must come from the
// token, never the body.
async function verifyPriceUser(token) {
  var supaUrl = process.env.VITE_SUPA_URL || process.env.SUPA_URL
  var supaKey = process.env.VITE_SUPA_KEY || process.env.SUPA_KEY
  if (!token || token.length < 20 || !supaUrl || !supaKey) return null
  try {
    var res = await fetch(supaUrl + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: supaKey },
    })
    if (!res.ok) return null
    var u = await res.json()
    return u && u.id ? u.id : null
  } catch (e) { return null }
}

async function handleRequest(req) {
  var origin=req.headers.get('origin')||''
  var co=isAllowedOrigin(origin)?origin:ALLOWED_ORIGINS[0]
  var cors={'Access-Control-Allow-Origin':co,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, x-user-token'}
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
  if (req.method!=='POST') return new Response(JSON.stringify({error:'POST only'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  var body; try { body=await req.json() } catch { return new Response(JSON.stringify({error:'Invalid JSON'}),{status:400,headers:{...cors,'Content-Type':'application/json'}}) }
  var {carName,rarity,castingYear}=body
  if (!carName) return new Response(JSON.stringify({error:'carName required'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})

  // ── Gate ──────────────────────────────────────────────────────────────
  // This endpoint had no authentication, no rate limit and no budget cap, and
  // it is the most expensive one in the app: every POST fires two Groq
  // completions unconditionally (neither is cached), and a high-value rarity
  // additionally triggers a BILLED Apify actor run.
  //
  // The origin check above is not a gate — it only chooses which value to echo
  // in the CORS header and never rejects. A browser discards a bad-origin
  // response, but curl or any server-side caller receives the full payload,
  // and the paid calls have already happened by then.
  //
  // Apify's 30-day de-dupe was the only brake, and it is trivially defeated:
  // the cache key is the first three words of carName and `rarity` is
  // caller-supplied, so a novel name plus rarity:'Error Car' forces a fresh
  // billed run every single time.
  var _ipRaw = req.headers.get('x-forwarded-for') || ''
  var ip = _ipRaw.split(',')[0].trim() || 'unknown'
  if (await isPriceRateLimited(ip)) {
    return new Response(JSON.stringify({error:'Too many price checks — try again in a minute.'}),
      {status:429,headers:{...cors,'Content-Type':'application/json'}})
  }

  var _tok = (req.headers.get('x-user-token')||'').trim()
  var _uid = await verifyPriceUser(_tok)
  if (!_uid) {
    return new Response(JSON.stringify({error:'Sign in to fetch live prices.'}),
      {status:401,headers:{...cors,'Content-Type':'application/json'}})
  }

  // carName reaches Groq prompts, URL query strings and a DB write. Unbounded
  // input there is both a cost lever and a prompt-injection surface.
  if (typeof carName !== 'string' || carName.length > 120) {
    return new Response(JSON.stringify({error:'Invalid carName'}),
      {status:400,headers:{...cors,'Content-Type':'application/json'}})
  }
  carName = carName.replace(/[\r\n]+/g,' ').trim()

  var pool=buildPool()
  if (!pool.length) return new Response(JSON.stringify({error:'No API keys'}),{status:503,headers:{...cors,'Content-Type':'application/json'}})

  var supaUrl=process.env.VITE_SUPA_URL||process.env.SUPA_URL
  var supaKey=process.env.VITE_SUPA_KEY||process.env.SUPA_KEY
  if (HIGH_VALUE_RARITIES.includes(rarity)) {
    var precheck = await communityPrices(carName).catch(()=>null)
    if (!precheck || precheck.community_count < 2) {
      await apifyBootstrap(carName, supaUrl, supaKey) // no-ops if APIFY_TOKEN isn't set, or already cached within 30 days
    }
  }

  var [web,community]=await Promise.all([
    webSearch(carName,rarity||'Common',pool).catch(()=>null),
    communityPrices(carName).catch(()=>null)
  ])
  var webSources = web && web._sources
  if (web) delete web._sources
  // The rarity the scanner sent is settled by the same evidence rules the app
  // uses; the request may also carry the wheel type and series for that.
  var car = { name: carName, rarity: rarity||'Common', wheel_type: body.wheelType||'', series: body.series||'' }
  rarity = settleRarity(car)
  car.rarity = rarity
  var band=bandFor(rarity)
  if (community) { var comSummary = community._summary; delete community._summary }
  var webHasPrice = !!(web && web.india_collector_inr)
  var final=await synthesize(carName,rarity,webHasPrice?web:null,community,pool)

  // Which evidence actually stands behind the collector price, strongest first.
  var source = 'Estimated', raw = null
  if (reportsFitRarity(comSummary, rarity)) {
    raw = { india_collector_inr: formatRange(comSummary.low, comSummary.high) }
    source = 'Community reports (' + comSummary.count + ', unverified)'
  } else if (webHasPrice && final && final.india_collector_inr) {
    raw = { india_collector_inr: final.india_collector_inr, india_retail_inr: final.india_retail_inr }
    source = 'Live listings'
  } else if (webHasPrice) {
    raw = { india_collector_inr: web.india_collector_inr, india_retail_inr: web.india_retail_inr }
    source = 'Live listings'
  }
  var fit = reconcile(car, raw || {})
  // A live figure that had to be pulled back inside the rarity's limits was
  // probably about a different car; do not keep calling it live.
  if (fit.estimated) source = 'Typical range for this rarity'
  else if (fit.clamped && source === 'Live listings') source = 'Live listings, adjusted to the usual range for this rarity'

  var result={
    india_retail_inr:    fit.india_retail_inr,
    india_collector_inr: fit.india_collector_inr,
    us_retail_usd:       band.ur,
    us_collector_usd:    (final&&final.us_collector_usd)||band.uc,
    price_trend:         (raw&&final&&final.price_trend)||'Stable',
    price_trend_reason:  (raw&&final&&final.price_trend_reason)||'',
    india_insight:       (final&&final.india_insight)||'',
    buy_tip:             (final&&final.buy_tip)||'',
    data_quality:        source,
    priced_rarity:       rarity,
    community_avg_inr:   community?community.community_avg_inr:null,
    community_median_inr:community?community.community_median_inr:null,
    community_count:     community?community.community_count:0,
    sources:{web_search:webHasPrice,community:!!community,synthesized:!!final},
    web_sources:         source.indexOf('Live') === 0 ? (webSources || []) : [],
    car_name:carName, rarity:rarity
  }
  return new Response(JSON.stringify(result),{status:200,headers:{...cors,'Content-Type':'application/json'}})
}

// NOTE: these MUST be named HTTP-method exports, not `export default`.
// Under Vercel's Node.js runtime, a default export is treated as the
// Express-style (req, res) => void signature and its RETURN VALUE IS
// IGNORED — so returning a Response from a default export meant the
// function never actually responded, hung, and died at the maxDuration
// limit with FUNCTION_INVOCATION_TIMEOUT (a 504 to the client). Named
// method exports use the Web fetch-style API where returning a Response
// is correct.
export async function POST(req) { return await handler(req) }
export async function OPTIONS(req) { return await handler(req) }
