import urllib.request

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
BID = '11823453'
H = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': f'https://www.qimao.com/shuku/{BID}/',
}
url = f'https://www.qimao.com/api/book/chapter-list?book_id={BID}'
req = urllib.request.Request(url, headers=H)
with urllib.request.urlopen(req, timeout=20) as r:
    body = r.read().decode('utf-8', 'ignore')
print(body[:300])
