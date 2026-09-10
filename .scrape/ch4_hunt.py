"""Channel 4: hunt the 10 unresolved titles across every cached artifact, platform-agnostic."""
import glob
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

TITLES = ['太荒吞天诀', '逆天邪神', '修真界第一废物', '鉴宝', '主人下山',
          '我怎么成掌门孩子他爹了', '盗梦长生', '无敌六皇子', '女大三千万', '日落红尘']

print('=== structured JSON caches ===')
for f in sorted(glob.glob('.scrape/*.json')):
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception:
        continue
    items = d if isinstance(d, list) else list(d.values())
    if not items or not isinstance(items[0], dict):
        continue
    for it in items:
        t = str(it.get('title', ''))
        for want in TITLES:
            if want and want in t:
                print('%-22s | %-14s | %s' % (os.path.basename(f), want, json.dumps(
                    {k: it.get(k) for k in
                     ('platform', 'board', 'bookid', 'title', 'author', 'cat',
                      'status', 'words', 'rank', 'metric', 'value', 'url')},
                    ensure_ascii=False)))

print('\n=== raw HTML (title tag match) ===')
for f in sorted(glob.glob('.scrape/raw/*.html')) + sorted(glob.glob('.scrape/*.html')):
    try:
        h = open(f, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    for want in TITLES:
        if want in h:
            m = re.search(r'<title>(.*?)</title>', h, re.S)
            print('%-34s | %-14s | title=%s' % (
                os.path.basename(f), want, (m.group(1)[:80] if m else '')))
            break
