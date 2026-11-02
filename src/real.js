/* ===================== Data nyata bawaan (hasil news scraper) ===================== */
/* window.REALDATA = {name, csv, meta} disisipkan hanya pada build artifact pribadi (tidak di repo publik). */
function loadReal(){
  var R=window.REALDATA;if(!R){demo();return;}
  var setIf=function(id,v){if(!$(id).value.trim())$(id).value=v;};
  setIf('eOrg','NU: nu|nahdlatul ulama|pbnu|pwnu|pcnu\nMuhammadiyah: muhammadiyah|pp muhammadiyah\nMUI: mui|majelis ulama indonesia\nKemenag: kemenag|kementerian agama\nBAZNAS: baznas\nPKS: pks|partai keadilan sejahtera\nPKB: pkb|partai kebangkitan bangsa\nPPP: ppp|partai persatuan pembangunan\nPAN: partai amanat nasional\nPolri: polri|kepolisian');
  setIf('eLoc','Jakarta\nJawa Barat: jawa barat|jabar\nJawa Tengah: jawa tengah|jateng\nJawa Timur: jawa timur|jatim\nAceh\nSumatera Selatan: sumatera selatan|sumsel\nKalimantan: kalimantan|kalsel|kalbar|kalteng');
  setIf('ePerson','Prabowo Subianto: prabowo\nGibran Rakabuming: gibran\nKH Miftachul Akhyar: miftachul akhyar\nGus Kikin: gus kikin|abdul hakim mahfudz');
  // data berita = postingan, bukan komentar: hitung sentimen untuk semua teks
  state.sent.scope='all';if($('sScope'))$('sScope').value='all';
  loadText(R.csv,R.name);
  var p=state.projects[state.projects.length-1];if(p&&p.file===R.name){p.real=true;p.name=R.title||p.name;renderProjects();}
  realBanner();
}
function realBanner(){
  var R=window.REALDATA,b=$('realBanner');if(!b)return;
  var on=!!(R&&state.projects.some(function(p){return p.real&&p.on;}));
  b.classList.toggle('hide',!on);
  if(on)b.innerHTML='<b>DATA NYATA.</b> '+esc(R.meta)+' Kategori diberikan otomatis oleh kamus kata kunci dan <b>belum divalidasi</b> terhadap pengodean manual. Jangan menafsirkan perbedaan antar-media atau antar-kategori sebagai temuan sebelum validasi dan sampel yang lebih berimbang.';
}
(function(){
  var _ap=applyProjects;applyProjects=function(f){var o=_ap(f);try{realBanner();}catch(e){}return o;};
  setTimeout(function(){if(!window.REALDATA)return;
    $('wDemo').textContent='Muat data nyata (Media Online)';$('wDemo').onclick=loadReal;
    var d=$('demo');if(d){d.textContent='Muat data nyata';d.onclick=loadReal;
      var s=document.createElement('button');s.className='btn';s.textContent='Data contoh sintetis';s.title='Data acak untuk mencoba fitur multi-platform';s.onclick=demo;d.parentNode.insertBefore(s,d.nextSibling);}
  },0);
})();
