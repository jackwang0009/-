"""Channel 4: parse every cached Qimao rank/category page into full per-book records."""
import glob
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

TITLES = ['太荒吞天诀', '逆天邪神', '修真界第一废物', '鉴宝：我能从文物中提取技能',
          '主人下山', '我怎么成掌门孩子他爹了', '盗梦长生', '无敌六皇子',
          '女大三千万', '日落红尘']


def txt(s):
    return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', '', s)).strip()


books = {}
for f in glob.glob('.scrape/**/*.html', recursive=True):
    h = open(f, encoding='utf-8', errors='ignore').read()
    if 'qimao.com' not in h:
        continue
    for b in re.split(r'<li class="rank-list-item|<div class="book-item', h)[1:]:
        ids = re.findall(r'/shuku/(\d+)(?:-\d+)?/', b)
        if not ids:
            continue
        bid = ids[0]
        mt = re.search(r'class="s-book-title"[^>]*>(.*?)</a>', b, re.S)
        title = txt(mt.group(1)) if mt else ''
        if not title:
            continue
        info = re.search(r'<span class="s-book-info clearfix"[^>]*>(.*?)</span>', b, re.S)
        parts = []
        if info:
            parts = [p.strip() for p in re.findall(r'>([^<>]+)<', info.group(1)) if p.strip()]
        words = next((p for p in parts if '万字' in p), '')
        status = next((p for p in parts if p in ('连载中', '已完结')), '')
        cats = [p for p in parts if p not in ('连载中', '已完结') and '万字' not in p and p != '|']
        mi = re.search(r'<span class="s-book-intro"[^>]*>(.*?)</span>', b, re.S)
        mu = re.search(r'<span class="s-book-update".*?class="mr20"[^>]*>(.*?)</a>', b, re.S)
        mtime = re.search(r'<em class="s-book-time"[^>]*>(.*?)</em>', b, re.S)
        rec = books.setdefault(bid, {})
        rec.update({k: v for k, v in {
            'bookid': bid, 'title': title, 'words': words, 'status': status,
            'cat': '/'.join(cats[:2]), 'intro': txt(mi.group(1))[:400] if mi else '',
            'chap': txt(mu.group(1)) if mu else '',
            'chap_time': txt(mtime.group(1)) if mtime else '',
            'url': 'https://www.qimao.com/shuku/%s/' % bid,
        }.items() if v})
        rec.setdefault('src', set()).add(f.replace('\\', '/'))

for r in books.values():
    r['src'] = sorted(r.get('src', []))
print('qimao books parsed: %d\n' % len(books))

by_title = {}
for r in books.values():
    by_title.setdefault(r['title'], []).append(r)

for want in TITLES:
    hits = [r for t, rs in by_title.items() if want in t or t in want for r in rs]
    if hits:
        for r in hits:
            print('%-24s -> id=%-9s %-8s %-10s %-22s %s' % (
                want, r['bookid'], r.get('status', ''), r.get('words', ''),
                r.get('cat', ''), r['title']))
    else:
        print('%-24s -> NOT FOUND' % want)

json.dump(books, open('.scrape/ch4_qm_books.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_qm_books.json')
