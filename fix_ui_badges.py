with open('src/ui.js', encoding='utf-8') as f:
    c = f.read()

# Find end of renderProfilePage and inject badges
OLD = "    } else {\n      olxStatus.textContent = 'Link your OLX account to speed up selling \u2014 shows your profile in deal alerts'\n    }\n  }\n}\n\nexport async function saveProfilePhone() {"

NEW = """    } else {
      olxStatus.textContent = 'Link your OLX account to speed up selling \u2014 shows your profile in deal alerts'
    }
  }

  var _bd = [
    { icon:'\U0001f3af', name:'First Scan',     desc:'Scanned your first car',       fn:function(){return ((state.userProfile&&state.userProfile.total_scans)||0)>=1} },
    { icon:'\U0001f4e6', name:'10 Cars',        desc:'Added 10 cars to collection',  fn:function(){return state.collection.length>=10} },
    { icon:'\U0001f3c6', name:'50 Cars',        desc:'Serious collector \u2014 50 cars',  fn:function(){return state.collection.length>=50} },
    { icon:'\U0001f4b0', name:'\u20B95K Club',       desc:'Collection worth \u20B95,000+',     fn:function(){var v=0;state.collection.forEach(function(x){v+=parseINR(x.india_collector_inr)});return v>=5000} },
    { icon:'\U0001f48e', name:'\u20B950K Collector', desc:'Collection worth \u20B950,000+',    fn:function(){var v=0;state.collection.forEach(function(x){v+=parseINR(x.india_collector_inr)});return v>=50000} },
    { icon:'\u2b50', name:'STH Hunter',     desc:'Found a Super Treasure Hunt',  fn:function(){return state.collection.some(function(x){return(x.rarity||'').toLowerCase().includes('super treasure')})} },
    { icon:'\U0001f525', name:'TH Tracker',     desc:'Found a Treasure Hunt',        fn:function(){return state.collection.some(function(x){return(x.rarity||'').toLowerCase().includes('treasure hunt')})} },
    { icon:'\U0001f525', name:'7-Day Streak',   desc:'Scanned 7 days in a row',      fn:function(){return (JSON.parse(localStorage.getItem('hs_streak')||'{"count":0}').count||0)>=7} },
    { icon:'\U0001f465', name:'Referrer',       desc:'Referred a friend',             fn:function(){return !!(state.userProfile&&(state.userProfile.referral_count||0)>0)} },
  ]
  var _bEl = document.getElementById('prof-badges')
  if (_bEl) {
    var _earn = _bd.filter(function(b){try{return b.fn()}catch(e){return false}})
    var _lock = _bd.filter(function(b){try{return !b.fn()}catch(e){return true}})
    _bEl.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Achievements '+_earn.length+'/'+_bd.length+'</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+
      _earn.map(function(b){return '<div title="'+b.desc+'" style="background:linear-gradient(135deg,rgba(255,214,10,.15),rgba(255,214,10,.05));border:1px solid rgba(255,214,10,.3);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px"><span style="font-size:20px">'+b.icon+'</span><div><div style="font-size:12px;font-weight:700">'+b.name+'</div><div style="font-size:10px;color:rgba(255,255,255,.5)">'+b.desc+'</div></div></div>'}).join('')+
      _lock.map(function(b){return '<div title="'+b.desc+' (locked)" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:8px;opacity:.35;filter:grayscale(1)"><span style="font-size:20px">'+b.icon+'</span><div><div style="font-size:12px;font-weight:700">'+b.name+'</div><div style="font-size:10px;color:rgba(255,255,255,.5)">'+b.desc+'</div></div></div>'}).join('')+
      '</div>'
  }
}

export async function saveProfilePhone() {"""

print('badges:', 'FOUND' if OLD in c else 'NOT FOUND')
c = c.replace(OLD, NEW)
with open('src/ui.js', 'w', encoding='utf-8') as f:
    f.write(c)
print('done')
