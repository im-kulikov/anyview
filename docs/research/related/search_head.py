import json,re,time,random,urllib.request,urllib.parse
from lib import *
B='https://api.animetop.info/v1'
items=json.load(open('feed.json'))
def head(b): return re.split(r'\s*:\s*|\s+[—–-]\s+',b,1)[0].strip()
cands={}
for x in items.values():
    ru,_=split(x['title']); b=MARK_RU.sub('',ru).strip()
    if re.search(r':|\s[—–-]\s',b):
        h=head(b)
        if len(h)>=4: cands.setdefault(norm(h),(h,[]))[1].append(x['title'][:100])
random.seed(5); keys=random.sample(list(cands),min(80,len(cands)))
def search(name):
    data=urllib.parse.urlencode({'name':name}).encode()
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(B+'/search',data=data),timeout=30) as r: return json.load(r).get('data',[])
        except urllib.error.HTTPError as e:
            if e.code==404: return []
            time.sleep(1.5)
        except Exception: time.sleep(1.5)
out={}
for i,k in enumerate(keys):
    r=search(cands[k][0]); out[k]={'head':cands[k][0],'from':cands[k][1],'res':[{kk:x.get(kk) for kk in('id','title','year','type')} for x in (r or [])]}
    time.sleep(0.45)
json.dump(out,open('searches_head.json','w'),ensure_ascii=False); print('done',len(out),'of',len(cands))
