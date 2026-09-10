"""Channel 4: show alt candidates for ambiguous Qimao picks + probe Zongheng book-page fields."""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

res = json.load(open('.scrape/ch4_qm_resolved.json', encoding='utf-8'))
print('=== ambiguous Qimao picks (alts) ===')
for n in ('56', '69', '71', '67', '60'):
    v = res.get(n)
    if not v:
        continue
    print('\n#%s query=%s hint=%s  results=%d' % (n, v['query'], v['hint'], v['n_results']))
    for a in v['alts']:
        print('    id=%-10s %-30s %s' % (a['book_id'], a['title'][:30], a['author']))

print('\n\n=== Zongheng book page fields (cached 1582826) ===')
h = open('.scrape/raw/zhc_1582826.html', encoding='utf-8', errors='ignore').read()
print('len', len(h))
for pat, label in [
    (r'<meta[^>]+name="keywords"[^>]+content="([^"]{0,120})"', 'kw'),
    (r'<meta[^>]+name="description"[^>]+content="([^"]{0,200})"', 'desc'),
    (r'"bookName":"([^"]*)"', 'bookName'),
    (r'"authorName":"([^"]*)"', 'authorName'),
    (r'"wordCount":"?(\d+)', 'wordCount'),
    (r'"serialStatus":"?([^",]*)', 'serialStatus'),
    (r'"categoryName":"([^"]*)"', 'categoryName'),
    (r'(\d[\d.]*)\s*万字', 'wanzi'),
    (r'<em>([^<]{0,20})</em>\s*字', 'em-zi'),
    (r'(连载中|已完结|完本|连载)', 'status-word'),
]:
    print('%-12s %s' % (label, re.findall(pat, h)[:6]))

i = h.find('万字')
print('\ncontext around 万字:', re.sub(r'\s+', ' ', h[max(0, i - 500):i + 200]) if i > 0 else 'none')
