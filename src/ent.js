/* ---------- entities & keywords: organisasi, lokasi, tempat/place, term, #hashtag ---------- */
var ECATS=[['person','Person','#a3e635'],['news','News Site','#fb923c'],['org','Organisasi','#60a5fa'],['loc','Lokasi','#34d399'],['place','Tempat','#fbbf24'],['term','Term','#c084fc'],['hashtag','#Hashtag','#f472b6']];
var ECAT={account:{name:'Account',color:'#94a3b8'}};ECATS.forEach(function(c){ECAT[c[0]]={name:c[1],color:c[2]};});
var EINPUT={person:'ePerson',news:'eNews',org:'eOrg',loc:'eLoc',place:'ePlace',term:'eTerm',hashtag:'eTag'};
/* node types: shape per type */
var NTYPES=[['account','Account','circle'],['person','Person','star'],['news','News Site','square'],['org','Organisasi','diamond'],['loc','Lokasi','triangle'],['place','Tempat','tridown'],['term','Term','pentagon'],['hashtag','#Hashtag','hexagon']];
var NSHAPE={};NTYPES.forEach(function(t){NSHAPE[t[0]]=t[2];});
state.types=new Map();state.canon=new Map();
function isEnt(lbl){return lbl&&lbl.charCodeAt(0)===0x27E8;}
function entKeyOf(lbl){return lbl.slice(1,-1);}
function nodeType(lbl){if(isEnt(lbl))return entKeyOf(lbl).split('|')[0];return state.types.get(lbl)||'account';}
function dispLabel(lbl){return isEnt(lbl)?entName(entKeyOf(lbl)):'@'+lbl;}
function typeBadge(t){return '<span class="ebadge" style="color:'+ECAT[t].color+';border-color:'+ECAT[t].color+'55">'+ECAT[t].name+'</span>';}
function shapePath(x,shape,cx,cy,r){
  x.beginPath();
  if(shape==='circle'){x.arc(cx,cy,r,0,6.2832);return;}
  if(shape==='square'){var s=r*0.9;x.rect(cx-s,cy-s,2*s,2*s);return;}
  if(shape==='star'){for(var si=0;si<10;si++){var ang=-Math.PI/2+si*Math.PI/5,rr=(si%2?0.55:1.3)*r,sx=cx+Math.cos(ang)*rr,sy=cy+Math.sin(ang)*rr;if(si)x.lineTo(sx,sy);else x.moveTo(sx,sy);}x.closePath();return;}
  var pts=shape==='diamond'?[[0,-1.25],[1.1,0],[0,1.25],[-1.1,0]]:shape==='triangle'?[[0,-1.25],[1.15,0.75],[-1.15,0.75]]:shape==='tridown'?[[0,1.25],[1.15,-0.75],[-1.15,-0.75]]:null;
  if(!pts){var k=shape==='pentagon'?5:6;pts=[];for(var i=0;i<k;i++){var a=-Math.PI/2+i*2*Math.PI/k;pts.push([Math.cos(a)*1.1,Math.sin(a)*1.1]);}}
  pts.forEach(function(p,i){var px=cx+p[0]*r,py=cy+p[1]*r;if(i)x.lineTo(px,py);else x.moveTo(px,py);});x.closePath();
}
function mapAtype(v){v=String(v||'').trim().toLowerCase();if(/news|media|berita|portal|pers|outlet/.test(v))return 'news';if(/org|lembaga|instansi|institus|partai|pemerintah|official|resmi|komunitas/.test(v))return 'org';if(/pribadi|individu|person|personal|tokoh|figur|politisi|influencer|pejabat|private/.test(v))return 'person';if(/akun|account|user|umum|lainnya/.test(v))return 'account';return null;}
var LTYPES=[['cooc_ne','cooc','Named Entity ↔ Named Entity','#38bdf8','Person, Organisasi, News Site, Lokasi, Tempat yang disebut dalam teks yang sama'],
  ['cooc_tag','cooc','Hashtag ↔ Hashtag','#f472b6','hashtag yang dipakai bersama dalam satu teks'],
  ['q_acc','quote','Account → akun dikutip','#facc15','baris type = quote (quote tweet/kutipan)'],
  ['q_media','quote','Media → Named Entity','#fb923c','akun News Site menyebut Person/Organisasi/Lokasi/Tempat'],
  ['q_term','quote','Akun → Term','#c084fc','akun menyebut term'],
  ['q_tag','quote','Akun → Hashtag','#f9a8d4','akun memakai hashtag']];
var LT={};LTYPES.forEach(function(l){LT[l[0]]={fam:l[1],name:l[2],color:l[3],desc:l[4]};});
state.links={};var ALLON={};LTYPES.forEach(function(l){state.links[l[0]]=true;ALLON[l[0]]=true;});state.linkRecalc=false;
function linkVisible(e){if(!e.lt)return true;for(var k in e.lt)if(state.links[k])return true;return false;}
function isLinkNet(n){return n==='cooc'||n==='quote';}
function linkVisSet(g){if(!isLinkNet(state.net)||state.linkRecalc)return null;var hv=new Set();g.edges.forEach(function(ed){if(linkVisible(ed)){hv.add(ed.s);hv.add(ed.t);}});return hv;}
var NECAT={person:1,org:1,news:1,loc:1,place:1};
var MENTION_RE=/(^|[^A-Za-z0-9_@.\/])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)/g;
function linkRecords(recs){
  var on=state.linkRecalc?state.links:ALLON,out=[];
  function nid(k){return state.canon.get(k)||('\u27E8'+k+'\u27E9');}
  recs.forEach(function(r){
    if(r.text&&r.text.indexOf('@')>=0){var seen=new Set(),m;MENTION_RE.lastIndex=0;
      var skip=(r.type==='reply'||r.type==='retweet'||r.type==='quote')?r.t:null;
      while((m=MENTION_RE.exec(r.text))){var h=SNA.normUser(m[2]);if(!h||h===r.a||h===skip||seen.has(h))continue;seen.add(h);out.push({a:r.a,t:h,type:'mention',ts:r.ts,p:r.p,s:r.s,lab:r.lab,ps:1,lt:'mention'});}}
    if(!r.ents||!r.text||!r.text.trim())return;
    var ne=[],tags=[],terms=[];
    r.ents.forEach(function(k){var c=k.split('|')[0];if(NECAT[c])ne.push(k);else if(c==='hashtag')tags.push(k);else if(c==='term')terms.push(k);});
    function push(a,t,type,lt){if(!t||a===t)return;out.push({a:a,t:t,type:type,ts:r.ts,p:r.p,s:r.s,lab:r.lab,ps:1,lt:lt});}
    function pairs(arr,lt){var ids=Array.from(new Set(arr.map(nid)));for(var i=0;i<ids.length;i++)for(var j=i+1;j<ids.length;j++){push(ids[i],ids[j],'cooc',lt);push(ids[j],ids[i],'cooc',lt);}}
    if(on.cooc_ne&&ne.length>1)pairs(ne,'cooc_ne');
    if(on.cooc_tag&&tags.length>1)pairs(tags,'cooc_tag');
    if(on.q_media&&nodeType(r.a)==='news')ne.forEach(function(k){push(r.a,nid(k),'quote','q_media');});
    if(on.q_term)terms.forEach(function(k){push(r.a,nid(k),'quote','q_term');});
    if(on.q_tag)tags.forEach(function(k){push(r.a,nid(k),'quote','q_tag');});
  });
  return out;
}
state.fams={mention:true,retweet:true,reply:true};
function famOn(f){if(state.fams.hasOwnProperty(f))return state.fams[f];if(!LTYPES.some(function(l){return l[1]===f;}))return true;return LTYPES.some(function(l){return l[1]===f&&state.links[l[0]];});}
function updateLinkCounts(){
  var c={mention:0,retweet:0,reply:0,cooc:0,quote:0};
  if(state.all){var ps=state.plat==='all'?state.all.platforms:[state.plat];
    ps.forEach(function(p){['mention','retweet','reply','cooc','quote'].forEach(function(n){var d=state.all.res[p]&&state.all.res[p][n];if(!d)return;d.g.edges.forEach(function(ed){c[n]+=ed.w;});});});
    c.cooc/=2;}
  ['mention','retweet','reply','cooc','quote'].forEach(function(f){var el=$('ltc_'+f);if(el){el.textContent=fmt(c[f]);var lb=el.closest('label');if(lb){if(!lb.dataset.t0)lb.dataset.t0=lb.title;lb.title=lb.dataset.t0+(state.all?' · '+fmt(c[f])+' link':'');}}});
  $('ltScope').textContent='';
}
function updateLinkChips(){$('gLinks').classList.add('hide');}
function onFamChange(f,on){
  if(state.fams.hasOwnProperty(f))state.fams[f]=on;else LTYPES.forEach(function(l){if(l[1]===f)state.links[l[0]]=on;});
  document.querySelectorAll('.lfam').forEach(function(i){i.checked=famOn(i.dataset.f);i.closest('.ntrow').classList.toggle('off',!i.checked);});
  if(!state.all||state.plat==='all')return;
  if(on&&hasNet(state.plat,f)){show(f,false);toast('Jaringan '+netName(state.plat,f)+' aktif.');ensureGraphVisible();}
  else if(!on&&state.net===f){var nx=netsOf(state.plat)[0];if(nx)show(nx,false);toast('Jaringan '+netName(state.plat,f)+' dinonaktifkan.');}
  else{show(state.net,false);if(on)toast('Tidak ada data '+netName(state.plat,f)+' di '+pName(state.plat)+'.');}
}
document.querySelectorAll('.lfam').forEach(function(i){i.onchange=function(){onFamChange(i.dataset.f,i.checked);};});

state.ent={list:[],meta:new Map(),mode:'none',focus:null,tab:'all',ovTab:'all',showAll:false,ready:false};
var BND='[^\\p{L}\\p{N}_]';
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function normTag(s){s=String(s).trim().toLowerCase();if(!s)return '';return s[0]==='#'?s:'#'+s;}
function parseDict(cat,txt){
  var out=[];String(txt||'').split(/[\n,;]/).forEach(function(line){
    line=line.trim();if(!line)return;var label,al;
    var ci=line.indexOf(':');if(ci>0&&!/^https?$/i.test(line.slice(0,ci))){label=line.slice(0,ci).trim();al=line.slice(ci+1).split('|');}else{label=line;al=line.split('|');label=al[0];}
    al=al.map(function(a){a=a.trim().toLowerCase();return cat==='hashtag'?normTag(a):a;}).filter(Boolean);
    if(cat==='hashtag')label=normTag(label);
    if(!label||!al.length)return;
    if(al.indexOf(cat==='hashtag'?label:label.toLowerCase())<0)al.push(cat==='hashtag'?label:label.toLowerCase());
    out.push({key:cat+'|'+label.toLowerCase(),cat:cat,label:label,aliases:al,re:al.map(function(a){return{a:a,r:new RegExp('(^|'+BND+')'+escRe(a)+'(?!'+BND.replace('[^','[')+')','iu')};})});
  });
  return out;
}
function entDict(){var all=[];ECATS.forEach(function(c){all=all.concat(parseDict(c[0],$(EINPUT[c[0]]).value));});return all;}
function matchText(lt,ents,set){for(var i=0;i<ents.length;i++){var e=ents[i];for(var j=0;j<e.re.length;j++){var x=e.re[j];if(lt.indexOf(x.a)>=0&&x.r.test(lt)){set.add(e.key);break;}}}}
function entApply(){
  if(!state.records)return Promise.resolve();
  var ents=entDict(),meta=new Map();ents.forEach(function(e){meta.set(e.key,{cat:e.cat,label:e.label,src:'kamus'});});
  // node types for accounts
  var handles=new Set();state.records.forEach(function(r){handles.add(r.a);if(r.t)handles.add(r.t);});
  var types=new Map(),canon=new Map();
  state.records.forEach(function(r){if(r.ext&&r.ext.atype){var t=mapAtype(r.ext.atype);if(t)types.set(r.a,t);}});
  ents.forEach(function(en){if(en.cat!=='news'&&en.cat!=='org'&&en.cat!=='person')return;en.aliases.forEach(function(a){var h=SNA.normUser(a);if(handles.has(h)){types.set(h,en.cat);if(!canon.has(en.key))canon.set(en.key,h);}});});
  String($('eAcc').value||'').split(/[\n,;]/).forEach(function(line){line=line.trim();if(!line)return;var ci=line.indexOf(':'),al=(ci>0?line.slice(ci+1):line).split('|');al.forEach(function(a){var h=SNA.normUser(a);if(h)types.set(h,'account');});});
  state.types=types;state.canon=canon;
  var byCat={};ents.forEach(function(e){(byCat[e.cat]=byCat[e.cat]||[]).push(e);});
  var recs=state.records,N=recs.length,i=0,CH=8000;
  $('gbusy').classList.add('on');
  return new Promise(function(res){(function step(){var e2=Math.min(N,i+CH);
    for(;i<e2;i++){var r=recs[i],set=new Set();
      if(r.text){var lt=r.text.toLowerCase();if(ents.length)matchText(lt,ents,set);}
      if(r.ext){for(var k in r.ext){var v=r.ext[k];
        if(k==='hashtag'){v.split(/[\s,;]+/).forEach(function(t){t=normTag(t);if(t.length<2)return;var kk='hashtag|'+t;set.add(kk);if(!meta.has(kk))meta.set(kk,{cat:'hashtag',label:t,src:'kolom'});});}
        else{v.split(/\s*[;|]\s*/).forEach(function(v){v=v.trim();if(!v)return;var before=set.size,lv=v.toLowerCase();if(byCat[k])matchText(lv,byCat[k],set);
          if(set.size===before){var kk2=k+'|'+lv.replace(/\s+/g,' ').slice(0,80);set.add(kk2);if(!meta.has(kk2))meta.set(kk2,{cat:k,label:v.replace(/\s+/g,' ').slice(0,80),src:'kolom'});}});}}}
      r.ents=set.size?Array.from(set):null;}
    $('gbusyMsg').textContent='Mencocokkan entitas '+fmt(i)+' / '+fmt(N)+'…';
    if(i<N)setTimeout(step,0);else{state.ent.list=ents;state.ent.meta=meta;state.ent.ready=true;$('gbusy').classList.remove('on');entInfo();res();}})();});
}
function entActive(){return state.ent.mode==='any'||!!state.ent.focus;}
function entPass(r){if(state.ent.focus)return !!(r.ents&&r.ents.indexOf(state.ent.focus)>=0);if(state.ent.mode==='any')return !!r.ents;return true;}
function entName(k){var m=state.ent.meta.get(k);return m?m.label:k.split('|').slice(1).join('|');}
function entCat(k){return k.split('|')[0];}
function entInfo(){
  var n=0,rows=0;state.records.forEach(function(r){if(r.ents)rows++;});n=state.ent.meta.size;
  var cols=state.report.extCols||{},ck=Object.keys(cols).filter(function(k){return ECAT[k]||k==='atype';});
  var tc={};state.types.forEach(function(t){tc[t]=(tc[t]||0)+1;});
  $('eInfo').innerHTML='Akun bertipe: '+(['person','news','org','account'].filter(function(t){return tc[t];}).map(function(t){return ECAT[t].name+' <b>'+tc[t]+'</b>';}).join(' · ')||'<span class="sub">belum ada (semua = Account)</span>')+'<br><b>'+fmt(n)+'</b> entitas · <b>'+fmt(rows)+'</b> baris menyebut ≥1 entitas'+(ck.length?'<br>Kolom CSV dipakai: '+ck.map(function(k){return (k==='atype'?'Tipe akun':ECAT[k].name)+' ← <code>'+esc(cols[k])+'</code>';}).join(', '):'')+(entActive()?'<br><span class="warn">Filter aktif: analisis hanya memakai data yang lolos filter entitas.</span>':'');
  var b=$('entBanner');
  if(state.ent.focus){b.classList.remove('hide');b.innerHTML='Fokus entitas: <b>'+esc(entName(state.ent.focus))+'</b> <span class="sub">('+ECAT[entCat(state.ent.focus)].name+')</span> — jaringan, metrik, dan sentimen dihitung hanya dari data yang menyebutnya. <button class="fchip" id="entUnfocus">Hapus fokus ×</button>';$('entUnfocus').onclick=function(){state.ent.focus=null;entInfo();run();};}
  else if(state.ent.mode==='any'){b.classList.remove('hide');b.innerHTML='Filter entitas aktif: hanya data yang menyebut salah satu entitas di daftar. <button class="fchip" id="entUnfocus">Matikan ×</button>';$('entUnfocus').onclick=function(){state.ent.mode='none';$('eMode').value='none';entInfo();run();};}
  else b.classList.add('hide');
}
function entStats(p){
  var mp=new Map();
  state.records.forEach(function(r){if(!r.ents||(p&&r.p!==p)||!inWindow(r))return;
    r.ents.forEach(function(k){var o=mp.get(k);if(!o){o={k:k,n:0,acc:new Set(),c:0,pos:0,neu:0,neg:0,sum:0,ns:0};mp.set(k,o);}
      o.n++;o.acc.add(r.a);if(r.text&&r.text.trim()&&inScope(r))o.c++;if(r.s!=null){o[r.lab]++;o.sum+=r.s;o.ns++;}});});
  return Array.from(mp.values()).sort(function(a,b){return b.n-a.n;});
}
function sbarHtml(o){return o.ns?'<div class="sbar" style="min-width:90px" title="Positif '+pct(o.pos,o.ns)+' · Netral '+pct(o.neu,o.ns)+' · Negatif '+pct(o.neg,o.ns)+' (n='+o.ns+')"><i style="width:'+(100*o.pos/o.ns)+'%;background:'+POS+'"></i><i style="width:'+(100*o.neu/o.ns)+'%;background:'+NEU+'"></i><i style="width:'+(100*o.neg/o.ns)+'%;background:'+NEG+'"></i></div>':'<span class="sub">–</span>';}
function catBadge(c){return '<span class="ebadge" style="color:'+ECAT[c].color+';border-color:'+ECAT[c].color+'55">'+ECAT[c].name+'</span>';}
function renderEntities(p){
  var card=$('entCard');if(!state.ent.ready||!state.ent.meta.size){card.classList.add('hide');return;}
  card.classList.remove('hide');
  var all=entStats(p).filter(function(o){return state.vis[entCat(o.k)]!==false;}),cnt={all:all.length};ECATS.forEach(function(c){cnt[c[0]]=all.filter(function(o){return entCat(o.k)===c[0];}).length;});
  var tab=state.ent.tab;if(tab!=='all'&&!cnt[tab])tab=state.ent.tab='all';
  $('eTabs').innerHTML=[['all','Semua']].concat(ECATS.map(function(c){return[c[0],c[1]];})).map(function(t){return '<button class="segb'+(tab===t[0]?' on':'')+'" data-k="'+t[0]+'"'+(cnt[t[0]]?'':' disabled style="opacity:.4"')+'>'+t[1]+' <span class="ct">'+cnt[t[0]]+'</span></button>';}).join('');
  $('eTabs').querySelectorAll('.segb').forEach(function(b){b.onclick=function(){if(b.disabled)return;state.ent.tab=b.dataset.k;renderEntities(p);};});
  var rows=all.filter(function(o){return tab==='all'||entCat(o.k)===tab;}),lim=state.ent.showAll?200:15,mx=rows.length?rows[0].n:1;
  $('eSub').textContent='· '+pName(p)+' · sebutan di teks'+(Object.keys(state.report.extCols||{}).length?' & kolom CSV':'');
  $('eTable').innerHTML='<thead><tr><th>Entitas</th><th class="r">Sebutan</th><th class="r">Akun</th><th class="r">Komentar</th><th>Sentimen</th><th class="r">Skor</th><th></th></tr></thead><tbody>'+
    (rows.slice(0,lim).map(function(o){var c=entCat(o.k),m=o.ns?o.sum/o.ns:null,f=state.ent.focus===o.k;
      return '<tr class="cl" data-k="'+esc(o.k)+'"><td><b>'+esc(entName(o.k))+'</b> '+catBadge(c)+'</td><td class="r val"><span class="hbar"><i style="width:'+(100*o.n/mx)+'%;background:'+ECAT[c].color+'"></i></span>'+fmt(o.n)+'</td><td class="r val">'+fmt(o.acc.size)+'</td><td class="r val">'+fmt(o.c)+'</td><td>'+sbarHtml(o)+'</td><td class="r val" style="color:'+sentColor(m)+'">'+fmtS(m)+'</td><td class="r" style="white-space:nowrap"><button class="btn sm efocus'+(f?' primary':'')+'" title="Hitung ulang seluruh analisis hanya untuk data yang menyebut entitas ini">'+(f?'Difokuskan':'Fokus')+'</button></td></tr>';}).join('')||'<tr><td colspan="7" class="sub">Tidak ada sebutan di '+pName(p)+'.</td></tr>')+'</tbody>';
  $('eMore').classList.toggle('hide',rows.length<=15);$('eMore').textContent=state.ent.showAll?'Tampilkan lebih sedikit':'Tampilkan semua ('+fmt(rows.length)+')';
  $('eTable').querySelectorAll('tr.cl').forEach(function(tr){var k=tr.dataset.k;tr.onclick=function(e){
    if(e.target.closest('.efocus')){state.ent.focus=state.ent.focus===k?null:k;entInfo();run();return;}
    gotoComments({ent:k});};});
}
$('eMore').onclick=function(){state.ent.showAll=!state.ent.showAll;if(state.plat!=='all')renderEntities(state.plat);};
function renderEntOverview(){
  var card=$('ovEnt');if(!state.ent.ready||!state.ent.meta.size){card.classList.add('hide');return;}
  card.classList.remove('hide');
  var plats=state.all.platforms,tab=state.ent.ovTab,tot=entStats(null).filter(function(o){return state.vis[entCat(o.k)]!==false&&(tab==='all'||entCat(o.k)===tab);}).slice(0,20);
  var per={};plats.forEach(function(p){per[p]=new Map();entStats(p).forEach(function(o){per[p].set(o.k,o);});});
  $('ovETabs').innerHTML=[['all','Semua']].concat(ECATS.map(function(c){return[c[0],c[1]];})).map(function(t){return '<button class="segb'+(tab===t[0]?' on':'')+'" data-k="'+t[0]+'">'+t[1]+'</button>';}).join('');
  $('ovETabs').querySelectorAll('.segb').forEach(function(b){b.onclick=function(){state.ent.ovTab=b.dataset.k;renderEntOverview();};});
  var mx=1;tot.forEach(function(o){plats.forEach(function(p){var x=per[p].get(o.k);if(x&&x.n>mx)mx=x.n;});});
  $('ovETable').innerHTML='<thead><tr><th>Entitas</th>'+plats.map(function(p){return '<th class="r">'+pName(p)+'</th>';}).join('')+'<th class="r">Total</th><th>Sentimen</th></tr></thead><tbody>'+
    (tot.map(function(o){var c=entCat(o.k);return '<tr><td><b>'+esc(entName(o.k))+'</b> '+catBadge(c)+'</td>'+plats.map(function(p){var x=per[p].get(o.k),v=x?x.n:0,a=v/mx;return '<td class="r val hc" data-p="'+p+'" data-k="'+esc(o.k)+'" style="background:rgba(60,98,240,'+(v?0.08+0.5*a:0).toFixed(2)+');cursor:'+(v?'pointer':'default')+'" title="'+(v?'Klik untuk membuka '+pName(p)+' dengan teks yang menyebut '+esc(entName(o.k)):'')+'">'+(v?fmt(v):'<span class="sub">·</span>')+'</td>';}).join('')+'<td class="r val"><b>'+fmt(o.n)+'</b></td><td>'+sbarHtml(o)+'</td></tr>';}).join('')||'<tr><td class="sub" colspan="'+(plats.length+3)+'">Tidak ada sebutan.</td></tr>')+'</tbody>';
  $('ovETable').querySelectorAll('td.hc').forEach(function(td){td.onclick=function(){if(td.textContent.trim()==='·')return;state.plat=td.dataset.p;renderChips();render(true);setTimeout(function(){gotoComments({ent:td.dataset.k});},400);};});
}
var STOP=new Set('yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga ada saya kami kita mereka anda atau sudah bisa karena jadi lebih saja sangat masih oleh agar bagi telah dapat harus para tersebut seperti hanya kalau tapi namun aja gak nya sih kok dong lah deh amp https http yg utk dgn tdk sdh blm juga lagi kalo udah banget bgt mau kan buat sama apa siapa kapan mana gimana bagaimana kenapa mengapa tahu tau baru semua setiap satu dua tiga hari ini akan the and for you that with this are not have from your was but what all can will just they them its our who has been about into more out than then there these those when where which while would could should being because each other some such very also only over most even many much like here really still well back down make made know think want need going good great one two'.split(' '));
$('eAutoTag').onclick=function(){
  if(!state.records){toast('Muat data terlebih dahulu.');return;}
  var c=new Map();state.records.forEach(function(r){if(!r.text)return;var m=r.text.toLowerCase().match(/#[\p{L}\p{N}_]{2,}/gu);if(m)new Set(m).forEach(function(t){c.set(t,(c.get(t)||0)+1);});
    if(r.ext&&r.ext.hashtag)r.ext.hashtag.split(/[\s,;]+/).forEach(function(t){t=normTag(t);if(t.length>2)c.set(t,(c.get(t)||0)+1);});});
  var top=Array.from(c.entries()).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(x){return x[0];});
  if(!top.length){toast('Tidak ditemukan hashtag di teks.');return;}
  var ex=parseDict('hashtag',$('eTag').value).map(function(e){return e.label;});
  $('eTag').value=ex.concat(top.filter(function(t){return ex.indexOf(t)<0;})).join(', ');toast(top.length+' hashtag teratas ditambahkan. Klik Terapkan.');
};
$('eAutoTerm').onclick=function(){
  if(!state.records){toast('Muat data terlebih dahulu.');return;}
  var c=new Map();state.records.forEach(function(r){if(!r.text)return;var ws=r.text.toLowerCase().replace(/https?:\/\/\S+|@\w+|#\S+/g,' ').match(/[\p{L}]{4,}/gu);if(ws)new Set(ws).forEach(function(w){if(!STOP.has(w)&&!SENT.BASE.hasOwnProperty(w))c.set(w,(c.get(w)||0)+1);});});
  var top=Array.from(c.entries()).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(x){return x[0];});
  var ex=parseDict('term',$('eTerm').value).map(function(e){return e.label.toLowerCase();});
  $('eTerm').value=ex.concat(top.filter(function(t){return ex.indexOf(t)<0;})).join(', ');toast('Saran term ditambahkan (kata non-sentimen paling sering). Hapus yang tidak relevan, lalu Terapkan.',5000);
};
$('eApply').onclick=function(){
  if(!state.records){toast('Muat data terlebih dahulu.');return;}
  state.ent.mode=$('eMode').value;
  if(state.ent.focus&&!state.ent.meta.has(state.ent.focus))state.ent.focus=null;
  entApply().then(function(){entInfo();run();toast('Node types diterapkan.');});
};
$('eExport').onclick=function(){
  if(!state.ent.ready||!state.all){toast('Belum ada entitas.');return;}
  var L=['platform,kategori,entitas,sumber,sebutan,akun_unik,komentar,positif,netral,negatif,skor_rata2'];
  state.all.platforms.forEach(function(p){entStats(p).forEach(function(o){var m=state.ent.meta.get(o.k)||{};L.push([csvCell(pName(p)),ECAT[entCat(o.k)].name,csvCell(entName(o.k)),m.src||'',o.n,o.acc.size,o.c,o.pos,o.neu,o.neg,o.ns?(o.sum/o.ns).toFixed(4):''].join(','));});});
  save(fileBase()+'_entitas.csv','﻿'+L.join('\n'),'text/csv');
};

/* ---------- node type checklist (visibility) ---------- */
state.vis={};NTYPES.forEach(function(t){state.vis[t[0]]=true;});
function visOK(lbl){return state.vis[nodeType(lbl)]!==false;}
function updateTypeCounts(){
  var c={};NTYPES.forEach(function(t){c[t[0]]=0;});
  var d=cur();
  if(d){d.g.labels.forEach(function(l){c[nodeType(l)]++;});}
  else if(state.records){var hs=new Set();state.records.forEach(function(r){hs.add(r.a);if(r.t)hs.add(r.t);});hs.forEach(function(h){c[state.types.get(h)||'account']++;});state.ent.meta.forEach(function(m,k){var cat=k.split('|')[0];if(c[cat]!=null&&!state.canon.has(k))c[cat]++;});}
  NTYPES.forEach(function(t){var el=$('ntc_'+t[0]);if(el)el.textContent=fmt(c[t[0]]);});
  var box=$('gTypes');
  if(d){var present=NTYPES.filter(function(t){return c[t[0]];});
    box.classList.toggle('hide',present.length<2);
    box.innerHTML='<span class="sub" style="align-self:center">Tampilkan:</span>'+present.map(function(t){var on=state.vis[t[0]]!==false;return '<label class="gtc'+(on?'':' off')+'"><input type="checkbox" data-t="'+t[0]+'"'+(on?' checked':'')+'><svg width="11" height="11"><path d="'+shapeSvg(t[2])+'" fill="'+ECAT[t[0]].color+'"/></svg>'+t[1]+' <span class="sub">'+fmt(c[t[0]])+'</span></label>';}).join('');
    box.querySelectorAll('input').forEach(function(i){i.onchange=function(){state.vis[i.dataset.t]=i.checked;onVisChange();};});}
  else box.classList.add('hide');
}
function syncVisUI(){document.querySelectorAll('.ntv').forEach(function(i){i.checked=state.vis[i.dataset.t]!==false;i.closest('.ntrow').classList.toggle('off',!i.checked);});}
function onVisChange(){
  syncVisUI();
  if(!state.all)return;
  if(state.plat==='all'){renderEntOverview();updateTypeCounts();return;}
  var d=cur();updateTypeCounts();buildView();if(d)renderTables(d.g,d.m);renderEntities(state.plat);
}
document.querySelectorAll('.ntv').forEach(function(i){i.onchange=function(){state.vis[i.dataset.t]=i.checked;onVisChange();};});
document.querySelectorAll('.ntedit').forEach(function(b){b.onclick=function(){var ta=$(b.dataset.x);ta.classList.toggle('hide');b.textContent=ta.classList.contains('hide')?'Atur':'Tutup';if(!ta.classList.contains('hide'))ta.focus();};});
$('ntAll').onclick=function(){NTYPES.forEach(function(t){state.vis[t[0]]=true;});onVisChange();};
$('ntAcc').onclick=function(){NTYPES.forEach(function(t){state.vis[t[0]]=t[0]==='account'||t[0]==='person'||t[0]==='news'||t[0]==='org';});onVisChange();};
$('ntEnt').onclick=function(){NTYPES.forEach(function(t){state.vis[t[0]]=t[0]!=='account'&&t[0]!=='person';});onVisChange();};

function ensureGraphVisible(){var r=$('gwrap').getBoundingClientRect();if(r.bottom<80||r.top>window.innerHeight-80)$('gwrap').scrollIntoView({behavior:'smooth',block:'center'});}
