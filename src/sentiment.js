/* ===== Sentiment: lexicon-based (Indonesian + English), negation, intensifier, contrast ===== */
var SENT = (function () {
  'use strict';
  function W(str, w, o) { str.split(/\s+/).forEach(function (k) { if (k) o[k] = w; }); }
  var BASE = {};
  // strong positive
  W('luarbiasa mantap mantul mantab mantep keren hebat terbaik juara sempurna salut bangga membanggakan alhamdulillah barokah berkah top jos joss josss gokil amazing awesome excellent perfect love wonderful best', 3, BASE);
  // positive
  W('bagus baik indah cantik ganteng senang bahagia gembira suka cinta sayang setuju dukung mendukung didukung sukses berhasil maju adil jujur amanah bijak bijaksana cerdas pintar bermanfaat manfaat membantu terbantu makasih terimakasih syukur bersyukur semangat inspiratif inspirasi solusi tepat asyik asik seru menarik positif aman nyaman damai sejahtera peduli tulus ramah sopan bersih puas memuaskan profesional berkualitas transparan bersatu persatuan toleransi toleran harmonis rukun kompak respect respek apresiasi menang kemenangan prestasi unggul rezeki sehat terpercaya optimis mendidik edukatif informatif bermutu berani tegas merakyat good great nice like happy thanks thank win beautiful support agree helpful glad proud brilliant', 2, BASE);
  // weak positive
  W('oke ok sip siip lumayan aamiin amin wow lucu murah gratis untung pulih harapan berharap percaya benar mudah lancar setia hormat jelas paham', 1, BASE);
  // weak negative
  W('masalah bermasalah salah kesalahan lambat lelet lemot ribet susah sulit mahal bosan protes kritik khawatir cemas ragu bingung aneh kurangnya kasihan miris capek lelah sepi telat terlambat mundur galau', -1, BASE);
  // negative
  W('buruk jelek jahat benci marah kesal kecewa mengecewakan sedih gagal kalah rugi bohong pembohong hoax hoaks fitnah palsu curang kecurangan munafik kotor jorok rusak hancur bahaya berbahaya takut ancam ancaman zalim zolim dzalim ketidakadilan diskriminasi rasis teror kriminal kejahatan penipu tipu menipu penipuan maling mencuri pencuri parah payah lebay alay norak cupu kacau ngawur pencitraan omdo gimmick provokator provokasi hina menghina penghinaan kasar arogan sombong egois serakah rakus licik malas males lemah sengsara menderita derita sesat menyesatkan ngeri tega kejam memalukan malu aib skandal muak nyesel menyesal kapok sotoy halu bacot penjilat korup korupsi koruptor bad hate fake liar sad angry disappointed fail failed useless scam lie lies poor wrong', -2, BASE);
  // strong negative (insults, slurs common in political discourse)
  W('bodoh goblok goblog tolol bego dungu idiot bangsat brengsek bajingan kampret sialan biadab sadis menjijikkan jijik najis tai taik dongo anjing anjir asu keparat laknat terkutuk cebong kadrun stupid worst terrible awful disgusting trash', -3, BASE);
  var BIGRAM = { 'luar biasa': 3, 'terima kasih': 2, 'omong kosong': -2, 'tidak becus': -2, 'tidak tahu malu': -3, 'cari muka': -2, 'buang buang': -1, 'naik daun': 1 };
  var NEG = new Set('tidak tak bukan belum gak nggak ngga enggak ga gk tdk kagak ndak jangan tanpa kurang never not no dont isnt'.split(' '));
  var INT = { sangat: 1.5, amat: 1.4, sekali: 1.4, banget: 1.5, paling: 1.5, terlalu: 1.4, super: 1.4, sungguh: 1.3, makin: 1.2, semakin: 1.2, very: 1.5, so: 1.3, really: 1.4, extremely: 1.6, sgt: 1.5 };
  var BUT = new Set('tapi tetapi namun but however cuma hanya'.split(' '));
  var SLANG = { yg: 'yang', gk: 'gak', g: 'gak', tdk: 'tidak', bgt: 'banget', bngt: 'banget', bgs: 'bagus', mntp: 'mantap', mantaap: 'mantap', jlk: 'jelek', tp: 'tapi', tpi: 'tapi', mksh: 'makasih', makasi: 'makasih', mkasih: 'makasih', trims: 'makasih', thx: 'thanks', tq: 'thanks', ty: 'thanks', sy: 'saya', krn: 'karena', dgn: 'dengan', utk: 'untuk', aja: 'saja', goblog: 'goblok', bs: 'bisa', blm: 'belum', jgn: 'jangan', bkn: 'bukan', gaada: 'gak ada', btl: 'betul', bener: 'benar', hoaks: 'hoax', korupt: 'korup' };
  var EMO_POS = '😍❤♥👍🙏👏😊😁😄🥰💪🔥💯✨🤩😇☺🙂💖💕', EMO_NEG = '😡🤬👎💩😠😤🙄😒🤮🖕😢😭😞😔💔';
  var PARTICLES = /(nya|lah|kah|pun|ku|mu)$/;

  function tokenize(text) {
    var t = String(text || '').toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ').replace(/@\w+/g, ' ').replace(/#/g, ' ')
      .replace(/\brt\b/g, ' ');
    var emo = [];
    for (var ch of t) { if (EMO_POS.indexOf(ch) >= 0) emo.push([ch, 2]); else if (EMO_NEG.indexOf(ch) >= 0) emo.push([ch, -2]); }
    var words = t.replace(/[^a-z0-9À-ɏ\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean)
      .map(function (w) { w = w.replace(/(.)\1{2,}/g, '$1$1'); return SLANG[w] || w; });
    var out = [];
    words.forEach(function (w) { w.split(' ').forEach(function (x) { if (x) out.push(x); }); });
    return { words: out, emo: emo };
  }

  function lookup(w, lex) {
    if (lex.hasOwnProperty(w)) return [w, lex[w]];
    var d = w.replace(/(.)\1+/g, '$1');
    if (lex.hasOwnProperty(d)) return [d, lex[d]];
    if (w.length > 4 && PARTICLES.test(w)) { var s = w.replace(PARTICLES, ''); if (lex.hasOwnProperty(s)) return [s, lex[s]]; }
    return null;
  }

  function score(text, lex) {
    lex = lex || BASE;
    var tk = tokenize(text), ws = tk.words, total = 0, hits = [], butIdx = -1, parts = [];
    for (var b = 0; b < ws.length; b++) if (BUT.has(ws[b])) butIdx = b;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], val = null, key = null;
      if (i + 1 < ws.length && BIGRAM.hasOwnProperty(w + ' ' + ws[i + 1]) && lex === BASE) { key = w + ' ' + ws[i + 1]; val = BIGRAM[key]; i++; }
      else { var lk = lookup(w, lex); if (lk) { key = lk[0]; val = lk[1]; } }
      if (val === null || val === 0) continue;
      var j0 = key.indexOf(' ') > 0 ? i - 1 : i;
      var mult = 1, negated = false;
      for (var k = Math.max(0, j0 - 3); k < j0; k++) {
        if (NEG.has(ws[k])) negated = true;
        if (INT.hasOwnProperty(ws[k])) mult *= INT[ws[k]];
      }
      if (j0 + 1 < ws.length && INT.hasOwnProperty(ws[j0 + 1]) && (ws[j0 + 1] === 'sekali' || ws[j0 + 1] === 'banget' || ws[j0 + 1] === 'bgt')) mult *= INT[ws[j0 + 1]];
      var v = val * mult;
      if (negated) v = -0.75 * v;
      if (butIdx >= 0) v *= (j0 < butIdx ? 0.5 : 1.5);
      total += v; hits.push([(negated ? 'tidak ' : '') + key, +v.toFixed(2)]);
    }
    tk.emo.forEach(function (e) { total += e[1]; hits.push([e[0], e[1]]); });
    var compound = total / Math.sqrt(total * total + 15);
    var label = compound >= 0.05 ? 'pos' : compound <= -0.05 ? 'neg' : 'neu';
    return { score: total, compound: compound, label: label, hits: hits };
  }

  /* parse custom lexicon: "word,weight" or "word\tweight" per line, header optional */
  function parseLexicon(text) {
    var lex = {}, n = 0;
    String(text).split(/\r?\n/).forEach(function (line) {
      var p = line.split(/[\t,;]/);
      if (p.length < 2) return;
      var w = p[0].trim().toLowerCase().replace(/^"|"$/g, ''), v = parseFloat(String(p[1]).replace(',', '.'));
      if (!w || isNaN(v)) return;
      lex[w] = v; n++;
    });
    return { lex: lex, count: n };
  }

  function normLabel(s) {
    var k = String(s == null ? '' : s).trim().toLowerCase();
    if (!k) return null;
    if (/^(pos|positif|positive|1|\+1|p)$/.test(k)) return 'pos';
    if (/^(neg|negatif|negative|-1|n)$/.test(k)) return 'neg';
    if (/^(neu|netral|neutral|0|nt)$/.test(k)) return 'neu';
    return null;
  }

  return { BASE: BASE, score: score, parseLexicon: parseLexicon, normLabel: normLabel, size: function (l) { return Object.keys(l || BASE).length; } };
})();
if (typeof module !== 'undefined') module.exports = SENT;
