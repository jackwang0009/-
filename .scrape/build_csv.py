import csv
import json
import os
import re
import sys

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from notes import NOTES  # noqa: E402

merged = json.load(open(os.path.join(D, 'merged.json'), encoding='utf-8'))
qmc = {}
p = os.path.join(D, 'qm_chaps.json')
if os.path.exists(p):
    qmc = json.load(open(p, encoding='utf-8'))

BOARD_ORDER = {'新书榜·男生·日榜': 0, '新书榜·男生·月榜': 1,
               '东方玄幻分类新书': 2, '玄幻奇幻分类新书': 3,
               '新书人气榜': 0, '新书订阅榜': 1}
BOARD_LABEL = {
    '东方玄幻分类新书': '东方玄幻分类·新书池（筛选：30万字以下 + 3日内更新 + 连载中，无榜位）',
    '玄幻奇幻分类新书': '玄幻奇幻分类·新书池（筛选：30万字以下 + 3日内更新 + 连载中，无榜位）',
}


def wan(v):
    return f'{v / 10000:.1f}' if v else ''


rows = []
missing = []
for key, v in merged.items():
    pf, bid = key.split('_', 1)
    plat = v['platform']
    title = v['title']
    note = NOTES.get((plat, title))
    if not note:
        missing.append((plat, title))
        note = ('', '', '')
    genre, trope, hybrid = note

    if plat == '纵横':
        words = wan(v.get('words') or 0)
        first = (v.get('first') or '')[:10]
        url = f'https://book.zongheng.com/book/{bid}.html'
    else:
        m = re.match(r'([\d.]+)万字', v.get('words') or '')
        words = m.group(1) if m else ''
        first = (qmc.get(bid, {}) or {}).get('first', '')
        url = f'https://www.qimao.com/shuku/{bid}/'

    boards = v['boards']
    prim = boards[0].split('#')[0].split('·')[0]
    try:
        rank = int(re.search(r'#(\d+)', boards[0]).group(1))
    except Exception:
        rank = 999
    rows.append({
        '书名': title, '作者': v.get('author', ''), '平台': plat,
        '字数(万)': words, '题材': genre, '核心设定/开篇套路': trope,
        '榜位快照': ' / '.join(BOARD_LABEL.get(b, b) for b in boards),
        '首发时间': first,
        '官方链接': url, '玄幻+X结构': hybrid,
        '_plat': 0 if plat == '七猫' else 1,
        '_board': BOARD_ORDER.get(boards[0].split('#')[0], 9),
        '_rank': rank,
    })

rows.sort(key=lambda r: (r['_plat'], r['_board'], r['_rank']))
cols = ['序号', '书名', '作者', '平台', '字数(万)', '题材', '核心设定/开篇套路',
        '榜位快照', '首发时间', '官方链接', '玄幻+X结构']
out = os.path.join(D, '..', 'docs', '近期新书-七猫纵横-20260826.csv')
with open(out, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for i, r in enumerate(rows, 1):
        r['序号'] = i
        w.writerow({c: r.get(c, '') for c in cols})

print('wrote', out, len(rows), 'rows')
if missing:
    print('MISSING NOTES:')
    for m in missing:
        print('  ', m)
nofirst = [r['书名'] for r in rows if not r['首发时间']]
print('no first-publish date:', len(nofirst))
