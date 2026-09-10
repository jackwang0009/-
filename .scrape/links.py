import re
import sys

path = sys.argv[1]
key = sys.argv[2]
h = open(path, encoding='utf-8', errors='ignore').read()
print('LEN', len(h))
links = set(re.findall(r'href="([^"]*' + key + r'[^"]*)"', h))
for l in sorted(links):
    print(l)
