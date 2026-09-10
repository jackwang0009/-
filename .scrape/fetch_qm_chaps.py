import datetime
import json
import os
import re
import time
import urllib.request

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
for i, bid in enumerate(ids, 1):
    p = os.path.join(RAW, f'qmc_{bid}.json')
    if os.path.exists(p) and os.path.getsize(p) > 200:
        body = open(p, encoding='utf-8').read()
    else:
        url = f'https://www.qimao.com/api/book/chapter-list?book_id={bid}'
        req = urllib.request.Request(url, headers={
            'User-Agent': UA, 'Referer': f'https://www.qimao.com/shuku/{bid}/'})
        body = ''
        for _ in range(3):
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    body = r.read().decode('utf-8', 'ignore')
                open(p, 'w', encoding='utf-8').write(body)
                time.sleep(0.4)
                break
            except Exception as e:
                print('  retry', bid, e)
                time.sleep(2)
    try:
        js = json.loads(body)
        ch = js['data']['chapters']
    except Exception:
        out[bid] = {}
        continue
    def fmt(ts):
        return datetime.datetime.fromtimestamp(int(ts)).strftime('%Y-%m-%d %H:%M')
    words = sum(int(c.get('words') or 0) for c in ch)
    out[bid] = dict(first=fmt(ch[0]['update_time']), last=fmt(ch[-1]['update_time']),
                    n=len(ch), words=words)
    if i % 15 == 0:
        print('  ', i, '/', len(ids))

json.dump(out, open(os.path.join(D, 'qm_chaps.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
ok = sum(1 for v in out.values() if v)
print('done', ok, '/', len(ids))
