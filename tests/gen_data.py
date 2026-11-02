import os; os.makedirs("tests/out", exist_ok=True)
import random, csv
random.seed(1)
users=[f"user{i}" for i in range(300)]
groups=[users[:100],users[100:200],users[200:]]
rows=[]
for _ in range(4000):
    g=random.choice(groups) if random.random()<0.9 else users
    a=random.choice(g)
    hubs=g[:8]
    t=random.choice(hubs) if random.random()<0.6 else random.choice(g)
    typ=random.choice(["retweet","reply","tweet"])
    rows.append([("@"+a.upper()) if random.random()<0.1 else a,"teks, \"kutip\"\nbaris",typ,"" if typ=="tweet" else t,"2026-10-%02d 10:00:00"%random.randint(1,30)])
with open("tests/out/sample.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["author","text","type","target_user","created_at"]); w.writerows(rows)
