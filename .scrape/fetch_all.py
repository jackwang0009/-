import json
import os
import re
import time
import urllib.request

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
OUT = os.path.join(os.path.dirname(__file__), 'raw')
os.makedirs(OUT, exist_ok=True)


def get(url, name, force=False):
    p = os.path.join(OUT, name)
    if os.path.exists(p) and not force and os.path.getsize(p) > 5000:
        return open(p, encoding='utf-8', errors='ignore').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read().decode('utf-8', 'ignore')
            open(p, 'w', encoding='utf-8').write(data)
            print('  ok', name, len(data))
            time.sleep(0.7)
            return data
        except Exception as e:
            print('  retry', name, e)
            time.sleep(2)
    return ''


# ---------- zongheng rank pages ----------
for rt, label, pages in ((4, 'new', 5), (9, 'sub', 3), (1, 'ticket', 1)):
    for p in range(1, pages + 1):
        url = (f'https://book.zongheng.com/rank/details.html?'
               f'rt={rt}&d=1&i=0&c=0&r=&p={p}')
        get(url, f'zh_{label}_p{p}.html')

# ---------- qimao rank + category ----------
get('https://www.qimao.com/paihang/boy/new/date', 'qm_new_date.html')
get('https://www.qimao.com/paihang/boy/new/month', 'qm_new_month.html')
get('https://www.qimao.com/paihang/boy/hot/date', 'qm_hot_date.html')

# 玄幻奇幻(202) subcategories, small word count + updated within 3 days + ongoing
for sub, subname in (('37', '东方玄幻'), ('a', '玄幻奇幻全部')):
    for p in (1, 2):
        url = f'https://www.qimao.com/shuku/a-202-{sub}-1-1-2-a-click-{p}/'
        get(url, f'qm_cat_{sub}_p{p}.html')
print('done')
