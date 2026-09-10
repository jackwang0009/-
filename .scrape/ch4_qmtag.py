"""Channel 4: check whether a Qimao book page exposes a structured tag list."""
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

h = open('.scrape/raw/qmb_12050460.html', encoding='utf-8', errors='ignore').read()
print('len', len(h))
print('tag-ish classes:', sorted(set(re.findall(r'class="([^"]*tag[^"]*)"', h)))[:20])
for m in list(re.finditer(r'class="[^"]*tag[^"]*"', h))[:6]:
    i = m.start()
    print('---')
    print(re.sub(r'\s+', ' ', h[max(0, i - 150):i + 400]))
