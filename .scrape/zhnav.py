import re

h = open('zh_rank.html', encoding='utf-8', errors='ignore').read()
out = []
for m in re.finditer(r'<a[^>]+href="([^"]*rank/details[^"]*)"[^>]*>(.*?)</a>', h, re.S):
    href, text = m.group(1), re.sub(r'(?s)<[^>]+>', '', m.group(2)).strip()
    out.append((href, text))
# also capture nav list items that carry rt in data attrs
for m in re.finditer(r'rt=(\d+)[^"\']{0,40}', h):
    pass
with open('.scrape/zh_nav.txt', 'w', encoding='utf-8') as f:
    for href, text in out:
        f.write(f'{text}\t{href}\n')
print(len(out))
