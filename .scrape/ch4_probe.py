"""Channel 4: probe Qimao/Zongheng search endpoints for the 10 books missing from cache."""
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')


def probe(url, label):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    })
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read().decode('utf-8', 'ignore')
        print('[%s] HTTP %s  len=%d  %s' % (label, r.status, len(body), url))
        print('    head:', body[:220].replace('\n', ' '))
    except Exception as e:
        print('[%s] FAIL %s  %s' % (label, e, url))
    time.sleep(1.2)


kw = urllib.parse.quote('太荒吞天诀')
probe('https://www.qimao.com/search/?wd=' + kw, 'qm-search-html')
probe('https://www.qimao.com/api/search/?wd=' + kw, 'qm-search-api')
probe('https://www.qimao.com/shuku/1880008/', 'qm-book-known')
probe('https://search.zongheng.com/s?keyword=' + urllib.parse.quote('日落红尘'), 'zh-search')
probe('https://book.zongheng.com/book/1582826.html', 'zh-book-known')
