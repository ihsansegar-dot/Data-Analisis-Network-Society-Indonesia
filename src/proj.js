/* ---------- Projects, Sources, Filters ---------- */
state.projects=[];var projSeq=0;
function mergeReports(ps){
  var R={rows:0,byType:{},unknownType:0,noAuthor:0,noTarget:0,badDate:0,missingCols:[],hasPlatform:true,platformCol:null,rawPlatformsUnknown:{},hasManual:false,manualCol:null,extCols:{},derivedTarget:0,likeMedia:0};
  ps.forEach(function(p){var r=p.report;R.rows+=r.rows;['unknownType','noAuthor','noTarget','badDate','derivedTarget','likeMedia'].forEach(function(k){R[k]+=r[k]||0;});
    for(var k in r.byType)R.byType[k]=(R.byType[k]||0)+r.byType[k];for(var u in r.rawPlatformsUnknown)R.rawPlatformsUnknown[u]=(R.rawPlatformsUnknown[u]||0)+r.rawPlatformsUnknown[u];
    r.missingCols.forEach(function(c){if(R.missingCols.indexOf(c)<0)R.missingCols.push(c);});
    if(!r.hasPlatform)R.hasPlatform=false;else if(!R.platformCol)R.platformCol=r.platformCol;
    if(r.hasManual){R.hasManual=true;R.manualCol=R.manualCol||r.manualCol;}if(r.viewCol)R.viewCol=R.viewCol||r.viewCol;for(var e in r.extCols)R.extCols[e]=r.extCols[e];});
  return R;
}
function loadText(text,name){
  var parsed,rr;
  try{parsed=SNA.parseCSV(text);rr=SNA.toRecords(parsed);}
  catch(e){$('report').innerHTML='<span class="err">'+esc(e.message)+'</span>';toast(e.message,5000);return;}
  var demo=name==='data_contoh.csv'&&!!loadText._demo;loadText._demo=false;
  if(!rr.report.hasPlatform)rr.records.forEach(function(r){r._np=1;r.p=state.filePlat;});
  var pr={id:++projSeq,name:demo?'Demo Oktober 2026':name.replace(/\.(csv|txt|tsv)$/i,''),file:name,records:rr.records,report:rr.report,delim:parsed.delimiter,demo:demo,on:true};
  rr.records.forEach(function(r){r.proj=pr.id;});
  if(!demo){var hadDemoOn=state.projects.some(function(p){return p.demo&&p.on;});state.projects.forEach(function(p){if(p.demo)p.on=false;});
    if(hadDemoOn)toast('Data contoh (sintetis) diganti dengan data Anda.',4000);}
  else{var ex=state.projects.find(function(p){return p.demo;});if(ex){ex.on=true;renderProjects();applyProjects(true);toast('Proyek demo sudah ada.');return;}}
  state.projects.push(pr);renderProjects();applyProjects(true);
}
function applyProjects(fresh){
  var on=state.projects.filter(function(p){return p.on;});
  if(!on.length){toast('Centang minimal satu proyek.');return;}
  var recs=[];on.forEach(function(p){for(var i=0;i<p.records.length;i++)recs.push(p.records[i]);});
  state.records=recs;state.report=mergeReports(on);state.fileName=on.map(function(p){return p.demo?'data_contoh.csv':p.file;}).join(' + ');state.delim=on[0].delim;
  state.projNames=on.map(function(p){return p.name;});
  state.records.forEach(function(r){if(r._np)r.p=state.filePlat;});
  var mn=Infinity,mx=-Infinity;recs.forEach(function(r){if(!isNaN(r.ts)){if(r.ts<mn)mn=r.ts;if(r.ts>mx)mx=r.ts;}});
  state.tsRange=isFinite(mn)?[mn,mx]:null;
  if(fresh){$('dFrom').value='';$('dTo').value='';}
  if(state.tsRange){$('dFrom').min=$('dTo').min=isoDay(mn);$('dFrom').max=$('dTo').max=isoDay(mx);}
  state.isDemo=on.some(function(p){return p.demo;});
  $('demoBanner').classList.toggle('hide',!state.isDemo);
  var so=$('sSource');so.options[2].disabled=!state.report.hasManual;
  if(!state.report.hasManual&&state.sent.source==='column'){state.sent.source='lexicon';so.value='lexicon';}
  $('valStart').disabled=false;$('run').disabled=false;
  if(fresh||state.plat==='__best__'||!platCounts()[state.plat])state.plat='__best__';
  state.ent.focus=null;
  qRecompute();
  var demoDict=loadText._demoDict&&state.isDemo;loadText._demoDict=false;
  scoreRecordsAsync().then(function(){
    if(demoDict){if(!$('ePerson').value.trim()){var ac=new Map();state.records.forEach(function(r){if(r.type==='reply'&&r.t)ac.set(r.t,(ac.get(r.t)||0)+1);});var tops=Array.from(ac.entries()).sort(function(a,b){return b[1]-a[1];}).map(function(x){return x[0];}).filter(function(h){return ['kabar_harian','media_kota','info_nusantara40'].indexOf(h)<0;}).slice(0,4);$('ePerson').value=tops.map(function(h,i){return 'Tokoh '+String.fromCharCode(65+i)+': '+h;}).join('\n');}
      if(!$('eNews').value.trim())$('eNews').value='Kabar Harian: kabar_harian|kabarharian.id\nMedia Kota: media_kota|mediakota.id\nInfo Nusantara: info_nusantara40|infonusantara.id';
      if(!$('eOrg').value.trim())$('eOrg').value='KPU: kpu|komisi pemilihan umum\nBawaslu: bawaslu\nDPR: dpr|dewan perwakilan rakyat\nMK: mk|mahkamah konstitusi';
      if(!$('eLoc').value.trim())$('eLoc').value='Jakarta: jakarta|jkt\nBandung\nSurabaya\nMedan\nMakassar';
      if(!$('ePlace').value.trim())$('ePlace').value='Gedung DPR: gedung dpr|senayan\nMonas';
      if(!$('eTerm').value.trim())$('eTerm').value='bansos, pajak, pemilu, harga';
      if(!$('eTag').value.trim())$('eTag').value='#pemilu2029, #bansos, #hargabbm, #kawalpemilu, #dprri';}
    return entApply();}).then(function(){lexInfo();updateAiUi();renderProjects();run();});
}
function renderProjects(){
  var box=$('projList'),list=state.projects.filter(function(p){return !p.demo;});
  if(!list.length){box.innerHTML='<div class="sub" style="padding:6px 4px">Belum ada proyek. Data contoh sintetis sedang ditampilkan.</div>';return;}
  box.innerHTML=list.map(function(p){return '<div class="prow"><span class="ntn" title="'+esc(p.file)+'" style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.name)+'</span><span style="display:flex;align-items:center;gap:4px"><span class="ct" style="font-family:var(--mono);font-size:11px;color:var(--muted);background:var(--panel2);border-radius:5px;padding:0 6px">'+fmt(p.records.length)+'</span><button class="pdel" data-id="'+p.id+'" title="Hapus proyek" aria-label="Hapus proyek '+esc(p.name)+'">×</button></span></div>';}).join('');
  box.querySelectorAll('.pdel').forEach(function(b){b.onclick=function(){var id=+b.dataset.id,pr=state.projects.find(function(x){return x.id===id;});
    state.projects=state.projects.filter(function(x){return x.id!==id;});
    var users=state.projects.filter(function(x){return !x.demo;});
    if(!users.length){var dm=state.projects.find(function(x){return x.demo;});if(dm){dm.on=true;}else{renderProjects();toast('Proyek “'+pr.name+'” dihapus. Memuat data contoh…');demo();return;}}
    renderProjects();applyProjects(false);toast('Proyek “'+pr.name+'” dihapus.');};});
}
$('projAdd').onclick=function(){$('file').click();};
/* sources dropdown (synced with platform chips) */
function syncSources(){
  var sel=$('srcSel'),c=platCounts(),tot=0;Object.keys(c).forEach(function(k){tot+=c[k];});
  var list=PLATS.map(function(p){return p[0];}).filter(function(k){return c[k];});if(c.lainnya)list.push('lainnya');
  sel.innerHTML='<option value="all">All Sources'+(tot?' ('+fmt(tot)+')':'')+'</option>'+list.map(function(k){return '<option value="'+k+'">'+PL[k].name+' ('+fmt(c[k])+')</option>';}).join('');
  sel.value=state.plat==='all'||!c[state.plat]?'all':state.plat;
}
$('srcSel').onchange=function(){var v=this.value;if(v===state.plat)return;state.plat=v;renderChips();render(true);updateAiUi();};
/* boolean text filter */
state.q=null;
function qParse(src){
  var toks=[],re=/\s*(?:(\()|(\))|"([^"]*)"|(\S+))/g,m;
  while((m=re.exec(src))){if(m[1])toks.push({t:'('});else if(m[2])toks.push({t:')'});else if(m[3]!==undefined){if(m[3].trim())toks.push({t:'P',v:m[3].trim().toLowerCase()});}
    else{var w=m[4];var U=w.toUpperCase();if(U==='OR'||w==='|')toks.push({t:'OR'});else if(U==='AND'||w==='&')toks.push({t:'AND'});else if(U==='NOT')toks.push({t:'NOT'});
      else{var neg=false;while(w[0]==='-'&&w.length>1){neg=!neg;w=w.slice(1);}var paren=[];while(w.length>1&&w[w.length-1]===')'){paren.push({t:')'});w=w.slice(0,-1);}var pre=[];while(w.length>1&&w[0]==='('){pre.push({t:'('});w=w.slice(1);}
        if(neg)toks.push({t:'NOT'});pre.forEach(function(x){toks.push(x);});toks.push({t:'W',v:w.toLowerCase()});paren.forEach(function(x){toks.push(x);});}}}
  var i=0;
  function peek(){return toks[i];}
  function orE(){var a=andE();while(peek()&&peek().t==='OR'){i++;var b=andE();a={op:'or',a:a,b:b};}return a;}
  function andE(){var a=notE();while(peek()&&peek().t!=='OR'&&peek().t!==')'){if(peek().t==='AND')i++;var b=notE();a={op:'and',a:a,b:b};}return a;}
  function notE(){var k=peek();if(!k)throw new Error('Kueri tidak lengkap');if(k.t==='NOT'){i++;return {op:'not',a:notE()};}return prim();}
  function prim(){var k=toks[i++];if(!k)throw new Error('Kueri tidak lengkap');
    if(k.t==='('){var e=orE();if(!peek()||peek().t!==')')throw new Error('Kurung tutup “)” hilang');i++;return e;}
    if(k.t==='W'||k.t==='P'){var v=k.v,pref=/\*$/.test(v);v=v.replace(/\*+$/,'');if(!v)throw new Error('Kata kosong');
      var body=v.split(/\s+/).map(escRe).join('\\s+');return {op:'m',v:k.v,re:new RegExp('(^|[^\\p{L}\\p{N}_])'+body+(pref?'[\\p{L}\\p{N}_]*':'(?![\\p{L}\\p{N}_])'),'iu')};}
    throw new Error('Operator tidak di tempat yang benar: '+(k.t==='OR'?'OR':k.t==='AND'?'AND':k.t));}
  var ast=orE();if(i<toks.length)throw new Error('Kurung buka “(” tanpa pasangan atau sisa kueri tak terbaca');
  return ast;
}
function qEval(n,t){switch(n.op){case 'or':return qEval(n.a,t)||qEval(n.b,t);case 'and':return qEval(n.a,t)&&qEval(n.b,t);case 'not':return !qEval(n.a,t);default:return n.re.test(t);}}
function qText(r){var t=r.text||'';if(r.ext){for(var k in r.ext)if(k!=='atype')t+=' '+r.ext[k];}return t;}
function qRecompute(){
  if(!state.records)return;var n=0,tot=0;
  if(!state.q){state.records.forEach(function(r){r.qok=true;});$('qInfo').textContent='';return;}
  state.records.forEach(function(r){tot++;var t=qText(r);r.qok=!!t.trim()&&qEval(state.q.ast,t);if(r.qok)n++;});
  $('qInfo').innerHTML='<b>'+fmt(n)+'</b> dari '+fmt(tot)+' baris cocok · baris tanpa teks (like/share) ikut tersaring <button class="fchip clear" id="qClear">Hapus filter ×</button>';
  $('qClear').onclick=function(){$('qInput').value='';qApply();};
}
function qApply(){
  var raw=$('qInput').value.trim(),prev=state.q?state.q.raw:'';
  if(raw===prev)return;
  if(!raw){state.q=null;$('qInput').classList.remove('bad');qRecompute();if(state.records)run();return;}
  try{state.q={raw:raw,ast:qParse(raw)};$('qInput').classList.remove('bad');}catch(e){$('qInput').classList.add('bad');$('qInfo').innerHTML='<span class="err">'+esc(e.message)+'</span>';return;}
  qRecompute();if(state.records)run();
}
$('qInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();qApply();}});
$('qInput').addEventListener('blur',qApply);
$('qHelp').onclick=function(){$('qPop').classList.toggle('hide');};
renderProjects();
