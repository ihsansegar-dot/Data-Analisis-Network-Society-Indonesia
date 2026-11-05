/* ---------- VOSviewer: normalization, VOS layout, node size, export ---------- */
state.vos={norm:'none',layout:'force',attr:2,rep:1,size:'pr'};
function vosNormName(){return state.vos.norm==='association'?'Association strength':'None (tanpa normalisasi)';}
/* similarity matrix (undirected) for displayed nodes */
function vosSims(nodes,links){
  var idx=new Map();nodes.forEach(function(n,i){idx.set(n.id,i);});
  var n=nodes.length,adj=[];for(var i=0;i<n;i++)adj.push(new Map());
  var d=cur(),und=state.net==='cooc';
  // use full edge list of current graph among displayed nodes (both directions summed)
  d.g.edges.forEach(function(e){if(e.s===e.t)return;var a=idx.get(e.s),b=idx.get(e.t);if(a===undefined||b===undefined)return;if(und&&e.s>e.t)return;
    adj[a].set(b,(adj[a].get(b)||0)+e.w);adj[b].set(a,(adj[b].get(a)||0)+e.w);});
  if(state.vos.norm==='association')adj=SNA.associationNormalize(adj);
  var pairs=[];adj.forEach(function(m,i){m.forEach(function(v,j){if(j>i&&v>0)pairs.push([i,j,v]);});});
  return pairs;
}
var vosRun=null;
function runVOS(){
  if(vosRun){cancelAnimationFrame(vosRun.raf);vosRun=null;}
  var nodes=view.nodes,n=nodes.length;if(n<1){return;}
  if(view.sim)view.sim.stop();
  var pairs=vosSims(nodes,view.links),a=state.vos.attr,r=state.vos.rep;
  var ms=0;pairs.forEach(function(p){ms+=p[2];});ms=pairs.length?ms/pairs.length:1;pairs.forEach(function(p){p[2]/=ms;});
  // connected components
  var par=new Int32Array(n);for(var i=0;i<n;i++)par[i]=i;
  function f(x){while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;}
  pairs.forEach(function(p){var x=f(p[0]),y=f(p[1]);if(x!==y)par[x]=y;});
  var cm=new Map();for(i=0;i<n;i++){var rt=f(i);if(!cm.has(rt))cm.set(rt,[]);cm.get(rt).push(i);}
  var comps=Array.from(cm.values()).sort(function(x,y){return y.length-x.length;});
  var compOf=new Int32Array(n);comps.forEach(function(c,ci){c.forEach(function(i){compOf[i]=ci;});});
  var X=new Float64Array(n),Y=new Float64Array(n),rng=SNA.mulberry32(state.opts?state.opts.seed:42);
  for(i=0;i<n;i++){X[i]=(rng()-0.5)*2;Y[i]=(rng()-0.5)*2;}
  var GX=new Float64Array(n),GY=new Float64Array(n),step=1,it=0,MAX=n>1200?260:360,grav=0.01;
  function pw(dd,e){return e===2?1:e===1?1/dd:e===0?1/(dd*dd):Math.pow(dd,e-2);}
  function iterate(){
    GX.fill(0);GY.fill(0);
    for(var q=0;q<pairs.length;q++){var p=pairs[q],i=p[0],j=p[1],dx=X[i]-X[j],dy=Y[i]-Y[j],dd=Math.sqrt(dx*dx+dy*dy)+1e-9,fa=p[2]*pw(dd,a);GX[i]+=fa*dx;GY[i]+=fa*dy;GX[j]-=fa*dx;GY[j]-=fa*dy;}
    comps.forEach(function(c){var m=c.length;if(m<2)return;var cx=0,cy=0;c.forEach(function(i){cx+=X[i];cy+=Y[i];});cx/=m;cy/=m;
      var full=m<=700,K=full?m-1:90,sc=full?1:(m-1)/K;
      c.forEach(function(i){var rx=0,ry=0;
        if(full){for(var t=0;t<m;t++){var j=c[t];if(j===i)continue;var dx=X[i]-X[j],dy=Y[i]-Y[j],dd=Math.sqrt(dx*dx+dy*dy)+1e-9,fr=pw(dd,r);rx+=fr*dx;ry+=fr*dy;}}
        else{for(var k=0;k<K;k++){var j=c[Math.floor(rng()*m)];if(j===i)continue;var dx=X[i]-X[j],dy=Y[i]-Y[j],dd=Math.sqrt(dx*dx+dy*dy)+1e-9,fr=pw(dd,r);rx+=fr*dx*sc;ry+=fr*dy*sc;}}
        GX[i]+=-rx+grav*m*(X[i]-cx);GY[i]+=-ry+grav*m*(Y[i]-cy);});});
    for(var i2=0;i2<n;i2++){var gl=Math.sqrt(GX[i2]*GX[i2]+GY[i2]*GY[i2]);if(gl>0){X[i2]-=step*GX[i2]/gl;Y[i2]-=step*GY[i2]/gl;}}
    step=Math.max(0.002,step*0.985);it++;
  }
  function apply(){
    // scale each component so its mean radius ~ sqrt(size)*k, then shelf-pack components
    var unit=34,boxes=[];
    comps.forEach(function(c){var m=c.length,cx=0,cy=0;c.forEach(function(i){cx+=X[i];cy+=Y[i];});cx/=m;cy/=m;
      var md=0;c.forEach(function(i){md+=Math.sqrt((X[i]-cx)*(X[i]-cx)+(Y[i]-cy)*(Y[i]-cy));});md=md/m;
      var S=m<2?1:(Math.sqrt(m)*unit)/(md||1),x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,pts=[];
      c.forEach(function(i){var x=(X[i]-cx)*S,y=(Y[i]-cy)*S;pts.push([i,x,y]);var rr=nodes[i].r+6;x0=Math.min(x0,x-rr);y0=Math.min(y0,y-rr);x1=Math.max(x1,x+rr);y1=Math.max(y1,y+rr);});
      boxes.push({pts:pts,w:x1-x0,h:y1-y0,x0:x0,y0:y0});});
    var total=0;boxes.forEach(function(b){total+=b.w*b.h;});var rowW=Math.max(boxes[0].w,Math.sqrt(total)*1.35),gap=30,cx2=0,cy2=0,rowH=0;
    boxes.forEach(function(b){if(cx2>0&&cx2+b.w>rowW){cx2=0;cy2+=rowH+gap;rowH=0;}b.ox=cx2-b.x0;b.oy=cy2-b.y0;cx2+=b.w+gap;rowH=Math.max(rowH,b.h);});
    var W=0,H=0;boxes.forEach(function(b){W=Math.max(W,b.ox+b.x0+b.w);H=Math.max(H,b.oy+b.y0+b.h);});
    boxes.forEach(function(b){b.pts.forEach(function(p){var nd=nodes[p[0]];nd.x=p[1]+b.ox-W/2;nd.y=p[2]+b.oy-H/2;nd.vx=0;nd.vy=0;});});
    draw();
  }
  vosRun={raf:0};
  (function frame(){var t0=performance.now();while(it<MAX&&performance.now()-t0<14)iterate();apply();
    if(it<MAX&&vosRun){vosRun.raf=requestAnimationFrame(frame);}else{vosRun=null;fit();}})();
}
function nodeSizeVal(i,g,m){
  if(state.vos.size==='tls'){return m.inW[i]+m.outW[i];}
  if(state.vos.size==='links'){return m.inC[i]+m.outC[i];}
  return m.pagerank[i];
}
function sizeLabel(){return state.vos.size==='tls'?'Total link strength':state.vos.size==='links'?'Links':'PageRank';}
/* export current network in VOSviewer formats */
function vosExport(){
  var d=cur();if(!d){toast('Buka satu platform dan jaringan terlebih dahulu.');return;}
  var g=d.g,m=d.m,und=new Map(),posMap=new Map();
  view.nodes.forEach(function(n){posMap.set(n.id,[n.x,n.y]);});
  g.edges.forEach(function(e){if(e.s===e.t)return;if(state.net==='cooc'&&e.s>e.t)return;var a=Math.min(e.s,e.t),b=Math.max(e.s,e.t),k=a+'|'+b;und.set(k,(und.get(k)||0)+e.w);});
  var links=[],lk=new Map(),tl=new Map();und.forEach(function(w,k){var p=k.split('|');links.push([+p[0],+p[1],w]);lk.set(+p[0],(lk.get(+p[0])||0)+1);lk.set(+p[1],(lk.get(+p[1])||0)+1);tl.set(+p[0],(tl.get(+p[0])||0)+w);tl.set(+p[1],(tl.get(+p[1])||0)+w);});
  var se=m.sent,lab=function(i){return isEnt(g.labels[i])?dispLabel(g.labels[i]):g.labels[i];};
  var xy=function(i){var p=posMap.get(i);return p&&isFinite(p[0])?[+(p[0]/100).toFixed(4),+(-p[1]/100).toFixed(4)]:null;};
  var hasXY=g.labels.every(function(_,i){return !!xy(i);});
  var clean=function(s){return String(s).replace(/[\t\r\n]+/g,' ');};
  // map file
  var hasO=se.outMean.some(function(x){return x!=null;}),hasI=se.inMean.some(function(x){return x!=null;});
  var head=['id','label','description'].concat(hasXY?['x','y']:[]).concat(['cluster','weight<Links>','weight<Total link strength>','weight<PageRank>']).concat(hasO?['score<Sentimen ditulis>']:[]).concat(hasI?['score<Sentimen diterima>']:[]);
  var M=[head.join('\t')];
  g.labels.forEach(function(_,i){var p=xy(i);M.push([i+1,clean(lab(i)),clean(ECAT[nodeType(g.labels[i])].name+' · '+pName(state.plat))].concat(hasXY?[p[0],p[1]]:[]).concat([m.community[i]+1,lk.get(i)||0,tl.get(i)||0,(m.pagerank[i]*1000).toFixed(4)]).concat(hasO?[se.outMean[i]==null?'':se.outMean[i].toFixed(4)]:[]).concat(hasI?[se.inMean[i]==null?'':se.inMean[i].toFixed(4)]:[]).join('\t'));});
  var N=links.map(function(l){return (l[0]+1)+'\t'+(l[1]+1)+'\t'+l[2];});
  // json
  var cl=new Set();m.community.forEach(function(c){cl.add(c);});
  var json={network:{items:g.labels.map(function(_,i){var p=xy(i),it={id:i+1,label:lab(i),description:'<b>'+esc(lab(i))+'</b><br>Tipe: '+ECAT[nodeType(g.labels[i])].name+'<br>Platform: '+esc(pName(state.plat))+'<br>In/out-degree: '+m.inW[i]+' / '+m.outW[i]+'<br>Betweenness: '+m.betweenness[i].toFixed(5),cluster:m.community[i]+1,
      weights:{'Links':lk.get(i)||0,'Total link strength':tl.get(i)||0,'PageRank':+(m.pagerank[i]*1000).toFixed(4)},scores:{}};
      if(p){it.x=p[0];it.y=p[1];}if(se.outMean[i]!=null)it.scores['Sentimen ditulis']=+se.outMean[i].toFixed(4);if(se.inMean[i]!=null)it.scores['Sentimen diterima']=+se.inMean[i].toFixed(4);return it;}),
    links:links.map(function(l){return{source_id:l[0]+1,target_id:l[1]+1,strength:l[2]};}),
    clusters:Array.from(cl).sort(function(a,b){return a-b;}).map(function(c){return{cluster:c+1,label:'Komunitas '+c};})},
    info:{title:appName()+' — '+pName(state.plat)+' · '+netName(state.plat,state.net),description:'Diekspor dari '+appName()+'. Link tak berarah (dua arah dijumlahkan), strength = jumlah interaksi mentah. Normalisasi di aplikasi: '+vosNormName()+'. Layout: '+(state.vos.layout==='vos'?'VOS (attraction '+state.vos.attr+', repulsion '+state.vos.rep+')':'force-directed')+'.'}};
  var base=fileBase()+'_'+slug(pName(state.plat))+'_'+slug(netName(state.plat,state.net))+'_vosviewer';
  save(base+'.zip',zip([{name:base+'_map.txt',data:M.join('\n')},{name:base+'_network.txt',data:N.join('\n')},{name:base+'.json',data:JSON.stringify(json,null,1)}]));
}
state.vos.quick=null;
var QUICK={
  account:{vis:{account:1,person:1,news:1,org:1},fams:{mention:1,retweet:1,reply:1,cooc:0,quote:0},net:['retweet','reply','mention'],desc:'Akun ↔ akun: jaringan Retweet/Share, Reply/Komentar, dan Mention. Entitas disembunyikan.'},
  acctopic:{vis:{account:1,person:1,news:1,org:1,term:1,hashtag:1},fams:{quote:1,cooc:0},net:['quote'],desc:'Akun → topik: jaringan Quote (akun → Term & #Hashtag, media → entitas, quote akun).'},
  actortopic:{vis:{person:1,news:1,org:1,term:1,hashtag:1},fams:{quote:1,cooc:0},net:['quote'],desc:'Aktor bernama (Person, Organisasi, News Site) → Term & #Hashtag. Akun umum disembunyikan.'},
  cooc:{vis:{person:1,news:1,org:1,loc:1,place:1,term:1,hashtag:1},fams:{cooc:1},net:['cooc'],desc:'Co-occurrence: Named Entity ↔ Named Entity dan #Hashtag ↔ #Hashtag yang muncul dalam teks yang sama.'}};
function setFam(f,on){if(state.fams.hasOwnProperty(f))state.fams[f]=!!on;else LTYPES.forEach(function(l){if(l[1]===f)state.links[l[0]]=!!on;});}
function applyQuick(q){
  var Q=QUICK[q];if(!Q)return;state.vos.quick=q;
  NTYPES.forEach(function(t){state.vis[t[0]]=!!Q.vis[t[0]];});
  for(var f in Q.fams)setFam(f,Q.fams[f]);
  syncVisUI();document.querySelectorAll('.lfam').forEach(function(i){i.checked=famOn(i.dataset.f);i.closest('.ntrow').classList.toggle('off',!i.checked);});
  applyVosUI();
  if(!state.all)return;
  if(state.plat==='all'){renderEntOverview();updateTypeCounts();updateLinkCounts();toast('Quick setting diterapkan; pilih satu platform untuk melihat grafnya.');return;}
  var tgt=Q.net.filter(function(n){return hasNet(state.plat,n)&&famOn(n);})[0];
  if(!tgt){show(state.net,false);toast('Tidak ada data untuk '+$('vQuick').querySelector('[data-v='+q+']').textContent+' di '+pName(state.plat)+'.',5000);return;}
  if(q!=='account'&&!state._qTypeSet){$('cMode').value='type';}
  show(tgt,false);ensureGraphVisible();
}
function applyVosUI(){
  $('vGraph').querySelectorAll('.vbtn').forEach(function(b){b.classList.toggle('on',b.dataset.v===state.vos.layout);});
  $('vNorm').querySelectorAll('.vbtn').forEach(function(b){b.classList.toggle('on',b.dataset.v===state.vos.norm);});
  $('vQuick').querySelectorAll('.vbtn').forEach(function(b){b.classList.toggle('on',b.dataset.v===state.vos.quick);});
  $('vqDesc').textContent=state.vos.quick?QUICK[state.vos.quick].desc:'Pilih Quick Setting untuk mengatur tipe node, jenis link, dan jaringan sekaligus.';
  $('vSize').value=state.vos.size;$('vAR').classList.toggle('hide',state.vos.layout!=='vos');
}
$('vGraph').querySelectorAll('.vbtn').forEach(function(b){b.onclick=function(){if(state.vos.layout===b.dataset.v)return;state.vos.layout=b.dataset.v;applyVosUI();if(cur())buildView();};});
$('vNorm').querySelectorAll('.vbtn').forEach(function(b){b.onclick=function(){if(state.vos.norm===b.dataset.v)return;state.vos.norm=b.dataset.v;applyVosUI();if(state.records){toast('Normalisasi: '+vosNormName()+'. Menghitung ulang klaster…');run();}};});
$('vQuick').querySelectorAll('.vbtn').forEach(function(b){b.onclick=function(){applyQuick(b.dataset.v);};});
$('vSize').onchange=function(){state.vos.size=this.value;if(cur())buildView();};
$('vAttr').onchange=function(){var x=parseInt(this.value,10);if(isNaN(x))x=2;state.vos.attr=Math.max(-2,Math.min(4,x));if(state.vos.attr<=state.vos.rep)state.vos.attr=state.vos.rep+1;this.value=state.vos.attr;if(state.vos.layout==='vos'&&cur())runVOS();};
$('vRep').onchange=function(){var x=parseInt(this.value,10);if(isNaN(x))x=1;state.vos.rep=Math.max(-2,Math.min(3,x));if(state.vos.rep>=state.vos.attr)state.vos.rep=state.vos.attr-1;this.value=state.vos.rep;if(state.vos.layout==='vos'&&cur())runVOS();};
$('vRelayout').onclick=function(){if(!cur()){toast('Buka satu platform terlebih dahulu.');return;}if(state.vos.layout==='vos')runVOS();else buildView();};
$('vExport').onclick=vosExport;
// manual changes elsewhere clear the quick-setting highlight
document.querySelectorAll('.ntv,.lfam').forEach(function(i){i.addEventListener('change',function(){state.vos.quick=null;applyVosUI();});});
['ntAll','ntAcc','ntEnt'].forEach(function(id){$(id).addEventListener('click',function(){state.vos.quick=null;applyVosUI();});});
applyVosUI();
