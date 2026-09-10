"""Channel 4: dump every book entry from the cached Qimao rank pages, per board."""
import glob
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')


def txt(s):
    return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', '', s)).strip()


out = {}
for f in sorted(glob.glob('.scrape/qm_*.html')) + sorted(glob.glob('.scrape/raw/qm_cat*.html')):
    h = open(f, encoding='utf-8', errors='ignore').read()
    mt = re.search(r'<title>(.*?)</title>', h, re.S)
    board = txt(mt.group(1)) if mt else f
    rows = []
    for b in re.split(r'<li class="rank-list-item', h)[1:]:
        m = re.search(r'/shuku/(\d+)/"[^>]*class="s-book-title"[^>]*>(.*?)</a>', b, re.S)
        if not m:
            m = re.search(r'class="s-book-title"[^>]*>(.*?)</a>', b, re.S)
            bid, title = (re.findall(r'/shuku/(\d+)', b) or [''])[0], txt(m.group(1)) if m else ''
        else:
            bid, title = m.group(1), txt(m.group(2))
        if not title:
            continue
        info = re.search(r'<span class="s-book-info clearfix"[^>]*>(.*?)</span>', b, re.S)
        parts = [p.strip() for p in re.findall(r'>([^<>]+)<', info.group(1))
                 if p.strip()] if info else []
        rank = re.search(r'class="rank-number[^"]*"[^>]*>(\d+)</span>', b)
        heat = re.search(r'class="rank-num"[^>]*>([\d.]+)</em>\s*<em class="rank-unit"[^>]*>([^<]*)</em>', b)
        rows.append({
            'rank': rank.group(1) if rank else '', 'bookid': bid, 'title': title,
            'author': parts[0] if parts else '',
            'words': next((p for p in parts if '万字' in p), ''),
            'status': next((p for p in parts if p in ('连载中', '已完结')), ''),
            'cat': '/'.join([p for p in parts[1:]
                             if p not in ('连载中', '已完结') and '万字' not in p][:2]),
            'heat': (heat.group(1) + heat.group(2)) if heat else '',
        })
    if rows:
        out[f] = {'board': board, 'rows': rows}
        print('\n### %s  (%s)  %d rows' % (f, board[:44], len(rows)))
        for r in rows:
            print('  #%-3s %-9s %-26s %-12s %-10s %-8s %s' % (
                r['rank'], r['bookid'], r['title'][:26], r['author'][:12],
                r['words'], r['heat'], r['cat']))

json.dump(out, open('.scrape/ch4_qm_boards.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
