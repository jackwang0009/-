import re
import sys

path = sys.argv[1]
out = sys.argv[2]
h = open(path, encoding='utf-8', errors='ignore').read()
txt = re.sub(r'(?is)<script.*?</script>', ' ', h)
txt = re.sub(r'(?is)<style.*?</style>', ' ', txt)
txt = re.sub(r'(?s)<[^>]+>', '\n', txt)
lines = [l.strip() for l in txt.split('\n')]
lines = [l for l in lines if l]
with open(out, 'w', encoding='utf-8') as f:
    f.write('--- TEXT ---\n')
    f.write('\n'.join(lines[:600]))
    f.write('\n--- SCRIPT SRC / API HINTS ---\n')
    for m in sorted(set(re.findall(r'(?:src|action|url)\s*[=:]\s*["\']([^"\']+)["\']', h))):
        f.write(m + '\n')
print('wrote', out)
