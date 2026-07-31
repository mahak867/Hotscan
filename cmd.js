/* HotScan command bar — vanilla, no build step */
(function(){
  var bar=document.getElementById('hs-cmd'), inp=document.getElementById('hs-cmd-input'),
      panel=document.getElementById('hs-cmd-panel'), scroll=document.getElementById('hs-cmd-scroll'),
      scrim=document.getElementById('hs-cmd-scrim'), clr=document.getElementById('hs-cmd-clear')
  if(!bar||!inp||!panel) return
  var rows=[], sel=-1, t=null

  // The short placeholder is the one that fits a 375px header. Widen the copy
  // only once there is room for it — CSS cannot swap placeholder text.
  try{ if(window.matchMedia('(min-width:520px)').matches) inp.placeholder='Search your collection and the marketplace' }catch(e){}

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function hi(s,q){ s=esc(s); if(!q) return s
    var i=s.toLowerCase().indexOf(q.toLowerCase()); if(i<0) return s
    return s.slice(0,i)+'<mark>'+s.slice(i,i+q.length)+'</mark>'+s.slice(i+q.length) }
  function col(){ try{ return JSON.parse(localStorage.getItem('hs_col')||'[]') }catch(e){ return [] } }
  function listings(){ return window.__hsListings||[] }

  function open(){ panel.classList.add('open'); scrim.classList.add('open'); inp.setAttribute('aria-expanded','true') }
  function close(){ panel.classList.remove('open'); scrim.classList.remove('open'); inp.setAttribute('aria-expanded','false'); sel=-1; inp.blur() }

  function go(page){ close(); if(window.goPage) window.goPage(page) }
  function openCollection(q){
    go('collection')
    var f=document.getElementById('col-search'); if(f) f.value=q||''
    if(window.searchCol) window.searchCol(q||'')
  }
  function openMarket(q){
    go('marketplace')
    var f=document.getElementById('mp-search'); if(f){ f.value=q||''; f.dispatchEvent(new Event('input',{bubbles:true})) }
  }

  function render(q){
    var html='', n=0
    rows=[]
    if(!q){
      html+='<div class="cmd-sec">Jump to</div>'
      html+=row({t:'My Collection',s:col().length+' cars saved',ic:'🚗',act:function(){go('collection')}})
      html+=row({t:'Marketplace',s:'Buy and sell with Indian collectors',ic:'🏪',act:function(){go('marketplace')}})
      html+=row({t:'Scan a car',s:'Identify a casting from a photo',ic:'📷',act:function(){go('scan')}})
      scroll.innerHTML=html; bind(); return
    }
    var ql=q.toLowerCase()
    var mine=col().filter(function(c){
      return [c.name,c.series,c.rarity,c.color,c.casting_year].some(function(v){
        return String(v==null?'':v).toLowerCase().indexOf(ql)>=0 }) }).slice(0,5)
    var mkt=listings().filter(function(l){
      return [l.name,l.rarity,l.city,l.condition,l.seller_name].some(function(v){
        return String(v==null?'':v).toLowerCase().indexOf(ql)>=0 }) }).slice(0,4)

    if(mine.length){
      html+='<div class="cmd-sec">In your collection<b>'+mine.length+'</b></div>'
      mine.forEach(function(c){ n++
        html+=row({t:hi(c.name,q),s:[c.series,c.rarity,c.casting_year].filter(Boolean).join(' · '),
          img:c.image,ic:'🚗',v:c.india_collector_inr||'',act:function(){openCollection(c.name)}}) })
    }
    html+='<div class="cmd-sec">On the marketplace'+(mkt.length?'<b>'+mkt.length+'</b>':'')+'</div>'
    mkt.forEach(function(l){ n++
      html+=row({t:hi(l.name,q),s:[l.rarity,l.condition,l.city].filter(Boolean).join(' · '),
        img:l.image_thumb,ic:'🏪',v:'₹'+Number(l.price||0).toLocaleString('en-IN'),vc:'mp',
        act:function(){openMarket(l.name)}}) })
    html+=row({t:'Search marketplace for “'+esc(q)+'”',s:'Open Marketplace with this filter',ic:'🔎',act:function(){openMarket(q)}})

    if(!mine.length&&!mkt.length) html='<div class="cmd-sec">In your collection<b>0</b></div><div class="cmd-empty"><span>🔍</span>No car in your garage matches “'+esc(q)+'”</div>'+html.slice(html.indexOf('<div class="cmd-sec">On the marketplace'))
    scroll.innerHTML=html; bind()
  }

  var acts=[]
  function row(o){
    acts.push(o.act)
    var thumb=o.img?'<span class="cmd-thumb"><img src="'+esc(o.img)+'" alt="" onerror="this.remove()"></span>'
                    :'<span class="cmd-thumb">'+(o.ic||'🚗')+'</span>'
    return '<button class="cmd-row" type="button" role="option" data-i="'+(acts.length-1)+'">'+thumb+
      '<span class="cmd-body"><span class="cmd-t">'+o.t+'</span>'+(o.s?'<span class="cmd-s">'+esc(o.s)+'</span>':'')+'</span>'+
      (o.v?'<span class="cmd-v '+(o.vc||'')+'">'+esc(o.v)+'</span>':'')+'</button>'
  }
  function bind(){
    rows=[].slice.call(scroll.querySelectorAll('.cmd-row')); sel=-1
    rows.forEach(function(r){ r.onclick=function(){ var f=acts[+r.dataset.i]; if(f) f() } })
  }
  function move(d){
    if(!rows.length) return
    if(sel>=0) rows[sel].classList.remove('sel')
    sel=(sel+d+rows.length)%rows.length
    rows[sel].classList.add('sel'); rows[sel].scrollIntoView({block:'nearest'})
  }

  inp.addEventListener('focus',function(){ acts=[]; render(inp.value.trim()); open() })
  inp.addEventListener('input',function(){
    bar.classList.toggle('has-text',!!inp.value)
    clearTimeout(t); t=setTimeout(function(){ acts=[]; render(inp.value.trim()); open() },110)
  })
  inp.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){e.preventDefault();move(1)}
    else if(e.key==='ArrowUp'){e.preventDefault();move(-1)}
    else if(e.key==='Enter'){ if(sel>=0){e.preventDefault();rows[sel].click()} }
    else if(e.key==='Escape'){e.preventDefault(); if(inp.value){inp.value='';bar.classList.remove('has-text');acts=[];render('')} else close()}
  })
  clr.addEventListener('click',function(){ inp.value=''; bar.classList.remove('has-text'); acts=[]; render(''); inp.focus() })
  scrim.addEventListener('click',close)
  document.addEventListener('click',function(e){
    if(panel.classList.contains('open')&&!e.target.closest('#hs-cmd')&&!e.target.closest('#hs-cmd-panel')) close()
  })
  document.addEventListener('keydown',function(e){
    var tag=(e.target.tagName||'').toLowerCase()
    if(e.key==='/'&&tag!=='input'&&tag!=='textarea'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){ e.preventDefault(); inp.focus() }
    if((e.key==='k'||e.key==='K')&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); inp.focus() }
  })
})()
