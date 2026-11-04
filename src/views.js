/* ===================== View postingan (X) ===================== */
/* Panel "View postingan" di tab View (X): jumlah tayangan per postingan dari kolom views/view_count/impressions.
   Bila data punya baris type=view, tab View juga menampilkan jaringan jangkauan (core.js); panel ini
   tampil di bawah grafik. Bila tidak ada, tab View hanya berisi panel ini (view tidak mencatat SIAPA yang melihat). */
var VIEW={on:false,only:false};
function viewPlatOK(p){return p==='x';}
function viewRecs(){
  if(!state.records)return [];
  var p=state.plat,seen=new Map();
  state.records.forEach(function(r){
    /* baris type=view adalah edge turunan (bobot = view postingan target), bukan postingan: jangan dihitung */
    if(r.ps||r.p!==p||r.type==='view'||!(r.v>0)||!inWindow(r))return;
    var k=r.url||(r.a+'|'+r.text),o=seen.get(k);
    if(!o||r.v>o.v)seen.set(k,r);
  });
  return Array.from(seen.values());
}
function viewHasData(p){return !!(state.records&&viewPlatOK(p)&&state.records.some(function(r){return r.p===p&&r.type!=='view'&&r.v>0;}));}
function fmtBig(v){if(v==null)return '–';if(v>=1e9)return fmt(v/1e9,1)+' M';if(v>=1e6)return fmt(v/1e6,1)+' jt';if(v>=1e4)return fmt(v/1e3,1)+' rb';return fmt(v);}
function median(a){if(!a.length)return null;var s=a.slice().sort(function(x,y){return x-y;}),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function enterView(only){
  VIEW.on=true;VIEW.only=!!only;state.net='view';
  $('pView').classList.toggle('viewmode',VIEW.only);$('viewCard').classList.remove('hide');
  document.querySelectorAll('.topbar .tab').forEach(function(b){b.classList.toggle('on',b.dataset.net==='view');});
  if(VIEW.only)$('netDesc').textContent=pName(state.plat)+' · View: jumlah tayangan per postingan (data ini tidak berisi baris type=view, jadi tidak ada jaringan jangkauan)';
  renderView();
}
function exitView(){
  if(!VIEW.on)return;VIEW.on=false;VIEW.only=false;
  $('pView').classList.remove('viewmode');$('viewCard').classList.add('hide');
}
function viewTabSync(){var tv=$('tabView');if(tv)tv.classList.toggle('hide',!(state.all&&state.plat!=='all'&&(hasNet(state.plat,'view')||viewHasData(state.plat))));}
function renderView(){
  var R=viewRecs(),N=$('viewTop')?+$('viewTop').value:25;
  var col=state.report&&state.report.viewCol;
  if(!R.length){
    $('viewSub').textContent='';
    $('viewKpis').innerHTML='';$('viewAcc').innerHTML='';$('viewTrend').innerHTML='';$('viewTable').innerHTML='';
    $('viewNote').innerHTML=col?'Tidak ada baris '+pName(state.plat)+' dengan nilai view pada rentang/filter ini.'
      :'Data belum memiliki kolom jumlah tayangan. Tambahkan kolom <code>views</code> (juga dikenali: <code>view_count</code>, <code>impressions</code>, <code>impression_count</code>, <code>tayangan</code>) berisi angka view tiap postingan, misalnya <code>12345</code>, <code>12.345</code>, <code>1,2 rb</code>, atau <code>3.4K</code>.';
    return;
  }
  var tot=0,vals=[],acc=new Map(),days=new Map();
  R.forEach(function(r){tot+=r.v;vals.push(r.v);var o=acc.get(r.a);if(!o){o={v:0,n:0,max:0};acc.set(r.a,o);}o.v+=r.v;o.n++;if(r.v>o.max)o.max=r.v;
    if(!isNaN(r.ts)){var d=isoDay(r.ts);days.set(d,(days.get(d)||0)+r.v);}});
  var mx=Math.max.apply(null,vals),med=median(vals);
  $('viewSub').textContent='· '+fmt(R.length)+' postingan · '+fmt(acc.size)+' akun · kolom '+(col||'views');
  $('viewKpis').innerHTML=[['Total view',fmtBig(tot),fmt(tot)+' tayangan'],['Postingan',fmt(R.length),'dengan data view'],['Median',fmtBig(med),'view per postingan'],['Rata-rata',fmtBig(tot/R.length),'view per postingan'],['Tertinggi',fmtBig(mx),'satu postingan'],['Akun',fmt(acc.size),'pemilik postingan']]
    .map(function(k){return '<div class="kpi"><div class="l">'+k[0]+'</div><div class="v">'+k[1]+'</div><div class="s">'+k[2]+'</div></div>';}).join('');
  var al=Array.from(acc.entries()).sort(function(a,b){return b[1].v-a[1].v;}).slice(0,10),amx=al.length?al[0][1].v:1;
  $('viewAcc').innerHTML=al.map(function(e){return '<div class="vbar" title="'+esc(dispLabel(e[0]))+' · '+fmt(e[1].n)+' postingan · total '+fmt(e[1].v)+' view"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(dispLabel(e[0]))+'</span><span class="bg"><span class="fg" style="width:'+(100*e[1].v/amx).toFixed(1)+'%"></span></span><span style="text-align:right;font-family:var(--mono);font-size:11.5px">'+fmtBig(e[1].v)+' <span class="sub">/'+fmt(e[1].n)+'</span></span></div>';}).join('')
    +'<div class="sub" style="margin-top:4px;font-size:11px">angka = total view / jumlah postingan</div>';
  var dl=Array.from(days.keys()).sort();
  if(dl.length){var W=420,H=150,pl=44,pb=20,pt=8,pr=8,iw=W-pl-pr,ih=H-pt-pb,dm=Math.max.apply(null,dl.map(function(d){return days.get(d);}))||1,bw=Math.max(2,iw/dl.length-2);
    var sv='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:'+W+'px">';
    [0,.5,1].forEach(function(f){var y=pt+ih-ih*f;sv+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="rgba(255,255,255,.08)"/><text x="'+(pl-4)+'" y="'+(y+3)+'" style="font-size:9px;fill:#9aa7c7" text-anchor="end">'+fmtBig(dm*f)+'</text>';});
    dl.forEach(function(d,i){var v=days.get(d),h=ih*v/dm,x=pl+i*(iw/dl.length)+1;sv+='<rect x="'+x.toFixed(1)+'" y="'+(pt+ih-h).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="#4f7cff"><title>'+d+': '+fmt(v)+' view</title></rect>';});
    sv+='<text x="'+pl+'" y="'+(H-5)+'" style="font-size:9px;fill:#9aa7c7">'+dl[0]+'</text><text x="'+(W-pr)+'" y="'+(H-5)+'" style="font-size:9px;fill:#9aa7c7" text-anchor="end">'+dl[dl.length-1]+'</text></svg>';
    $('viewTrend').innerHTML=sv;}
  else $('viewTrend').innerHTML='<div class="sub">created_at tidak tersedia.</div>';
  var top=R.slice().sort(function(a,b){return b.v-a.v;}).slice(0,N);
  $('viewTable').innerHTML='<thead><tr><th>#</th><th>Akun</th><th>Postingan</th><th>Tanggal</th><th class="r">View</th><th class="r">% total</th></tr></thead><tbody>'+
    top.map(function(r,i){var t=String(r.text||'').replace(/\s+/g,' ').trim();t=t.length>140?t.slice(0,140)+'…':t;
      return '<tr><td class="sub">'+(i+1)+'</td><td>'+esc(dispLabel(r.a))+'</td><td style="max-width:460px">'+(r.url?'<a href="'+esc(r.url)+'" target="_blank" rel="noopener" style="color:inherit">'+esc(t||'(tanpa teks)')+' ↗</a>':esc(t||'(tanpa teks)'))+' <span class="sub">'+esc(r.type)+'</span></td><td class="sub">'+(isNaN(r.ts)?'–':isoDay(r.ts))+'</td><td class="r val"><b>'+fmt(r.v)+'</b></td><td class="r sub">'+fmt(100*r.v/tot,1)+'%</td></tr>';}).join('')+'</tbody>';
  $('viewNote').innerHTML='View = jumlah tayangan yang dilaporkan platform saat data diambil (bisa terus bertambah setelahnya). View tidak mencatat siapa yang melihat, sehingga tidak membentuk jaringan dan tidak memengaruhi centrality. Distribusi view biasanya sangat timpang; median lebih mewakili daripada rata-rata.';
}
function viewCsv(){
  var R=viewRecs().sort(function(a,b){return b.v-a.v;});if(!R.length){toast('Tidak ada data view.');return;}
  var q=function(v){v=String(v==null?'':v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  var rows=[['author','type','created_at','views','text','url']].concat(R.map(function(r){return [r.a,r.type,isNaN(r.ts)?'':new Date(r.ts).toISOString(),r.v,r.text||'',r.url||''];}));
  save('view_'+state.plat+'.csv','﻿'+rows.map(function(r){return r.map(q).join(',');}).join('\n'),'text/csv');
}
(function(){
  $('viewTop').onchange=renderView;$('viewCsv').onclick=viewCsv;
  var _s=show;show=function(n,f){
    var p=state.plat;
    if(n==='view'){
      if(hasNet(p,'view')){var o1=_s('view',f);enterView(false);viewTabSync();return o1;}
      if(viewHasData(p)){var o0=_s(state.net==='view'?netsOf(p)[0]||'retweet':state.net,f);enterView(true);viewTabSync();return o0;}
      n=netsOf(p)[0]||'retweet';
    }
    exitView();var o=_s(n,f);viewTabSync();return o;};
  var _r=render;render=function(f){_r(f);try{viewTabSync();if(VIEW.on){if(state.plat!=='all'&&(hasNet(state.plat,'view')||viewHasData(state.plat)))renderView();else exitView();}}catch(e){console.error(e);}};
  setTimeout(function(){$('tabView').onclick=function(){show('view',false);};},0);
})();
