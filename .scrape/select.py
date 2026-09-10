import json
import os
from collections import Counter, OrderedDict

D = os.path.dirname(__file__)
zh = json.load(open(os.path.join(D, 'zh_all.json'), encoding='utf-8'))
qm = json.load(open(os.path.join(D, 'qm_all.json'), encoding='utf-8'))

print('--- zongheng cat counts ---')
for k, v in Counter(x['cat'] for x in zh).most_common():
    print(f'{k}\t{v}')
print('--- qimao cat counts ---')
for k, v in Counter(x['cat'] for x in qm).most_common():
    print(f'{k}\t{v}')
print('--- zongheng metrics ---')
for b in ('新书人气榜', '新书订阅榜', '月票榜'):
    rows = [x for x in zh if x['board'] == b]
    print(b, len(rows), 'metric=', rows[0]['metric'] if rows else '',
          'top=', rows[0]['value'] if rows else '',
          'last=', rows[-1]['value'] if rows else '')
