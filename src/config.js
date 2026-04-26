// Keys — safe fallbacks for browser ES module usage without Vite build
// import.meta.env is Vite-only; guard it so raw browser loads don't crash
var _env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}
export var SUPA_URL  = _env.VITE_SUPA_URL  || 'https://qptxrvvpbrnklzpxjtfr.supabase.co'
export var SUPA_KEY  = _env.VITE_SUPA_KEY  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdHhydnZwYnJua2x6cHhqdGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjA5NjcsImV4cCI6MjA5MDMzNjk2N30.LC0dkwyx8Pt20LKWU7rOR29RO5nwiSOFkTdDT2DfOf0'
export var RZP_KEY   = _env.VITE_RZP_KEY   || 'rzp_live_SX0GLL6DXzycgo'
export var DEV_EMAIL = 'mahakfahad07@gmail.com'
export var WA_COMMUNITY = 'https://chat.whatsapp.com/GCEONvdK5Vx1luFVcVD8QH'
export var WA_SUPPORT   = '918089558314'
export var FREE_SCANS = 5
// Models — Maverick: 128 experts vs Scout's 16, better STH/TH detection
// kimi-k2-instruct deprecated Sept 2025 → llama-3.3-70b-versatile
export var HAIKU_MODEL  = 'llama-3.1-8b-instant'
export var CODEX_MODEL  = 'llama-3.3-70b-versatile'
export var VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
export var VISION_FALLBACK = 'llama-3.2-11b-vision-preview'

export var HUNT_DATA = {
  mainline:[
    {name:"Dodge Charger Daytona",rarity:"Common",india:"150-200",priority:"Low"},
    {name:"Honda Civic Type R",rarity:"Uncommon",india:"200-350",priority:"Medium"},
    {name:"Porsche 911 GT3 RS",rarity:"Rare",india:"400-800",priority:"High"},
    {name:"Ferrari 488 GT3",rarity:"Rare",india:"500-900",priority:"High"},
    {name:"Toyota Supra MK4",rarity:"Uncommon",india:"250-450",priority:"Medium"},
    {name:"Nissan Skyline GT-R R34",rarity:"Rare",india:"500-1000",priority:"High"},
    {name:"'69 Chevrolet Camaro",rarity:"Common",india:"150-200",priority:"Low"},
    {name:"Lamborghini Huracán",rarity:"Uncommon",india:"250-400",priority:"Medium"},
    {name:"Ford Mustang Shelby GT500",rarity:"Uncommon",india:"200-350",priority:"Medium"},
    {name:"Dodge Viper GTS-R",rarity:"Rare",india:"400-800",priority:"High"},
  ],
  th:[
    {name:"Bone Shaker (TH)",rarity:"Treasure Hunt",india:"1200-2500",priority:"HIGH"},
    {name:"Twin Mill (TH)",rarity:"Treasure Hunt",india:"1000-2000",priority:"HIGH"},
    {name:"Deora III (STH)",rarity:"Super Treasure Hunt",india:"4000-10000",priority:"MUST GRAB"},
    {name:"'69 Camaro Z28 (STH)",rarity:"Super Treasure Hunt",india:"5000-12000",priority:"MUST GRAB"},
    {name:"Porsche 934.5 (STH)",rarity:"Super Treasure Hunt",india:"6000-15000",priority:"MUST GRAB"},
    {name:"Dodge Charger (TH)",rarity:"Treasure Hunt",india:"1500-3000",priority:"HIGH"},
    {name:"'67 Camaro (STH)",rarity:"Super Treasure Hunt",india:"5000-11000",priority:"MUST GRAB"},
  ],
  premium:[
    {name:"Car Culture — Real Riders",rarity:"Premium",india:"600-1200",priority:"High"},
    {name:"Boulevard Series",rarity:"Premium",india:"500-1000",priority:"High"},
    {name:"Fast & Furious Series",rarity:"Premium",india:"500-1000",priority:"High"},
    {name:"Retro Entertainment",rarity:"Premium",india:"600-1200",priority:"High"},
    {name:"Racing Circuit",rarity:"Premium",india:"400-800",priority:"Medium"},
  ],
  vintage:[
    {name:"Redline Era Cars (pre-1977)",rarity:"Vintage",india:"3000-20000",priority:"BIG VALUE"},
    {name:"Blackwall Era (1977-1983)",rarity:"Vintage",india:"1000-5000",priority:"HIGH"},
    {name:"Error Cars (any year)",rarity:"Error Car",india:"5000-50000",priority:"BIG VALUE"},
    {name:"Malaysia base variants",rarity:"Rare",india:"800-3000",priority:"High"},
    {name:"Convention Exclusives",rarity:"Rare",india:"2000-8000",priority:"HIGH"},
  ]
}
