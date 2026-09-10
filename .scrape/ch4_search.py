"""Channel 4: resolve remaining titles via the Qimao search API (metadata only)."""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

WANT = ['逆天邪神', '修真界第一废物，反派大佬排队求亲亲', '鉴宝：我能从文物中提取技能',
        '盗梦长生', '太荒吞天诀', '主人下山', '无敌六皇子']

ENDPOINTS = [
    'https://api-www.qimao.com/api/search/result?wd={kw}&page=1',
    'https://www.qimao.com/api/search/result?wd={kw}&page=1',
    'https://api-www.qimao.com/api/search/result?keyword={kw}&page=1',
]


def call(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.qimao.com/search/index/',
        'Origin': 'https://www.qimao.com',
    })
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            print('    %d -> backoff 60s' % e.code)
            time.sleep(60)
        return e.code, ''
    except Exception as e:
        return str(e), ''


print('=== endpoint probe ===')
kw = urllib.parse.quote('逆天邪神')
good = None
for ep in ENDPOINTS:
    st, body = call(ep.format(kw=kw))
    print('%-3s len=%-7s %s' % (st, len(body), ep))
    if st == 200 and len(body) > 80:
        print('    ', body[:400])
        good = ep
    time.sleep(1.2)

if not good:
    print('\nno usable endpoint')
    sys.exit()

print('\n=== resolving ===')
out = {}
for t in WANT:
    st, body = call(good.format(kw=urllib.parse.quote(t)))
    try:
        d = json.loads(body)
    except Exception:
        print('%-26s -> unparsable (%s)' % (t[:26], st))
        time.sleep(1.2)
        continue
    books = []

    def walk(o):
        if isinstance(o, dict):
            if o.get('id') and (o.get('title') or o.get('original_title')):
                books.append(o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(d)
    print('%-26s -> %d hits' % (t[:26], len(books)))
    for b in books[:4]:
        print('     id=%-10s %-28s %-12s %s %s' % (
            b.get('id'), str(b.get('title'))[:28], b.get('author', ''),
            b.get('words_num', b.get('word_count', '')), b.get('category', b.get('book_tag_type', ''))))
    out[t] = books[:6]
    time.sleep(1.3)

json.dump(out, open('.scrape/ch4_qm_search.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_qm_search.json')
