import json
import os
import re
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
D = os.path.dirname(__file__)
zh = json.load(open(os.path.join(D, 'zh_all.json'), encoding='utf-8'))
qm = json.load(open(os.path.join(D, 'qm_all.json'), encoding='utf-8'))
det = json.load(open(os.path.join(D, 'detail.json'), encoding='utf-8'))

print('=== 纵横 新书人气榜 人气门槛 ===')
rows = [x for x in zh if x['board'] == '新书人气榜']
for pos in (1, 3, 5, 10, 20, 30, 50, 80, 100):
    r = [x for x in rows if x['rank'] == str(pos)]
    if r:
        print(f'  #{pos}: {r[0]["value"]} 人气  ({r[0]["title"]})')

print('=== 纵横 月票榜（全站，非新书） ===')
rows = [x for x in zh if x['board'] == '月票榜']
for pos in (1, 5, 10, 15, 20):
    r = [x for x in rows if x['rank'] == str(pos)]
    if r:
        print(f'  #{pos}: {r[0]["value"]} 月票  ({r[0]["title"]} / {r[0]["cat"]})')

print('=== 七猫 新书榜·男生·日榜 热度门槛 ===')
rows = [x for x in qm if x['board'] == '新书榜·男生·日榜']
for r in rows:
    if r['rank'] in ('1', '3', '5', '10', '15', '20'):
        print(f'  #{r["rank"]}: {r["value"]}  ({r["title"]} / {r["cat"]})')

print('=== 七猫 新书榜·男生·月榜 热度门槛 ===')
rows = [x for x in qm if x['board'] == '新书榜·男生·月榜']
for r in rows:
    if r['rank'] in ('1', '3', '5', '10', '15', '20'):
        print(f'  #{r["rank"]}: {r["value"]}  ({r["title"]} / {r["cat"]})')

print('=== 七猫 大热榜·男生 对照 ===')
rows = [x for x in qm if x['board'] == '大热榜·男生·日榜']
for r in rows[:5]:
    print(f'  #{r["rank"]}: {r["value"]}  ({r["title"]} / {r["cat"]} / {r["words"]})')

print('=== 纵横 新书人气榜/订阅榜 分类分布（玄幻族） ===')
c = Counter(x['cat'] for x in zh if x['board'] in ('新书人气榜', '新书订阅榜'))
for k, v in c.most_common(12):
    print(f'  {k}\t{v}')

print('=== 七猫 新书榜（日+月，去重）分类分布 ===')
seen = {}
for x in qm:
    if x['board'].startswith('新书榜'):
        seen[x['bookid']] = x['cat']
for k, v in Counter(seen.values()).most_common():
    print(f'  {k}\t{v}')

print('=== 纵横 新书首发时间分布 ===')
months = Counter()
for bid, d in det['zh'].items():
    if d.get('first'):
        months[d['first'][:7]] += 1
for k in sorted(months):
    print(f'  {k}\t{months[k]}')

print('=== 七猫 新书榜字数区间 ===')
ws = []
for x in qm:
    if x['board'].startswith('新书榜'):
        m = re.match(r'([\d.]+)万字', x.get('words') or '')
        if m:
            ws.append(float(m.group(1)))
if ws:
    print(f'  n={len(ws)} min={min(ws)} max={max(ws)} avg={sum(ws) / len(ws):.1f}')
