import urllib.request
import urllib.error

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
BID = '11901855'
paths = [
    'book/chapter-list', 'book/chapter_list', 'book/chapters',
    'book/catalog', 'book/detail', 'book/info', 'chapter/list',
]
params = [f'id={BID}', f'book_id={BID}', f'bookId={BID}', f'bookid={BID}',
          f'id={BID}&book_id={BID}']
seen = set()
for p in paths:
    for q in params:
        url = f'https://www.qimao.com/api/{p}?{q}'
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': UA,
                'Referer': f'https://www.qimao.com/shuku/{BID}/',
                'X-Requested-With': 'XMLHttpRequest',
            })
            with urllib.request.urlopen(req, timeout=12) as r:
                body = r.read().decode('utf-8', 'ignore')
            tag = body[:120].replace('\n', ' ')
        except urllib.error.HTTPError as e:
            tag = f'HTTP {e.code}'
        except Exception as e:
            tag = f'ERR {e}'
        if '40001002' in tag:
            tag = '(param error)'
        key = (p, tag)
        if key in seen:
            continue
        seen.add(key)
        print(f'{p:22s} {q:28s} {tag}')
