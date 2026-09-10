"""Channel 4: fetch the 10 Zongheng book pages in scope and extract metadata (no chapter text)."""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
RAW = '.scrape/raw'

# 序号 -> (bookid, expected title)
ZH = {
    91: ('1435440', '齐天'), 92: ('1336976', '无敌天命'), 93: ('1385191', '星辰大道'),
    94: ('1552353', '盗梦千年'), 95: ('1412188', '万仙来朝'), 96: ('1410173', '众仙俯首'),
    97: ('1582826', '寒渊帝途'), 98: ('1555785', '九转仙葫'), 99: ('1562907', '无敌圣体'),
    100: ('1581938', '废灵根垃圾？可我吞噬就变强啊！'),
}


def get(url, name):
    p = os.path.join(RAW, name)
    if os.path.exists(p) and os.path.getsize(p) > 5000:
        return open(p, encoding='utf-8', errors='ignore').read()
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                d = r.read().decode('utf-8', 'ignore')
            open(p, 'w', encoding='utf-8').write(d)
            time.sleep(1.3)
            return d
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                print('   %d backoff 60s' % e.code)
                time.sleep(60)
            else:
                print('   HTTP %d' % e.code)
                return ''
        except Exception as e:
            print('   err', e)
            time.sleep(2)
    return ''


def flat(s):
    return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', ' ', s)).strip()


out = {}
for n, (bid, title) in ZH.items():
    url = 'https://book.zongheng.com/book/%s.html' % bid
    h = get(url, 'ch4_zhb_%s.html' % bid)
    if not h:
        print('%3d %-14s FETCH FAIL' % (n, title))
        continue
    body = re.sub(r'(?s)<(script|style).*?</\1>', ' ', h)
    rec = {'bookid': bid, 'url': url, 'len': len(h)}
    m = re.search(r'<div class="book-meta"[^>]*>(.*?)</div>\s*</div>', body, re.S)
    rec['meta'] = flat(m.group(1))[:300] if m else ''
    for key, pat in [
        ('title_tag', r'<title>([^<]*)</title>'),
        ('cat', r'/category/\d+\.html"[^>]*>([^<]{1,12})</a>'),
        ('words_raw', r'本卷共\s*(\d+)\s*字'),
        ('chaps', r'共(\d+)章'),
        ('status', r'(连载中|已完结|完本|连载)'),
        ('cover', r'(https?://[^"\']*?(?:bookimg|cover)[^"\']*?\.(?:jpg|jpeg|png))'),
        ('desc', r'<meta[^>]+name="description"[^>]+content="([^"]{0,240})"'),
    ]:
        rec[key] = re.findall(pat, body)[:8]
    words_total = sum(int(x) for x in rec['words_raw']) if rec['words_raw'] else 0
    chaps_total = sum(int(x) for x in rec['chaps']) if rec['chaps'] else 0
    rec['words_total'] = words_total
    rec['chaps_total'] = chaps_total
    out[n] = rec
    print('%3d %-16s id=%-9s words=%-9s chaps=%-5s cat=%s' % (
        n, title[:16], bid, words_total, chaps_total, rec['cat'][:3]))
    print('      meta: %s' % rec['meta'][:150])

json.dump(out, open('.scrape/ch4_zh_books.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_zh_books.json')
