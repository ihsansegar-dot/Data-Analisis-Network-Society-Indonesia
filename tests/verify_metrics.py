"""Membandingkan metrik src/core.js dengan NetworkX (pip install networkx)."""
import csv, json, os
import networkx as nx
D = os.path.join(os.path.dirname(__file__), 'out')
out = json.load(open(os.path.join(D, 'metrics.json')))
rows = list(csv.DictReader(open(os.path.join(D, 'sample.csv'))))
ok = True
for ty in ['retweet', 'reply']:
    G = nx.DiGraph()
    for r in rows:
        if r['type'] != ty: continue
        a = r['author'].strip().lstrip('@').lower(); t = r['target_user'].strip().lstrip('@').lower()
        if not t or a == t: continue
        G.add_edge(a, t, weight=G[a][t]['weight'] + 1 if G.has_edge(a, t) else 1)
    L, m = out[ty]['labels'], out[ty]['m']
    pr = nx.pagerank(G, weight='weight', tol=1e-12); bt = nx.betweenness_centrality(G)
    d_pr = max(abs(pr[u] - m['pagerank'][i]) for i, u in enumerate(L))
    d_bt = max(abs(bt[u] - m['betweenness'][i]) for i, u in enumerate(L))
    d_in = max(abs(G.in_degree(u, weight='weight') - m['inW'][i]) for i, u in enumerate(L))
    print(f"{ty}: n={len(L)} PageRank maxdiff={d_pr:.2e} betweenness maxdiff={d_bt:.2e} in-degree maxdiff={d_in}")
    ok &= d_pr < 1e-5 and d_bt < 1e-9 and d_in == 0
print('LULUS' if ok else 'GAGAL'); raise SystemExit(0 if ok else 1)
