import json
import os
import re
import time
import urllib.request

D = os.path.dirname(__file__)
RAW = os.path.join(D, 'raw')
os.makedirs(RAW, exist_ok=True)
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

ZH_CORE = ('玄幻', '修真', '仙侠', '武侠', '诸天', '争霸', '奇幻', '洪荒')
ZH_HYBRID = ('高武', '奇门', '复苏', '末世')
QM_CORE = ('玄幻', '仙侠', '修真', '异世', '诸天', '争霸', '奇幻')
QM_HYBRID = ('高武', '修仙', '高手', '奇闻')


def get(url, name):
    p = os.path.join(RAW, name)
    if os.path.exists(p) and os.path.getsize(p) > 3000:
        return open(p, encoding='utf-8', errors='ignore').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read().decode('utf-8', 'ignore')
            open(p, 'w', encoding='utf-8').write(data)
            time.sleep(0.5)
            return data
        except Exception as e:
            print('  retry', name, e)
            time.sleep(2)
    return ''


zh = json.load(open(os.path.join(D, 'zh_all.json'), encoding='utf-8'))
qm = json.load(open(os.path.join(D, 'qm_all.json'), encoding='utf-8'))

zh_pick = {}
for x in zh:
    if x['board'] not in ('新书人气榜', '新书订阅榜'):
        continue
    if any(k in x['cat'] for k in ZH_CORE + ZH_HYBRID):
        zh_pick.setdefault(x['bookid'], x)

qm_pick = {}
for x in qm:
    if x['board'] == '大热榜·男生·日榜':
        continue
    if any(k in x['cat'] for k in QM_CORE + QM_HYBRID):
        qm_pick.setdefault(x['bookid'], x)

print('zh candidates', len(zh_pick), 'qm candidates', len(qm_pick))

zh_detail = {}
for i, bid in enumerate(zh_pick, 1):
    h = get(f'https://book.zongheng.com/showchapter/{bid}.html', f'zhc_{bid}.html')
    chaps = re.findall(r'title="([^"]*?)\s*字数：(\d+)\s*更新时间：([\d\-: ]+)"', h)
    total = sum(int(c[1]) for c in chaps)
    zh_detail[bid] = dict(
        first=chaps[0][2].strip() if chaps else '',
        last=chaps[-1][2].strip() if chaps else '',
        n=len(chaps), words=total,
    )
    if i % 20 == 0:
        print('  zh', i)

qm_detail = {}
for i, bid in enumerate(qm_pick, 1):
    h = get(f'https://www.qimao.com/shuku/{bid}/', f'qmb_{bid}.html')
    def num(label):
        m = re.search(r'<em[^>]*>([\d.]+)</em>([^<]*)</div>\s*<div class="desc"[^>]*>' + label, h)
        return (m.group(1) + m.group(2).strip()) if m else ''
    score = re.search(r'class="score"[^>]*>\s*<em[^>]*>([\d.]+)</em>', h)
    hero = re.search(r'主角：\s*</span>\s*<span[^>]*>([^<]*)</span>', h)
    reads = re.search(r'<em[^>]*>([\d.]+)</em>\s*<em[^>]*>万</em>[^<]*<em[^>]*>次阅读', h)
    qm_detail[bid] = dict(
        works=num('作品总数'), sumwords=num('累计字数'), days=num('创作天数'),
        score=score.group(1) if score else '',
        hero=hero.group(1).strip() if hero else '',
        signed='签约作品' if '签约作品' in h else '',
    )
    if i % 20 == 0:
        print('  qm', i)

json.dump({'zh': zh_detail, 'qm': qm_detail},
          open(os.path.join(D, 'detail.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('done')
