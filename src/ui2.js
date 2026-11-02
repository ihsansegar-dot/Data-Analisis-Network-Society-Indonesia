/* ---------- interactive: key actors ---------- */
state.mTab='pr';state.mTop=10;state.mType='all';
var M_HELP={in:'Jumlah interaksi yang <b>diterima</b> akun (angka kecil = jumlah akun unik).',out:'Jumlah interaksi yang <b>dilakukan</b> akun ke akun lain.',bt:'Seberapa sering akun menjadi <b>jembatan</b> pada jalur terpendek antar akun lain.',pr:'<b>Pengaruh</b>: tinggi bila akun diinteraksi oleh akun yang juga berpengaruh.'};
function hoverNode(i){var n=i==null?null:view.nodes.find(function(x){return x.id===i;})||null;view.hover=n;draw();}
function renderTables(g,m){
  var defs=tableDefs(g,m,state.plat,state.net),keys=['in','out','bt','pr'],ix=keys.indexOf(state.mTab),d=defs[ix];
  $('mTabs').innerHTML=defs.map(function(dd,i){return '<button class="segb'+(i===ix?' on':'')+'" data-k="'+keys[i]+'">'+dd.t+'</button>';}).join('');
  $('mDesc').innerHTML=M_HELP[state.mTab]+' <span class="sub">· '+esc(d.sub)+' · arahkan kursor untuk menyorot node, klik untuk membuka di graf</span>';
  var tcnt={all:0};g.labels.forEach(function(l){var t=nodeType(l);if(state.vis[t]===false)return;tcnt[t]=(tcnt[t]||0)+1;tcnt.all++;});
  if(state.mType!=='all'&&!tcnt[state.mType])state.mType='all';
  var multi=Object.keys(tcnt).length>2;
  $('mTypes').classList.toggle('hide',!multi);
  if(multi){$('mTypes').innerHTML=[['all','Semua tipe']].concat(NTYPES.filter(function(t){return tcnt[t[0]];}).map(function(t){return[t[0],t[1]];})).map(function(t){return '<button class="segb'+(state.mType===t[0]?' on':'')+'" data-t="'+t[0]+'">'+(t[0]!=='all'?'<span class="dot" style="background:'+ECAT[t[0]].color+'"></span>':'')+t[1]+' <span class="ct">'+tcnt[t[0]]+'</span></button>';}).join('');
    $('mTypes').querySelectorAll('.segb').forEach(function(b){b.onclick=function(){state.mType=b.dataset.t;renderTables(g,m);};});}
  var flt=state.mType==='all'?null:state.mType;
  var top=g.labels.map(function(_,i){return i;}).filter(function(i){return visOK(g.labels[i])&&(!state.visNodes||state.visNodes.has(i))&&(!flt||nodeType(g.labels[i])===flt);}).sort(function(a,b){return d.val(b)-d.val(a)||(g.labels[a]<g.labels[b]?-1:1);}).slice(0,state.mTop),mx=top.length?d.val(top[0])||1:1;
  $('mTable').innerHTML='<thead><tr><th>#</th><th>Node</th><th>Tipe</th><th>Komunitas</th><th class="r">'+d.t+'</th></tr></thead><tbody>'+
    (top.map(function(i,r){var v=d.val(i);return '<tr class="cl" data-i="'+i+'"><td class="rk">'+(r+1)+'</td><td class="u"><b>'+esc(dispLabel(g.labels[i]))+'</b></td><td>'+typeBadge(nodeType(g.labels[i]))+'</td><td><span class="dot" style="background:'+commColor(m.community[i])+'"></span> <span class="sub">K'+m.community[i]+'</span></td><td class="r val"><span class="hbar"><i style="width:'+Math.max(2,100*v/mx)+'%"></i></span>'+d.f(i)+(d.extra?' <span class="sub">'+d.extra(i)+'</span>':'')+'</td></tr>';}).join('')||'<tr><td colspan="5" class="sub">Tidak ada data</td></tr>')+'</tbody>';
  $('mTabs').querySelectorAll('.segb').forEach(function(b){b.onclick=function(){state.mTab=b.dataset.k;renderTables(g,m);};});
  $('mTable').querySelectorAll('tr.cl').forEach(function(tr){var i=+tr.dataset.i;
    tr.onmouseenter=function(){hoverNode(i);};tr.onmouseleave=function(){hoverNode(null);};
    tr.onclick=function(){focusNode(i);$('gwrap').scrollIntoView({behavior:'smooth',block:'center'});};});
}
$('mTop').onchange=function(){state.mTop=+this.value;var d=cur();if(d)renderTables(d.g,d.m);};

/* ---------- interactive: sentiment panel ---------- */
state.sTab='sum';state.wTab='neg';state.aTab='rcv';state.eTab='neg';
function xfReset(){state.xf={q:'',lab:'',f:'',sort:'time',day:null,word:null,actor:null,role:null,ent:null};}
xfReset();
function gotoComments(f){xfReset();for(var k in f)state.xf[k]=f[k];state.xPage=0;state.sTab='all';renderSentTabs();$('sentCard').scrollIntoView({behavior:'smooth',block:'start'});}
function textRecs(p){return state.records.filter(function(r){return r.p===p&&inWindow(r)&&inScope(r)&&r.text&&r.text.trim();});}
function renderSentiment(p){
  var st=sentStats(p);state.lastSent={p:p,st:st,words:null};
  $('sentSub').innerHTML='· '+pName(p)+' · '+(state.sent.scope==='all'?'semua teks':'komentar/reply')+' · sumber: '+srcName();
  state.xPage=0;xfReset();
  renderSentTabs();
}
function renderSentTabs(){
  var p=state.lastSent.p,st=state.lastSent.st,nAll=textRecs(p).length;
  var tabs=[['sum','Ringkasan'],['words','Kata'],['actpos','Aktor positif'],['actors','Aktor negatif'],['actneu','Aktor netral'],['ex','Contoh'],['all','Semua komentar <span class="ct">'+fmt(nAll)+'</span>']];
  $('sTabs').innerHTML=tabs.map(function(t){return '<button class="segb'+(state.sTab===t[0]?' on':'')+'" data-k="'+t[0]+'">'+t[1]+'</button>';}).join('');
  $('sTabs').querySelectorAll('.segb').forEach(function(b){b.onclick=function(){state.sTab=b.dataset.k;renderSentTabs();};});
  var pane=state.sTab==='actpos'||state.sTab==='actneu'?'actors':state.sTab;
  ['sum','words','actors','ex','all'].forEach(function(k){$('sp-'+k).classList.toggle('hide',pane!==k);});
  ({sum:paneSum,words:paneWords,actors:paneActors,actpos:paneActors,actneu:paneActors,ex:paneEx,all:renderExplorer})[state.sTab](p,st);
}
function emptySentMsg(p){var cvg=aiCoverage(p);return '<div class="sub" style="padding:10px 0">'+(state.sent.source==='ai'?'Belum ada teks '+pName(p)+' yang diklasifikasi Claude AI ('+fmt(cvg.done)+' / '+fmt(cvg.total)+'). Klik “Klasifikasi” di panel Sentimen (kiri).':state.sent.source==='column'?'Belum ada teks berlabel manual untuk '+pName(p)+'.':'Tidak ada teks bersentimen untuk '+pName(p)+'. Pastikan kolom <code>text</code> terisi pada baris komentar.')+'</div>';}
function paneSum(p,st){
  renderAgreement(p);
  if(!st.n){$('sentDist').innerHTML=emptySentMsg(p);$('sentMeta').innerHTML='';$('sentTrend').innerHTML='';return;}
  $('sentDist').innerHTML=['pos','neu','neg'].map(function(l){return '<button class="drow" data-l="'+l+'" title="Klik untuk melihat semua teks '+labName(l).toLowerCase()+'"><span class="dl">'+labName(l)+'</span><span class="track"><i style="width:'+(100*st[l]/st.n)+'%;background:'+labColor(l)+'"></i></span><span class="dn"><b>'+pct(st[l],st.n)+'</b> <span class="sub">'+fmt(st[l])+'</span></span><span class="go">›</span></button>';}).join('');
  $('sentDist').querySelectorAll('.drow').forEach(function(b){b.onclick=function(){gotoComments({lab:b.dataset.l,sort:b.dataset.l==='pos'?'pos':b.dataset.l==='neg'?'neg':'time'});};});
  $('sentMeta').innerHTML='<b>'+fmt(st.n)+'</b> teks · skor rata-rata <b style="color:'+sentColor(st.mean)+'">'+fmtS(st.mean)+'</b> <span class="sub">(−1…+1)</span>'+(state.sent.source==='ai'?' · sarkasme <b>'+fmt(st.recs.filter(function(r){return r.ai&&r.ai.sar;}).length)+'</b>':'')+'<br><span class="sub">Negatif 95% CI '+ciTxt(st.neg,st.n)+' · positif 95% CI '+ciTxt(st.pos,st.n)+(st.n<30?' · ⚠ n kecil':'')+'</span>';
  var days=Array.from(st.days.keys()).sort(),W=560,H=150,pl=28,pb=20,pt=6;
  if(!days.length){$('sentTrend').innerHTML='<div class="sub">created_at tidak tersedia.</div>';return;}
  var mx=d3.max(days,function(d){var o=st.days.get(d);return o.pos+o.neu+o.neg;})||1,bw=(W-pl-6)/days.length,y=d3.scaleLinear().domain([0,mx]).nice().range([H-pb,pt]);
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Tren sentimen harian">';
  y.ticks(4).forEach(function(t){s+='<line x1="'+pl+'" x2="'+(W-4)+'" y1="'+y(t)+'" y2="'+y(t)+'" stroke="#24358a" stroke-width="0.5"/><text x="'+(pl-4)+'" y="'+(y(t)+3)+'" text-anchor="end">'+t+'</text>';});
  days.forEach(function(d,i){var o=st.days.get(d),x=pl+i*bw+bw*0.12,w=Math.max(1,bw*0.76),base=H-pb,tot=o.pos+o.neu+o.neg;
    s+='<g class="dbar" data-d="'+d+'"><rect x="'+(pl+i*bw)+'" y="'+pt+'" width="'+bw+'" height="'+(H-pb-pt)+'" fill="transparent"/>';
    ['neg','neu','pos'].forEach(function(l){if(!o[l])return;var hh=(H-pb)-y(o[l]);s+='<rect x="'+x.toFixed(1)+'" y="'+(base-hh).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+hh.toFixed(1)+'" fill="'+labColor(l)+'"/>';base-=hh;});
    s+='<title>'+d+' · '+tot+' teks — positif '+o.pos+', netral '+o.neu+', negatif '+o.neg+' (klik untuk lihat teksnya)</title></g>';});
  var step=Math.ceil(days.length/6);days.forEach(function(d,i){if(i%step===0)s+='<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-6)+'" text-anchor="middle">'+d.slice(5)+'</text>';});
  $('sentTrend').innerHTML=s+'</svg><div class="sub">Klik batang hari untuk melihat teks pada hari itu.</div>';
  $('sentTrend').querySelectorAll('.dbar').forEach(function(g){g.onclick=function(){gotoComments({day:g.dataset.d});};});
}
state.wTab='all';
var WC_COL={pos:['#16a37f','#2ed3a0','#7cf0c9'],neg:['#d9384a','#f87171','#ffb3b3'],neu:['#3c62f0','#7d9bff','#c3d0ff']};
function cloudLayout(words,W,H){
  var cv=cloudLayout._c||(cloudLayout._c=document.createElement('canvas')),ctx=cv.getContext('2d'),placed=[],out=[];
  function hit(r){for(var i=0;i<placed.length;i++){var q=placed[i];if(r.x<q.x+q.w&&r.x+r.w>q.x&&r.y<q.y+q.h&&r.y+r.h>q.y)return true;}return false;}
  words.forEach(function(w,ix){
    ctx.font='700 '+w.size+'px Inter,system-ui,"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    var tw=ctx.measureText(w.text).width+4,th=w.size*0.92+2,bw=w.rot?th:tw,bh=w.rot?tw:th;
    if(bw>W-8||bh>H-8)return;
    var ok=false,ratio=W/H;
    for(var tt=0;tt<2400;tt++){var a=tt*0.21,rad=1.6*a,x=W/2+rad*Math.cos(a)*ratio*0.9-bw/2,y=H/2+rad*Math.sin(a)-bh/2;
      if(x<4||y<4||x+bw>W-4||y+bh>H-4)continue;var r={x:x,y:y,w:bw,h:bh};if(!hit(r)){placed.push(r);out.push({w:w,cx:x+bw/2,cy:y+bh/2,i:ix});ok=true;break;}}
  });
  return out;
}
function cloudItems(ws,tab){
  var src=tab==='all'?[['pos',ws.pos.slice(0,28)],['neg',ws.neg.slice(0,28)],['neu',ws.neu.slice(0,34)]]:[[tab,ws[tab]]];
  var items=[];src.forEach(function(s){s[1].forEach(function(w){items.push({text:w[0],n:w[1],cls:s[0]});});});
  items.sort(function(a,b){return b.n-a.n;});
  var mx=items.length?items[0].n:1,mn=items.length?items[items.length-1].n:1;
  var big=tab==='all'?54:62,small=12;
  items.forEach(function(it,i){var f=mx===mn?0.6:Math.sqrt((it.n-mn)/(mx-mn));it.size=Math.round(small+(big-small)*f);
    var shades=WC_COL[it.cls];it.color=f>0.66?shades[0]:f>0.3?shades[1]:shades[2];
    if(it.cls==='neu'&&f>0.66)it.color='#eef1ff';
    it.rot=!/\p{Extended_Pictographic}/u.test(it.text)&&it.text.length>3&&i>2&&((i*7)%5===0);});
  return items;
}
function paneWords(p,st){
  var box=$('sp-words');
  var recsAll=textRecs(p);
  if(!recsAll.length){box.innerHTML=emptySentMsg(p);return;}
  if(!state.lastSent.words)state.lastSent.words=wordStats(st.n?st.recs:recsAll);
  var ws=state.lastSent.words,tab=state.wTab,cnt={pos:ws.pos.length,neg:ws.neg.length,neu:ws.neu.length};
  var tabs=[['all','Semua'],['pos','Kata positif'],['neg','Kata negatif'],['neu','Kata netral']];
  box.innerHTML='<div class="seg sm" id="wSeg">'+tabs.map(function(t){return '<button class="segb'+(tab===t[0]?' on':'')+'" data-k="'+t[0]+'">'+(t[0]!=='all'?'<span class="dot" style="background:'+WC_COL[t[0]][1]+'"></span>':'')+t[1]+(t[0]!=='all'?' <span class="ct">'+cnt[t[0]]+'</span>':'')+'</button>';}).join('')+'</div>'+
    '<div class="sub" style="margin:8px 0 10px">Ukuran = jumlah teks yang memuat kata/emoji. Klik untuk membaca teksnya.'+(tab==='neg'||tab==='all'?' “tidak X” = kata positif yang dinegasi.':'')+(tab==='neu'||tab==='all'?' Netral = kata topik di luar leksikon sentimen & stopword, serta emoji tanpa muatan sentimen.':'')+'</div>'+
    '<div class="cloudwrap" id="wcBox"><div class="cloudtip" id="wcTip"></div></div>'+
    '<div class="cloudlegend"><span><span class="dot" style="background:'+WC_COL.pos[1]+'"></span> positif</span><span><span class="dot" style="background:'+WC_COL.neg[1]+'"></span> negatif</span><span><span class="dot" style="background:'+WC_COL.neu[1]+'"></span> netral</span><span class="sub">· sumber kata: leksikon '+(state.sent.lexName?'unggahan':'bawaan')+'</span></div>';
  box.querySelectorAll('#wSeg .segb').forEach(function(b){b.onclick=function(){state.wTab=b.dataset.k;paneWords(p,st);};});
  var wrap=$('wcBox'),W=Math.max(320,Math.round(wrap.getBoundingClientRect().width||800)),H=Math.round(Math.min(460,Math.max(300,W*0.48)));
  var items=cloudItems(ws,tab);
  if(!items.length){wrap.innerHTML='<div class="sub" style="padding:30px;text-align:center">Tidak ada kata.</div>';return;}
  var placed=cloudLayout(items,W,H);
  var svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Word cloud">'+placed.map(function(o,k){var w=o.w;return '<text x="'+o.cx.toFixed(1)+'" y="'+o.cy.toFixed(1)+'" text-anchor="middle" dominant-baseline="central" style="font-size:'+w.size+'px;fill:'+w.color+';animation-delay:'+(Math.min(k,60)*12)+'ms"'+(w.rot?' transform="rotate(-90 '+o.cx.toFixed(1)+' '+o.cy.toFixed(1)+')"':'')+' data-i="'+o.i+'">'+esc(w.text)+'</text>';}).join('')+'</svg>';
  wrap.insertAdjacentHTML('beforeend',svg);
  var tip=$('wcTip');
  wrap.querySelectorAll('text').forEach(function(el){var it=items[+el.dataset.i];
    el.onmouseenter=function(e){wrap.classList.add('dim');el.classList.add('hl');tip.style.display='block';tip.innerHTML='<b>'+esc(it.text)+'</b> · '+fmt(it.n)+' teks · <span style="color:'+WC_COL[it.cls][1]+'">'+(it.cls==='pos'?'positif':it.cls==='neg'?'negatif':'netral')+'</span>';};
    el.onmousemove=function(e){var r=wrap.getBoundingClientRect();var x=e.clientX-r.left+12,y=e.clientY-r.top+12;if(x+200>r.width)x-=200;tip.style.left=x+'px';tip.style.top=y+'px';};
    el.onmouseleave=function(){wrap.classList.remove('dim');el.classList.remove('hl');tip.style.display='none';};
    el.onclick=function(){if(it.cls==='neu')gotoComments({q:it.text});else gotoComments({word:it.text});};});
  if(placed.length<items.length)wrap.insertAdjacentHTML('beforeend','<div class="sub" style="position:absolute;right:10px;bottom:6px">'+placed.length+' dari '+items.length+' kata tampil</div>');
}

function paneActors(p,st){
  var box=$('sp-actors');
  if(!st.n){box.innerHTML=emptySentMsg(p);return;}
  var lab=state.sTab==='actpos'?'pos':state.sTab==='actneu'?'neu':'neg',ln=labName(lab).toLowerCase(),col=labColor(lab);
  var minN=state.sent.minN,mp=new Map(),role=state.aTab==='rcv'?'t':'a';
  st.recs.forEach(function(r){var u=role==='t'?r.t:r.a;if(!u||(role==='t'&&r.t===r.a))return;var o=mp.get(u)||{n:0,pos:0,neu:0,neg:0,sum:0};o.n++;o.sum+=r.s;o[r.lab]++;mp.set(u,o);});
  var arr=Array.from(mp.entries()).filter(function(e){return e[1][lab]>0&&e[1].n>=minN;}).sort(function(a,b){return b[1][lab]-a[1][lab]||b[1].n-a[1].n;}).slice(0,15),mx=arr.length?arr[0][1][lab]:1;
  box.innerHTML='<div class="seg sm" id="aSeg"><button class="segb'+(state.aTab==='rcv'?' on':'')+'" data-k="rcv">Paling banyak menerima</button><button class="segb'+(state.aTab==='wrt'?' on':'')+'" data-k="wrt">Paling banyak menulis</button></div>'+
    '<div class="sub" style="margin:8px 0">Komentar <b style="color:'+col+'">'+ln+'</b> per akun (hanya akun dengan ≥ '+minN+' teks). Klik baris untuk membaca komentarnya; ◎ = tampilkan di graf.</div>'+
    '<table class="top"><thead><tr><th>#</th><th>Aktor</th><th class="r">'+labName(lab)+'</th><th class="r">dari</th><th class="r">% '+ln.slice(0,3)+' <span class="sub">(95% CI)</span></th><th>Komposisi</th><th class="r">Skor</th><th></th></tr></thead><tbody>'+
    (arr.map(function(e,i){var o=e[1],sc=o.sum/o.n;return '<tr class="cl" data-u="'+esc(e[0])+'"><td class="rk">'+(i+1)+'</td><td class="u"><b>@'+esc(e[0])+'</b></td><td class="r val"><span class="hbar"><i style="width:'+(100*o[lab]/mx)+'%;background:'+col+'"></i></span><b style="color:'+col+'">'+o[lab]+'</b></td><td class="r val">'+o.n+'</td><td class="r val">'+pct(o[lab],o.n)+' <span class="sub">'+ciTxt(o[lab],o.n)+'</span></td><td><div class="sbar" style="min-width:80px" title="Positif '+o.pos+' · Netral '+o.neu+' · Negatif '+o.neg+'"><i style="width:'+(100*o.pos/o.n)+'%;background:'+POS+'"></i><i style="width:'+(100*o.neu/o.n)+'%;background:'+NEU+'"></i><i style="width:'+(100*o.neg/o.n)+'%;background:'+NEG+'"></i></div></td><td class="r val" style="color:'+sentColor(sc)+'">'+fmtS(sc)+'</td><td class="r"><button class="btn sm loc" title="Tampilkan di graf">◎</button></td></tr>';}).join('')||'<tr><td colspan="8" class="sub">Tidak ada akun dengan teks '+ln+' dan n ≥ '+minN+'.</td></tr>')+'</tbody></table>';
  box.querySelectorAll('#aSeg .segb').forEach(function(b){b.onclick=function(){state.aTab=b.dataset.k;paneActors(p,st);};});
  box.querySelectorAll('tr.cl').forEach(function(tr){var u=tr.dataset.u;
    tr.onclick=function(e){if(e.target.closest('.loc')){var d=cur(),i=d?d.g.labels.indexOf(u):-1;if(i>=0){focusNode(i);$('gwrap').scrollIntoView({behavior:'smooth',block:'center'});}else toast('@'+u+' tidak ada di jaringan '+netName(state.plat,state.net)+'.');return;}
      gotoComments({actor:u,role:role,lab:lab,sort:lab==='pos'?'pos':lab==='neg'?'neg':'time'});};
    tr.onmouseenter=function(){var d=cur();if(d)hoverNode(d.g.labels.indexOf(u));};tr.onmouseleave=function(){hoverNode(null);};});
}
function cmtCard(r){return '<div class="cmt" style="border-left-color:'+labColor(r.lab)+'"><div class="m">@'+esc(r.a)+(r.t?' → @'+esc(r.t):'')+(isNaN(r.ts)?'':' · '+isoDay(r.ts))+' · <span class="lab '+r.lab+'">'+fmtS(r.s)+'</span>'+(r.ai&&r.ai.sar?' <span class="lab neg">sarkas</span>':'')+'</div>'+esc(r.text.length>320?r.text.slice(0,320)+'…':r.text)+'</div>';}
function paneEx(p,st){
  var box=$('sp-ex');
  if(!st.n){box.innerHTML=emptySentMsg(p);return;}
  var l=state.eTab,rows=st.recs.filter(function(r){return r.lab===l&&r.text&&r.text.trim();}).sort(function(a,b){return l==='pos'?b.s-a.s:a.s-b.s;});
  var seen=new Set(),uniq=[];rows.forEach(function(r){var k=tkey(r.text);if(!seen.has(k)&&uniq.length<6){seen.add(k);uniq.push(r);}});
  box.innerHTML='<div class="seg sm" id="eSeg"><button class="segb'+(l==='neg'?' on':'')+'" data-k="neg">Paling negatif</button><button class="segb'+(l==='pos'?' on':'')+'" data-k="pos">Paling positif</button></div>'+
    '<div class="sub" style="margin:8px 0">Teks dengan skor paling '+(l==='pos'?'positif':'negatif')+' (teks identik ditampilkan sekali).</div>'+
    (uniq.map(cmtCard).join('')||'<div class="sub">Tidak ada teks.</div>')+
    '<button class="btn sm" id="exAll" style="margin-top:6px">Lihat semua '+fmt(rows.length)+' teks '+labName(l).toLowerCase()+' ›</button>';
  box.querySelectorAll('#eSeg .segb').forEach(function(b){b.onclick=function(){state.eTab=b.dataset.k;paneEx(p,st);};});
  $('exAll').onclick=function(){gotoComments({lab:l,sort:l==='pos'?'pos':'neg'});};
}
/* explorer (all comments, unlimited) */
state.xPage=0;
function wordMatch(r,w){return SENT.score(r.text,state.sent.lex).hits.some(function(h){return h[0]===w;});}
function explorerRows(){
  var p=state.plat,x=state.xf,q=x.q.trim().toLowerCase().replace(/^@/,'');
  var rows=textRecs(p).filter(function(r){
    if(x.lab&&r.lab!==x.lab)return false;
    if(x.f==='dis'&&!(r.ai&&r.lx&&r.ai.s!==r.lx))return false;
    if(x.f==='sar'&&!(r.ai&&r.ai.sar))return false;
    if(x.f==='man'&&!r.man)return false;
    if(x.day&&(isNaN(r.ts)||isoDay(r.ts)!==x.day))return false;
    if(x.actor&&(x.role==='t'?r.t:r.a)!==x.actor)return false;
    if(q&&r.text.toLowerCase().indexOf(q)<0&&r.a.indexOf(q)<0&&(r.t||'').indexOf(q)<0)return false;
    if(x.word&&!wordMatch(r,x.word))return false;
    if(x.ent&&!(r.ents&&r.ents.indexOf(x.ent)>=0))return false;
    return true;});
  if(x.sort==='neg')rows.sort(function(a,b){return (a.s==null?9:a.s)-(b.s==null?9:b.s);});
  else if(x.sort==='pos')rows.sort(function(a,b){return (b.s==null?-9:b.s)-(a.s==null?-9:a.s);});
  else rows.sort(function(a,b){return (b.ts||0)-(a.ts||0);});
  return rows;
}
function renderExplorer(){
  if(state.plat==='all'||!state.records||state.sTab!=='all')return;
  var x=state.xf;
  $('xQ').value=x.q;$('xSort').value=x.sort;$('xF').value=x.f;
  $('xLabs').innerHTML=[['','Semua'],['pos','Positif'],['neu','Netral'],['neg','Negatif']].map(function(o){return '<button class="segb'+(x.lab===o[0]?' on':'')+'" data-l="'+o[0]+'">'+(o[0]?'<span class="dot" style="background:'+labColor(o[0])+'"></span> ':'')+o[1]+'</button>';}).join('');
  $('xLabs').querySelectorAll('.segb').forEach(function(b){b.onclick=function(){state.xf.lab=b.dataset.l;state.xPage=0;renderExplorer();};});
  var chips=[];
  if(x.day)chips.push(['day','Tanggal: '+x.day]);if(x.word)chips.push(['word','Kata: '+x.word]);if(x.actor)chips.push(['actor',(x.role==='t'?'Diterima @':'Ditulis @')+x.actor]);if(x.ent)chips.push(['ent',ECAT[entCat(x.ent)].name+': '+entName(x.ent)]);
  $('xChips').innerHTML=chips.map(function(c){return '<button class="fchip" data-k="'+c[0]+'">'+esc(c[1])+' <b>×</b></button>';}).join('')+(chips.length?'<button class="fchip clear" data-k="__all">Hapus semua filter</button>':'');
  $('xChips').querySelectorAll('.fchip').forEach(function(b){b.onclick=function(){if(b.dataset.k==='__all')xfReset();else{state.xf[b.dataset.k]=null;if(b.dataset.k==='actor')state.xf.role=null;}state.xPage=0;renderExplorer();};});
  var rows=explorerRows(),PS=25,pages=Math.max(1,Math.ceil(rows.length/PS));
  if(state.xPage>=pages)state.xPage=pages-1;
  var pg=rows.slice(state.xPage*PS,state.xPage*PS+PS);
  function B(l,t,title){return l?'<span class="lab '+l+'" title="'+title+'">'+t+'</span>':'';}
  $('xList').innerHTML=pg.map(function(r){
    return '<div class="xrow" style="border-left-color:'+(r.lab?labColor(r.lab):'var(--line)')+'"><div class="xt">'+esc(r.text.length>500?r.text.slice(0,500)+'…':r.text)+'</div>'+
      '<div class="xm"><button class="lnk" data-u="'+esc(r.a)+'" data-r="a">@'+esc(r.a)+'</button>'+(r.t?' → <button class="lnk" data-u="'+esc(r.t)+'" data-r="t">@'+esc(r.t)+'</button>':'')+(isNaN(r.ts)?'':' · '+isoDay(r.ts))+
      '<span class="xb">'+(r.lab?'<span class="lab '+r.lab+'">'+labName(r.lab)+(r.s!=null?' '+fmtS(r.s):'')+'</span>':'<span class="sub">belum berlabel</span>')+
      (state.sent.source!=='lexicon'&&r.lx?B(r.lx,'Leks: '+labName(r.lx).slice(0,3),'Label leksikon'):'')+(state.sent.source!=='ai'&&r.ai?B(r.ai.s,'AI: '+labName(r.ai.s).slice(0,3),'Label Claude AI'):'')+(r.ai&&r.ai.sar?B('neg','sarkas','Sarkasme menurut AI'):'')+(state.sent.source!=='column'&&r.man?B(r.man,'Manual: '+labName(r.man).slice(0,3),'Label manual'):'')+'</span></div></div>';
  }).join('')||'<div class="sub" style="padding:14px 0">Tidak ada teks yang cocok dengan filter.</div>';
  $('xList').querySelectorAll('.lnk').forEach(function(b){b.onclick=function(){state.xf.actor=b.dataset.u;state.xf.role=b.dataset.r;state.xPage=0;renderExplorer();};});
  $('xInfo').textContent=rows.length?fmt(state.xPage*PS+1)+'–'+fmt(Math.min(rows.length,state.xPage*PS+PS))+' dari '+fmt(rows.length):'0 teks';
  $('xPrev').disabled=state.xPage===0;$('xNext').disabled=state.xPage>=pages-1;
}
$('xQ').addEventListener('input',function(){state.xf.q=this.value;state.xPage=0;clearTimeout(renderExplorer._t);renderExplorer._t=setTimeout(renderExplorer,180);});
$('xSort').onchange=function(){state.xf.sort=this.value;state.xPage=0;renderExplorer();};
$('xF').onchange=function(){state.xf.f=this.value;state.xPage=0;renderExplorer();};
$('xPrev').onclick=function(){state.xPage=Math.max(0,state.xPage-1);renderExplorer();$('sentCard').scrollIntoView({block:'start'});};
$('xNext').onclick=function(){state.xPage++;renderExplorer();$('sentCard').scrollIntoView({block:'start'});};
