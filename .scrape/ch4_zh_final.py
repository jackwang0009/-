"""Channel 4: parse the fetched Zongheng book pages into structured metadata."""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

ZH = {
    91: '1435440', 92: '1336976', 93: '1385191', 94: '1552353', 95: '1412188',
    96: '1410173', 97: '1582826', 98: '1555785', 99: '1562907', 100: '1581938',
}

out = {}
for n, bid in ZH.items():
    h = open('.scrape/raw/ch4_zhb_%s.html' % bid, encoding='utf-8', errors='ignore').read()
    body = re.sub(r'(?s)<(script|style).*?</\1>', ' ', h)
    txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '|', body))
    cells = [c.strip() for c in txt.split('|') if c.strip()]

    rec = {'bookid': bid, 'url': 'https://book.zongheng.com/book/%s.html' % bid}

    mt = re.search(r'<title>\s*([^(（<]+)[(（]([^)）]+)[)）]', h)
    if mt:
        rec['title'], rec['author'] = mt.group(1).strip(), mt.group(2).strip()

    # breadcrumb: 首页 > <cat1> > <cat2> > <title>
    if '首页' in cells:
        i = cells.index('首页')
        rec['cat'] = '/'.join(cells[i + 1:i + 3])

    rec['status'] = next((c for c in cells if c in ('连载中', '已完结', '完本')), '')

    mw = re.search(r'([\d.]+)[\s|]+万字数', txt)
    rec['words_wan'] = mw.group(1) if mw else ''
    mk = re.search(r'([\d.]+)[\s|]+万总点击', txt)
    rec['clicks_wan'] = mk.group(1) if mk else ''

    mc = re.search(r'最新章节：[\s|]*([^|]{1,60}?)[\s|]+(\d{4}-\d{2}-\d{2})', txt)
    if mc:
        rec['latest_chap'], rec['latest_date'] = mc.group(1).strip(), mc.group(2)

    # tags sit between the serial-status cell and the first stat number
    try:
        s = cells.index(rec['status'])
        tags = []
        for c in cells[s + 1:s + 12]:
            if re.fullmatch(r'[\d.]+', c) or '总点击' in c or '万' == c:
                break
            tags.append(c)
        rec['tags'] = tags
    except ValueError:
        rec['tags'] = []

    mn = re.search(r'window\.__NUXT__=(.*?)</script>', h, re.S)
    if mn:
        md = re.search(r'description:"((?:[^"\\]|\\.)*)"', mn.group(1))
        rec['has_desc'] = bool(md)
    mimg = re.search(r'(https?://[^"\']*?(?:bookimg|/cover/|zongheng)[^"\']*?\.(?:jpg|jpeg|png))', h)
    rec['cover'] = mimg.group(1) if mimg else ''

    out[n] = rec
    print('%3d %-16s %-12s %-6s %-8s %-14s %s' % (
        n, rec.get('title', '?')[:16], rec.get('author', '?'), rec.get('status', ''),
        rec.get('words_wan', ''), rec.get('cat', ''), '/'.join(rec.get('tags', []))[:40]))
    print('      cover=%s' % rec['cover'][:100])

json.dump(out, open('.scrape/ch4_zh_final.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_zh_final.json')
