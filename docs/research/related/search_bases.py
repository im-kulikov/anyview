import json,re,time,random,urllib.request,urllib.parse
B='https://api.animetop.info/v1'
items=json.load(open('feed.json'))
def split(t):
    t=re.sub(r'\s*\[.*$','',t)
    if ' / ' in t: a,b=t.split(' / ',1); return a.strip(),b.strip()
    return t.strip(),''
MARK=re.compile(r'\s*\((?:[а-яё]+\s+сезон|\d+\s*-?\s*й?\s*сезон|фильм[^)]*|спецвыпуск[^)]*|спэшл[^)]*|cпэшлы)\)',re.I)
def base(ru): return re.sub(r'\s+',' ',MARK.sub('',ru)).strip()
bases={}
for x in items.values():
    ru,orig=split(x['title']); bases.setdefault(base(ru).lower(),base(ru))
random.seed(11)
keys=list(bases)
with_marker=[b for b in keys if any(MARK.search(split(x['title'])[0]) and base(split(x['title'])[0]).lower()==b for x in items.values())]
rest=[b for b in keys if b not in set(with_marker)]
pick=random.sample(with_marker,min(130,len(with_marker)))+random.sample(rest,min(130,len(rest)))
print('unique bases',len(keys),'with marker',len(with_marker),'picked',len(pick))
def search(name):
    data=urllib.parse.urlencode({'name':name}).encode()
    for i in range(3):
        try:
            req=urllib.request.Request(B+'/search',data=data)
            with urllib.request.urlopen(req,timeout=30) as r: return json.load(r).get('data',[])
        except urllib.error.HTTPError as e:
            if e.code==404: return []
            time.sleep(1.5)
        except Exception: time.sleep(1.5)
    return None
out={}
for i,b in enumerate(pick):
    r=search(bases[b])
    out[bases[b]]=None if r is None else [{k:x.get(k) for k in('id','title','year','type')} for x in r]
    time.sleep(0.45)
    if i%40==0: print(i,flush=True)
json.dump(out,open('searches.json','w'),ensure_ascii=False)
print('done',len(out),'failed',sum(v is None for v in out.values()))
