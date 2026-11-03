/* ---------- PDF report ---------- */
function pdfSafe(s){return String(s).replace(/\p{Extended_Pictographic}|[\uFE0F\u200D\u20E3]|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/ {2,}/g,' ').replace(/[→]/g,'->').replace(/[–—−]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/…/g,'...').replace(/[^\x20-\x7E -ÿ]/g,'?');}
function layoutFor(p,net,maxNodes){
  var d=state.all.res[p][net],g=d.g,m=d.m;
  if(view.key===p+'|'+net&&view.nodes.length) return {nodes:view.nodes.map(function(n){return{id:n.id,label:n.label,x:n.x,y:n.y,r:n.r,c:commColor(m.community[n.id]),sh:NSHAPE[nodeType(n.label)]};}),links:view.links.map(function(l){return{s:l.source,t:l.target,w:l.w};})};
  var order=g.labels.map(function(_,i){return i;}).sort(function(a,b){return m.pagerank[b]-m.pagerank[a];});
  var keep=order.slice(0,Math.min(g.n,maxNodes||1500)),set=new Set(keep),maxPr=m.pagerank[order[0]]||1,pos=new Map();
  var nodes=keep.map(function(i){var n={id:i,label:g.labels[i],r:2.5+20*Math.sqrt(m.pagerank[i]/maxPr),c:commColor(m.community[i]),sh:NSHAPE[nodeType(g.labels[i])]};pos.set(i,n);return n;});
  var links=g.edges.filter(function(e){return e.s!==e.t&&set.has(e.s)&&set.has(e.t);}).map(function(e){return{source:pos.get(e.s),target:pos.get(e.t),w:e.w};});
  var n=nodes.length,sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).distance(function(l){return 18+l.source.r+l.target.r;}).strength(0.3))
    .force('charge',d3.forceManyBody().strength(n>800?-18:n>300?-35:-60).theta(0.9).distanceMax(600)).force('collide',d3.forceCollide(function(d){return d.r+1.5;}))
    .force('x',d3.forceX(0).strength(0.04)).force('y',d3.forceY(0).strength(0.04)).stop();
  for(var k=0;k<(n>1000?200:300);k++) sim.tick();
  return {nodes:nodes,links:links.map(function(l){return{s:l.source,t:l.target,w:l.w};})};
}
function snapshot(lay,W,H,nLabels,dark){
  var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.fillStyle=dark?'#06124a':'#ffffff';x.fillRect(0,0,W,H);
  if(!lay.nodes.length) return c.toDataURL('image/png');
  var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;lay.nodes.forEach(function(n){x0=Math.min(x0,n.x-n.r);y0=Math.min(y0,n.y-n.r);x1=Math.max(x1,n.x+n.r);y1=Math.max(y1,n.y+n.r);});
  var pad=60,k=Math.min((W-2*pad)/(x1-x0||1),(H-2*pad)/(y1-y0||1)),ox=W/2-(x0+x1)/2*k,oy=H/2-(y0+y1)/2*k;
  function X(v){return ox+v*k;}function Y(v){return oy+v*k;}
  var maxW=1;lay.links.forEach(function(l){if(l.w>maxW)maxW=l.w;});var arrows=lay.links.length<=4000,rs=Math.max(1,k*0.9);
  x.strokeStyle=dark?'#7f8fb3':'#8a94a8';x.fillStyle=x.strokeStyle;
  lay.links.forEach(function(l){var sx=X(l.s.x),sy=Y(l.s.y),tx=X(l.t.x),ty=Y(l.t.y),tr=Math.max(2,l.t.r*rs),dx=tx-sx,dy=ty-sy,dist=Math.sqrt(dx*dx+dy*dy)||1,ex=tx-dx/dist*(tr+1),ey=ty-dy/dist*(tr+1);
    x.globalAlpha=lay.links.length>4000?0.15:0.35;x.lineWidth=0.6+2.4*Math.log(1+l.w)/Math.log(1+maxW);x.beginPath();x.moveTo(sx,sy);x.lineTo(ex,ey);x.stroke();
    if(arrows&&dist>tr+8){var a=4+x.lineWidth*1.5,ux=dx/dist,uy=dy/dist;x.beginPath();x.moveTo(ex,ey);x.lineTo(ex-ux*a-uy*a*.5,ey-uy*a+ux*a*.5);x.lineTo(ex-ux*a+uy*a*.5,ey-uy*a-ux*a*.5);x.closePath();x.fill();}});
  x.globalAlpha=1;lay.nodes.forEach(function(n){shapePath(x,n.sh||'circle',X(n.x),Y(n.y),Math.max(2,n.r*rs));x.fillStyle=n.c;x.fill();x.lineWidth=1;x.strokeStyle=dark?'#06124a':'#ffffff';x.stroke();});
  x.font='600 '+Math.round(W/95)+'px Helvetica,Arial,sans-serif';x.textAlign='center';x.textBaseline='top';
  lay.nodes.slice().sort(function(a,b){return b.r-a.r;}).slice(0,nLabels).forEach(function(n){var t=dispLabel(n.label),ty=Y(n.y)+Math.max(2,n.r*rs)+3;x.lineWidth=4;x.strokeStyle=dark?'rgba(11,20,43,.95)':'rgba(255,255,255,.95)';x.strokeText(t,X(n.x),ty);x.fillStyle=dark?'#eef1ff':'#1f2937';x.fillText(t,X(n.x),ty);});
  return c.toDataURL('image/png');
}
function buildPDF(scope){
  var J=window.jspdf.jsPDF,doc=new J({unit:'mm',format:'a4',compress:true});
  var PW=210,PH=297,M=16,CW=PW-2*M,y=M,rh=5.2;
  var INK=[17,24,39],MUT=[100,110,130],LINE=[220,225,232],FILL=[244,246,250];
  function T(s,xx,yy,o){doc.text(pdfSafe(s),xx,yy,o);}
  function font(sz,st,col){doc.setFont('helvetica',st||'normal');doc.setFontSize(sz);doc.setTextColor.apply(doc,col||INK);}
  function need(h){if(y+h>PH-M-6){doc.addPage();y=M;}}
  function h2(s){need(14);font(12.5,'bold');T(s,M,y+5);y+=8;doc.setDrawColor.apply(doc,LINE);doc.setLineWidth(0.3);doc.line(M,y,M+CW,y);y+=4;}
  function h3(s){need(10);font(10.5,'bold');T(s,M,y+4);y+=7;}
  function para(s,sz,col){font(sz||9,'normal',col||MUT);doc.splitTextToSize(pdfSafe(s),CW).forEach(function(l){need(4.6);T(l,M,y+3.4);y+=4.3;});y+=1;}
  function rgbFill(hex){var c=hexRgb(hex);doc.setFillColor(c[0],c[1],c[2]);}
  function trunc(s,w){s=pdfSafe(s);while(doc.getTextWidth(s)>w&&s.length>4)s=s.slice(0,-4)+'...';return s;}
  function hline(x0,x1){doc.setDrawColor.apply(doc,LINE);doc.setLineWidth(0.15);doc.line(x0,y,x1,y);}
  function sbar(x0,y0,w,h,st){if(!st.n)return;var xx=x0;[['pos',POS],['neu',NEU],['neg',NEG]].forEach(function(p){var ww=w*st[p[0]]/st.n;if(ww>0){rgbFill(p[1]);doc.rect(xx,y0,ww,h,'F');}xx+=ww;});}
  var o=state.opts,r=state.report,now=new Date(),A=state.all;
  var plats=scope==='overview'?[]:scope==='all'?A.platforms.slice():(state.plat==='all'?[]:[state.plat]);
  var withOverview=scope!=='active'||state.plat==='all';
  var title=scope==='active'&&state.plat!=='all'?'Platform '+pName(state.plat):(scope==='overview'?'Ringkasan perbandingan antar-platform':'Semua platform');
  doc.setFillColor(10,17,34);doc.rect(0,0,PW,34,'F');
  font(17,'bold',[255,255,255]);T('Laporan Analisis Jaringan & Sentimen',M,15);
  font(10.5,'normal',[180,195,220]);T(title+' - '+(state.fileName||'data'),M,22.5);
  font(8.5,'normal',[140,155,185]);T('Dibuat '+now.toLocaleString('id-ID')+' - Jaringan Politik Partai Islam di Indonesia',M,28.5);
  y=42;
  if(state.isDemo){doc.setFillColor(254,243,199);doc.setDrawColor(245,184,74);doc.roundedRect(M,y,CW,11,1.5,1.5,'FD');font(8.5,'bold',[146,64,14]);T('DATA SINTETIS - dibangkitkan acak oleh aplikasi untuk demonstrasi; perbedaan antar-platform bukan temuan.',M+3,y+6.8);y+=16;}
  h2('Data dan pengaturan');
  var types=Object.keys(r.byType).sort(function(a,b){return r.byType[b]-r.byType[a];}).map(function(k){return k+' '+fmt(r.byType[k]);}).join(', ');
  var pc0=platCounts(),pk=Object.keys(pc0).sort(function(a,b){return pc0[b]-pc0[a];});
  var kv=[['File',state.fileName||'-'],['Jumlah baris',fmt(r.rows)+' ('+types+')'],['Baris per platform',pk.map(function(k){return pName(k)+' '+fmt(pc0[k]);}).join(', ')+(r.hasPlatform?'':' (file tanpa kolom platform; ditetapkan '+pName(state.filePlat)+')')],
    ['Rentang created_at',state.tsRange?isoDay(state.tsRange[0])+' s.d. '+isoDay(state.tsRange[1]):'tidak tersedia'],['Filter tanggal',(o.from||o.to)?(o.from?isoDay(o.from):'awal')+' s.d. '+(o.to?isoDay(o.to):'akhir'):'tidak ada (semua data)'],
    ['Analisis','per platform (akun tidak digabung lintas platform); self-loop '+(o.keepSelf?'disertakan':'dibuang')],['Louvain','seed '+o.seed+', resolusi '+o.resolution+' (proyeksi tak berarah); normalisasi: '+vosNormName()],['Layout & ukuran','layout '+(state.vos.layout==='vos'?'VOS (attraction '+state.vos.attr+', repulsion '+state.vos.rep+')':'force-directed')+'; ukuran node = '+sizeLabel()],
    ['Sentimen',(state.sent.source==='column'?'label manual ('+r.manualCol+')':state.sent.source==='ai'?'Claude AI (cakupan '+fmt(aiCoverage(null).done)+' / '+fmt(aiCoverage(null).total)+' teks unik)':'leksikon '+(state.sent.lexName?'unggahan ('+state.sent.lexName+')':'bawaan')+', '+fmt(SENT.size(state.sent.lex))+' entri')+'; teks: '+(state.sent.scope==='all'?'semua teks':'komentar/reply saja')+'; minimal '+state.sent.minN+' teks per aktor']];
  kv.forEach(function(p){need(5);font(9,'bold',MUT);T(p[0],M,y+3.4);font(9,'normal',INK);doc.splitTextToSize(pdfSafe(p[1]),CW-42).forEach(function(l,ix){if(ix)need(4.4);T(l,M+42,y+3.4);y+=4.4;});y+=0.6;});
  y+=3;
  if(withOverview){
    h2('Perbandingan antar-platform');
    var cols=[['Platform',0,'l'],['Share',38,'r'],['node',49,'r'],['Komentar',67,'r'],['node',78,'r'],['Like',93,'r'],['node',104,'r'],['Teks',117,'r'],['Sentimen (pos/net/neg)',119,'l'],['Skor',CW,'r']];
    need(rh*2);doc.setFillColor.apply(doc,FILL);doc.rect(M,y,CW,rh,'F');font(7,'bold',MUT);
    cols.forEach(function(c){T(c[0],M+(c[2]==='r'?c[1]-1:c[1]+1.5),y+3.6,c[2]==='r'?{align:'right'}:undefined);});y+=rh;
    A.platforms.forEach(function(p){var R=A.res[p],st=sentStats(p),tw=function(g){return g.edges.reduce(function(s,e){return s+e.w;},0);};need(rh+1);
      font(7.8,'normal');rgbFill(PL[p].color);doc.rect(M+1.5,y+1.4,2.2,2.2,'F');T(pName(p),M+5,y+3.6);
      var vals=[[fmt(tw(R.retweet.g)),38],[fmt(R.retweet.g.n),49],[fmt(tw(R.reply.g)),67],[fmt(R.reply.g.n),78],[R.like?fmt(tw(R.like.g)):'-',93],[R.like?fmt(R.like.g.n):'-',104],[fmt(st.n),117]];
      vals.forEach(function(v){T(v[0],M+v[1]-1,y+3.6,{align:'right'});});
      if(st.n){sbar(M+120,y+1.3,17,2.6,st);font(6.8,'normal',MUT);T(fmt(100*st.pos/st.n,0)+' / '+fmt(100*st.neu/st.n,0)+' / '+fmt(100*st.neg/st.n,0)+' %',M+139,y+3.6);}else{font(7,'normal',MUT);T('tidak ada teks',M+120,y+3.6);}
      font(7.8,'bold',hexRgb(sentColor(st.mean)));T(fmtS(st.mean),M+CW-1,y+3.6,{align:'right'});y+=rh;hline(M,M+CW);});
    y+=2;if(state.ent.ready&&state.ent.meta.size){var tot=entStats(null).slice(0,15);if(tot.length){y+=2;h3('Entitas teratas per platform (jumlah sebutan)');var pls=A.platforms,cw2=(CW-50)/(pls.length+1);need(rh*2);doc.setFillColor.apply(doc,FILL);doc.rect(M,y,CW,rh,'F');font(6.8,'bold',MUT);T('Entitas',M+1.5,y+3.6);pls.forEach(function(pp,ix){T(trunc(pName(pp),cw2-1),M+50+cw2*(ix+1)-1,y+3.6,{align:'right'});});T('Total',M+CW-1,y+3.6,{align:'right'});y+=rh;
      var per={};pls.forEach(function(pp){per[pp]=new Map();entStats(pp).forEach(function(o){per[pp].set(o.k,o.n);});});
      tot.forEach(function(o){need(rh);font(7.5,'normal');T(trunc(entName(o.k)+' ('+ECAT[entCat(o.k)].name+')',48),M+1.5,y+3.6);pls.forEach(function(pp,ix){var v=per[pp].get(o.k)||0;font(7.5,'normal',v?INK:MUT);T(v?fmt(v):'-',M+50+cw2*(ix+1)-1,y+3.6,{align:'right'});});font(7.5,'bold');T(fmt(o.n),M+CW-1,y+3.6,{align:'right'});y+=rh;hline(M,M+CW);});y+=3;}}
    para('Share = jumlah interaksi share/retweet/repost; Komentar = jumlah interaksi komentar/reply; Like = jumlah like (tidak berlaku untuk Media Online); node = akun unik; Skor = rata-rata skor sentimen (-1...+1). Jaringan tiap platform dihitung terpisah.',7.5);
    y+=3;
  }
  plats.forEach(function(p){
    var R=A.res[p];doc.addPage();y=M;
    rgbFill(PL[p].color);doc.rect(M,y,3,9,'F');font(15,'bold');T('Platform: '+pName(p),M+6,y+7);y+=14;
    netsOf(p).forEach(function(net){
      var d=R[net];if(!d)return;var g=d.g,m=d.m;
      h2(pName(p)+' - jaringan '+netName(p,net)+'  ('+(net==='like'?'penyuka -> pemilik postingan':net==='mention'?'penulis -> @akun disebut':net==='cooc'?'co-occurrence, tak berarah':net==='quote'?'sumber -> dikutip/disebut':'author -> target_user')+', bobot = jumlah '+(net==='cooc'?'teks':net==='quote'?'kutipan/sebutan':'interaksi')+')');
      var totW=g.edges.reduce(function(s,e){return s+e.w;},0);
      var K=[['Node',fmt(g.n)],['Edge',fmt(g.edges.length)],['Interaksi',fmt(totW)],['Densitas',m.density<0.001&&m.density>0?m.density.toExponential(2):fmt(m.density,4)],['Resiprositas',fmt(m.reciprocity*100,1)+'%'],['Komunitas',fmt(m.communities)],['Modularitas Q',fmt(m.modularity,3)],['Komponen lemah',fmt(m.components.count)+' (terbesar '+fmt(m.components.largest)+')']];
      need(26);var bw=(CW-9)/4;
      K.forEach(function(k,i){var bx=M+(i%4)*(bw+3),by=y+Math.floor(i/4)*12;doc.setFillColor.apply(doc,FILL);doc.setDrawColor.apply(doc,LINE);doc.roundedRect(bx,by,bw,10.5,1.5,1.5,'FD');font(7,'normal',MUT);T(k[0],bx+2.5,by+3.8);font(k[1].length>12?8.5:10.5,'bold');T(k[1],bx+2.5,by+8.6);});
      y+=26;
      if(!g.n){para('Jaringan kosong: tidak ada baris '+netName(p,net).toLowerCase()+' dengan target_user'+((o.from||o.to)?' pada rentang tanggal ini':'')+'.',9,INK);y+=4;return;}
      var room=PH-M-6-y-18,ih=CW*0.62;if(room<ih&&room>=100)ih=room;need(ih+12);
      var lay=layoutFor(p,net,1500),img=snapshot(lay,2000,Math.round(2000*ih/CW),16);
      doc.setDrawColor.apply(doc,LINE);doc.addImage(img,'PNG',M,y,CW,ih,undefined,'FAST');doc.rect(M,y,CW,ih);y+=ih+3;
      font(7.5,'normal',MUT);doc.splitTextToSize(pdfSafe('Gambar: graf force-directed, ukuran node = PageRank, warna = komunitas Louvain, bentuk = tipe node (lingkaran Account, bintang Person, kotak News Site, belah ketupat Organisasi, segitiga Lokasi, segitiga terbalik Tempat, segi lima Term, segi enam #Hashtag), ketebalan edge = bobot.'+(lay.nodes.length<g.n?' Ditampilkan '+fmt(lay.nodes.length)+' dari '+fmt(g.n)+' node dengan PageRank tertinggi.':'')),CW).forEach(function(l){T(l,M,y+2.8);y+=3.6;});y+=2;
      var size=new Map();m.community.forEach(function(c){size.set(c,(size.get(c)||0)+1);});var lx=M;need(6);font(7.5,'normal');
      for(var c=0;c<Math.min(PALETTE.length,m.communities);c++){var lab='K'+c+' ('+size.get(c)+')',wv=doc.getTextWidth(lab)+7;if(lx+wv>M+CW){lx=M;y+=4.5;need(5);}rgbFill(PALETTE[c]);doc.circle(lx+1.4,y+1.9,1.3,'F');T(lab,lx+3.6,y+3);lx+=wv;}
      if(m.communities>PALETTE.length){var labO='lainnya ('+(m.communities-PALETTE.length)+' kom.)';if(lx+doc.getTextWidth(labO)+7>M+CW){lx=M;y+=4.5;}rgbFill(OTHER);doc.circle(lx+1.4,y+1.9,1.3,'F');T(labO,lx+3.6,y+3);}
      y+=8;
      var defs=tableDefs(g,m,p,net),tw=(CW-6)/2,th=8+11*rh;
      for(var q=0;q<4;q+=2){need(th+4);[0,1].forEach(function(z){
        var dd=defs[q+z],tx=M+z*(tw+6),ty=y,top=topIdx(g,dd.val);
        font(10,'bold');T(dd.t,tx,ty+3.5);var tWd=doc.getTextWidth(dd.t);font(7,'normal',MUT);T(trunc('top 10 - '+dd.sub,tw-tWd-4),tx+tWd+2.5,ty+3.5);
        ty+=6;doc.setFillColor.apply(doc,FILL);doc.rect(tx,ty,tw,rh,'F');font(7,'bold',MUT);T('#',tx+1.5,ty+3.6);T('Aktor',tx+7,ty+3.6);T('Kom.',tx+tw*0.56,ty+3.6);T('Nilai',tx+tw-1.5,ty+3.6,{align:'right'});
        top.forEach(function(i,rk){var yy=ty+rh*(rk+1);font(7.8,'normal',MUT);T(String(rk+1),tx+1.5,yy+3.6);font(7.8,'normal');T(trunc(dispLabel(g.labels[i])+(nodeType(g.labels[i])!=='account'?' ['+ECAT[nodeType(g.labels[i])].name+']':''),tw*0.47),tx+7,yy+3.6);
          rgbFill(commColor(m.community[i]));doc.circle(tx+tw*0.56+1.2,yy+2.5,1.1,'F');T(String(m.community[i]),tx+tw*0.56+3.5,yy+3.6);T(dd.f(i)+(dd.extra?'  ('+dd.extra(i)+')':''),tx+tw-1.5,yy+3.6,{align:'right'});
          doc.setDrawColor.apply(doc,LINE);doc.setLineWidth(0.15);doc.line(tx,yy+rh,tx+tw,yy+rh);});
      });y+=th+5;}
      h3('Ringkasan komunitas - '+netName(p,net));
      var members=new Map();g.labels.forEach(function(_,i){var cc=m.community[i];if(!members.has(cc))members.set(cc,[]);members.get(cc).push(i);});
      need(rh*2);doc.setFillColor.apply(doc,FILL);doc.rect(M,y,CW,rh,'F');font(7,'bold',MUT);T('Kom.',M+1.5,y+3.6);T('Akun',M+16,y+3.6);T('% node',M+30,y+3.6);T('Skor sentimen',M+46,y+3.6);T('Aktor teratas (PageRank)',M+70,y+3.6);y+=rh;
      Array.from(members.keys()).sort(function(a,b){return a-b;}).slice(0,10).forEach(function(cc){
        var mem=members.get(cc).sort(function(a,b){return m.pagerank[b]-m.pagerank[a];}),ss=0,sn=0;mem.forEach(function(i){if(m.sent.outN[i]){ss+=m.sent.outMean[i]*m.sent.outN[i];sn+=m.sent.outN[i];}});
        var ls=doc.splitTextToSize(pdfSafe(mem.slice(0,5).map(function(i){return dispLabel(g.labels[i]);}).join(', ')),CW-72),hh=Math.max(rh,ls.length*3.8+1.6);need(hh);
        rgbFill(commColor(cc));doc.circle(M+2.6,y+2.5,1.1,'F');font(7.8,'normal');T(String(cc),M+5,y+3.6);T(fmt(mem.length),M+16,y+3.6);T(fmt(100*mem.length/g.n,1)+'%',M+30,y+3.6);
        font(7.8,'normal',sn?hexRgb(sentColor(ss/sn)):MUT);T(sn?fmtS(ss/sn)+' (n='+sn+')':'-',M+46,y+3.6);font(7.8,'normal');
        ls.forEach(function(l,ix){T(l,M+70,y+3.6+ix*3.8);});y+=hh;hline(M,M+CW);});
      if(m.communities>10)para(fmt(m.communities-10)+' komunitas kecil lainnya tidak ditampilkan. Skor sentimen komunitas = rata-rata teks yang ditulis anggotanya.',7.5);
      y+=5;
    });
    if(state.ent.ready&&state.ent.meta.size){var es=entStats(p).slice(0,15);if(es.length){h2(pName(p)+' - entitas & kata kunci');need(rh*2);doc.setFillColor.apply(doc,FILL);doc.rect(M,y,CW,rh,'F');font(7,'bold',MUT);T('Entitas',M+1.5,y+3.6);T('Kategori',M+62,y+3.6);T('Sebutan',M+100,y+3.6,{align:'right'});T('Akun',M+116,y+3.6,{align:'right'});T('Komentar',M+134,y+3.6,{align:'right'});T('Sentimen',M+138,y+3.6);T('Skor',M+CW-1,y+3.6,{align:'right'});y+=rh;
      es.forEach(function(o){need(rh);font(7.8,'normal');T(trunc(entName(o.k),58),M+1.5,y+3.6);font(7.5,'normal',hexRgb(ECAT[entCat(o.k)].color));T(ECAT[entCat(o.k)].name,M+62,y+3.6);font(7.8,'normal');T(fmt(o.n),M+100,y+3.6,{align:'right'});T(fmt(o.acc.size),M+116,y+3.6,{align:'right'});T(fmt(o.c),M+134,y+3.6,{align:'right'});
        if(o.ns)sbar(M+138,y+1.4,22,2.6,o);var mm=o.ns?o.sum/o.ns:null;font(7.8,'bold',mm==null?MUT:hexRgb(sentColor(mm)));T(fmtS(mm),M+CW-1,y+3.6,{align:'right'});y+=rh;hline(M,M+CW);});
      para('Sentimen entitas = sentimen teks yang menyebut entitas tersebut, bukan sentimen yang pasti ditujukan kepadanya.',7.5);y+=3;}}
    // sentiment
    var st=sentStats(p);
    h2(pName(p)+' - analisis sentimen '+(state.sent.scope==='all'?'(semua teks)':'(komentar/reply)'));
    if(!st.n){para('Tidak ada teks bersentimen untuk platform ini.',9,INK);return;}
    need(30);
    ['pos','neu','neg'].forEach(function(l,ix){var yy=y+ix*6.5;font(9,'normal');T(labName(l),M,yy+3.6);doc.setFillColor.apply(doc,FILL);doc.rect(M+20,yy+1,90,3.4,'F');rgbFill(labColor(l));doc.rect(M+20,yy+1,90*st[l]/st.n,3.4,'F');font(9,'bold');T(pct(st[l],st.n),M+114,yy+3.6);font(8,'normal',MUT);T('('+fmt(st[l])+')',M+130,yy+3.6);});
    y+=21;para('Teks dianalisis: '+fmt(st.n)+' - skor rata-rata: '+fmtS(st.mean)+' (skala -1...+1). Sumber: '+srcName()+'. Interval kepercayaan 95% (Wilson): positif '+ciTxt(st.pos,st.n)+', netral '+ciTxt(st.neu,st.n)+', negatif '+ciTxt(st.neg,st.n)+'.'+(st.n<30?' Perhatian: n < 30, persentase tidak stabil.':'')+(state.sent.source==='ai'?' Sarkasme terdeteksi AI: '+fmt(st.recs.filter(function(x){return x.ai&&x.ai.sar;}).length)+' teks.':''),8.5,INK);
    var days=Array.from(st.days.keys()).sort();
    if(days.length){need(48);h3('Tren harian');var cx=M+8,cw=CW-8,chH=34,base=y+chH,mx=1;days.forEach(function(dk){var oo=st.days.get(dk);mx=Math.max(mx,oo.pos+oo.neu+oo.neg);});
      doc.setDrawColor.apply(doc,LINE);doc.setLineWidth(0.15);[0,.5,1].forEach(function(f){var yy=base-chH*f;doc.line(cx,yy,cx+cw,yy);font(6.5,'normal',MUT);T(String(Math.round(mx*f)),cx-1.5,yy+1,{align:'right'});});
      var bw2=cw/days.length;days.forEach(function(dk,i){var oo=st.days.get(dk),b=base;['neg','neu','pos'].forEach(function(l){if(!oo[l])return;var hh=chH*oo[l]/mx;rgbFill(labColor(l));doc.rect(cx+i*bw2+bw2*.12,b-hh,Math.max(.3,bw2*.76),hh,'F');b-=hh;});});
      var step=Math.ceil(days.length/8);font(6.5,'normal',MUT);days.forEach(function(dk,i){if(i%step===0)T(dk.slice(5),cx+i*bw2+bw2/2,base+3.5,{align:'center'});});y=base+7;}
    if(r.hasManual){var arec=agreeRecs(p);[['Leksikon','lx'],['Claude AI','ai']].forEach(function(kk){var ag=agreement(arec,kk[1]);if(!ag)return;
      h3('Validasi: '+kk[0]+' vs label manual (n = '+fmt(ag.n)+')');para('Akurasi '+pct(ag.acc,1)+' (95% CI '+ciTxt(Math.round(ag.acc*ag.n),ag.n)+') - Cohen kappa '+fmt(ag.kappa,3)+'. '+ag.per.map(function(x){return labName(x.l)+': P '+fmt(x.p,2)+', R '+fmt(x.r,2)+', F1 '+fmt(x.f,2);}).join('; ')+'. Matriks (baris = manual, kolom = '+kk[0]+' pos/net/neg): '+['pos','neu','neg'].map(function(a){return labName(a)+' ['+ag.M[a].pos+', '+ag.M[a].neu+', '+ag.M[a].neg+']';}).join(' '),8.5,INK);});}
    var ws=wordStats(st.recs);
    var lat=function(arr){return arr.filter(function(w){return /^[\x20-\xFF]+$/.test(w[0]);}).slice(0,20).map(function(w){return w[0]+' ('+w[1]+')';}).join(', ')||'-';};if(ws.pos.length||ws.neg.length||ws.neu.length){need(24);h3('Kata teratas');para('Positif: '+lat(ws.pos),8.5,INK);para('Negatif: '+lat(ws.neg),8.5,INK);para('Netral (kata topik di luar leksikon): '+lat(ws.neu),8.5,INK);}
    var rcv=new Map(),wrt=new Map();
    st.recs.forEach(function(x){var oo=wrt.get(x.a)||{n:0,pos:0,neu:0,neg:0,sum:0};oo.n++;oo.sum+=x.s;oo[x.lab]++;wrt.set(x.a,oo);if(x.t&&x.t!==x.a){var qq=rcv.get(x.t)||{n:0,pos:0,neu:0,neg:0,sum:0};qq.n++;qq.sum+=x.s;qq[x.lab]++;rcv.set(x.t,qq);}});
    var tw2=(CW-6)/2,th2=8+11*rh;
    ['pos','neg','neu'].forEach(function(lab){
      var ln=labName(lab).toLowerCase(),colr=hexRgb(labColor(lab));
      need(th2+12);h3('Aktor '+ln+' (n >= '+state.sent.minN+' teks)');
      [[rcv,'Paling banyak menerima komentar '+ln],[wrt,'Paling banyak menulis komentar '+ln]].forEach(function(pr,z){
        var tx=M+z*(tw2+6),ty=y,arr=Array.from(pr[0].entries()).filter(function(e){return e[1][lab]>0&&e[1].n>=state.sent.minN;}).sort(function(a,b){return b[1][lab]-a[1][lab]||b[1].n-a[1].n;}).slice(0,10);
        font(8.3,'bold');T(trunc(pr[1],tw2),tx,ty+3.5);ty+=6;doc.setFillColor.apply(doc,FILL);doc.rect(tx,ty,tw2,rh,'F');font(7,'bold',MUT);
        T('Aktor',tx+1.5,ty+3.6);T(labName(lab).slice(0,3),tx+tw2*0.5,ty+3.6,{align:'right'});T('n',tx+tw2*0.6,ty+3.6,{align:'right'});T('%',tx+tw2*0.72,ty+3.6,{align:'right'});T('Komposisi',tx+tw2*0.745,ty+3.6);T('Skor',tx+tw2-1.5,ty+3.6,{align:'right'});
        arr.forEach(function(e,i){var yy=ty+rh*(i+1),oo=e[1];font(7.6,'normal');T(trunc('@'+e[0],tw2*0.42),tx+1.5,yy+3.6);
          font(7.6,'bold',colr);T(String(oo[lab]),tx+tw2*0.5,yy+3.6,{align:'right'});font(7.6,'normal');T(String(oo.n),tx+tw2*0.6,yy+3.6,{align:'right'});T(fmt(100*oo[lab]/oo.n,0),tx+tw2*0.72,yy+3.6,{align:'right'});
          sbar(tx+tw2*0.745,yy+1.4,tw2*0.13,2.6,{n:oo.n,pos:oo.pos,neu:oo.neu,neg:oo.neg});
          var sc=oo.sum/oo.n;font(7.6,'normal',hexRgb(sentColor(sc)));T(fmtS(sc),tx+tw2-1.5,yy+3.6,{align:'right'});
          doc.setDrawColor.apply(doc,LINE);doc.setLineWidth(0.15);doc.line(tx,yy+rh,tx+tw2,yy+rh);});
        if(!arr.length){font(7.6,'normal',MUT);T('Tidak ada akun dengan teks '+ln,tx+1.5,ty+rh+3.6);}
      });
      y+=th2+4;
    });
    para('Komposisi = proporsi positif/netral/negatif seluruh teks akun; % = persentase teks berlabel tersebut; Skor = rata-rata skor sentimen (-1...+1).',7.5);y+=2;
    var sorted=st.recs.filter(function(x){return x.text&&x.text.trim();}).sort(function(a,b){return b.s-a.s;});
    [['Contoh teks paling positif',sorted.filter(function(x){return x.lab==='pos';}).slice(0,5)],['Contoh teks paling negatif',sorted.filter(function(x){return x.lab==='neg';}).reverse().slice(0,5)]].forEach(function(pr){
      if(!pr[1].length)return;h3(pr[0]);
      pr[1].forEach(function(x){var meta='@'+x.a+(x.t?' -> @'+x.t:'')+(isNaN(x.ts)?'':' - '+isoDay(x.ts))+' - skor '+fmtS(x.s),txt=x.text.length>300?x.text.slice(0,300)+'...':x.text;
        font(8.3,'normal');var ls=doc.splitTextToSize(pdfSafe(txt),CW-6),hh=4+ls.length*3.8+1.5;need(hh);rgbFill(labColor(x.lab));doc.rect(M,y,0.9,hh-1,'F');
        font(7,'normal',MUT);T(meta,M+3,y+3);font(8.3,'normal');ls.forEach(function(l,ix){T(l,M+3,y+7+ix*3.8);});y+=hh+1;});
      y+=2;});
  });
  // kategori (kolom term)
  (function(){if(typeof katData!=='function')return;var KD=katData(scope==='active'&&state.plat!=='all'?state.plat:'all');if(!KD.recs.length)return;
    h2('Kategori (kolom term) - '+fmt(KD.recs.length)+' teks berkategori, '+fmt(KD.media.length)+' media/akun');
    need(rh*2);doc.setFillColor.apply(doc,FILL);doc.rect(M,y,CW,rh,'F');font(7,'bold',MUT);T('Kategori',M+1.5,y+3.6);T('Teks',M+78,y+3.6,{align:'right'});T('%',M+92,y+3.6,{align:'right'});T('Media/akun teratas',M+96,y+3.6);y+=rh;
    var mx=KD.cats.length?KD.cats[0][1]:1;
    KD.cats.forEach(function(c,i){need(rh);font(7.8,'normal');T(trunc(c[0],50),M+1.5,y+3.6);rgbFill(katColor(i));doc.rect(M+52,y+1.4,14*c[1]/mx,2.6,'F');
      T(fmt(c[1]),M+78,y+3.6,{align:'right'});T(fmt(100*c[1]/KD.recs.length,1),M+92,y+3.6,{align:'right'});
      var tops=KD.media.map(function(m){return [m[0],KD.cell.get(c[0]+'\u0001'+m[0])||0];}).filter(function(x){return x[1];}).sort(function(a,b){return b[1]-a[1];}).slice(0,3).map(function(x){return dispLabel(x[0])+' '+x[1];}).join(', ');
      font(7.3,'normal',MUT);T(trunc(tops,CW-97),M+96,y+3.6);y+=rh;hline(M,M+CW);});
    para('Multi-label: satu teks dapat masuk beberapa kategori; persentase dihitung terhadap teks berkategori dan tidak dijumlahkan menjadi 100%. Jumlah per media dipengaruhi volume media tersebut. Bila kategori berasal dari klasifikasi otomatis berbasis kamus, angka ini belum tervalidasi terhadap pengodean manual.',7.5);y+=3;})();
  doc.addPage();y=M;h2('Catatan metode');
  ['Analisis per platform: setiap platform memiliki jaringan sendiri; akun bernama sama di dua platform diperlakukan sebagai node berbeda. Jaringan share dinamai sesuai istilah platform (Retweet di X, Repost di Threads, Share/Repost di TikTok dan Instagram, Share di Facebook, YouTube, Media Online) dan tidak pernah digabung antar-platform.',
   'Jaringan like (semua platform kecuali Media Online): edge penyuka -> pemilik postingan; hanya dapat dibentuk bila data mencatat akun yang menyukai, bukan sekadar jumlah like.',
   'Jaringan: edge author -> target_user; bobot = jumlah interaksi. Nama akun dinormalisasi (huruf kecil, tanpa "@"). Baris tweet/post tidak membentuk edge.',
   'In/out-degree berbobot (angka dalam kurung = akun unik). Betweenness: Brandes, berarah, tanpa bobot, dinormalisasi 1/((n-1)(n-2)); diaproksimasi dari 1.000 sumber bila node > 4.000. PageRank berbobot, alpha 0,85. Setara NetworkX.',
   'Louvain: proyeksi tak berarah (u->v + v->u); hasil bergantung seed; komunitas dinomori menurut ukuran.',
   state.sent.source==='column'?'Sentimen: label manual ('+r.manualCol+'); positif = +1, netral = 0, negatif = -1 untuk perhitungan rata-rata. Hanya teks berlabel yang dianalisis.':
   state.sent.source==='ai'?'Sentimen: klasifikasi Claude AI (tier cepat) atas seluruh teks unik dalam cakupan, per batch 50, tanpa batas jumlah; instruksi meminta sentimen penulis menurut maksud, termasuk sarkasme (ditandai). Positif = +1, netral = 0, negatif = -1 untuk rata-rata. Teks yang belum diklasifikasi tidak dianalisis.':'Sentimen: leksikon '+(state.sent.lexName?'unggahan ('+state.sent.lexName+')':'bawaan alat ini (sekitar 320 kata Indonesia/Inggris, belum divalidasi)')+' dengan penanganan negasi, penguat, kontras (tapi/namun) dan emoji. Skor = jumlah bobot, dinormalisasi s/sqrt(s^2+15) ke -1...+1; positif >= 0,05, negatif <= -0,05. Metode leksikon tidak menangkap sarkasme dan konteks; validasi terhadap sampel berlabel manual disarankan sebelum menarik kesimpulan substantif.',
   'Sentimen pada jaringan: tiap akun memperoleh rata-rata skor teks yang ditulis dan diterima di platform yang sama; skor sentimen komunitas = rata-rata tertimbang teks yang ditulis anggotanya.',
   'Jaringan aktif: '+['retweet','reply','mention','cooc','quote'].filter(famOn).map(function(f){return f==='retweet'?'Retweet/Share':f==='reply'?'Reply/Komentar':f==='mention'?'Mention':f==='cooc'?'Co-occurrence':'Quote';}).join(', ')+'. Mention = penulis -> @akun yang disebut di teks (selain target reply/retweet/quote baris itu).',
   'Edge/Link Types: Co-occurrence (tak berarah) = Named Entity <-> Named Entity dan Hashtag <-> Hashtag dalam teks yang sama; Quote (berarah) = Account (type quote), Media -> Named Entity, Akun -> Term, Akun -> Hashtag. Jenis link aktif: '+LTYPES.filter(function(l){return state.links[l[0]];}).map(function(l){return (l[1]==='cooc'?'Co-occurrence ':'Quote ')+l[2];}).join(', ')+'.',
   'Node Types: akun bertipe Account (default/belum diklasifikasi), Person (akun pribadi), News Site, atau Organisasi berdasarkan daftar alias/kolom tipe akun. Jaringan Multi-tipe adalah jaringan dua-mode akun -> entitas (News Site, Organisasi, Lokasi, Tempat, Term, #Hashtag) dengan bobot jumlah sebutan; centrality di dalamnya sebaiknya dibandingkan antar node bertipe sama.',
   'Entitas: Organisasi, Lokasi, Tempat/Place, Term dan #Hashtag dicocokkan per kata utuh (tidak peka huruf besar/kecil, dengan sinonim) dan/atau diambil dari kolom CSV yang sesuai. Sebutan = jumlah baris yang menyebut entitas.'+(state.ent.focus?' Analisis dalam laporan ini difokuskan pada entitas: '+entName(state.ent.focus)+'.':state.ent.mode==='any'?' Analisis dalam laporan ini hanya memakai data yang menyebut salah satu entitas.':''),
   'Validasi: label manual diperoleh dari sampel acak sederhana; kesesuaian dilaporkan sebagai akurasi (CI Wilson), Cohen kappa, presisi, recall dan F1. Ketidakpastian proporsi dilaporkan sebagai interval kepercayaan 95% Wilson; aktor dengan teks < '+state.sent.minN+' tidak dimasukkan ke peringkat sentimen aktor.',
   'Emoji dihilangkan dan karakter lain di luar Latin-1 ditampilkan sebagai "?" di PDF ini.'].forEach(function(s){para(s,9,INK);y+=1;});
  var pc=doc.getNumberOfPages();for(var pg=1;pg<=pc;pg++){doc.setPage(pg);font(7.5,'normal',MUT);T('Jaringan Politik Partai Islam di Indonesia - '+(state.fileName||'data'),M,PH-8);T('Halaman '+pg+' dari '+pc,PW-M,PH-8,{align:'right'});}
  return doc;
}
$('exPdf').onclick=function(){
  if(!window.jspdf){toast('Pustaka PDF gagal dimuat.');return;}
  var scope=$('pdfScope').value,btn=this,old=btn.textContent;btn.disabled=true;btn.textContent='Menyusun PDF…';
  if(scope==='all'){$('gbusy').classList.add('on');$('gbusyMsg').textContent='Menyusun PDF semua platform…';}
  setTimeout(function(){
    try{var doc=buildPDF(scope);var tag=scope==='active'&&state.plat!=='all'?slug(pName(state.plat)):scope==='overview'||state.plat==='all'&&scope==='active'?'ringkasan':'semua_platform';
      save(fileBase()+'_SNA_sentimen_'+tag+'.pdf',doc.output('blob'),'application/pdf');}
    catch(e){toast('Gagal membuat PDF: '+e.message,6000);console.error(e);}
    btn.disabled=false;btn.textContent=old;$('gbusy').classList.remove('on');
  },50);
};
