import re
import sys
import json

path, out = sys.argv[1], sys.argv[2]
h = open(path, encoding='utf-8', errors='ignore').read()

# rank widgets: find sections then the book links inside
res = {}
for m in re.finditer(r'(大热榜|新书榜|飙升榜|完结榜|好评榜)', h):
    pass

links = re.findall(r'href="(/shuku/\d+[^"]*)"[^>]*>([^<]*)<', h)
seen = []
for href, txt in links:
    t = txt.strip()
    if t:
        seen.append((href, t))
with open(out, 'w', encoding='utf-8') as f:
    json.dump(seen, f, ensure_ascii=False, indent=1)
print(len(seen), '->', out)
