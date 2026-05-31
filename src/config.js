// Keys — loaded from Vite env vars (set in Vercel dashboard, never hardcoded here).
// Supabase anon key: safe to be public by design (RLS enforces access).
// Razorpay key: must NEVER be hardcoded — set VITE_RZP_KEY in Vercel env vars.
// DEV_EMAIL: set via VITE_DEV_EMAIL env var — not in source.
var _env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}
export var SUPA_URL  = _env.VITE_SUPA_URL  || ''
export var SUPA_KEY  = _env.VITE_SUPA_KEY  || ''
export var RZP_KEY   = _env.VITE_RZP_KEY   || ''
export var DEV_EMAIL = _env.VITE_DEV_EMAIL  || ''
export var WA_COMMUNITY = 'https://chat.whatsapp.com/GCEONvdK5Vx1luFVcVD8QH'
export var WA_SUPPORT   = '918089558314'
export var FREE_SCANS = 5
// Models — Maverick: 128 experts vs Scout's 16, better STH/TH detection
// kimi-k2-instruct deprecated Sept 2025 → llama-3.3-70b-versatile
export var HAIKU_MODEL  = 'llama-3.1-8b-instant'
export var CODEX_MODEL  = 'llama-3.3-70b-versatile'
export var VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
export var VISION_FALLBACK = 'llama-3.2-11b-vision-instruct'

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
