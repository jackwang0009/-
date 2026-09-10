"""Channel 4: build a title -> bookid index from every cached rank/category page."""
import glob
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

TITLES = ['太荒吞天诀', '逆天邪神', '修真界第一废物', '鉴宝：我能从文物中提取技能',
          '主人下山', '我怎么成掌门孩子他爹了', '盗梦长生', '无敌六皇子',
          '女大三千万', '日落红尘']

qm_idx, zh_idx = {}, {}

for f in glob.glob('.scrape/**/*.html', recursive=True):
    h = open(f, encoding='utf-8', errors='ignore').read()
    for bid, t in re.findall(r'href="[^"]*?/shuku/(\d+)/?"[^>]*>\s*([^<]{1,60}?)\s*<', h):
        t = t.strip()
        if t and not t.isdigit():
            qm_idx.setdefault(t, set()).add(bid)
    for bid, t in re.findall(
            r'book\.zongheng\.com/book/(\d+)\.html"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{1,60}?)\s*<', h):
        t = t.strip()
        if t and not t.isdigit():
            zh_idx.setdefault(t, set()).add(bid)

print('qimao titles indexed: %d | zongheng titles indexed: %d\n' % (len(qm_idx), len(zh_idx)))

for want in TITLES:
    hits = []
    for t, ids in qm_idx.items():
        if want in t or t in want:
            hits.append(('七猫', t, sorted(ids)))
    for t, ids in zh_idx.items():
        if want in t or t in want:
            hits.append(('纵横', t, sorted(ids)))
    print('%-24s -> %s' % (want, hits if hits else 'NOT FOUND'))

json.dump({'qm': {k: sorted(v) for k, v in qm_idx.items()},
           'zh': {k: sorted(v) for k, v in zh_idx.items()}},
          open('.scrape/ch4_index.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_index.json')
