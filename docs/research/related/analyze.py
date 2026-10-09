"""Воспроизводит основные цифры исследования (docs/research/related-titles.md).
Запуск из каталога data/ после fetch_*/search_*: PYTHONPATH=.. python3 ../analyze.py"""
import collections, json
from lib import *

items = json.load(open('feed.json'))
S = json.load(open('searches.json'))
H = json.load(open('searches_head.json'))
O = json.load(open('searches_orig2.json'))

print('== типы:', collections.Counter(x['type'] for x in items.values()).most_common())
paren = collections.Counter()
for x in items.values():
    ru, _ = split(x['title'])
    for m in re.findall(r'\(([^)]*)\)', ru):
        paren[re.sub(r'\d+', 'N', m.lower())] += 1
print('== скобки в русской части:', paren.most_common(15))

st = collections.Counter()
for x in items.values():
    ru, orig = split(x['title']); r, o = season_ru(ru), season_orig(orig)
    if r:
        st['маркер_ru'] += 1
        if o is not None: st['совпало' if o == r else 'РАСХОДИТСЯ'] += 1
print('== русский маркер vs номер в оригинале:', st)

sets = list(S.values()) + [v['res'] for v in H.values()]
dist = collections.Counter(); sim = collections.Counter()
for res in [r for r in sets if r]:
    cur = res[0]
    seasons, similar = classify(cur['title'], res)
    similar = [x for x in similar if x['id'] != cur['id']]
    dist[min(len(seasons), 4)] += 1; sim['есть' if similar else 'нет'] += 1
print('== сезонов в группе (4 = 4+):', sorted(dist.items()), '| похожие:', dict(sim))

extra = 0
for q, v in O.items():
    nb = norm(q); nob = norm(v['orig_base'])
    ru = {x['id'] for x in S[q] if base_ru(split(x['title'])[0]) == nb or base_ru(split(x['title'])[0]).startswith(nb + ' ')}
    ors = {x['id'] for x in (v['res'] or []) if norm(base_orig2(split(x['title'])[1])) == nob or norm(base_orig2(split(x['title'])[1])).startswith(nob + ' ')}
    extra += bool(ors - ru)
print('== поиск по оригиналу нашёл лишнее в', extra, 'из', len(O), 'запросов')
