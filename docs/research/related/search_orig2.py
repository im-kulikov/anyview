import json,time,urllib.request,urllib.parse
from lib import *
B='https://api.animetop.info/v1'
S=json.load(open('searches.json'))
def search(name):
    data=urllib.parse.urlencode({'name':name}).encode()
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(B+'/search',data=data),timeout=30) as r: return json.load(r).get('data',[])
        except urllib.error.HTTPError as e:
            if e.code==404: return []
            time.sleep(1.5)
        except Exception: time.sleep(1.5)
    return None
out={}
for i,(q,res) in enumerate(S.items()):
    nb=norm(q); same=[x for x in res if base_ru(split(x['title'])[0])==nb]
    if not same: continue
    same.sort(key=lambda x:(season_ru(split(x['title'])[0]) or 1, x['year'] or ''))
    ob=base_orig2(split(same[0]['title'])[1])
    if len(ob)<4: continue
    r=search(ob)
    out[q]={'orig_base':ob,'res':None if r is None else [{k:x.get(k) for k in('id','title','year','type')} for x in r]}
    time.sleep(0.45)
    if i%60==0: print(i,flush=True)
json.dump(out,open('searches_orig2.json','w'),ensure_ascii=False)
print('done',len(out))
