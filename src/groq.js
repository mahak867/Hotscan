import { state } from './state.js'
import { VISION_MODEL, VISION_FALLBACK, CODEX_MODEL, HAIKU_MODEL } from './config.js'

export function parseJSON(raw) {
  if (!raw) throw new Error('No response from AI. Try again.')
  raw = raw.trim().replace(/```json\n?/gi,'').replace(/```\n?/g,'').trim()
  var s = raw.indexOf('{')
  var e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('AI returned unexpected format. Try again.')
  if (e < s) throw new Error('AI returned unexpected format. Try again.')
  try { return JSON.parse(raw.substring(s, e + 1)) }
  catch(ex) { throw new Error('Could not parse AI response. Try again.') }
}

async function callVision(model, imageData, systemPrompt, userPrompt) {
  var b64  = imageData.split(',')[1]
  var mime = imageData.split(';')[0].split(':')[1]
  var body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } },
        { type: 'text', text: userPrompt }
      ]}
    ],
    temperature: 0.02, max_tokens: 1400
  }
  var url     = state.KEY ? 'https://api.groq.com/openai/v1/chat/completions' : '/api/groq'
  var headers = state.KEY
    ? { 'Authorization': 'Bearer ' + state.KEY, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
  
  var controller = new AbortController()
  var timeoutId = setTimeout(function() { controller.abort() }, 45000)  // 45 second timeout for vision
  
  try {
    var res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: controller.signal })
    if (!res.ok) {
      var bt = await res.text().catch(function(){ return '{}' })
      var eb = {}; try { eb = JSON.parse(bt) } catch(ex) {}
      var sm = (eb.error && typeof eb.error === 'string') ? eb.error
             : (eb.error && eb.error.message) ? eb.error.message : null
      if (res.status === 401) throw new Error('API key issue — tap ⚙️ in the header to check your key')
      if (res.status === 429) {
        var wait = parseInt(res.headers.get('retry-after') || '30', 10)
        throw new Error('AI is busy right now 🔄 — wait ' + wait + 's and try again, or upgrade to Pro for unlimited access')
      }
      if (res.status === 503) throw new Error(sm || 'AI service is temporarily down — try again in a moment')
      if (res.status === 400 || res.status === 404) {
        var err = new Error(sm || 'Model not available'); err.modelError = true; throw err
      }
      throw new Error('Something went wrong (error ' + res.status + ') — try again')
    }
    var data = await res.json()
    var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
    if (!content) throw new Error('Empty response from AI vision model. Try again.')
    return parseJSON(content)
  } catch(e) {
    if (e.name === 'AbortError') throw new Error('Vision model timed out — try again with better lighting or a closer photo')
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function groqVision(imageData, systemPrompt, userPrompt) {
  try {
    return await callVision(VISION_MODEL, imageData, systemPrompt, userPrompt)
  } catch(e) {
    if (e.modelError) {
      if (typeof captureException === 'function') captureException(new Error('Vision model fallback triggered'))
      return await callVision(VISION_FALLBACK, imageData, systemPrompt, userPrompt)
    }
    throw e
  }
}

export async function groqText(prompt, model) {
  var chosenModel = model || CODEX_MODEL
  var useProxy = !state.KEY
  var url = useProxy ? '/api/groq' : 'https://api.groq.com/openai/v1/chat/completions'
  var headers = state.KEY
    ? { 'Authorization': 'Bearer ' + state.KEY, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
  var res = await fetch(url, {
    method: 'POST', headers: headers,
    body: JSON.stringify({ model: chosenModel, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 900 })
  })
  if (!res.ok) {
    var bt = await res.text().catch(function(){ return '{}' })
    var eb = {}; try { eb = JSON.parse(bt) } catch(ex) {}
    var sm = (eb.error && typeof eb.error === 'string') ? eb.error
           : (eb.error && eb.error.message) ? eb.error.message : null
    if (res.status === 401) throw new Error('Invalid API key')
    if (res.status === 429) {
      // Try fallback model on rate limit
      if (chosenModel !== HAIKU_MODEL) {
        return groqText(prompt, HAIKU_MODEL)
      }
      var wait = parseInt(res.headers.get('retry-after') || '30', 10)
      throw new Error('Rate limit — wait ' + wait + 's or add your own Groq key.')
    }
    throw new Error(sm || 'Text API error ' + res.status)
  }
  var data = await res.json()
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
  if (!content) throw new Error('Empty response from AI. Try again.')
  return content
}

// groqJSON — like groqText but parses and returns the JSON object
// Use this whenever the prompt asks for JSON output
export async function groqJSON(prompt, model) {
  var raw = await groqText(prompt, model)
  return parseJSON(raw)
}
