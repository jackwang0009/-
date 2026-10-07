import datetime
import json
import os
import re
import time
import urllib.request

from qm_chaps_utils import parse_chapters, read_cached, write_cached, write_output

D = os.path.dirname(__file__)
RAW = os.path.join(D, 'raw')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

qm = json.load(open(os.path.join(D, 'qm_all.json'), encoding='utf-8'))
QM_KEEP = ('玄幻', '仙侠', '修真', '异世', '诸天', '争霸', '奇幻',
           '高武', '修仙', '高手', '奇闻')
ids = []
for x in qm:
    if x['board'] == '大热榜·男生·日榜':
        continue
    if any(k in x['cat'] for k in QM_KEEP) and x['bookid'] not in ids:
        ids.append(x['bookid'])

out = {}
failed = []
for i, bid in enumerate(ids, 1):
    p = os.path.join(RAW, f'qmc_{bid}.json')
    ch = read_cached(p) if os.path.exists(p) else None
    if ch is None:
        if os.path.exists(p):
            print('  invalid cache, refetching', bid)
        url = f'https://www.qimao.com/api/book/chapter-list?book_id={bid}'
        req = urllib.request.Request(url, headers={
            'User-Agent': UA, 'Referer': f'https://www.qimao.com/shuku/{bid}/'})
        body = ''
        for _ in range(3):
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    body = r.read().decode('utf-8', 'ignore')
                ch = parse_chapters(body)
                if ch is not None:
                    write_cached(p, body)
                    time.sleep(0.4)
                    break
                print('  invalid response', bid)
            except Exception as e:
                print('  retry', bid, e)
                time.sleep(2)
    if ch is None:
        failed.append(bid)
        continue
    def fmt(ts):
        return datetime.datetime.fromtimestamp(int(ts)).strftime('%Y-%m-%d %H:%M')
    words = sum(int(c.get('words') or 0) for c in ch)
    out[bid] = dict(first=fmt(ch[0]['update_time']), last=fmt(ch[-1]['update_time']),
                    n=len(ch), words=words)
    if i % 15 == 0:
        print('  ', i, '/', len(ids))

write_output(os.path.join(D, 'qm_chaps.json'), out)
ok = sum(1 for v in out.values() if v)
print('done', ok, '/', len(ids), 'valid; failed', len(failed))
