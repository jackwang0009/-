"""Channel 4: resolve every Qimao title in scope via the search API (metadata only, no chapter text)."""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
EP = 'https://api-www.qimao.com/api/search/result?keyword={kw}&page=1'

# 序号 -> (base title, base author hint)
QUERIES = {
    56: ('吞天神体', '化十'), 57: ('鸿蒙霸体诀', '鱼初见'), 58: ('葬神棺', '浮生一诺'),
    59: ('荒古武神', '化十'), 60: ('太荒吞天诀', '铁马飞桥'), 61: ('逆天邪神', '火星引力'),
    62: ('修真界第一废物，反派大佬排队求亲亲', '棠吉归'),
    63: ('鉴宝：我能从文物中提取技能', ''), 64: ('主人下山', ''),
    65: ('都市极品大邪修', ''), 66: ('我怎么成掌门孩子他爹了', ''), 67: ('盗梦长生', ''),
    68: ('从骑奴到大乾武圣', ''), 69: ('无敌六皇子', '妖妖妖'), 70: ('六扇门第一悍捕', ''),
    71: ('女大三千万', '惊蛰落月'), 72: ('盖世神医', '狐颜乱语'), 73: ('逍遥四公子', '修果'),
    74: ('警报！真龙出狱！', '红透半边天'), 75: ('步步登阶', '江湖如梦'),
}


def call(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.qimao.com/search/index/',
    })
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8', 'ignore'))
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                print('    %d -> backoff 60s' % e.code)
                time.sleep(60)
            else:
                return None
        except Exception:
            time.sleep(2)
    return None


def clean(s):
    return (s or '').replace('\u3000', ' ').strip()


out = {}
for n, (title, author) in QUERIES.items():
    d = call(EP.format(kw=urllib.parse.quote(title)))
    lst = (((d or {}).get('data') or {}).get('search_list')) or []
    # prefer exact title match, then author match, else first result
    pick = None
    for b in lst:
        if clean(b.get('title')) == title:
            pick = b
            break
    if pick is None and author:
        pick = next((b for b in lst if clean(b.get('author')) == author), None)
    if pick is None and lst:
        pick = lst[0]
    out[n] = {'query': title, 'hint': author, 'n_results': len(lst), 'pick': pick,
              'alts': [{'book_id': b.get('book_id'), 'title': clean(b.get('title')),
                        'author': clean(b.get('author'))} for b in lst[:5]]}
    if pick:
        print('%3d %-24s -> id=%-10s %-26s %-12s %s' % (
            n, title[:24], pick.get('book_id'), clean(pick.get('title'))[:26],
            clean(pick.get('author')), pick.get('words_num', pick.get('characters', ''))))
    else:
        print('%3d %-24s -> NO RESULT' % (n, title[:24]))
    time.sleep(1.3)

json.dump(out, open('.scrape/ch4_qm_resolved.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_qm_resolved.json')
print('\nsample record keys:',
      sorted((next(v['pick'] for v in out.values() if v['pick'])).keys()))
