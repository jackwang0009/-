"""Channel 4: verify every 封面URL resolves to a real image (HTTP 200 + Content-Type image/*).

Unverifiable covers are blanked rather than left as claims. Rate limiting uses a
deadline loop: a single sleep() can return early on Windows and dip under the 1s floor.
"""
import csv
import json
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = 'docs/书库/七猫纵横-档案.csv'
MIN_GAP = 1.3          # seconds between requests to one host, with margin over the 1s red line
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

_next_ok = 0.0


def throttle():
    """Block until the deadline actually passes; sleep() alone can fire early."""
    global _next_ok
    while True:
        now = time.monotonic()
        if now >= _next_ok:
            break
        time.sleep(min(0.05, _next_ok - now))
    _next_ok = time.monotonic() + MIN_GAP


def probe(url):
    """Return (ok, status, content_type). Fetches only the first byte."""
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8',
        'Referer': 'https://www.qimao.com/', 'Range': 'bytes=0-0'})
    for attempt in range(3):
        throttle()
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                ct = (r.headers.get('Content-Type') or '').lower()
                r.read(1)
                return (r.status in (200, 206) and ct.startswith('image/')), r.status, ct
        except urllib.error.HTTPError as e:
            ct = (e.headers.get('Content-Type') or '').lower() if e.headers else ''
            if e.code in (403, 429):
                print('     %d -> backoff 60s' % e.code)
                time.sleep(60)
                continue
            return False, e.code, ct
        except Exception as e:
            if attempt == 2:
                return False, str(e)[:40], ''
            time.sleep(2)
    return False, 'retry-exhausted', ''


with open(CSV_PATH, encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
    cols = list(rows[0].keys())

report = []
for r in rows:
    url = r['封面URL'].strip()
    if not url:
        continue
    ok, st, ct = probe(url)
    report.append({'序号': r['序号'], 'url': url, 'ok': ok, 'status': st, 'ctype': ct})
    print('%4s %-5s %-3s %-24s %s' % (r['序号'], 'OK' if ok else 'FAIL', st, ct[:24], url[:70]))
    if not ok:
        r['封面URL'] = ''

good = sum(1 for x in report if x['ok'])
for r in rows:
    if r['封面URL'].strip():
        r['数据来源'] = r['数据来源'].split('；')[0] + '；封面直链实测校验 200/image'

with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

json.dump(report, open('.scrape/ch4_cover_report.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nverified %d/%d covers; failures blanked' % (good, len(report)))
print('rows with 封面URL after verification: %d/30'
      % sum(1 for r in rows if r['封面URL'].strip()))
