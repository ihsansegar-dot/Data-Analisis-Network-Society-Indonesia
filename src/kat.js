/* ===================== Kategori (kolom term) ===================== */
/* Ringkasan kategori dari kolom term/keyword (mis. keluaran news scraper: "Partai Islam;Politik umat").
   Multi-label: satu baris boleh punya beberapa kategori; persentase dihitung terhadap baris berkategori. */
var KAT={sel:null,media:null,norm:false,page:0};
(function(){
  var card=document.createElement('section');card.className='card hide';card.id='katCard';
  card.innerHTML='<div class="phead"><h2>Kategori <span class="sub" id="katSub"></span></h2>'+
    '<div style="display:flex;gap:8px;align-items:center"><label class="sub" style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="katNorm"> % per media</label>'+
    '<button class="btn sm" id="katCsv">Unduh CSV</button></div></div>'+
    '<div class="grid2"><div><div class="sub" style="margin-bottom:6px">Jumlah teks per kategori · klik untuk memilih</div><div id="katBars"></div></div>'+
    '<div><div class="sub" style="margin-bottom:6px" id="katTrendT">Tren harian</div><div id="katTrend"></div></div></div>'+
    '<div class="sub" style="margin:14px 0 6px" id="katMxT">Kategori × media / akun</div><div style="overflow-x:auto"><table class="top" id="katMx"></table></div>'+
    '<div class="sub" style="margin:14px 0 6px" id="katListT"></div><div id="katList"></div>'+
    '<div class="pager"><span id="katInfo"></span><button class="btn sm" id="katPrev">‹</button><button class="btn sm" id="katNext">›</button></div>'+
    '<div class="report" style="margin-top:10px">Sumber: kolom <code>term</code>/<code>keyword</code>; beberapa nilai dipisah <code>;</code> atau <code>|</code>. Satu teks bisa masuk lebih dari satu kategori, jadi jumlah per kategori tidak dijumlahkan menjadi total. Bila kategori berasal dari klasifikasi otomatis (kamus), angkanya <b>belum tervalidasi</b>; lihat <code>scraper/validate.py</code>.</div>';
  var pv=$('pView');pv.parentNode.insertBefore(card,pv.nextSibling);
  $('katNorm').onchange=function(){KAT.norm=this.checked;renderKat();};
  $('katPrev').onclick=function(){if(KAT.page>0){KAT.page--;renderKatList();}};
  $('katNext').onclick=function(){KAT.page++;renderKatList();};
  $('katCsv').onclick=katCsv;
})();
function katSplit(v){return String(v||'').split(/\s*[;|]\s*/).map(function(x){return x.trim();}).filter(Boolean);}
function katRecs(p){
  if(!state.records)return [];
  if(p==null)p=state.plat;
  return state.records.filter(function(r){return !r.ps&&r.ext&&r.ext.term&&(p==='all'||r.p===p)&&inWindow(r);});
}
function katData(p){
  var recs=katRecs(p),cats=new Map(),media=new Map(),cell=new Map(),days=new Map();
  recs.forEach(function(r){
    var cs=Array.from(new Set(katSplit(r.ext.term)));r._kat=cs;
    media.set(r.a,(media.get(r.a)||0)+1);
    var d=isNaN(r.ts)?null:isoDay(r.ts);
    cs.forEach(function(c){cats.set(c,(cats.get(c)||0)+1);var k=c+'\u0001'+r.a;cell.set(k,(cell.get(k)||0)+1);
      if(d){var o=days.get(d);if(!o){o=new Map();days.set(d,o);}o.set(c,(o.get(c)||0)+1);}});
  });
  var cl=Array.from(cats.entries()).sort(function(a,b){return b[1]-a[1]||a[0].localeCompare(b[0]);});
  var ml=Array.from(media.entries()).sort(function(a,b){return b[1]-a[1];});
  return {recs:recs,cats:cl,media:ml,cell:cell,days:days};
}
var KATCOL=['#4f7cff','#fd5c63','#2ec4a6','#f6b73c','#a77bff','#3fb6e8','#ff8a3d','#8bd450','#e86fb3','#9aa7c7','#d4c26a','#5ad1d1'];
function katColor(i){return KATCOL[i%KATCOL.length];}
function renderKat(){
  var card=$('katCard');
  if(!state.all){card.classList.add('hide');return;}
  var D=katData();KAT.D=D;
  if(!D.recs.length){card.classList.add('hide');return;}
  card.classList.remove('hide');
  if(KAT.sel&&!D.cats.some(function(c){return c[0]===KAT.sel;}))KAT.sel=null;
  if(KAT.media&&!D.media.some(function(m){return m[0]===KAT.media;}))KAT.media=null;
  $('katSub').textContent='· '+fmt(D.recs.length)+' teks berkategori · '+fmt(D.cats.length)+' kategori · '+fmt(D.media.length)+' media/akun · '+(state.plat==='all'?'semua platform':pName(state.plat));
  var mx=D.cats.length?D.cats[0][1]:1,N=D.recs.length;
  $('katBars').innerHTML=D.cats.map(function(c,i){var on=KAT.sel===c[0],w=(100*c[1]/mx).toFixed(1);
    return '<div class="katb" data-c="'+esc(c[0])+'" style="display:grid;grid-template-columns:minmax(120px,38%) 1fr 92px;gap:8px;align-items:center;padding:3px 4px;border-radius:6px;cursor:pointer;'+(on?'background:rgba(79,124,255,.18)':'')+'">'+
      '<span style="font-size:12.5px;'+(on?'font-weight:700':'')+'">'+esc(c[0])+'</span>'+
      '<span style="background:var(--bg);border-radius:4px;height:12px;overflow:hidden"><span style="display:block;height:100%;width:'+w+'%;background:'+katColor(i)+'"></span></span>'+
      '<span class="r val" style="font-size:12px;text-align:right">'+fmt(c[1])+' <span class="sub">'+fmt(100*c[1]/N,1)+'%</span></span></div>';}).join('');
  $('katBars').querySelectorAll('.katb').forEach(function(el){el.onclick=function(){KAT.sel=KAT.sel===el.dataset.c?null:el.dataset.c;KAT.page=0;renderKat();};});
  renderKatTrend(D);renderKatMatrix(D);KAT.page=0;renderKatList();
}
function renderKatTrend(D){
  var days=Array.from(D.days.keys()).sort();
  if(days.length>1){var full=[],t0=Date.parse(days[0]+'T12:00:00'),t1=Date.parse(days[days.length-1]+'T12:00:00');
    if((t1-t0)/864e5<=400){for(var t=t0;t<=t1+1;t+=864e5)full.push(isoDay(t));days=full;}}
  var gd=function(d,c){var o=D.days.get(d);return o?o.get(c)||0:0;};
  if(!days.length){$('katTrend').innerHTML='<div class="sub">created_at tidak tersedia.</div>';return;}
  var show=KAT.sel?[KAT.sel]:D.cats.slice(0,5).map(function(c){return c[0];});
  $('katTrendT').textContent='Tren harian · '+(KAT.sel?esc(KAT.sel):'5 kategori teratas');
  var W=440,H=170,pl=30,pb=22,pt=8,pr=8,iw=W-pl-pr,ih=H-pt-pb,mx=1;
  days.forEach(function(d){show.forEach(function(c){mx=Math.max(mx,gd(d,c));});});
  var x=function(i){return pl+(days.length===1?iw/2:i*iw/(days.length-1));},y=function(v){return pt+ih-ih*v/mx;};
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:'+W+'px">';
  [0,.5,1].forEach(function(f){var v=Math.round(mx*f);s+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="rgba(255,255,255,.08)"/><text x="'+(pl-4)+'" y="'+(y(v)+3)+'" style="font-size:9px;fill:#9aa7c7" text-anchor="end">'+v+'</text>';});
  show.forEach(function(c){var ci=D.cats.findIndex(function(z){return z[0]===c;}),col=katColor(ci);
    var pts=days.map(function(d,i){return x(i).toFixed(1)+','+y(gd(d,c)).toFixed(1);});
    s+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+col+'" stroke-width="1.8"/>';
    if(days.length<=40)days.forEach(function(d,i){var v=gd(d,c);s+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.4" fill="'+col+'"><title>'+d+' · '+esc(c)+': '+v+'</title></circle>';});});
  s+='<text x="'+pl+'" y="'+(H-6)+'" style="font-size:9px;fill:#9aa7c7">'+days[0]+'</text><text x="'+(W-pr)+'" y="'+(H-6)+'" style="font-size:9px;fill:#9aa7c7" text-anchor="end">'+days[days.length-1]+'</text></svg>';
  s+='<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px">'+show.map(function(c){var ci=D.cats.findIndex(function(z){return z[0]===c;});return '<span><span class="dot" style="background:'+katColor(ci)+'"></span> '+esc(c)+'</span>';}).join('')+'</div>';
  $('katTrend').innerHTML=s;
}
function renderKatMatrix(D){
  var med=D.media.slice(0,12),cats=D.cats;
  $('katMxT').textContent='Kategori × media / akun · '+(med.length<D.media.length?med.length+' teratas dari '+D.media.length:med.length)+' · '+(KAT.norm?'% teks media itu':'jumlah teks')+' · klik sel untuk membaca teksnya';
  var mx=0;cats.forEach(function(c){med.forEach(function(m){var v=D.cell.get(c[0]+'\u0001'+m[0])||0;if(KAT.norm)v=v/m[1];mx=Math.max(mx,v);});});
  var h='<thead><tr><th>Kategori</th>'+med.map(function(m){return '<th class="r" title="'+esc(m[0])+' · '+fmt(m[1])+' teks">'+esc(dispLabel(m[0]).slice(0,14))+'<br><span class="sub" style="text-transform:none">n='+fmt(m[1])+'</span></th>';}).join('')+'<th class="r">Total</th></tr></thead><tbody>';
  h+=cats.map(function(c){return '<tr><td>'+esc(c[0])+'</td>'+med.map(function(m){var n=D.cell.get(c[0]+'\u0001'+m[0])||0,v=KAT.norm?n/m[1]:n,a=mx?v/mx:0;
      return '<td class="r val kc" data-c="'+esc(c[0])+'" data-m="'+esc(m[0])+'" style="background:rgba(60,98,240,'+(n?0.08+0.5*a:0).toFixed(2)+');cursor:'+(n?'pointer':'default')+'">'+(n?(KAT.norm?fmt(100*v,1)+'%':fmt(n)):'<span class="sub">·</span>')+'</td>';}).join('')+'<td class="r val"><b>'+fmt(c[1])+'</b></td></tr>';}).join('')+'</tbody>';
  $('katMx').innerHTML=h;
  $('katMx').querySelectorAll('td.kc').forEach(function(td){td.onclick=function(){if(td.textContent.trim()==='·')return;KAT.sel=td.dataset.c;KAT.media=td.dataset.m;KAT.page=0;renderKat();KAT.media=td.dataset.m;renderKatList();$('katListT').scrollIntoView({behavior:'smooth',block:'start'});};});
}
function renderKatList(){
  var D=KAT.D;if(!D)return;
  var L=D.recs.filter(function(r){return (!KAT.sel||r._kat.indexOf(KAT.sel)>=0)&&(!KAT.media||r.a===KAT.media);})
    .sort(function(a,b){return (b.ts||0)-(a.ts||0);});
  var per=15,pages=Math.max(1,Math.ceil(L.length/per));if(KAT.page>=pages)KAT.page=pages-1;
  $('katListT').innerHTML='Teks'+(KAT.sel?' · <b>'+esc(KAT.sel)+'</b>':'')+(KAT.media?' · '+esc(dispLabel(KAT.media))+' <button class="btn sm" id="katClrM">× media</button>':'')+(KAT.sel?' <button class="btn sm" id="katClrC">× kategori</button>':'');
  if($('katClrM'))$('katClrM').onclick=function(){KAT.media=null;KAT.page=0;renderKatList();};
  if($('katClrC'))$('katClrC').onclick=function(){KAT.sel=null;KAT.media=null;renderKat();};
  $('katList').innerHTML=L.slice(KAT.page*per,KAT.page*per+per).map(function(r){
    var t=String(r.text||'').trim(),dot=t.indexOf('. '),title=dot>10&&dot<220?t.slice(0,dot):t.slice(0,160),rest=dot>10&&dot<220?t.slice(dot+2,dot+262):'';
    return '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div style="font-size:13px;font-weight:600">'+(r.url?'<a href="'+esc(r.url)+'" target="_blank" rel="noopener" style="color:inherit">'+esc(title)+' ↗</a>':esc(title))+'</div>'+
      (rest?'<div class="sub" style="margin:2px 0">'+esc(rest)+(t.length>dot+262?'…':'')+'</div>':'')+
      '<div class="sub" style="font-size:11px">'+esc(dispLabel(r.a))+' · '+(isNaN(r.ts)?'tanpa tanggal':isoDay(r.ts))+' · '+r._kat.map(function(c){return '<span style="border:1px solid var(--line);border-radius:5px;padding:0 5px;margin-right:3px">'+esc(c)+'</span>';}).join('')+'</div></div>';}).join('')||'<div class="sub">Tidak ada teks.</div>';
  $('katInfo').textContent=L.length?('Hal. '+(KAT.page+1)+' / '+pages+' · '+fmt(L.length)+' teks'):'';
  $('katPrev').disabled=KAT.page<=0;$('katNext').disabled=KAT.page>=pages-1;
}
function katCsv(){
  var D=KAT.D;if(!D)return;
  var q=function(v){v=String(v==null?'':v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  var med=D.media.map(function(m){return m[0];});
  var rows=[['kategori','jumlah_teks','persen_teks_berkategori'].concat(med)];
  D.cats.forEach(function(c){rows.push([c[0],c[1],(100*c[1]/D.recs.length).toFixed(2)].concat(med.map(function(m){return D.cell.get(c[0]+'\u0001'+m)||0;})));});
  rows.push(['(total teks media)','',''].concat(D.media.map(function(m){return m[1];})));
  save('kategori_'+(state.plat==='all'?'semua':state.plat)+'.csv','﻿'+rows.map(function(r){return r.map(q).join(',');}).join('\n'),'text/csv');
}
/* sambungkan ke siklus render */
(function(){var _r=render;render=function(f){_r(f);try{renderKat();}catch(e){console.error(e);}};
  var _s=show;show=function(n,f){var o=_s(n,f);try{renderKat();}catch(e){console.error(e);}return o;};})();
