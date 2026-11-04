/* ===== SNA core: parsing, graph building, metrics, Louvain, GEXF ===== */
var SNA = (function () {
  'use strict';

  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var firstLine = text.split(/\r?\n/, 1)[0] || '';
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQ = false;
    for (var i = 0; i < firstLine.length; i++) {
      var ch = firstLine[i];
      if (ch === '"') inQ = !inQ;
      else if (!inQ && counts.hasOwnProperty(ch)) counts[ch]++;
    }
    var delim = ',';
    if (counts[';'] > counts[delim]) delim = ';';
    if (counts['\t'] > counts[delim]) delim = '\t';

    var rows = [], row = [], field = '', q = false, n = text.length;
    for (var j = 0; j < n; j++) {
      var c = text[j];
      if (q) {
        if (c === '"') {
          if (text[j + 1] === '"') { field += '"'; j++; }
          else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[j + 1] === '\n') j++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return { rows: rows, delimiter: delim };
  }

  function normUser(s) {
    if (s == null) return '';
    return String(s).trim().replace(/^@+/, '').toLowerCase();
  }

  var TYPE_MAP = {
    retweet: 'retweet', rt: 'retweet', retweeted: 'retweet', repost: 'retweet',
    reply: 'reply', replied: 'reply', replies: 'reply',
    tweet: 'tweet', original: 'tweet', post: 'tweet', quote: 'quote', qt: 'quote', quoted: 'quote', quote_tweet: 'quote', quotes: 'quote', kutip: 'quote', mengutip: 'quote',
    comment: 'reply', comments: 'reply', komentar: 'reply', balasan: 'reply', balas: 'reply',
    share: 'retweet', shared: 'retweet', reshare: 'retweet', bagikan: 'retweet', reposts: 'retweet',
    like: 'like', likes: 'like', liked: 'like', suka: 'like', menyukai: 'like', disukai: 'like', love: 'like', reaction: 'like', reactions: 'like', reaksi: 'like', react: 'like', favorite: 'like', favourite: 'like', fav: 'like', heart: 'like',
    view: 'view', views: 'view', tayangan: 'view', impression: 'view', impressions: 'view',
    video: 'tweet', unggahan: 'tweet', status: 'tweet', artikel: 'tweet', article: 'tweet'
  };
  var PLATFORM_MAP = {
    tiktok: 'tiktok', 'tik tok': 'tiktok', tt: 'tiktok',
    instagram: 'instagram', ig: 'instagram', insta: 'instagram',
    x: 'x', twitter: 'x', 'x/twitter': 'x', 'twitter/x': 'x', 'x (twitter)': 'x',
    youtube: 'youtube', yt: 'youtube', 'you tube': 'youtube',
    threads: 'threads', thread: 'threads',
    facebook: 'facebook', fb: 'facebook',
    media: 'media', 'media online': 'media', 'media_online': 'media', 'online media': 'media', news: 'media', berita: 'media', portal: 'media', 'portal berita': 'media', website: 'media', web: 'media'
  };
  function normPlatform(s) {
    var k = String(s == null ? '' : s).trim().toLowerCase();
    if (!k) return '';
    return PLATFORM_MAP[k] || PLATFORM_MAP[k.replace(/[-_]+/g, ' ')] || 'lainnya';
  }

  /* Turn parsed rows into records. Returns {records, report} */
  function toRecords(parsed) {
    var rows = parsed.rows;
    if (!rows.length) throw new Error('File CSV kosong.');
    var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var need = ['author', 'text', 'type', 'target_user', 'created_at'];
    var idx = {};
    need.forEach(function (k) { idx[k] = header.indexOf(k); });
    var missing = need.filter(function (k) { return idx[k] < 0 && k !== 'text' && k !== 'created_at'; });
    if (missing.length) throw new Error('Kolom wajib tidak ditemukan: ' + missing.join(', ') + '. Header terbaca: ' + header.join(', '));
    var pIdx = -1;
    ['platform', 'media', 'source', 'sumber', 'channel', 'sosmed', 'media_sosial'].some(function (k) { pIdx = header.indexOf(k); return pIdx >= 0; });
    var EXT = { org: ['organisasi', 'organization', 'organisation', 'org'], loc: ['lokasi', 'location', 'user_location', 'kota', 'provinsi'], place: ['place', 'tempat', 'place_name', 'place_full_name'], term: ['term', 'keyword', 'kata_kunci', 'query'], hashtag: ['hashtag', 'hashtags', 'tagar'], atype: ['author_type', 'account_type', 'node_type', 'tipe_akun', 'jenis_akun', 'tipe_node'] };
    var extIdx = {}, extCols = {};
    Object.keys(EXT).forEach(function (k) { EXT[k].some(function (h) { var i = header.indexOf(h); if (i >= 0) { extIdx[k] = i; extCols[k] = h; return true; } return false; }); });
    var uIdx = -1;
    ['url', 'link', 'tautan', 'permalink'].some(function (k) { uIdx = header.indexOf(k); return uIdx >= 0; });
    var vIdx = -1;
    ['views', 'view_count', 'view', 'tayangan', 'impressions'].some(function (k) { vIdx = header.indexOf(k); return vIdx >= 0; });
    var sIdx = -1;
    ['sentiment', 'sentimen', 'label_sentimen', 'sentiment_label', 'label'].some(function (k) { sIdx = header.indexOf(k); return sIdx >= 0; });
    var rep = { extCols: extCols, hasManual: sIdx >= 0, manualCol: sIdx >= 0 ? header[sIdx] : null, rows: rows.length - 1, byType: {}, unknownType: 0, noAuthor: 0, noTarget: 0, badDate: 0, missingCols: need.filter(function (k) { return idx[k] < 0; }), hasPlatform: pIdx >= 0, platformCol: pIdx >= 0 ? header[pIdx] : null, rawPlatformsUnknown: {} };
    var recs = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var rawType = String(row[idx.type] || '').trim().toLowerCase();
      var type = TYPE_MAP[rawType] || null;
      rep.byType[rawType || '(kosong)'] = (rep.byType[rawType || '(kosong)'] || 0) + 1;
      if (!type) { rep.unknownType++; continue; }
      var a = normUser(row[idx.author]);
      if (!a) { rep.noAuthor++; continue; }
      var t = normUser(row[idx.target_user]);
      if (!t && idx.text >= 0 && (type === 'retweet' || type === 'reply' || type === 'quote')) {
        var tx = String(row[idx.text] || ''), mm = type === 'retweet' ? /^\s*RT\s+@([\w.]+)/i.exec(tx) : type === 'quote' ? /(?:QT|RT)\s+@([\w.]+)/i.exec(tx) : /^\s*@([\w.]+)/.exec(tx);
        if (mm) { t = normUser(mm[1]); rep.derivedTarget = (rep.derivedTarget || 0) + 1; }
      }
      var ts = NaN;
      if (idx.created_at >= 0) {
        var raw = String(row[idx.created_at] || '').trim();
        if (raw) { ts = Date.parse(raw); if (isNaN(ts)) ts = Date.parse(raw.replace(' ', 'T')); }
        if (raw && isNaN(ts)) rep.badDate++;
      }
      if ((type === 'retweet' || type === 'reply' || type === 'like' || type === 'quote') && !t) rep.noTarget++;
      if (type === 'like' && p === 'media') rep.likeMedia = (rep.likeMedia || 0) + 1;
      var p = null;
      if (pIdx >= 0) {
        var rawP = row[pIdx];
        p = normPlatform(rawP) || 'lainnya';
        if (p === 'lainnya') { var rk = String(rawP || '(kosong)').trim() || '(kosong)'; rep.rawPlatformsUnknown[rk] = (rep.rawPlatformsUnknown[rk] || 0) + 1; }
      }
      var man = null;
      if (sIdx >= 0 && typeof SENT !== 'undefined') man = SENT.normLabel(row[sIdx]);
      var ext = null;
      for (var ek in extIdx) { var ev = String(row[extIdx[ek]] || '').trim(); if (ev) { if (!ext) ext = {}; ext[ek] = ev; } }
      var rec = { a: a, t: t, type: type, ts: ts, p: p, text: idx.text >= 0 ? String(row[idx.text] || '') : '', man: man, ext: ext };
      if (uIdx >= 0) { var uv = String(row[uIdx] || '').trim(); if (/^https?:\/\//i.test(uv)) rec.url = uv; }
      if (vIdx >= 0) { var vv = parseFloat(String(row[vIdx] || '').replace(/[^\d.]/g, '')); if (vv > 0) rec.v = vv; }
      if (type === 'view' && !(rec.v > 0)) { rep.viewNoCount = (rep.viewNoCount || 0) + 1; continue; }
      recs.push(rec);
    }
    return { records: recs, report: rep };
  }

  /* Build directed weighted graph for one interaction type */
  function buildGraph(records, type, opts) {
    opts = opts || {};
    var from = opts.from, to = opts.to, keepSelf = !!opts.keepSelf;
    var pset = opts.platform ? new Set([opts.platform]) : (opts.platforms && opts.platforms.length ? new Set(opts.platforms) : null);
    var id = new Map(), labels = [], ew = new Map(), ep = new Map(), es = new Map(), el = new Map(), self = 0, inter = 0;
    function gid(u) { var k = id.get(u); if (k === undefined) { k = labels.length; id.set(u, k); labels.push(u); } return k; }
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type !== type || !r.t) continue;
      if (pset && !pset.has(r.p)) continue;
      if ((from != null || to != null) && isNaN(r.ts)) continue;
      if (from != null && r.ts < from) continue;
      if (to != null && r.ts > to) continue;
      if (r.a === r.t && !keepSelf) { self++; continue; }
      var s = gid(r.a), t = gid(r.t), key = s + '|' + t;
      ew.set(key, (ew.get(key) || 0) + (type === 'view' ? (r.v > 0 ? r.v : 0) : 1)); inter++;
      if (r.lt) { var lm = el.get(key); if (!lm) { lm = {}; el.set(key, lm); } lm[r.lt] = (lm[r.lt] || 0) + 1; }
      if (r.s != null) { var ss = es.get(key); if (!ss) { ss = [0, 0, 0]; es.set(key, ss); } ss[0] += r.s; ss[1]++; if (r.lab === 'neg') ss[2]++; }
      if (r.p) { var ps = ep.get(key); if (!ps) { ps = {}; ep.set(key, ps); } ps[r.p] = (ps[r.p] || 0) + 1; }
    }
    var edges = [];
    ew.forEach(function (w, k) { var p = k.split('|'); var ss = es.get(k); edges.push({ s: +p[0], t: +p[1], w: w, pl: ep.get(k) || null, sSum: ss ? ss[0] : 0, sN: ss ? ss[1] : 0, sNeg: ss ? ss[2] : 0, lt: el.get(k) || null }); });
    return { n: labels.length, labels: labels, edges: edges, selfLoopsDropped: self, interactions: inter };
  }

  function adjacency(g) {
    var out = [], inn = [];
    for (var i = 0; i < g.n; i++) { out.push([]); inn.push([]); }
    g.edges.forEach(function (e) { out[e.s].push(e); inn[e.t].push(e); });
    return { out: out, inn: inn };
  }

  function degrees(g) {
    var n = g.n, inW = new Float64Array(n), outW = new Float64Array(n), inC = new Int32Array(n), outC = new Int32Array(n);
    g.edges.forEach(function (e) {
      if (e.s === e.t) return;
      outW[e.s] += e.w; inW[e.t] += e.w; outC[e.s]++; inC[e.t]++;
    });
    return { inW: inW, outW: outW, inC: inC, outC: outC };
  }

  /* PageRank, weighted, damping alpha; dangling mass spread uniformly (same as NetworkX) */
  function pagerank(g, alpha, tol, maxIter) {
    alpha = alpha == null ? 0.85 : alpha; tol = tol || 1e-10; maxIter = maxIter || 500;
    var n = g.n; if (!n) return new Float64Array(0);
    var outW = new Float64Array(n);
    g.edges.forEach(function (e) { outW[e.s] += e.w; });
    var x = new Float64Array(n).fill(1 / n), nx;
    for (var it = 0; it < maxIter; it++) {
      nx = new Float64Array(n);
      var dang = 0;
      for (var i = 0; i < n; i++) if (outW[i] === 0) dang += x[i];
      for (var k = 0; k < g.edges.length; k++) {
        var e = g.edges[k];
        nx[e.t] += alpha * x[e.s] * e.w / outW[e.s];
      }
      var base = alpha * dang / n + (1 - alpha) / n, err = 0;
      for (var j = 0; j < n; j++) { nx[j] += base; err += Math.abs(nx[j] - x[j]); }
      x = nx;
      if (err < n * tol) break;
    }
    return x;
  }

  /* Brandes betweenness, directed, unweighted (hops). Normalized by (n-1)(n-2).
     If sources array given, approximation scaled by n/k. */
  function betweenness(g, sources, onProgress) {
    var n = g.n, CB = new Float64Array(n);
    if (n < 3) return CB;
    var adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    g.edges.forEach(function (e) { if (e.s !== e.t) adj[e.s].push(e.t); });
    var S = new Int32Array(n), P = [], sigma = new Float64Array(n), d = new Int32Array(n), delta = new Float64Array(n), Q = new Int32Array(n);
    for (i = 0; i < n; i++) P.push([]);
    var src = sources || null, K = src ? src.length : n;
    for (var si = 0; si < K; si++) {
      var s = src ? src[si] : si;
      for (var v = 0; v < n; v++) { P[v].length = 0; sigma[v] = 0; d[v] = -1; delta[v] = 0; }
      sigma[s] = 1; d[s] = 0;
      var qh = 0, qt = 0, sp = 0; Q[qt++] = s;
      while (qh < qt) {
        var u = Q[qh++]; S[sp++] = u;
        var nb = adj[u];
        for (var k = 0; k < nb.length; k++) {
          var w = nb[k];
          if (d[w] < 0) { d[w] = d[u] + 1; Q[qt++] = w; }
          if (d[w] === d[u] + 1) { sigma[w] += sigma[u]; P[w].push(u); }
        }
      }
      while (sp > 0) {
        var x = S[--sp], px = P[x];
        for (var m = 0; m < px.length; m++) { var p = px[m]; delta[p] += sigma[p] / sigma[x] * (1 + delta[x]); }
        if (x !== s) CB[x] += delta[x];
      }
      if (onProgress && si % 200 === 0) onProgress(si / K);
    }
    var scale = 1 / ((n - 1) * (n - 2));
    if (src) scale *= n / K;
    for (i = 0; i < n; i++) CB[i] *= scale;
    return CB;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Louvain on undirected projection: w(u,v)=w(u->v)+w(v->u). Returns {membership, modularity, levels} */
  function associationNormalize(adj) {
    var n = adj.length, w = new Float64Array(n), m2 = 0;
    for (var i = 0; i < n; i++) adj[i].forEach(function (v, j) { if (j !== i) { w[i] += v; } });
    for (i = 0; i < n; i++) m2 += w[i];
    var out = [];
    for (i = 0; i < n; i++) { var mp = new Map(); adj[i].forEach(function (v, j) { if (j !== i && w[i] > 0 && w[j] > 0) mp.set(j, m2 * v / (w[i] * w[j])); }); out.push(mp); }
    return out;
  }
  function louvain(g, seed, resolution, norm) {
    resolution = resolution == null ? 1 : resolution;
    var rng = mulberry32(seed == null ? 42 : seed);
    var n = g.n;
    // adjacency maps
    var adj = [];
    for (var i = 0; i < n; i++) adj.push(new Map());
    g.edges.forEach(function (e) {
      if (e.s === e.t) { adj[e.s].set(e.s, (adj[e.s].get(e.s) || 0) + e.w); return; }
      adj[e.s].set(e.t, (adj[e.s].get(e.t) || 0) + e.w);
      adj[e.t].set(e.s, (adj[e.t].get(e.s) || 0) + e.w);
    });
    if (norm === 'association') adj = associationNormalize(adj);
    var membership = new Int32Array(n); for (i = 0; i < n; i++) membership[i] = i;
    var levels = 0;
    function degreeOf(a, j) { var k = 0; a[j].forEach(function (w, nb) { k += (nb === j ? 2 * w : w); }); return k; }
    var cur = adj;
    while (true) {
      var N = cur.length, k = new Float64Array(N), m2 = 0;
      for (i = 0; i < N; i++) { k[i] = degreeOf(cur, i); m2 += k[i]; }
      if (m2 === 0) break;
      var com = new Int32Array(N), tot = new Float64Array(N);
      for (i = 0; i < N; i++) { com[i] = i; tot[i] = k[i]; }
      var order = []; for (i = 0; i < N; i++) order.push(i);
      for (i = N - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
      var movedAny = false, improved = true, passes = 0;
      while (improved && passes < 100) {
        improved = false; passes++;
        for (var oi = 0; oi < N; oi++) {
          var node = order[oi], c0 = com[node], ki = k[node];
          var nw = new Map();
          cur[node].forEach(function (w, nb) { if (nb !== node) nw.set(com[nb], (nw.get(com[nb]) || 0) + w); });
          tot[c0] -= ki;
          var best = c0, bestGain = (nw.get(c0) || 0) - resolution * tot[c0] * ki / m2;
          nw.forEach(function (wc, c) {
            var gain = wc - resolution * tot[c] * ki / m2;
            if (gain > bestGain + 1e-12) { bestGain = gain; best = c; }
          });
          tot[best] += ki;
          if (best !== c0) { com[node] = best; improved = true; movedAny = true; }
        }
      }
      if (!movedAny) break;
      levels++;
      // renumber
      var map = new Map(), nc = 0;
      for (i = 0; i < N; i++) { if (!map.has(com[i])) map.set(com[i], nc++); com[i] = map.get(com[i]); }
      for (i = 0; i < n; i++) membership[i] = com[membership[i]];
      // aggregate
      var next = []; for (i = 0; i < nc; i++) next.push(new Map());
      for (i = 0; i < N; i++) {
        var ci = com[i];
        cur[i].forEach(function (w, nb) {
          var cj = com[nb];
          if (nb === i) { next[ci].set(ci, (next[ci].get(ci) || 0) + w); }
          else if (ci === cj) { if (i < nb) next[ci].set(ci, (next[ci].get(ci) || 0) + w); }
          else next[ci].set(cj, (next[ci].get(cj) || 0) + w);
        });
      }
      cur = next;
      if (nc === N) break;
    }
    // relabel communities by size desc
    var size = new Map();
    for (i = 0; i < n; i++) size.set(membership[i], (size.get(membership[i]) || 0) + 1);
    var sorted = Array.from(size.keys()).sort(function (a, b) { return size.get(b) - size.get(a) || a - b; });
    var rel = new Map(); sorted.forEach(function (c, ix) { rel.set(c, ix); });
    for (i = 0; i < n; i++) membership[i] = rel.get(membership[i]);
    return { membership: membership, modularity: modularity(adj, membership, resolution), levels: levels, count: sorted.length };
  }

  function modularity(adj, memb, resolution) {
    var n = adj.length, m2 = 0, k = new Float64Array(n);
    for (var i = 0; i < n; i++) adj[i].forEach(function (w, nb) { var x = nb === i ? 2 * w : w; k[i] += x; });
    for (i = 0; i < n; i++) m2 += k[i];
    if (!m2) return 0;
    var inC = new Map(), totC = new Map();
    for (i = 0; i < n; i++) {
      totC.set(memb[i], (totC.get(memb[i]) || 0) + k[i]);
      adj[i].forEach(function (w, nb) { if (memb[nb] === memb[i]) inC.set(memb[i], (inC.get(memb[i]) || 0) + (nb === i ? 2 * w : w)); });
    }
    var Q = 0;
    totC.forEach(function (t, c) { Q += (inC.get(c) || 0) / m2 - resolution * (t / m2) * (t / m2); });
    return Q;
  }

  function weakComponents(g) {
    var parent = new Int32Array(g.n); for (var i = 0; i < g.n; i++) parent[i] = i;
    function f(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    g.edges.forEach(function (e) { var a = f(e.s), b = f(e.t); if (a !== b) parent[a] = b; });
    var sizes = new Map();
    for (i = 0; i < g.n; i++) { var r = f(i); sizes.set(r, (sizes.get(r) || 0) + 1); }
    var largest = 0; sizes.forEach(function (s) { if (s > largest) largest = s; });
    return { count: sizes.size, largest: largest };
  }

  function analyze(g, opts, onProgress) {
    opts = opts || {};
    var deg = degrees(g);
    var pr = pagerank(g, opts.alpha);
    var sources = null, approx = false;
    var exactLimit = opts.exactLimit || 4000;
    if (g.n > exactLimit) {
      approx = true;
      var rng = mulberry32((opts.seed || 42) + 7), all = [];
      for (var i = 0; i < g.n; i++) all.push(i);
      for (i = all.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = all[i]; all[i] = all[j]; all[j] = t; }
      sources = all.slice(0, opts.pivots || 1000);
    }
    var bt = betweenness(g, sources, onProgress);
    var lv = louvain(g, opts.seed, opts.resolution, opts.norm);
    var rec = 0, set = new Set();
    g.edges.forEach(function (e) { set.add(e.s + '|' + e.t); });
    g.edges.forEach(function (e) { if (e.s !== e.t && set.has(e.t + '|' + e.s)) rec++; });
    var nonSelf = g.edges.filter(function (e) { return e.s !== e.t; }).length;
    return {
      inW: Array.from(deg.inW), outW: Array.from(deg.outW), inC: Array.from(deg.inC), outC: Array.from(deg.outC),
      pagerank: Array.from(pr), betweenness: Array.from(bt), betweennessApprox: approx, pivots: sources ? sources.length : g.n,
      community: Array.from(lv.membership), modularity: lv.modularity, communities: lv.count,
      density: g.n > 1 ? nonSelf / (g.n * (g.n - 1)) : 0,
      reciprocity: nonSelf ? rec / nonSelf : 0,
      components: weakComponents(g)
    };
  }

  /* per-node sentiment from scored texts (records with .s) of the same platform/date window */
  function nodeSentiment(records, g, opts) {
    var n = g.n, oS = new Float64Array(n), oN = new Int32Array(n), oNeg = new Int32Array(n), iS = new Float64Array(n), iN = new Int32Array(n), iNeg = new Int32Array(n);
    var id = new Map(); g.labels.forEach(function (l, i) { id.set(l, i); });
    var from = opts.from, to = opts.to;
    for (var k = 0; k < records.length; k++) {
      var r = records[k];
      if (r.s == null || (opts.platform && r.p !== opts.platform)) continue;
      if (r.ps) { if (opts.net !== r.type || r.type === 'cooc') continue; var tm = id.get(r.t); if (tm !== undefined) { iS[tm] += r.s; iN[tm]++; if (r.lab === 'neg') iNeg[tm]++; } continue; }
      if ((from != null || to != null) && isNaN(r.ts)) continue;
      if (from != null && r.ts < from) continue;
      if (to != null && r.ts > to) continue;
      var a = id.get(r.a); if (a !== undefined) { oS[a] += r.s; oN[a]++; if (r.lab === 'neg') oNeg[a]++; }
      if (r.t && r.t !== r.a) { var t = id.get(r.t); if (t !== undefined) { iS[t] += r.s; iN[t]++; if (r.lab === 'neg') iNeg[t]++; } }
    }
    function mean(S, N) { var o = []; for (var i = 0; i < n; i++) o.push(N[i] ? S[i] / N[i] : null); return o; }
    return { outMean: mean(oS, oN), outN: Array.from(oN), outNeg: Array.from(oNeg), inMean: mean(iS, iN), inN: Array.from(iN), inNeg: Array.from(iNeg) };
  }

  /* analyze every platform separately; returns {platforms:[...], res:{p:{retweet:{g,m},reply:{g,m}}}} */
  function analyzeAll(records, opts, onProgress) {
    var present = {};
    records.forEach(function (r) { if (r.p) present[r.p] = (present[r.p] || 0) + 1; });
    var plats = Object.keys(present).sort(function (a, b) { return present[b] - present[a]; });
    var res = {};
    plats.forEach(function (p, pi) {
      res[p] = {};
      var nets = p === 'media' ? ['retweet', 'reply'] : ['retweet', 'reply', 'like'];
      ['mention', 'cooc', 'quote', 'view'].forEach(function (x) { if (records.some(function (r) { return r.p === p && r.type === x && r.t; })) nets.push(x); });
      nets.forEach(function (ty) {
        var o = {}; for (var k in opts) o[k] = opts[k]; o.platform = p; o.net = ty;
        var g = buildGraph(records, ty, o);
        if (onProgress) onProgress(p, ty, pi / plats.length);
        var m = analyze(g, o);
        m.sent = nodeSentiment(records, g, o);
        res[p][ty] = { g: g, m: m };
      });
    });
    return { platforms: plats, res: res };
  }

  function xmlEsc(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /* GEXF 1.3. viz: {colors:[[r,g,b]], sizes:[], pos:[[x,y]]} optional */
  function toGEXF(g, m, title, viz) {
    var L = [];
    var date = new Date().toISOString().slice(0, 10);
    L.push('<?xml version="1.0" encoding="UTF-8"?>');
    L.push('<gexf xmlns="http://gexf.net/1.3" xmlns:viz="http://gexf.net/1.3/viz" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd" version="1.3">');
    L.push('  <meta lastmodifieddate="' + date + '"><creator>Jaringan Politik Partai Islam di Indonesia</creator><description>' + xmlEsc(title) + '</description></meta>');
    L.push('  <graph defaultedgetype="directed" mode="static">');
    L.push('    <attributes class="node">');
    var attrs = [['in_degree', 'integer'], ['out_degree', 'integer'], ['in_degree_weighted', 'double'], ['out_degree_weighted', 'double'], ['betweenness', 'double'], ['pagerank', 'double'], ['community', 'integer'], ['sentiment_written_mean', 'double'], ['sentiment_written_n', 'integer'], ['sentiment_received_mean', 'double'], ['sentiment_received_n', 'integer'], ['negative_received_n', 'integer']];
    attrs.push(['node_type', 'string']);
    attrs.forEach(function (a, i) { L.push('      <attribute id="' + i + '" title="' + a[0] + '" type="' + a[1] + '"/>'); });
    L.push('    </attributes>');
    L.push('    <attributes class="edge"><attribute id="0" title="platforms" type="string"/><attribute id="1" title="sentiment_mean" type="double"/><attribute id="2" title="sentiment_n" type="integer"/><attribute id="3" title="negative_n" type="integer"/><attribute id="4" title="link_type" type="string"/></attributes>');
    L.push('    <nodes>');
    for (var i = 0; i < g.n; i++) {
      var se = m.sent || null;
      var vals = [m.inC[i], m.outC[i], m.inW[i], m.outW[i], m.betweenness[i], m.pagerank[i], m.community[i],
        se ? se.outMean[i] : null, se ? se.outN[i] : null, se ? se.inMean[i] : null, se ? se.inN[i] : null, se ? se.inNeg[i] : null, viz && viz.types ? viz.types[i] : 'account'];
      var s = '      <node id="n' + i + '" label="' + xmlEsc(viz && viz.labels ? viz.labels[i] : g.labels[i]) + '"><attvalues>';
      vals.forEach(function (v, k) { if (v !== null && v !== undefined) s += '<attvalue for="' + k + '" value="' + xmlEsc(v) + '"/>'; });
      s += '</attvalues>';
      if (viz) {
        if (viz.colors) { var c = viz.colors[i]; s += '<viz:color r="' + c[0] + '" g="' + c[1] + '" b="' + c[2] + '"/>'; }
        if (viz.sizes) s += '<viz:size value="' + (+viz.sizes[i]).toFixed(3) + '"/>';
        if (viz.pos && viz.pos[i] && isFinite(viz.pos[i][0])) s += '<viz:position x="' + (+viz.pos[i][0]).toFixed(2) + '" y="' + (-viz.pos[i][1]).toFixed(2) + '" z="0"/>';
      }
      s += '</node>';
      L.push(s);
    }
    L.push('    </nodes>');
    L.push('    <edges>');
    g.edges.forEach(function (e, k) {
      var pl = e.pl ? Object.keys(e.pl).sort().map(function (p) { return p + ':' + e.pl[p]; }).join(';') : '';
      var av = (pl ? '<attvalue for="0" value="' + xmlEsc(pl) + '"/>' : '') + (e.sN ? '<attvalue for="1" value="' + (e.sSum / e.sN) + '"/><attvalue for="2" value="' + e.sN + '"/><attvalue for="3" value="' + e.sNeg + '"/>' : '') + (e.lt ? '<attvalue for="4" value="' + xmlEsc(Object.keys(e.lt).join(';')) + '"/>' : '');
      L.push('      <edge id="e' + k + '" source="n' + e.s + '" target="n' + e.t + '" weight="' + e.w + '"' + (av ? '><attvalues>' + av + '</attvalues></edge>' : '/>'));
    });
    L.push('    </edges>');
    L.push('  </graph>');
    L.push('</gexf>');
    return L.join('\n');
  }

  return { parseCSV: parseCSV, toRecords: toRecords, buildGraph: buildGraph, analyze: analyze, toGEXF: toGEXF, pagerank: pagerank, betweenness: betweenness, louvain: louvain, mulberry32: mulberry32, normUser: normUser, normPlatform: normPlatform, associationNormalize: associationNormalize, analyzeAll: analyzeAll, nodeSentiment: nodeSentiment };
})();
if (typeof module !== 'undefined') module.exports = SNA;
