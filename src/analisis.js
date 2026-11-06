/* ===================== Analisis ilmiah: sentimen & SNA ===================== */
/* Menyusun deskripsi ilmiah dari data yang sedang tampil (platform + jaringan + rentang waktu + filter)
   dan menautkannya ke teori Ilmu Komunikasi dan analisis jaringan sosial. Semua angka dihitung ulang
   setiap kali tampilan berubah; teori hanya dipanggil bila pola datanya relevan, dan setiap klaim
   diberi kekuatan bukti berdasarkan ukuran data. Teks ini adalah draf interpretasi, bukan kesimpulan final. */
var ANZ = {
  refs: {
    castells: 'Castells, M. (2009). <i>Communication Power</i>. Oxford University Press.',
    granovetter: 'Granovetter, M. S. (1973). The strength of weak ties. <i>American Journal of Sociology, 78</i>(6), 1360–1380.',
    katz: 'Katz, E., &amp; Lazarsfeld, P. F. (1955). <i>Personal Influence: The Part Played by People in the Flow of Mass Communications</i>. Free Press.',
    mccombs: 'McCombs, M. E., &amp; Shaw, D. L. (1972). The agenda-setting function of mass media. <i>Public Opinion Quarterly, 36</i>(2), 176–187.',
    entman: 'Entman, R. M. (1993). Framing: Toward clarification of a fractured paradigm. <i>Journal of Communication, 43</i>(4), 51–58.',
    burt: 'Burt, R. S. (1992). <i>Structural Holes: The Social Structure of Competition</i>. Harvard University Press.',
    mcpherson: 'McPherson, M., Smith-Lovin, L., &amp; Cook, J. M. (2001). Birds of a feather: Homophily in social networks. <i>Annual Review of Sociology, 27</i>, 415–444.',
    barabasi: 'Barabási, A.-L., &amp; Albert, R. (1999). Emergence of scaling in random networks. <i>Science, 286</i>(5439), 509–512.',
    freeman: 'Freeman, L. C. (1978). Centrality in social networks: Conceptual clarification. <i>Social Networks, 1</i>(3), 215–239.',
    newman: 'Newman, M. E. J. (2006). Modularity and community structure in networks. <i>PNAS, 103</i>(23), 8577–8582.',
    blondel: 'Blondel, V. D., Guillaume, J.-L., Lambiotte, R., &amp; Lefebvre, E. (2008). Fast unfolding of communities in large networks. <i>Journal of Statistical Mechanics</i>, P10008.',
    brin: 'Brin, S., &amp; Page, L. (1998). The anatomy of a large-scale hypertextual Web search engine. <i>Computer Networks and ISDN Systems, 30</i>(1–7), 107–117.',
    wasserman: 'Wasserman, S., &amp; Faust, K. (1994). <i>Social Network Analysis: Methods and Applications</i>. Cambridge University Press.',
    papacharissi: 'Papacharissi, Z. (2015). <i>Affective Publics: Sentiment, Technology, and Politics</i>. Oxford University Press.',
    soroka: 'Soroka, S. N. (2014). <i>Negativity in Democratic Politics: Causes and Consequences</i>. Cambridge University Press.',
    noelle: 'Noelle-Neumann, E. (1974). The spiral of silence: A theory of public opinion. <i>Journal of Communication, 24</i>(2), 43–51.',
    sunstein: 'Sunstein, C. R. (2017). <i>#Republic: Divided Democracy in the Age of Social Media</i>. Princeton University Press.',
    cinelli: 'Cinelli, M., De Francisci Morales, G., Galeazzi, A., Quattrociocchi, W., &amp; Starnini, M. (2021). The echo chamber effect on social media. <i>PNAS, 118</i>(9), e2023301118.',
    chadwick: 'Chadwick, A. (2013). <i>The Hybrid Media System: Politics and Power</i>. Oxford University Press.',
    bruns: 'Bruns, A. (2005). <i>Gatewatching: Collaborative Online News Production</i>. Peter Lang.',
    benkler: 'Benkler, Y. (2006). <i>The Wealth of Networks</i>. Yale University Press.',
    bossetta: 'Bossetta, M. (2018). The digital architectures of social media. <i>Journalism &amp; Mass Communication Quarterly, 95</i>(2), 471–496.',
    liu: 'Liu, B. (2012). <i>Sentiment Analysis and Opinion Mining</i>. Morgan &amp; Claypool.'
  },
  used: null
};
function anzCite(k, txt) { ANZ.used.add(k); return txt; }
function anzStrength(n) { return n >= 200 ? ['tinggi', 'hi'] : n >= 40 ? ['sedang', 'md'] : ['rendah', 'lo']; }
function anzBadge(n, label) { var s = anzStrength(n); return '<span class="anzb ' + s[1] + '" title="Kekuatan bukti dari ukuran data (' + fmt(n) + ' ' + (label || 'unit') + '); bukan uji signifikansi">bukti ' + s[0] + '</span>'; }
function anzPct(a, b) { return b ? fmt(100 * a / b, 1) + '%' : '–'; }
function anzGini(arr) {
  /* semua node ikut dihitung (termasuk yang tidak menerima interaksi): mengukur konsentrasi perhatian di seluruh jaringan */
  var a = arr.map(function (x) { return x > 0 ? x : 0; }).sort(function (x, y) { return x - y; }), n = a.length, s = 0, c = 0;
  if (n < 2) return 0;
  for (var k = 0; k < n; k++) s += a[k];
  if (!s) return 0;
  s = 0;
  for (var i = 0; i < n; i++) { s += a[i]; c += (i + 1) * a[i]; }
  return (2 * c) / (n * s) - (n + 1) / n;
}
function anzPearson(xs, ys, ws) {
  var n = xs.length; if (n < 8) return null;
  var sw = 0, mx = 0, my = 0, i;
  for (i = 0; i < n; i++) { sw += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
  mx /= sw; my /= sw;
  var sxy = 0, sxx = 0, syy = 0;
  for (i = 0; i < n; i++) { var dx = xs[i] - mx, dy = ys[i] - my; sxy += ws[i] * dx * dy; sxx += ws[i] * dx * dx; syy += ws[i] * dy * dy; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
/* tipe aktor: daftar alias aplikasi dulu, lalu pola akun media Indonesia yang umum, lalu nama penerbit pada platform Media Online */
var ANZ_NEWS = /^(kompas(com|tv|data|_tv)?|detik(com|news|finance)?|kumparan(com|news)?|tempo(dotco|co)?|cnnindonesia|cnbcindonesia|bbcindonesia|voaindonesia|tribun(news|timur|jateng|jabar)?|liputan6(dotcom)?|metro_?tv|metrotvnews|tvone(news)?|tvonenews|inilah(dotcom|com)?|okezone(news)?|republika(online|co_id)?|antara(news|news_com)?|mediaindonesia|sindonews|suara(dotcom|com)?|idntimes|narasi(newsroom|tv)?|jawapos(dotcom)?|beritasatu|jpnn(com)?|viva(_co_id|news)?|merdeka(dotcom)?|inews(dotid|_id)?|thejakartapost|jakpost|rmol(id|_id)?|kontan(news)?|bisniscom|katadata(co)?|tirtoid|tirto_id|mojokdotco|asumsico|folkative|projectm_org|ipopbase|nu_online|muionline|hidayatullah)$/i;
function anzKind(lbl) {
  var t = nodeType(lbl); if (t && t !== 'account') return t;
  var h = String(lbl || '').replace(/^@/, '');
  if (ANZ_NEWS.test(h)) return 'news';
  if (!ANZ.media) { ANZ.media = new Set(); (state.records || []).forEach(function (r) { if (r.p === 'media') ANZ.media.add(r.a); }); }
  return ANZ.media.has(lbl) ? 'news' : 'account';
}
function anzTypeName(t) { return t === 'news' ? 'situs/akun berita' : t === 'person' ? 'tokoh (Person)' : t === 'org' ? 'organisasi' : 'akun'; }
function anzRecs(p) {
  if (!state.records) return [];
  return state.records.filter(function (r) { return !r.ps && (p === 'all' || r.p === p) && inWindow(r); });
}
function anzSent(recs) {
  var o = { pos: 0, neg: 0, neu: 0, n: 0, sum: 0 };
  recs.forEach(function (r) { if (r.lab == null || r.s == null) return; o[r.lab] = (o[r.lab] || 0) + 1; o.n++; o.sum += r.s; });
  o.mean = o.n ? o.sum / o.n : null;
  return o;
}
function anzTerms(recs) {
  var c = new Map(), pair = new Map();
  recs.forEach(function (r) {
    if (!r.ext || !r.ext.term) return;
    var cs = Array.from(new Set(String(r.ext.term).split(/\s*[;|]\s*/).filter(Boolean)));
    cs.forEach(function (x) { c.set(x, (c.get(x) || 0) + 1); });
    for (var i = 0; i < cs.length; i++) for (var j = i + 1; j < cs.length; j++) { var k = [cs[i], cs[j]].sort().join(' + '); pair.set(k, (pair.get(k) || 0) + 1); }
  });
  var top = Array.from(c.entries()).sort(function (a, b) { return b[1] - a[1]; });
  var tp = Array.from(pair.entries()).sort(function (a, b) { return b[1] - a[1]; });
  return { top: top, pairs: tp };
}
function anzList(items) { return items.map(function (s) { return '<b>' + s + '</b>'; }).join(', '); }

/* ---- analisis satu platform + satu jaringan ---- */
function anzPlatform() {
  var p = state.plat, net = state.net, d = cur(), H = [], tiles = [];
  var recs = anzRecs(p), st = anzSent(recs), nm = netName(p, net), pn = pName(p);
  if (!d || !d.g || !d.g.n) { return { tiles: '', body: '<p class="sub">Jaringan ' + esc(nm) + ' di ' + esc(pn) + ' belum memiliki edge pada rentang/filter ini, sehingga belum ada struktur yang bisa ditafsirkan.</p>' }; }
  var g = d.g, m = d.m, n = g.n, E = g.edges.length, isView = net === 'view', isCooc = net === 'cooc';
  var lc = m.components ? m.components.largest : n, ncomp = m.components ? m.components.count : 1;
  var gini = anzGini(m.inW), recv = m.inW.filter(function (v) { return v > 0; }).length, order = function (arr) { return arr.map(function (v, i) { return [i, v]; }).sort(function (a, b) { return b[1] - a[1]; }); };
  var byIn = order(m.inW), byBt = order(m.betweenness), byPr = order(m.pagerank);
  var lab = function (i) { return esc(dispLabel(g.labels[i])); };
  var totIn = m.inW.reduce(function (s, v) { return s + v; }, 0), top5share = byIn.slice(0, 5).reduce(function (s, x) { return s + x[1]; }, 0) / (totIn || 1);
  var entTarget = byIn.slice(0, 5).filter(function (x) { return typeof isEnt === 'function' && isEnt(g.labels[x[0]]); }).length >= 3;
  var top10 = byIn.filter(function (x) { return x[1] > 0 && !(typeof isEnt === 'function' && isEnt(g.labels[x[0]])); }).slice(0, 10).map(function (x) { return anzKind(g.labels[x[0]]); });
  var newsTop = top10.filter(function (t) { return t === 'news'; }).length, orgTop = top10.filter(function (t) { return t === 'org' || t === 'person'; }).length;

  tiles = [['Node', fmt(n)], ['Edge', fmt(E)], ['Densitas', fmt(m.density, 4)]].concat(isCooc ? [] : [['Resiprositas', anzPct(m.reciprocity * E, E)]]).concat([['Modularitas', fmt(m.modularity, 3)]]).concat(isCooc ? [] : [['Penerima interaksi', anzPct(recv, n)]]).concat([['Teks bersentimen', fmt(st.n)], ['Negatif', anzPct(st.neg, st.n)]]);

  /* 1. konteks */
  H.push('<h4>1. Konteks data</h4><p>Analisis ini membaca jaringan <b>' + esc(nm) + '</b> di <b>' + esc(pn) + '</b> pada rentang dan filter yang sedang aktif: ' + fmt(recs.length) + ' baris data, ' + fmt(n) + ' node, dan ' + fmt(E) + ' edge berbobot. ' +
    (isView ? 'Pada jaringan View, bobot edge adalah jumlah tayangan postingan yang diinteraksi, sehingga ukuran berbobot mencerminkan <i>jangkauan</i>, bukan frekuensi interaksi. ' : isCooc ? 'Jaringan co-occurrence bersifat tak berarah: dua entitas terhubung bila muncul dalam teks yang sama. ' : '') +
    'Kerangka besarnya adalah masyarakat jaringan, yaitu kekuasaan komunikasi dijalankan melalui kemampuan memprogram dan menghubungkan jaringan ' + anzCite('castells', '(Castells, 2009)') + '. Ukuran jaringan mengikuti konvensi analisis jaringan sosial ' + anzCite('wasserman', '(Wasserman &amp; Faust, 1994)') + '.</p>');

  /* 2. struktur */
  var dens = m.density, frag = ncomp > 1 ? (lc / n) : 1, s2 = [];
  s2.push('Densitas ' + fmt(dens, 4) + ' menunjukkan jaringan yang ' + (dens < 0.01 ? 'sangat renggang' : dens < 0.05 ? 'renggang' : 'relatif rapat') + ': dari semua pasangan aktor yang mungkin, hanya sebagian kecil yang benar-benar berinteraksi. ');
  s2.push('Komponen terbesar memuat ' + anzPct(lc, n) + ' node (' + fmt(ncomp) + ' komponen). ' + (frag < 0.5 ? 'Percakapan terpecah menjadi banyak kelompok kecil yang tidak saling menyapa, ciri wacana yang terfragmentasi. ' : 'Sebagian besar aktor masih terhubung dalam satu struktur percakapan. '));
  if (!isCooc) {
    var rec = m.reciprocity;
    s2.push('Resiprositas ' + anzPct(rec * E, E) + ' ' + (rec < 0.05 ? 'menandakan pola komunikasi satu arah (siaran/<i>broadcast</i>): aktor lebih banyak menyapa atau menanggapi pihak tertentu daripada berdialog timbal balik. Pola ini lebih dekat ke model transmisi daripada model deliberatif ruang publik berjaringan ' + anzCite('benkler', '(Benkler, 2006)') + '. ' : 'menunjukkan adanya pertukaran dua arah yang cukup berarti, sehingga sebagian interaksi bersifat dialogis. '));
  }
  if (m.communities > 1) {
    s2.push('Algoritme Louvain ' + anzCite('blondel', '(Blondel dkk., 2008)') + ' menemukan ' + fmt(m.communities) + ' komunitas dengan modularitas Q = ' + fmt(m.modularity, 3) + '. ' +
      (m.modularity >= 0.4 ? 'Nilai di atas ±0,3 umumnya dibaca sebagai struktur komunitas yang nyata ' + anzCite('newman', '(Newman, 2006)') + ': aktor cenderung berinteraksi di dalam kelompoknya sendiri. Pola ini konsisten dengan homofili ' + anzCite('mcpherson', '(McPherson dkk., 2001)') + ' dan bisa mengarah pada ruang gema ' + anzCite('sunstein', '') + anzCite('cinelli', '(Sunstein, 2017; Cinelli dkk., 2021)') + ', <i>tetapi</i> modularitas tinggi saja belum membuktikan ruang gema; diperlukan bukti bahwa isi atau sikap antarkomunitas juga berbeda. ' :
        m.modularity >= 0.3 ? 'Struktur komunitasnya moderat ' + anzCite('newman', '(Newman, 2006)') + ': ada pengelompokan, tetapi batas antarkelompok masih cukup cair. ' : 'Modularitas rendah: pengelompokan lemah, sehingga klaim polarisasi struktural tidak didukung data ini. '));
  }
  H.push('<h4>2. Struktur jaringan ' + anzBadge(n, 'node') + '</h4><p>' + s2.join('') + '</p>');

  /* 3. aktor sentral */
  var s3 = [];
  s3.push('Sentralitas dibaca dengan tiga ukuran ' + anzCite('brin', '') + anzCite('freeman', '(Freeman, 1978; Brin &amp; Page, 1998)') + '. In-degree berbobot tertinggi: ' + anzList(byIn.slice(0, 5).map(function (x) { return lab(x[0]) + ' (' + fmt(x[1]) + ')'; })) + '. ');
  var conc = top5share >= 0.4 || recv / n < 0.2;
  if (!isCooc) s3.push('Hanya ' + fmt(recv) + ' dari ' + fmt(n) + ' node (' + anzPct(recv, n) + ') yang menerima interaksi, dan lima teratas menyerap ' + anzPct(top5share * totIn, totIn) + ' seluruh bobot masuk (Gini in-degree seluruh node ' + fmt(gini, 2) + '). ');
  if (entTarget) {
    /* target utama adalah entitas/isu, bukan akun: tafsir yang tepat adalah salience isu, bukan opinion leader */
    s3.push('Node dengan in-degree tertinggi adalah entitas/isu, bukan akun. Ukuran ini menunjukkan <i>salience</i>, yaitu objek apa yang paling sering disebut atau dikutip, sejalan dengan agenda-setting: media memengaruhi apa yang dianggap penting oleh publik ' + anzCite('mccombs', '(McCombs &amp; Shaw, 1972)') + '. Konsentrasi di sini berarti perhatian terpusat pada sedikit isu, bukan pada sedikit aktor. ');
    var src = byIn.length ? g.edges.reduce(function (mp, e) { if (!(typeof isEnt === 'function' && isEnt(g.labels[e.s]))) mp.set(e.s, (mp.get(e.s) || 0) + e.w); return mp; }, new Map()) : new Map();
    var srcTop = Array.from(src.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    if (srcTop.length && !isCooc) s3.push('Sumber yang paling banyak mengutip atau menyebut isu-isu tersebut (out-degree): ' + anzList(srcTop.map(function (x) { return lab(x[0]) + ' (' + fmt(x[1]) + ')'; })) + '. ');
  } else {
    if (conc) s3.push('Perhatian terkonsentrasi pada segelintir pusat. Pola ini konsisten dengan <i>preferential attachment</i>, yakni aktor yang sudah populer makin banyak menarik interaksi ' + anzCite('barabasi', '(Barabási &amp; Albert, 1999)') + '. <i>Namun</i>, konsentrasi ini juga bisa merupakan artefak cara data dikumpulkan (misalnya hanya postingan teratas atau akun media yang diambil, lalu interaksinya ditelusuri), sehingga belum bisa dibaca sebagai sifat ekosistem secara keseluruhan. ');
    else s3.push('Interaksi tersebar pada banyak penerima, sehingga percakapan tidak dimonopoli oleh satu-dua pusat. ');
    if (!isCooc) {
    if (newsTop >= 4) s3.push('<b>' + newsTop + ' dari 10</b> aktor dengan in-degree tertinggi adalah situs/akun berita. Media arus utama tetap menjadi poros percakapan daring, sejalan dengan fungsi penentuan agenda ' + anzCite('mccombs', '(McCombs &amp; Shaw, 1972)') + ' dan logika sistem media hibrida, tempat media lama dan baru saling bergantung ' + anzCite('chadwick', '(Chadwick, 2013)') + '. ');
    else if (orgTop >= 4) s3.push('<b>' + orgTop + ' dari 10</b> aktor teratas adalah tokoh atau organisasi, sehingga elite politik atau kelembagaan berperan langsung sebagai pusat percakapan. ');
    else s3.push('Di antara 10 aktor teratas, ' + newsTop + ' teridentifikasi sebagai media dan ' + orgTop + ' sebagai tokoh/organisasi; sisanya tidak dikenali dalam daftar alias. Sebelum menyimpulkan bahwa pusat percakapan adalah warga biasa, tipe akun-akun tersebut perlu diperiksa secara manual. ');
    s3.push('Dalam kerangka aliran dua tahap ' + anzCite('katz', '(Katz &amp; Lazarsfeld, 1955)') + ', akun dengan PageRank tertinggi, yaitu ' + anzList(byPr.slice(0, 3).map(function (x) { return lab(x[0]); })) + ', dapat diperlakukan sebagai kandidat <i>opinion leader</i>: pengaruhnya tidak hanya dari jumlah interaksi, tetapi juga dari siapa yang berinteraksi dengannya. ');
  }
  }
  var bt = byBt.filter(function (x) { return x[1] > 0; }).slice(0, 3);
  if (bt.length) {
    var bridges = byBt.filter(function (x) { return x[1] > 0; }).slice(0, 15).map(function (x) {
      var i = x[0], cs = new Set();
      g.edges.forEach(function (e) { if (e.s === i) cs.add(m.community[e.t]); else if (e.t === i) cs.add(m.community[e.s]); });
      cs.add(m.community[i]);
      return [i, cs.size];
    }).filter(function (b) { return b[1] >= 2; }).slice(0, 3);
    bt = bridges.map(function (b) { return [b[0]]; });
    bridges = bridges.map(function (b) { return lab(b[0]) + ' (menyentuh ' + b[1] + ' komunitas)'; });
    if (!bt.length) { s3.push('Aktor dengan betweenness tertinggi tidak menghubungkan komunitas yang berbeda; jalur perantara berada di dalam kelompok masing-masing, sehingga tidak tampak <i>broker</i> lintas kelompok yang jelas. '); }
    else {
    var entB = bt.filter(function (x) { return typeof isEnt === 'function' && isEnt(g.labels[x[0]]); }).length > bt.length / 2;
    if (entB) s3.push('Perantara lintas komunitas dengan betweenness tertinggi: ' + anzList(bridges) + '. Karena node ini berupa entitas/isu, perannya adalah <i>jembatan wacana</i>: topik yang menautkan klaster isu yang berbeda, sehingga menjadi titik temu bingkai-bingkai yang bersaing ' + anzCite('entman', '(Entman, 1993)') + '. ');
    else s3.push('Perantara lintas komunitas dengan betweenness tertinggi: ' + anzList(bridges) + '. Aktor seperti ini menempati <i>lubang struktural</i>, yaitu posisi perantara yang mengendalikan aliran informasi antarkelompok ' + anzCite('burt', '(Burt, 1992)') + '; di media sosial mereka berperan sebagai <i>gatewatcher</i> yang memilih dan meneruskan informasi ' + anzCite('bruns', '(Bruns, 2005)') + '. ');
    }
  }
  H.push('<h4>3. Aktor sentral ' + anzBadge(n, 'node') + '</h4><p>' + s3.join('') + '</p>');

  /* 4. sentimen */
  var s4 = [];
  if (st.n) {
    s4.push('Dari ' + fmt(st.n) + ' teks yang diberi skor sentimen, ' + anzPct(st.pos, st.n) + ' positif, ' + anzPct(st.neg, st.n) + ' negatif, dan ' + anzPct(st.neu, st.n) + ' netral (rerata skor ' + fmt(st.mean, 3) + '). ');
    var polar = st.pos + st.neg;
    if (st.neu > st.n * 0.6) s4.push('Sebagian besar teks bernada netral, hal yang lazim untuk teks informatif seperti judul berita atau unggahan akun resmi; karena itu, perbandingan berikut hanya berlaku untuk ' + fmt(polar) + ' teks yang bernada. ');
    if (st.neg > st.pos * 1.3 && p === 'media') s4.push('Di antara teks bernada, nada negatif lebih banyak. Pola ini sejalan dengan bias negativitas dalam pemberitaan politik ' + anzCite('soroka', '(Soroka, 2014)') + ': peristiwa konflik, pelanggaran, dan krisis lebih bernilai berita. ');
    else if (st.neg > st.pos * 1.3) s4.push('Di antara teks bernada, nada negatif lebih banyak. Pola ini sejalan dengan bias negativitas dalam komunikasi politik, yakni informasi negatif lebih mudah menarik perhatian dan disebarkan ' + anzCite('soroka', '(Soroka, 2014)') + '. Publik yang terbentuk di sini dapat dibaca sebagai <i>publik afektif</i>, yang dimobilisasi oleh ekspresi emosi lebih dari oleh argumen ' + anzCite('papacharissi', '(Papacharissi, 2015)') + '. ');
    else if (st.pos > st.neg * 1.3) s4.push('Nada positif lebih banyak, sehingga percakapan cenderung bersifat dukungan, promosi, atau afirmasi. Bila banyak teks berasal dari akun resmi atau media, hal ini perlu dibaca sebagai komunikasi strategis, bukan semata opini publik. ');
    else s4.push('Proporsi positif dan negatif relatif seimbang, sehingga tidak tampak satu iklim opini yang dominan. ');
    var nmx = n <= 6000 ? SNA.nodeSentiment(state.records, g, { platform: p, net: net, from: (state.opts || {}).from, to: (state.opts || {}).to }) : null;
    if (nmx && !isCooc) {
      var xs = [], ys = [], ws = [];
      g.edges.forEach(function (e) { var a = nmx.outMean[e.s], b = nmx.outMean[e.t]; if (e.s !== e.t && a != null && b != null) { xs.push(a); ys.push(b); ws.push(1); } });
      var r = anzPearson(xs, ys, ws);
      if (r != null) {
        s4.push('Korelasi sentimen antara pengirim dan penerima edge r = ' + fmt(r, 2) + ' (' + fmt(xs.length) + ' pasangan). ' + (r >= 0.2 ? 'Aktor cenderung terhubung dengan aktor yang bernada serupa, sebuah indikasi <i>homofili afektif</i> ' + anzCite('mcpherson', '(McPherson dkk., 2001)') + '. ' : r <= -0.2 ? 'Aktor justru sering terhubung dengan pihak yang bernada berlawanan, menandakan interaksi lintas sikap (misalnya sanggahan atau kritik). ' : 'Hampir tidak ada keselarasan nada antara pihak yang berinteraksi, sehingga homofili afektif tidak terlihat. '));
      }
      if (m.communities > 1) {
        var cm = new Map();
        for (var i = 0; i < n; i++) { var v = nmx.outMean[i]; if (v == null) continue; var c = m.community[i], o = cm.get(c); if (!o) { o = { s: 0, n: 0 }; cm.set(c, o); } o.s += v; o.n++; }
        var cl = Array.from(cm.entries()).filter(function (e) { return e[1].n >= 10; }).map(function (e) { return [e[0], e[1].s / e[1].n, e[1].n]; }).sort(function (a, b) { return a[1] - b[1]; });
        if (cl.length >= 2) {
          var lo = cl[0], hi = cl[cl.length - 1];
          s4.push('Antarkomunitas, rerata sentimen berkisar dari ' + fmt(lo[1], 2) + ' (komunitas ' + lo[0] + ', ' + lo[2] + ' aktor) hingga ' + fmt(hi[1], 2) + ' (komunitas ' + hi[0] + ', ' + hi[2] + ' aktor). ' + (hi[1] - lo[1] >= 0.3 ? 'Selisih ini cukup besar; bila disertai modularitas tinggi, kombinasi struktur terpisah dan nada berbeda merupakan bukti yang lebih kuat untuk polarisasi daripada salah satunya saja ' + anzCite('cinelli', '(Cinelli dkk., 2021)') + '. ' : 'Selisihnya kecil, jadi pengelompokan struktural tidak disertai perbedaan nada yang berarti. '));
        }
      }
    }
    if (st.neg < st.pos && st.neg < st.n * 0.15 && recs.length > 100 && p !== 'media') s4.push('Rendahnya ekspresi negatif tidak otomatis berarti tidak ada penolakan; teori spiral keheningan mengingatkan bahwa pihak yang merasa minoritas cenderung diam ' + anzCite('noelle', '(Noelle-Neumann, 1974)') + '. ');
    H.push('<h4>4. Sentimen dan iklim opini ' + anzBadge(st.n, 'teks') + '</h4><p>' + s4.join('') + '</p>');
  } else H.push('<h4>4. Sentimen dan iklim opini</h4><p class="sub">Belum ada teks bersentimen pada cakupan ini (lihat pengaturan sumber sentimen).</p>');

  /* 5. bingkai */
  var tm = anzTerms(recs);
  if (tm.top.length) {
    var tot = recs.filter(function (r) { return r.ext && r.ext.term; }).length;
    H.push('<h4>5. Isu dan pembingkaian ' + anzBadge(tot, 'teks berlabel') + '</h4><p>Label isu terbanyak: ' + anzList(tm.top.slice(0, 5).map(function (x) { return esc(x[0]) + ' (' + anzPct(x[1], tot) + ')'; })) + '. ' +
      (tm.pairs.length ? 'Pasangan isu yang paling sering muncul bersama: ' + anzList(tm.pairs.slice(0, 3).map(function (x) { return esc(x[0]) + ' (' + fmt(x[1]) + ')'; })) + '. ' : '') +
      'Menurut Entman ' + anzCite('entman', '(1993)') + ', membingkai berarti menonjolkan aspek tertentu dari realitas sehingga mendorong definisi masalah, tafsir sebab, penilaian moral, dan rekomendasi tertentu. Pasangan isu yang sering muncul bersama menunjukkan aspek mana yang ditautkan dalam wacana. Label ini berasal dari kamus kata kunci, sehingga menunjukkan <i>topik</i>; untuk menyimpulkan <i>bingkai</i>, perlu koding manual atas sampel teks.</p>');
  }
  return { tiles: tiles, body: H.join('') };
}

/* ---- perbandingan antar-platform ---- */
function anzAll() {
  var plats = (state.all && state.all.platforms) || [], rows = [], H = [];
  plats.forEach(function (p) {
    var recs = anzRecs(p), st = anzSent(recs), R = state.all.res[p] || {}, best = null;
    ['reply', 'mention', 'quote', 'retweet'].forEach(function (k) { var d = R[k]; if (d && d.g && d.g.edges.length && (!best || d.g.edges.length > best.d.g.edges.length)) best = { k: k, d: d }; });
    rows.push({ p: p, n: recs.length, st: st, net: best });
  });
  rows.sort(function (a, b) { return b.n - a.n; });
  var tot = rows.reduce(function (s, r) { return s + r.n; }, 0);
  var tb = '<table class="top"><thead><tr><th>Platform</th><th class="r">Baris</th><th class="r">% negatif</th><th class="r">Rerata sentimen</th><th>Jaringan terbesar</th><th class="r">Node</th><th class="r">Modularitas</th><th class="r">Resiprositas</th></tr></thead><tbody>' +
    rows.map(function (r) { var d = r.net && r.net.d; return '<tr><td>' + esc(pName(r.p)) + '</td><td class="r">' + fmt(r.n) + '</td><td class="r">' + anzPct(r.st.neg, r.st.n) + '</td><td class="r">' + (r.st.mean == null ? '–' : fmt(r.st.mean, 3)) + '</td><td>' + (r.net ? esc(netName(r.p, r.net.k)) : '–') + '</td><td class="r">' + (d ? fmt(d.g.n) : '–') + '</td><td class="r">' + (d ? fmt(d.m.modularity, 3) : '–') + '</td><td class="r">' + (d ? anzPct(d.m.reciprocity, 1) : '–') + '</td></tr>'; }).join('') + '</tbody></table>';
  H.push('<h4>1. Ekosistem lintas platform</h4><p>Data mencakup ' + fmt(tot) + ' baris dari ' + plats.length + ' platform. Setiap platform punya arsitektur digital yang berbeda (aturan jaringan, fitur interaksi, dan pengelolaan visibilitas), sehingga perbandingan antarplatform harus dibaca sebagai perbandingan ekosistem, bukan sampel dari satu populasi ' + anzCite('bossetta', '(Bossetta, 2018)') + '. Dalam sistem media hibrida, berita dari media daring dan percakapan media sosial saling memengaruhi agenda ' + anzCite('chadwick', '(Chadwick, 2013)') + '.</p>' + tb);
  var withS = rows.filter(function (r) { return r.st.n >= 30; });
  if (withS.length >= 2) {
    var neg = withS.slice().sort(function (a, b) { return (b.st.neg / b.st.n) - (a.st.neg / a.st.n); });
    H.push('<h4>2. Perbedaan iklim opini ' + anzBadge(withS.reduce(function (s, r) { return s + r.st.n; }, 0), 'teks') + '</h4><p>Proporsi nada negatif tertinggi ada di <b>' + esc(pName(neg[0].p)) + '</b> (' + anzPct(neg[0].st.neg, neg[0].st.n) + ') dan terendah di <b>' + esc(pName(neg[neg.length - 1].p)) + '</b> (' + anzPct(neg[neg.length - 1].st.neg, neg[neg.length - 1].st.n) + '). Perbedaan ini wajar diduga berkaitan dengan siapa yang berbicara (media, akun resmi, atau warga biasa) dan dengan norma ekspresi platform; ruang komentar biasanya lebih afektif ' + anzCite('papacharissi', '(Papacharissi, 2015)') + ' dan lebih negatif ' + anzCite('soroka', '(Soroka, 2014)') + ' daripada teks berita. Pilih satu platform untuk melihat analisis struktur dan aktornya.</p>');
  }
  return { tiles: [['Platform', fmt(plats.length)], ['Baris', fmt(tot)]], body: H.join('') };
}

function anzLimits() {
  return '<h4>Keterbatasan dan validitas</h4><ul class="anzl">' +
    '<li><b>Representativitas.</b> Data hasil scraping (pencarian "Teratas", akun media, atau kata kunci) bukan sampel acak pengguna; temuan menggambarkan percakapan yang <i>terambil</i>, bukan opini publik secara umum.</li>' +
    '<li><b>Sentimen.</b> Skor leksikon (atau label AI) belum divalidasi terhadap koding manusia pada korpus ini; sarkasme, ironi, dan bahasa daerah sering salah terbaca ' + anzCite('liu', '(Liu, 2012)') + '. Laporkan angka sentimen bersama hasil uji kesepakatan (mis. Cohen\'s κ) pada sampel.</li>' +
    '<li><b>Jaringan.</b> Daftar akun yang menyukai atau membagikan sering tidak tersedia dari platform, sehingga jaringan dibentuk terutama dari balasan, kutipan, dan sebutan. Modularitas Louvain bergantung pada <i>seed</i>; betweenness bisa berupa aproksimasi pada graf besar.</li>' +
    '<li><b>Inferensi.</b> Semua pola di atas bersifat deskriptif dan korelasional; teori dipakai sebagai lensa tafsir, bukan sebagai hipotesis yang sudah diuji. Label "bukti tinggi/sedang/rendah" hanya mencerminkan ukuran data, bukan signifikansi statistik.</li></ul>';
}

function renderAnalisis() {
  var box = $('anzBody'); if (!box || !state.all) return;
  ANZ.used = new Set();
  var o = state.plat === 'all' ? anzAll() : anzPlatform();
  $('anzSub').textContent = '· ' + (state.plat === 'all' ? 'semua platform' : pName(state.plat) + ' · ' + netName(state.plat, state.net)) + ' · dihitung dari data yang sedang tampil';
  $('anzTiles').innerHTML = (o.tiles || []).map(function (t) { return '<div class="kpi"><div class="l">' + t[0] + '</div><div class="v">' + t[1] + '</div></div>'; }).join('');
  var refs = Array.from(ANZ.used).map(function (k) { return ANZ.refs[k]; }).filter(Boolean).sort();
  box.innerHTML = o.body + anzLimits() + '<h4>Rujukan</h4><ol class="anzr">' + refs.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ol>';
}
function anzText() {
  var b = $('anzBody'); if (!b) return '';
  var t = '# Analisis ' + (state.plat === 'all' ? 'lintas platform' : pName(state.plat) + ' — ' + netName(state.plat, state.net)) + '\n\n';
  b.querySelectorAll('h4,p,li').forEach(function (el) {
    var s = el.innerText.replace(/\s+/g, ' ').trim(); if (!s) return;
    t += el.tagName === 'H4' ? '\n## ' + s + '\n\n' : el.tagName === 'LI' ? '- ' + s + '\n' : s + '\n\n';
  });
  return t;
}
(function () {
  $('anzCopy').onclick = function () { var t = anzText(); if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Teks analisis disalin.'); }, function () { save('analisis.md', t, 'text/markdown'); }); else save('analisis.md', t, 'text/markdown'); };
  $('anzMd').onclick = function () { save('analisis_' + (state.plat || 'all') + '_' + (state.net || '') + '.md', anzText(), 'text/markdown'); };
  var _r = render; render = function (f) { _r(f); try { renderAnalisis(); } catch (e) { console.error(e); } };
  var _s = show; show = function (n, f) { var o = _s(n, f); try { renderAnalisis(); } catch (e) { console.error(e); } return o; };
})();
