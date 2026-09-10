import re
import sys
import json

path, out = sys.argv[1], sys.argv[2]
h = open(path, encoding='utf-8', errors='ignore').read()

blocks = re.split(r'<li class="rank-list-item"', h)[1:]
items = []
for b in blocks:
    def txt(s):
        return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', '', s)).strip()
    m = re.search(r'href="https://www\.qimao\.com/shuku/(\d+)/"[^>]*class="s-book-title"[^>]*>(.*?)</a>', b, re.S)
    if not m:
        m2 = re.search(r'class="s-book-title"[^>]*>(.*?)</a>', b, re.S)
        bookid, title = '', txt(m2.group(1)) if m2 else ''
    else:
        bookid, title = m.group(1), txt(m.group(2))
    rank = ''
    mr = re.search(r'class="rank-number[^"]*"[^>]*>(\d+)</span>', b)
    if mr:
        rank = mr.group(1)
    info = ''
    mi = re.search(r'<span class="s-book-info clearfix"[^>]*>(.*?)</span>', b, re.S)
    if mi:
        raw = mi.group(1)
        parts = [txt(x) for x in re.findall(r'>([^<>]+)<', raw)]
        parts = [p for p in parts if p and p != '|']
        info = '|'.join(parts)
    intro = ''
    mint = re.search(r'<span class="s-book-intro"[^>]*>(.*?)</span>', b, re.S)
    if mint:
        intro = txt(mint.group(1))[:300]
    upd = ''
    mu = re.search(r'<span class="s-book-update".*?</a>\s*<em[^>]*>([^<]+)</em>', b, re.S)
    if mu:
        upd = mu.group(1).strip()
    chap = ''
    mc = re.search(r'<span class="s-book-update".*?class="mr20"[^>]*>(.*?)</a>', b, re.S)
    if mc:
        chap = txt(mc.group(1))
    heat = ''
    mh = re.search(r'class="rank-num"[^>]*>([\d.]+)</em>\s*<em class="rank-unit"[^>]*>([^<]*)</em>', b)
    if mh:
        heat = mh.group(1) + mh.group(2)
    tag = ''
    mt = re.search(r'<span class="rank-tag"[^>]*>(.*?)</span>\s*</div>', b, re.S)
    if mt:
        tag = txt(mt.group(1))
    items.append(dict(rank=rank, title=title, bookid=bookid, info=info,
                      heat=heat, tag=tag, chap=chap, upd=upd, intro=intro))
with open(out, 'w', encoding='utf-8') as f:
    json.dump(items, f, ensure_ascii=False, indent=1)
print(len(items), '->', out)
