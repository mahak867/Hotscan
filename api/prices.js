// HotScan India — Real-Time Pricing Engine (Vercel Edge Function)
// 3-source pipeline: Groq compound-beta-mini web search + Supabase community + AI synthesis
export const config = { runtime: 'edge' }

const ALLOWED_ORIGINS = ['https://hotscan.in','https://www.hotscan.in','https://hotscan-theta.vercel.app']

const BANDS = {
  'Common':              {r:'150-200',  c:'200-350',    ur:'1.49', uc:'2-5'   },
  'Uncommon':            {r:'200-350',  c:'350-600',    ur:'1.49', uc:'3-8'   },
  'Rare':                {r:'300-500',  c:'600-1500',   ur:'1.99', uc:'5-15'  },
  'Premium':             {r:'450-800',  c:'700-1500',   ur:'4.99', uc:'8-20'  },
  'Treasure Hunt':       {r:'500-800',  c:'1200-3500',  ur:'1.99', uc:'10-30' },
  'Super Treasure Hunt': {r:'700-1000', c:'4000-15000', ur:'1.99', uc:'30-100'},
  'Vintage':             {r:'500-2000', c:'1000-8000',  ur:'5-20', uc:'10-50' },
  'Error Car':           {r:'1000-3000',c:'5000-30000', ur:'10+',  uc:'50-500'},
}

const HIGH_DEMAND = [
  'skyline','supra','rx-7','nsx','civic','ae86','evo','impreza',
  'camaro','mustang','charger','challenger','cuda','corvette',
  'ferrari','lamborghini','porsche','mclaren','pagani','koenigsegg',
  'aston','lotus','alpine','bugatti','veyron','huayra',
  'bone shaker','twin mill','deora','beach bomb',
  'f1','formula 1','formula one','gt40','ford gt',
  'dodge viper','acura nsx','lancia','alfa romeo',
  'car culture','boulevard','retro entertainment','fast furious',
  'hw exotics','id car','screen time','mario kart',
  'super treasure hunt','treasure hunt'
]

function getDemand(n) {
  n = (n||'').toLowerCase()
  return HIGH_DEMAND.some(k=>n.includes(k)) ? 'high' : 'medium'
}

// Parses "200-350", "₹1,200", "150" etc into [low, high] numbers.
function parseRange(s) {
  if (!s) return null
  var nums = String(s).replace(/[₹,\s]/g,'').match(/\d+(\.\d+)?/g)
  if (!nums || !nums.length) return null
  var vals = nums.map(Number)
  return [Math.min.apply(null,vals), Math.max.apply(null,vals)]
}

// The AI is deliberately told not to cap prices below real market data — but
// nothing was stopping it from returning a wildly hallucinated number if its
// web search picked up one irrelevant listing. This clamps the result to a
// generous multiple of the rarity band (allows genuine premium pricing
// through, catches outright hallucination) rather than trusting it blindly.
// Returns the original string if it doesn't even parse as a number.
function sanityClamp(aiStr, bandStr, minMult, maxMult) {
  var ai = parseRange(aiStr), band = parseRange(bandStr)
  if (!ai) return bandStr
  if (!band) return aiStr
  var floor = band[0] * minMult, ceiling = band[1] * maxMult
  var lo = Math.max(ai[0], floor * 0.3) // still allow real dips below band, just not near-zero
  var hi = Math.min(Math.max(ai[1], lo), ceiling)
  lo = Math.min(lo, hi)
  return Math.round(lo) === Math.round(hi) ? String(Math.round(lo)) : Math.round(lo) + '-' + Math.round(hi)
}

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
      if (!res.ok) { console.error('Groq error:', res.status); return null }
      var d=await res.json()
      return d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content
    } catch(e) {
      clearTimeout(timer)
      if (e.name === 'AbortError') { console.warn('Groq timeout after', timeoutMs, 'ms'); return null }
      if (a < pool.length-1) continue
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
    'Return ONLY valid JSON (no markdown): {"india_retail_inr":"range e.g. 150-200","india_collector_inr":"range e.g. 200-350","us_retail_usd":"price","us_collector_usd":"range","price_trend":"Rising|Stable|Falling","price_trend_reason":"1 sentence","india_insight":"2 sentences about Indian collector demand for this specific casting","buy_tip":"actionable India buying advice"}'

  // groq/compound (full, not -mini) — mini only makes a single tool call per
  // request, meaning one search with no cross-checking. Full compound can
  // make multiple tool calls, which matters here since price accuracy is
  // this product's actual core value — worth the extra latency/rate-limit
  // cost over mini.
  var content = await callGroq({model:'groq/compound',messages:[{role:'user',content:q}],max_tokens:500,temperature:0},pool,15000)
  if (!content) return null
  try {
    var s=content.indexOf('{'),e=content.lastIndexOf('}')
    return s>-1?JSON.parse(content.slice(s,e+1)):null
  } catch { return null }
}

async function communityPrices(carName) {
  var url=process.env.VITE_SUPA_URL||process.env.SUPA_URL
  var key=process.env.VITE_SUPA_KEY||process.env.SUPA_KEY
  if (!url||!key) return null
  try {
    var q=encodeURIComponent(carName.split(' ').slice(0,3).join(' '))
    var res=await fetch(url+'/rest/v1/community_prices?car_name=ilike.*'+q+'*&order=created_at.desc&limit=20',
      {headers:{'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'}})
    if (!res.ok) return null
    var rows=await res.json()
    if (!rows||!rows.length) return null
    var prices=rows.map(r=>parseInt((r.price_inr||'0').toString().replace(/[₹,\s]/g,''))).filter(p=>p>50&&p<200000).sort((a,b)=>a-b)
    if (!prices.length) return null
    return {
      community_avg_inr: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),
      community_median_inr: prices[Math.floor(prices.length/2)],
      community_min_inr: prices[0], community_max_inr: prices[prices.length-1],
      community_count: prices.length,
      community_range_inr: prices[0]+'-'+prices[prices.length-1]
    }
  } catch { return null }
}

async function synthesize(carName, rarity, web, community, pool) {
  var band=BANDS[rarity]||BANDS['Common']
  var ctx='Car: "'+carName+'" | Rarity: '+rarity+'\n'+
    (web?'✅ Live web search prices found:\n'+JSON.stringify(web)+'\n':'❌ No web data available\n')+
    (community?'✅ Real Indian collector community prices:\n'+JSON.stringify(community)+'\n':'❌ No community data\n')+
    'Fallback bands (use ONLY if no web/community data): India retail ₹'+band.r+' | Collector ₹'+band.c+' | US $'+band.ur+' / $'+band.uc+'\n\n'+
    'RULES:\n'+
    '1. If web data exists, use it as the PRIMARY source for pricing.\n'+
    '2. If community data exists, use it to validate/adjust collector price.\n'+
    '3. Use fallback bands ONLY as a minimum floor — real market prices may be higher.\n'+
    '4. Do NOT artificially cap prices — if web shows ₹800 for a "Common" car, return ₹800.\n'+
    '5. Prioritize accuracy over conservatism.\n\n'+
    'Return ONLY JSON: {"india_retail_inr":"range","india_collector_inr":"range","us_retail_usd":"price","us_collector_usd":"range","price_trend":"Rising|Stable|Falling","price_trend_reason":"1 sentence","india_insight":"2 sentences","buy_tip":"actionable advice","data_quality":"Live+Community|Live Only|Community Only|Estimated"}'

  var content=await callGroq({model:'openai/gpt-oss-120b',messages:[
    {role:'system',content:'You are an India Hot Wheels die-cast toy price analyst. Return accurate evidence-based JSON pricing. Never artificially cap prices that are supported by real data.'},
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

export default async function handler(req) {
  var origin=req.headers.get('origin')||''
  var co=isAllowedOrigin(origin)?origin:ALLOWED_ORIGINS[0]
  var cors={'Access-Control-Allow-Origin':co,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
  if (req.method!=='POST') return new Response(JSON.stringify({error:'POST only'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  var body; try { body=await req.json() } catch { return new Response(JSON.stringify({error:'Invalid JSON'}),{status:400,headers:{...cors,'Content-Type':'application/json'}}) }
  var {carName,rarity,castingYear}=body
  if (!carName) return new Response(JSON.stringify({error:'carName required'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})
  var pool=buildPool()
  if (!pool.length) return new Response(JSON.stringify({error:'No API keys'}),{status:503,headers:{...cors,'Content-Type':'application/json'}})

  var [web,community]=await Promise.all([
    webSearch(carName,rarity||'Common',pool).catch(()=>null),
    communityPrices(carName).catch(()=>null)
  ])
  var final=await synthesize(carName,rarity||'Common',web,community,pool)
  var band=BANDS[rarity]||BANDS['Common']

  var result={
    india_retail_inr:    sanityClamp((final&&final.india_retail_inr)||band.r, band.r, 1, 6),
    india_collector_inr: sanityClamp((final&&final.india_collector_inr)||band.c, band.c, 1, 8),
    us_retail_usd:       (final&&final.us_retail_usd)||band.ur,
    us_collector_usd:    (final&&final.us_collector_usd)||band.uc,
    price_trend:         (final&&final.price_trend)||'Stable',
    price_trend_reason:  (final&&final.price_trend_reason)||'',
    india_insight:       (final&&final.india_insight)||'',
    buy_tip:             (final&&final.buy_tip)||'Check OLX India and local collector groups',
    data_quality:        (final&&final.data_quality)||'Estimated',
    community_avg_inr:   community?community.community_avg_inr:null,
    community_median_inr:community?community.community_median_inr:null,
    community_count:     community?community.community_count:0,
    sources:{web_search:!!web,community:!!community,synthesized:!!final},
    car_name:carName, rarity:rarity
  }
  // With 3+ real community submissions, trust that over the AI's synthesized
  // guess entirely for the collector price — actual sold/listed prices from
  // real people beat an LLM's web-search interpretation, and this is the
  // strongest accuracy lever available without building a full scraped
  // price database.
  if (community && community.community_count >= 3 && community.community_median_inr) {
    var med = community.community_median_inr
    result.india_collector_inr = Math.round(med*0.85) + '-' + Math.round(med*1.15)
    result.data_quality = 'Community Verified (' + community.community_count + ' submissions)'
  }
  return new Response(JSON.stringify(result),{status:200,headers:{...cors,'Content-Type':'application/json'}})
}
