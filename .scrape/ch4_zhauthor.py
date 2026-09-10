"""Channel 4: locate the author element on a Zongheng book page (independent of <title>)."""
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

h = open('.scrape/raw/ch4_zhb_1435440.html', encoding='utf-8', errors='ignore').read()
name = '日落红尘'
print('occurrences of author name:', h.count(name))
for m in list(re.finditer(name, h))[:6]:
    i = m.start()
    print('--- @%d ---' % i)
    print(re.sub(r'\s+', ' ', h[max(0, i - 300):i + 120]))
    print()
print('author-ish hrefs:', sorted(set(re.findall(r'href="([^"]*(?:author|/u/|home\.zongheng)[^"]*)"', h)))[:12])
print('author-ish classes:', sorted(set(re.findall(r'class="([^"]*au[^"]*)"', h)))[:15])
