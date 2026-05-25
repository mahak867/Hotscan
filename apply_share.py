with open('src/ui.js', encoding='utf-8') as f:
    c = f.read()

start = c.find('export function shareCollection')
if start == -1:
    start = c.find('export async function shareCollection')

depth = 0
found_end = None
for i in range(start, len(c)):
    if c[i] == '{': depth += 1
    elif c[i] == '}':
        depth -= 1
        if depth == 0:
            found_end = i + 1
            break

NEW = r"""export async function shareCollection() {
  var total = state.collection.length
  if (total === 0) { showToast('Add some cars first!', 'error'); return }
  var val = 0; state.collection.forEach(function(c){val+=parseINR(c.india_collector_inr)})
  var sth = state.collection.filter(function(c){return(c.rarity||'').toLowerCase().includes('super treasure')}).length
  var th  = state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('treasure hunt')&&!r.includes('super')}).length
  var rare= state.collection.filter(function(c){var r=(c.rarity||'').toLowerCase();return r.includes('rare')||r.includes('error')||r.includes('vintage')}).length
  var avg = total ? Math.round(val/total) : 0
  showToast('Generating share card\u2026', 'success')
  setTimeout(async function() {
    var W=1080,H=1080,cvs=document.createElement('canvas')
    cvs.width=W; cvs.height=H
    var ctx=cvs.getContext('2d')
    var bg=ctx.createLinearGradient(0,0,W,H)
    bg.addColorStop(0,'#0a0a0a'); bg.addColorStop(0.6,'#111827'); bg.addColorStop(1,'#0a0a0a')
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
    ctx.fillStyle='#E63946'; ctx.fillRect(0,0,W,8)
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1
    for(var gx=0;gx<W;gx+=60){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke()}
    for(var gy=0;gy<H;gy+=60){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke()}
    ctx.fillStyle='#E63946'; ctx.beginPath(); ctx.roundRect(60,48,160,54,27); ctx.fill()
    ctx.fillStyle='#fff'; ctx.font='bold 26px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('HOTSCAN',140,75)
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='500 24px -apple-system,sans-serif'
    ctx.textAlign='left'; ctx.fillText('INDIA',232,75)
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='500 30px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='alphabetic'
    ctx.fillText('MY HOT WHEELS COLLECTION',W/2,175)
    ctx.fillStyle='#FFD60A'; ctx.font='900 120px -apple-system,sans-serif'
    ctx.fillText('\u20B9'+val.toLocaleString('en-IN'),W/2,320)
    ctx.fillStyle='rgba(255,214,10,0.45)'; ctx.font='500 26px -apple-system,sans-serif'
    ctx.fillText('Estimated Collection Value',W/2,368)
    ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(80,408); ctx.lineTo(W-80,408); ctx.stroke()
    var stats=[{l:'Cars',v:String(total),c:'#fff'},{l:'Super THs',v:String(sth),c:'#FFD60A'},{l:'Avg',v:'\u20B9'+avg.toLocaleString('en-IN'),c:'#4CC9F0'},{l:'Rare+',v:String(rare+th),c:'#FF6B6B'}]
    var bW=220,bH=140,gap=16,sX=(W-4*bW-3*gap)/2,sY=438
    stats.forEach(function(s,i){
      var bx=sX+i*(bW+gap),by=sY
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.roundRect(bx,by,bW,bH,18); ctx.fill()
      ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(bx,by,bW,bH,18); ctx.stroke()
      ctx.fillStyle=s.c; ctx.font='800 50px -apple-system,sans-serif'
      ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.fillText(s.v,bx+bW/2,by+82)
      ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='500 21px -apple-system,sans-serif'; ctx.fillText(s.l,bx+bW/2,by+115)
    })
    var carsImg=state.collection.filter(function(c){return c.image}).slice(0,6)
    var gY=628,iSz=148,iG=16,tW=6*iSz+5*iG,gX=(W-tW)/2
    await Promise.all([0,1,2,3,4,5].map(function(i){
      return new Promise(function(res){
        var car=carsImg[i]
        if(!car){
          ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.fill()
          ctx.font='60px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText(['🚗','🏎','🚙','🚕','🛻','🚐'][i],gX+i*(iSz+iG)+iSz/2,gY+iSz/2); res(); return
        }
        var img=new Image(); img.crossOrigin='anonymous'
        img.onload=function(){
          ctx.save(); ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.clip()
          ctx.drawImage(img,gX+i*(iSz+iG),gY,iSz,iSz); ctx.restore()
          ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1
          ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.stroke(); res()
        }
        img.onerror=function(){
          ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.roundRect(gX+i*(iSz+iG),gY,iSz,iSz,14); ctx.fill()
          ctx.font='60px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
          ctx.fillText('🚗',gX+i*(iSz+iG)+iSz/2,gY+iSz/2); res()
        }
        img.src=car.image
      })
    }))
    ctx.fillStyle='rgba(230,57,70,0.18)'; ctx.beginPath(); ctx.roundRect(W/2-200,836,400,64,32); ctx.fill()
    ctx.strokeStyle='rgba(230,57,70,0.45)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect(W/2-200,836,400,64,32); ctx.stroke()
    ctx.fillStyle='#fff'; ctx.font='600 26px -apple-system,sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('hotscan.in \u00B7 Free AI Scanner',W/2,868)
    cvs.toBlob(async function(blob){
      var file=new File([blob],'hotscan-collection.png',{type:'image/png'})
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:'My HotScan Collection',text:'\u20B9'+val.toLocaleString('en-IN')+' \u00B7 '+total+' cars \u00B7 hotscan.in'});return}catch(e){}
      }
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob)
      a.download='hotscan-collection.png'; a.click()
      showToast('Image saved! Share to Instagram or WhatsApp Stories.','success')
    },'image/png')
  }, 50)
}"""

c = c[:start] + NEW + c[found_end:]
with open('src/ui.js', 'w', encoding='utf-8') as f:
    f.write(c)
print('done, new length:', len(c))
