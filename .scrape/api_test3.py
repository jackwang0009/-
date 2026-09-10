import http.cookiejar
import time
import urllib.request

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

BID = '11823453'
base = {'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9'}

r = op.open(urllib.request.Request(f'https://www.qimao.com/shuku/{BID}/', headers=base), timeout=25)
html = r.read().decode('utf-8', 'ignore')
print('html', len(html), 'cookies:', [c.name for c in cj])
time.sleep(3)

h = dict(base)
h.update({'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': f'https://www.qimao.com/shuku/{BID}/'})
r = op.open(urllib.request.Request(
    f'https://www.qimao.com/api/book/chapter-list?book_id={BID}', headers=h), timeout=25)
body = r.read().decode('utf-8', 'ignore')
print(body[:300])
