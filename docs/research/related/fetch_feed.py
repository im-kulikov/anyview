import json, time, urllib.request, urllib.parse, random
B='https://api.animetop.info/v1'
def get(path):
    for i in range(3):
        try:
            with urllib.request.urlopen(B+path, timeout=30) as r: return json.load(r)
        except Exception as e:
            time.sleep(1.5)
    return None
first=get('/last?page=1&quantity=40'); total=int(first['state']['count']); pages=-(-total//40)
random.seed(7)
chosen=sorted(set([1,2,3,4,5]+random.sample(range(6,pages+1),20)))
items={}
for p in chosen:
    d=get(f'/last?page={p}&quantity=40')
    if d and d.get('data'):
        for x in d['data']: items[str(x['id'])]={k:x.get(k) for k in ('id','title','year','type','genre')}
    time.sleep(0.35)
json.dump(items,open('feed.json','w'),ensure_ascii=False)
print('total',total,'pages',pages,'chosen',len(chosen),'items',len(items))
