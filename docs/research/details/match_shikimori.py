# Замер сопоставления тайтлов animevost с Shikimori (строгий режим: точное имя + год ±1). Запуск: python3 match_shikimori.py (нужен lib.py из ../related/ рядом)
# Результат 2026-10-09: 101 из 120 (84 %), неоднозначных 0.
import json,time,random,urllib.request,urllib.parse,re
from lib import *
UA={'User-Agent':'anyview-research'}
def get(u,tries=3):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
        except Exception as e: time.sleep(2)
def av(p): return get(f'https://api.animetop.info/v1/last?page={p}&quantity=40')
f=av(1); pages=-(-int(f['state']['count'])//40); random.seed(3)
items=[]
for p in random.sample(range(1,pages+1),5): items+= (av(p) or {}).get('data',[])
random.shuffle(items); items=items[:120]
out=[]
for x in items:
    ru,orig=split(x['title']); yr=re.search(r'\d{4}',x.get('year') or ''); yr=int(yr.group()) if yr else None
    q=orig or ru
    q=base_orig2(q) if False else q
    r=get('https://shikimori.io/api/animes?limit=10&search='+urllib.parse.quote(q)) or []
    time.sleep(0.8)
    def hit(c):
        names={norm(c.get(k) or '') for k in('name','russian','english')}|{norm(s) for s in c.get('synonyms',[]) or []}
        return norm(orig) in names or norm(ru) in names
    cands=[c for c in r if hit(c)]
    ym=[c for c in cands if yr and c.get('aired_on') and abs(int(c['aired_on'][:4])-yr)<=1]
    out.append(dict(id=x['id'],ru=ru,orig=orig,yr=yr,type=x.get('type'),n=len(r),exact=len(cands),yearok=len(ym),pick=(ym[0]['id'],ym[0]['name'],ym[0]['aired_on']) if ym else None))
json.dump(out,open('m.json','w'),ensure_ascii=False)
N=len(out); print(N,'found-any',sum(o['n']>0 for o in out),'name-hit',sum(o['exact']>0 for o in out),'name+year',sum(o['yearok']>0 for o in out),'ambiguous(>1 yearok)',sum(o['yearok']>1 for o in out))
for o in out:
    if not o['yearok']: print('MISS',o['id'],o['ru'],'|',o['orig'],o['yr'],o['type'],o['n'],o['exact'])
