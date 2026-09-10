"""Channel 4: resolve the 10 books missing from cache via platform search, then pull their book pages."""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
RAW = os.path.join(os.path.dirname(__file__), 'raw')
os.makedirs(RAW, exist_ok=True)

QM_MISSING = ['太荒吞天诀', '逆天邪神', '修真界第一废物，反派大佬排队求亲亲',
              '鉴宝：我能从文物中提取技能', '主人下山', '我怎么成掌门孩子他爹了',
              '盗梦长生', '无敌六皇子', '女大三千万']
ZH_MISSING = ['日落红尘']


def get(url, name, force=False):
    """Fetch with on-disk cache; >=1.2s between live requests, 60s backoff on 403/429."""
    p = os.path.join(RAW, name)
    if os.path.exists(p) and not force and os.path.getsize(p) > 3000:
        return open(p, encoding='utf-8', errors='ignore').read()
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read().decode('utf-8', 'ignore')
            open(p, 'w', encoding='utf-8').write(data)
            time.sleep(1.2)
            return data
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                print('    %d on %s, backing off 60s' % (e.code, name))
                time.sleep(60)
            else:
                print('    HTTP %d on %s' % (e.code, name))
                time.sleep(2)
        except Exception as e:
            print('    err %s on %s' % (e, name))
            time.sleep(2)
    return ''


def nuxt(html):
    """Qimao is a Nuxt SSR app; the page payload sits in window.__NUXT__."""
    m = re.search(r'window\.__NUXT__=(.*?);?</script>', html, re.S)
    return m.group(1) if m else ''


print('=== QIMAO search ===')
qm_found = {}
for i, kw in enumerate(QM_MISSING):
    url = 'https://www.qimao.com/search/?wd=' + urllib.parse.quote(kw)
    h = get(url, 'ch4_qms_%d.html' % i)
    ids = re.findall(r'/shuku/(\d+)', h)
    payload = nuxt(h)
    titles = re.findall(r'"title":"([^"]{2,40})"', payload)
    print('%-26s ids=%s' % (kw[:26], sorted(set(ids))[:6]))
    if titles:
        print('    titles seen:', titles[:6])
    qm_found[kw] = sorted(set(ids))

print('\n=== ZONGHENG search ===')
zh_found = {}
for i, kw in enumerate(ZH_MISSING):
    url = 'https://search.zongheng.com/s?keyword=' + urllib.parse.quote(kw)
    h = get(url, 'ch4_zhs_%d.html' % i)
    pairs = re.findall(r'book\.zongheng\.com/book/(\d+)\.html[^>]*>(?:<[^>]+>)*([^<]{1,40})', h)
    print('%-16s pairs=%s' % (kw, pairs[:8]))
    zh_found[kw] = pairs

json.dump({'qm': qm_found, 'zh': zh_found},
          open(os.path.join(RAW, 'ch4_search.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved ch4_search.json')
