"""Channel 4: mine cached Qimao JS bundles for the search API endpoint."""
import glob
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

paths, hosts = set(), set()
for f in glob.glob('.scrape/qm_*.js'):
    s = open(f, encoding='utf-8', errors='ignore').read()
    paths.update(re.findall(r'["\'`]((?:/api|/rank|/search|/shuku)[A-Za-z0-9/_\-{}$.]{0,60})["\'`]', s))
    hosts.update(re.findall(r'https?://[a-z0-9.\-]*(?:qimao|wtzw)[a-z0-9.\-]*', s))

print('--- hosts ---')
for h in sorted(hosts):
    print(' ', h)
print('\n--- paths ---')
for p in sorted(paths):
    print(' ', p)

print('\n--- lines mentioning search ---')
seen = set()
for f in glob.glob('.scrape/qm_*.js'):
    s = open(f, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'search', s):
        frag = s[max(0, m.start() - 90):m.start() + 90]
        if 'http' in frag or '/api' in frag or 'url' in frag:
            frag = re.sub(r'\s+', ' ', frag)
            if frag not in seen:
                seen.add(frag)
                print(' ', frag)
            if len(seen) > 25:
                break
