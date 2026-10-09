import re,json,collections
def split(t):
    t=re.sub(r'\s*\[.*$','',t)
    if ' / ' in t: a,b=t.split(' / ',1); return a.strip(),b.strip()
    return t.strip(),''
MARK_RU=re.compile(r'\s*\((?:[а-яё]+\s+сезон|\d+\s*-?\s*й?\s*сезон|фильм[^)]*|спецвыпуск[^)]*|спэшл[^)]*|cпэшлы)\)',re.I)
def norm(s):
    s=s.lower().replace('ё','е')
    s=re.sub(r'[^\w\s]',' ',s); return re.sub(r'\s+',' ',s).strip()
def base_ru(ru): return norm(MARK_RU.sub('',ru))
ORD={'первый':1,'второй':2,'третий':3,'четвертый':4,'четвёртый':4,'пятый':5,'шестой':6,'седьмой':7,'восьмой':8,'девятый':9,'десятый':10,'одиннадцатый':11,'двенадцатый':12}
def season_ru(ru):
    m=re.search(r'\(([а-яё]+)\s+сезон\)',ru,re.I)
    if m and m.group(1).lower() in ORD: return ORD[m.group(1).lower()]
    m=re.search(r'\((\d+)\s*-?\s*й?\s*сезон\)',ru,re.I)
    return int(m.group(1)) if m else None
def kind_ru(ru):
    m=re.search(r'\((фильм[^)]*|спецвыпуск[^)]*|спэшл[^)]*|cпэшлы)\)',ru,re.I)
    return m.group(1).lower() if m else None
ORIG_TAIL=re.compile(r'(?:\s*[:\-–]?\s*)(?:\d+(?:st|nd|rd|th)\s+season|season\s*\d+|part\s*\d+|cour\s*\d+|ii|iii|iv|vi|vii|viii|ix|x|\d{1,2})\s*$',re.I)
def base_orig(orig):
    o=re.sub(r'\s+',' ',orig).strip()
    for _ in range(2): o=ORIG_TAIL.sub('',o).strip()
    return o
def season_orig(orig):
    o=orig.strip().lower()
    m=re.search(r'(\d+)(?:st|nd|rd|th)\s+season\s*$',o) or re.search(r'season\s*(\d+)\s*$',o) or re.search(r'\bpart\s*(\d+)\s*$',o)
    if m: return int(m.group(1))
    m=re.search(r'\b(ii|iii|iv|v|vi|vii|viii|ix|x)\s*$',o)
    if m: return {'ii':2,'iii':3,'iv':4,'v':5,'vi':6,'vii':7,'viii':8,'ix':9,'x':10}[m.group(1)]
    m=re.search(r'\s(\d{1,2})\s*$',o)
    return int(m.group(1)) if m else None
ORIG_TAIL2=re.compile(r'(?:\s*[:\-–]?\s*)(?:\d+(?:st|nd|rd|th)\s+season|(?:second|third|fourth|fifth|sixth|final)\s+season|season\s*\d+|part\s*\d+|cour\s*\d+|ii|iii|iv|vi|vii|viii|ix|x|\d{1,2}|s|r|\(\d{4}\))\s*$',re.I)
ORIG_HEAD=re.compile(r'^(?:gekijouban|eiga)\s+',re.I)
def base_orig2(orig):
    o=re.sub(r'\s+',' ',orig).strip(); o=ORIG_HEAD.sub('',o)
    for _ in range(3): o=ORIG_TAIL2.sub('',o).strip()
    return o
def head_ru(b): return re.split(r'\s*:\s*|\s+[—–-]\s+|\.\s+',b,maxsplit=1)[0].strip()
SEASON_TYPES=('тв','ona')
def classify(cur_title, results):
    """cur_title: raw 'title'; results: list of dicts id,title,year,type -> (seasons, similar)"""
    cru,_=split(cur_title); full=MARK_RU.sub('',cru).strip(); B=norm(full); H=norm(head_ru(full))
    seas=collections.defaultdict(list); sim=[]
    for x in results:
        ru,_=split(x['title']); f=MARK_RU.sub('',ru).strip(); bx=norm(f); hx=norm(head_ru(f))
        same_head = hx==H or bx.startswith(H+' ')
        if not same_head: continue
        isseason = bx==B and not kind_ru(ru) and x['type'].lower() in SEASON_TYPES
        if isseason: seas[season_ru(ru) or 1].append(x)
        else: sim.append(x)
    # дубли номеров -> в похожие
    out=[]
    for n in sorted(seas):
        if len(seas[n])==1: out.append((n,seas[n][0]))
        else: sim.extend(seas[n])
    return out,sorted(sim,key=lambda x:(x['year'] or '',x['id']))
import collections
