"""Channel 4: discover the field layout of the current Zongheng book page."""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

h = open('.scrape/raw/ch4_zhb_1435440.html', encoding='utf-8', errors='ignore').read()
print('len', len(h))
print('has __NUXT__:', '__NUXT__' in h)

m = re.search(r'window\.__NUXT__=(.*?)</script>', h, re.S)
if m:
    blob = m.group(1)
    print('nuxt blob len', len(blob))
    for key in ['bookName', 'authorName', 'wordCount', 'totalWord', 'serialStatus',
                'categoryName', 'cateName', 'chapterNum', 'bookId', 'cover', 'description']:
        print('%-14s %s' % (key, re.findall(r'%s\s*:\s*("?[^,}]{0,60})' % key, blob)[:3]))
    print('\nblob head:', blob[:600])

print('\n=== visible text blocks ===')
body = re.sub(r'(?s)<(script|style).*?</\1>', ' ', h)
txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' | ', body))
for marker in ['万字', '字数', '连载', '完本', '齐天', '日落红尘']:
    for mm in list(re.finditer(marker, txt))[:2]:
        i = mm.start()
        print('--- %s ---' % marker)
        print(txt[max(0, i - 220):i + 140])
        print()
