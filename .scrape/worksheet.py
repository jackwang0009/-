import json
import os
from collections import OrderedDict

D = os.path.dirname(__file__)
zh = json.load(open(os.path.join(D, 'zh_all.json'), encoding='utf-8'))
qm = json.load(open(os.path.join(D, 'qm_all.json'), encoding='utf-8'))
det = json.load(open(os.path.join(D, 'detail.json'), encoding='utf-8'))

ZH_KEEP = ('玄幻', '修真', '仙侠', '武侠', '诸天', '争霸', '奇幻', '洪荒',
           '高武', '奇门', '复苏', '末世')
QM_KEEP = ('玄幻', '仙侠', '修真', '异世', '诸天', '争霸', '奇幻',
           '高武', '修仙', '高手', '奇闻')

rows = []
seen = OrderedDict()
for x in zh:
    if x['board'] not in ('新书人气榜', '新书订阅榜'):
        continue
    if not any(k in x['cat'] for k in ZH_KEEP):
        continue
    d = det['zh'].get(x['bookid'], {})
    key = ('zh', x['bookid'])
    if key in seen:
        seen[key]['boards'].append(f"{x['board']}#{x['rank']}"
                                   + (f"·{x['value']}{x['metric']}" if x['value'] else ''))
        continue
    seen[key] = dict(x, boards=[f"{x['board']}#{x['rank']}"
                                + (f"·{x['value']}{x['metric']}" if x['value'] else '')],
                     first=d.get('first', ''), words=d.get('words', 0), n=d.get('n', 0))

for x in qm:
    if x['board'] == '大热榜·男生·日榜':
        continue
    if not any(k in x['cat'] for k in QM_KEEP):
        continue
    key = ('qm', x['bookid'])
    label = x['board'] + (f"#{x['rank']}" if x.get('rank') else '')
    if x.get('value'):
        label += f"·{x['value']}热度"
    if key in seen:
        if label not in seen[key]['boards']:
            seen[key]['boards'].append(label)
        continue
    seen[key] = dict(x, boards=[label], first='', n=0)

with open(os.path.join(D, 'worksheet.txt'), 'w', encoding='utf-8') as f:
    for i, ((pf, bid), v) in enumerate(seen.items(), 1):
        f.write(f"### {i} [{v['platform']}] {v['title']} | {v.get('author','')} | "
                f"{v.get('cat','')} | 首发 {v.get('first','?')} | "
                f"{v.get('words') or v.get('words','')} | {' ; '.join(v['boards'])}\n")
        f.write(v.get('intro', '')[:260] + '\n\n')
json.dump({f'{k[0]}_{k[1]}': v for k, v in seen.items()},
          open(os.path.join(D, 'merged.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('rows', len(seen))
