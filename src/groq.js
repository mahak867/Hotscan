import { state } from './state.js'
import { VISION_MODEL, CODEX_MODEL, HAIKU_MODEL } from './config.js'

export function parseJSON(raw) {
  if (!raw) throw new Error('No response from AI. Try again.')
  raw = raw.trim().replace(/```json\n?/gi,'').replace(/```\n?/g,'').trim()
  var s = raw.indexOf('{')
  var e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('AI returned unexpected format. Try again.')
  if (e < s) throw new Error('AI returned unexpected format. Try again.')
  try {
    return JSON.parse(raw.substring(s, e + 1))
  } catch(ex) {
    throw new Error('Could not parse AI response. Try again.')
  }
}

export async function groqVision(imageData, systemPrompt, userPrompt) {
  var b64 = imageData.split(',')[1]
  var mime = imageData.split(';')[0].split(':')[1]
  var body = {
    model: VISION_MODEL,
    messages: [
      {role:'system', content:systemPrompt},
      {role:'user', content:[
        {type:'image_url', image_url:{url:'data:'+mime+';base64,'+b64}},
        {type:'text', text:userPrompt}
      ]}
    ],
    temperature: 0.05, max_tokens: 900
  }
  var url = state.KEY ? 'https://api.groq.com/openai/v1/chat/completions' : '/api/groq'
  var headers = state.KEY
    ? {'Authorization':'Bearer '+state.KEY, 'Content-Type':'application/json'}
    : {'Content-Type':'application/json'}
  var res = await fetch(url, {method:'POST', headers:headers, body:JSON.stringify(body)})
  if (!res.ok) {
    var bodyText = await res.text().catch(function(){return'{}'})
    var errBody = {}; try { errBody = JSON.parse(bodyText) } catch(ex) {}
    var serverMsg = (errBody.error && typeof errBody.error === 'string') ? errBody.error
                  : (errBody.error && errBody.error.message) ? errBody.error.message : null
    if (res.status === 401) throw new Error('Invalid API key — check at console.groq.com')
    if (res.status === 429) {
      if (serverMsg && serverMsg.length > 60) throw new Error(serverMsg)
      var wait = parseInt(res.headers.get('retry-after') || '30', 10)
      throw new Error('Too many scans right now — wait ' + wait + 's, add your own free key at console.groq.com, or upgrade to Pro for unlimited access.')
    }
    if (res.status === 503) throw new Error(serverMsg || 'AI service temporarily unavailable. Try again in a moment.')
    throw new Error(serverMsg || 'Vision API error ' + res.status)
  }
  var data = await res.json()
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
  if (!content) throw new Error('Empty response from AI vision model. Try again.')
  return parseJSON(content)
}

export async function groqText(prompt, model) {
  var chosenModel = model || CODEX_MODEL
  var useProxy = !state.KEY
  var url = useProxy ? '/api/groq' : 'https://api.groq.com/openai/v1/chat/completions'
  var headers = useProxy
    ? {'Content-Type':'application/json'}
    : {'Authorization':'Bearer '+state.KEY, 'Content-Type':'application/json'}
  var res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: chosenModel,
      messages: [{role:'user', content:prompt}],
      temperature: 0.1, max_tokens: 600
    })
  })
  if (!res.ok) {
    var rtBody = await res.text().catch(function(){return'{}'})
    var rtErr = {}; try { rtErr = JSON.parse(rtBody) } catch(ex) {}
    var rtMsg = (rtErr.error && typeof rtErr.error === 'string') ? rtErr.error
              : (rtErr.error && rtErr.error.message) ? rtErr.error.message : null
    if (res.status === 401) throw new Error('Invalid API key — check at console.groq.com')
    if (res.status === 429) {
      if (rtMsg && rtMsg.length > 60) throw new Error(rtMsg)
      var wait = parseInt(res.headers.get('retry-after') || '30', 10)
      throw new Error('Too many scans right now — wait ' + wait + 's, add your own free key at console.groq.com, or upgrade to Pro for unlimited access.')
    }
    if (res.status >= 400 && chosenModel !== HAIKU_MODEL) {
      var fb = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: HAIKU_MODEL,
          messages: [{role:'user', content:prompt}],
          temperature: 0.1, max_tokens: 600
        })
      })
      if (!fb.ok) throw new Error('AI text API error ' + fb.status)
      var fd = await fb.json()
      var fc = fd.choices && fd.choices[0] && fd.choices[0].message && fd.choices[0].message.content
      if (!fc) throw new Error('Empty fallback response from AI. Try again.')
      return parseJSON(fc)
    }
    throw new Error(rtMsg || 'AI text API error ' + res.status)
  }
  var data = await res.json()
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
  if (!content) throw new Error('Empty response from AI. Try again.')
  return parseJSON(content)
}
