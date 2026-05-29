// Run from ~/hotscan: node apply_realtime.cjs
var fs = require('fs'), path = require('path')
console.log('🔧 Applying real-time pricing engine...\n')

// ── 1. Create api/prices.js ───────────────────────────────────────────────
if (!fs.existsSync('api')) fs.mkdirSync('api')

fs.writeFileSync('api/prices.js', `// HotScan India — Real-Time Pricing Engine (Vercel Edge Function)
// 3-source pipeline: Groq compound-beta web search + Supabase community + AI synthesis
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

const HIGH_DEMAND = ['skyline','supra','rx-7','nsx','civic','ae86','evo','impreza',
  'camaro','mustang','charger','challenger','cuda','corvette','ferrari','lamborghini',
  'porsche','bone shaker','twin mill','deora','beach bomb','bugatti','pagani']

function getDemand(n) {
  n = (n||'').toLowerCase()
  return HIGH_DEMAND.some(k=>n.includes(k)) ? 'high' : 'medium'
}

function buildPool() {
  var pool = []
  var s = process.env.GROQ_API_KEY; if (s) pool.push(s)
  for (var i=1;i<=5;i++) { var k=process.env['GROQ_API_KEY_'+i]; if (k&&!pool.includes(k)) pool.push(k) }
  return pool
}

var rr = 0

async function callGroq(body, pool) {
  for (var a=0;a<pool.length;a++) {
    var idx=(rr+a)%pool.length, key=pool[idx]
    var res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    })
    if (res.status===429&&a<pool.length-1) continue
    rr=(idx+1)%pool.length
    if (!res.ok) return null
    var d=await res.json()
    return d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content
  }
  return null
}

async function webSearch(carName, rarity, pool) {
  var demand = getDemand(carName)
  var q = 'Search NOW for current prices of Hot Wheels "'+carName+'" ('+rarity+') in India and US.\\n'+
    'Search: OLX India, Amazon.in, Flipkart, eBay completed sales, Instagram #hotwheelsindia\\n'+
    'India demand level for this car: '+demand+'\\n\\n'+
    'Return ONLY JSON: {"india_retail_inr":"range","india_collector_inr":"range","us_retail_usd":"price","us_collector_usd":"range","price_trend":"Rising|Stable|Falling","price_trend_reason":"1 sentence","india_insight":"2 sentences about Indian demand","buy_tip":"actionable India buying advice"}'
  var content = await callGroq({model:'compound-beta',messages:[{role:'user',content:q}],max_tokens:600,temperature:0},pool)
  if (!content) return null
  try { var s=content.indexOf('{'),e=content.lastIndexOf('}'); return s>-1?JSON.parse(content.slice(s,e+1)):null } catch { return null }
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
    var prices=rows.map(r=>parseInt((r.price_inr||'0').toString().replace(/[₹,\\s]/g,''))).filter(p=>p>50&&p<200000).sort((a,b)=>a-b)
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
  var ctx='Car: "'+carName+'" | Rarity: '+rarity+'\\n'+
    (web?'✅ Web search prices:\\n'+JSON.stringify(web)+'\\n':'❌ No web data\\n')+
    (community?'✅ Community prices (real Indian collectors):\\n'+JSON.stringify(community)+'\\n':'❌ No community data\\n')+
    'Fallback bands: India retail ₹'+band.r+' | Collector ₹'+band.c+' | US $'+band.ur+' / $'+band.uc+'\\n\\n'+
    'RULES: Prioritize community data for india_collector_inr. Prioritize web search for US/trend.\\n'+
    'Never exceed 200% of fallback bands.\\n\\n'+
    'Return ONLY JSON: {"india_retail_inr":"range","india_collector_inr":"range","us_retail_usd":"price","us_collector_usd":"range","price_trend":"Rising|Stable|Falling","price_trend_reason":"1 sentence","india_insight":"2 sentences","buy_tip":"actionable advice","data_quality":"Live+Community|Live Only|Community Only|Estimated"}'
  var content=await callGroq({model:'llama-3.3-70b-versatile',messages:[
    {role:'system',content:'India Hot Wheels price analyst. Return accurate evidence-based JSON pricing.'},
    {role:'user',content:ctx}
  ],max_tokens:600,temperature:0,response_format:{type:'json_object'}},pool)
  if (!content) return null
  try { return JSON.parse(content) } catch { try { var s=content.indexOf('{'),e=content.lastIndexOf('}'); return s>-1?JSON.parse(content.slice(s,e+1)):null } catch { return null } }
}

export default async function handler(req) {
  var origin=req.headers.get('origin')||''
  var co=ALLOWED_ORIGINS.includes(origin)?origin:ALLOWED_ORIGINS[0]
  var cors={'Access-Control-Allow-Origin':co,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
  if (req.method!=='POST') return new Response(JSON.stringify({error:'POST only'}),{status:405,headers:{...cors,'Content-Type':'application/json'}})
  var body; try { body=await req.json() } catch { return new Response(JSON.stringify({error:'Invalid JSON'}),{status:400,headers:{...cors,'Content-Type':'application/json'}}) }
  var {carName,rarity,castingYear}=body
  if (!carName) return new Response(JSON.stringify({error:'carName required'}),{status:400,headers:{...cors,'Content-Type':'application/json'}})
  var pool=buildPool()
  if (!pool.length) return new Response(JSON.stringify({error:'No API keys'}),{status:503,headers:{...cors,'Content-Type':'application/json'}})

  var [web,community]=await Promise.all([webSearch(carName,rarity||'Common',pool).catch(()=>null),communityPrices(carName).catch(()=>null)])
  var final=await synthesize(carName,rarity||'Common',web,community,pool)
  var band=BANDS[rarity]||BANDS['Common']

  var result={
    india_retail_inr:   (final&&final.india_retail_inr)||band.r,
    india_collector_inr:(final&&final.india_collector_inr)||band.c,
    us_retail_usd:      (final&&final.us_retail_usd)||band.ur,
    us_collector_usd:   (final&&final.us_collector_usd)||band.uc,
    price_trend:        (final&&final.price_trend)||'Stable',
    price_trend_reason: (final&&final.price_trend_reason)||'',
    india_insight:      (final&&final.india_insight)||'',
    buy_tip:            (final&&final.buy_tip)||'Check OLX India and local collector groups',
    data_quality:       (final&&final.data_quality)||'Estimated',
    community_avg_inr:  community?community.community_avg_inr:null,
    community_median_inr:community?community.community_median_inr:null,
    community_count:    community?community.community_count:0,
    sources:{web_search:!!web,community:!!community,synthesized:!!final},
    car_name:carName, rarity:rarity
  }
  return new Response(JSON.stringify(result),{status:200,headers:{...cors,'Content-Type':'application/json'}})
}
`)
console.log('✅ api/prices.js created')

// ── 2. Update scanner.js searchPrices ─────────────────────────────────────
var sc = fs.readFileSync('src/scanner.js', 'utf8')

if (sc.includes('/api/prices')) {
  console.log('ℹ️  scanner.js: real-time pricing already installed')
} else {
  var old = sc.indexOf('async function searchPrices(')
  var end = sc.indexOf('\nexport async function analyzePhoto', old)
  if (old > -1 && end > old) {
    sc = sc.slice(0, old) + `async function searchPrices(carName, rarity, castingYear) {
  // Real-Time 3-Source Pricing: web search + community + AI synthesis
  try {
    var ctrl = new AbortController()
    var t = setTimeout(function(){ ctrl.abort() }, 20000)
    var res = await fetch('/api/prices', {
      method: 'POST', signal: ctrl.signal,
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({carName:carName, rarity:rarity, castingYear:castingYear})
    })
    clearTimeout(t)
    if (res && res.ok) {
      var d = await res.json()
      if (d && d.india_collector_inr) {
        var R = function(v){ return v?(String(v).startsWith('₹')?v:'₹'+v):v }
        return {
          india_retail_inr: R(d.india_retail_inr), india_collector_inr: R(d.india_collector_inr),
          us_retail_usd: d.us_retail_usd, us_collector_usd: d.us_collector_usd,
          price_trend: d.price_trend||'Stable', price_trend_reason: d.price_trend_reason||'',
          india_insight: d.india_insight||'', sell_platforms: d.sell_platforms||['OLX India','Instagram','Maido'],
          buy_tip: d.buy_tip||'', data_quality: d.data_quality||'Live',
          community_avg_inr: d.community_avg_inr||null, community_count: d.community_count||0
        }
      }
    }
  } catch(e) { console.warn('Pricing API unavailable, using fallback:', e.message) }
  return await _fallbackPrices(carName, rarity, castingYear)
}

async function _fallbackPrices(carName, rarity, castingYear) {
  var rp = {
    'Common':{r:'150-200',c:'200-350',ur:'1.49',uc:'2-5'},'Uncommon':{r:'200-350',c:'350-600',ur:'1.49',uc:'3-8'},
    'Rare':{r:'300-500',c:'600-1500',ur:'1.99',uc:'5-15'},'Premium':{r:'450-800',c:'700-1500',ur:'4.99',uc:'8-20'},
    'Treasure Hunt':{r:'500-800',c:'1200-3500',ur:'1.99',uc:'10-30'},'Super Treasure Hunt':{r:'700-1000',c:'4000-15000',ur:'1.99',uc:'30-100'},
    'Vintage':{r:'500-2000',c:'1000-8000',ur:'5-20',uc:'10-50'},'Error Car':{r:'1000-3000',c:'5000-30000',ur:'10+',uc:'50-500'}
  }
  var p = rp[rarity]||rp['Common']
  var n=(carName||'').toLowerCase()
  var hi=['skyline','supra','rx-7','nsx','camaro','mustang','charger','ferrari','lamborghini','porsche','bone shaker','twin mill','deora','beach bomb','corvette'].some(function(k){return n.includes(k)})
  var prompt='India Hot Wheels price analyst for "'+carName+'" ('+rarity+')\\nBands: India retail ₹'+p.r+' | Collector ₹'+p.c+' | US $'+p.ur+'/'+p.uc+'\\nHigh India demand: '+hi+'\\nReturn ONLY JSON: {"india_retail_inr":"'+p.r+'","india_collector_inr":"'+p.c+'","us_retail_usd":"'+p.ur+'","us_collector_usd":"'+p.uc+'","price_trend":"Stable","price_trend_reason":"Based on rarity and India collector demand","india_insight":"Indian collectors seek this through OLX and Instagram groups.","sell_platforms":["OLX India","Instagram #hotwheelsindia","Maido"],"buy_tip":"Check OLX India and local collector groups","data_quality":"Estimated"}'
  try { return await groqJSON(prompt, CODEX_MODEL) } catch(e) { return null }
}

` + sc.slice(end)
    fs.writeFileSync('src/scanner.js', sc)
    console.log('✅ scanner.js: real-time pricing installed')
  } else {
    console.log('⚠️  scanner.js: could not find searchPrices - check file structure')
  }
}

console.log('\n🎉 Done! Run:')
console.log('git add -A && git commit -m "Real-time 3-source pricing: web search + community + AI" && git push origin main')
