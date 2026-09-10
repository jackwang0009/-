import datetime
import json
import os
import random
import time
import urllib.request

D = os.path.dirname(__file__)
RAW = os.path.join(D, 'raw')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

qm = json.load(open(os.path.join(D, 'qm_all.json'), encoding='utf-8'))
KEEP = ('玄幻', '仙侠', '修真', '异世', '诸天', '争霸', '奇幻',
        '高武', '修仙', '高手', '奇闻')
ids = []
for x in qm:
    if x['board'] == '大热榜·男生·日榜':
        continue
    if any(k in x['cat'] for k in KEEP) and x['bookid'] not in ids:
        ids.append(x['bookid'])

print('waiting 300s for WAF cooldown', flush=True)
time.sleep(300)

pending = list(ids)
for rnd in range(6):
    if not pending:
        break
    print(f'--- round {rnd + 1}, {len(pending)} pending ---', flush=True)
    nxt = []
    for bid in pending:
        p = os.path.join(RAW, f'qmc_{bid}.json')
        if os.path.exists(p) and open(p, encoding='utf-8').read().startswith('{"data"'):
            continue
        url = f'https://www.qimao.com/api/book/chapter-list?book_id={bid}'
        req = urllib.request.Request(url, headers={
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': f'https://www.qimao.com/shuku/{bid}/'})
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                body = r.read().decode('utf-8', 'ignore')
        except Exception as e:
            print('  err', bid, e, flush=True)
            nxt.append(bid)
            time.sleep(5)
            continue
        if body.startswith('{"data"'):
            open(p, 'w', encoding='utf-8').write(body)
            print('  ok', bid, flush=True)
            time.sleep(random.uniform(2.5, 4.5))
        else:
            nxt.append(bid)
            print('  waf', bid, flush=True)
            time.sleep(30)
    pending = nxt
    if pending:
        print('sleeping 240s before retry', flush=True)
        time.sleep(240)

out = {}
for bid in ids:
    p = os.path.join(RAW, f'qmc_{bid}.json')
    if not os.path.exists(p):
        continue
    body = open(p, encoding='utf-8').read()
    if not body.startswith('{"data"'):
        continue
    ch = json.loads(body)['data']['chapters']
    f = lambda t: datetime.datetime.fromtimestamp(int(t)).strftime('%Y-%m-%d')
    times = sorted(int(c['update_time']) for c in ch)
    out[bid] = dict(first=f(times[0]), last=f(times[-1]), n=len(ch),
                    words=sum(int(c.get('words') or 0) for c in ch))
json.dump(out, open(os.path.join(D, 'qm_chaps.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('RESULT', len(out), '/', len(ids), flush=True)
