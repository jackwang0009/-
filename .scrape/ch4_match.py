"""Channel 4: match base-CSV rows 56-75 / 91-100 against cached Qimao+Zongheng scrapes."""
import csv
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE = 'docs/玄幻选题库-100本-20260826.csv'
WANT = set(range(56, 76)) | set(range(91, 101))


def norm(s):
    """Strip annotations/punctuation so titles compare on their core characters."""
    s = re.sub(r'（[^）]*）|\([^)]*\)', '', s or '')
    return re.sub(r'[\s，,。.！!？?：:；;、~～"\'’”—\-…《》]', '', s)


base = {}
with open(BASE, encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        n = int(row['序号'])
        if n in WANT:
            base[n] = row

qm = json.load(open('.scrape/qm_all.json', encoding='utf-8'))
zh = json.load(open('.scrape/zh_all.json', encoding='utf-8'))
merged = json.load(open('.scrape/merged.json', encoding='utf-8'))

pool = {'七猫': qm, '纵横': zh}
by_norm = {}
for plat, items in pool.items():
    for it in items:
        by_norm.setdefault((plat, norm(it['title'])), []).append(it)

print('merged.json key prefixes:', sorted({k.split('_')[0] for k in merged}))
print('qm_all=%d zh_all=%d merged=%d' % (len(qm), len(zh), len(merged)))
print()

hit = miss = 0
for n in sorted(base):
    row = base[n]
    plat, title = row['平台'], row['书名']
    cands = by_norm.get((plat, norm(title)), [])
    if cands:
        hit += 1
        it = cands[0]
        m = merged.get('%s_%s' % ('qm' if plat == '七猫' else 'zh', it['bookid']), {})
        print('%3d OK  %-28s id=%-9s author=%-12s words=%-10s status=%-5s cat=%s' % (
            n, title[:28], it['bookid'], it.get('author', ''),
            it.get('words', '') or m.get('words', ''), it.get('status', ''), it.get('cat', '')))
        print('        url=%s  first=%s  n=%s' % (it['url'], m.get('first', ''), m.get('n', '')))
    else:
        miss += 1
        print('%3d ??  %-28s  [no cache match on %s]' % (n, title[:28], plat))

print('\nmatched=%d  unmatched=%d  of %d' % (hit, miss, len(base)))
