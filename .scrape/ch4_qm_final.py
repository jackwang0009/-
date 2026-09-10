"""Channel 4: final Qimao resolution - author-aware picking, full metadata records."""
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

# 序号 -> (query, expected author or '', expected book_id or '')
# expected id set where cached rank pages already proved the mapping
Q = {
    56: ('吞天神体', '化十', '1880008'),
    57: ('鸿蒙霸体诀', '鱼初见', '1655407'),
    58: ('葬神棺', '浮生一诺', '1761978'),
    59: ('荒古武神', '化十', '216404'),
    60: ('太荒吞天诀', '铁马飞桥', '195631'),
    61: ('逆天邪神', '火星引力', '148431'),
    62: ('修真界第一废物，反派大佬排队求亲亲', '棠吉归', '9992316'),
    63: ('鉴宝：我能从文物中提取技能', '', '12206274'),
    64: ('主人下山', '', '12255177'),
    65: ('都市极品大邪修', '粮满仓', '12050460'),
    66: ('我一杂役，怎么成掌门孩子他爹了？', '三月雨', '12026346'),
    67: ('盗梦长生', '', ''),          # unresolved - no such title on platform
    68: ('从骑奴到大乾武圣', '一嘟噜葡萄', '12465015'),
    69: ('无敌六皇子', '', '1747899'),   # base says 妖妖妖; platform says 梁山老鬼
    70: ('六扇门第一悍捕', '爆裂无声', '11988894'),
    71: ('混沌塔', '惊蛰落月', '1767940'),  # base title 女大三千万 is the old/blurb title
    72: ('盖世神医', '狐颜乱语', '195958'),
    73: ('逍遥四公子', '修果', '1809361'),
    74: ('警报！真龙出狱！', '红透半边天', '1834789'),
    75: ('步步登阶', '江湖如梦', '1982360'),
}


def call(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.qimao.com/search/index/'})
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8', 'ignore'))
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                print('    %d backoff 60s' % e.code)
                time.sleep(60)
            else:
                return None
        except Exception:
            time.sleep(2)
    return None


def clean(s):
    return (s or '').replace('\u3000', ' ').strip()


out = {}
for n, (q, author, want_id) in Q.items():
    if not q:
        out[n] = None
        continue
    d = call(EP.format(kw=urllib.parse.quote(q)))
    lst = (((d or {}).get('data') or {}).get('search_list')) or []
    pick = None
    if want_id:
        pick = next((b for b in lst if str(b.get('book_id')) == want_id), None)
    if pick is None and author:
        pick = next((b for b in lst if clean(b.get('title')) == q
                     and clean(b.get('author')) == author), None)
        if pick is None:
            pick = next((b for b in lst if clean(b.get('author')) == author), None)
    if pick is None:
        pick = next((b for b in lst if clean(b.get('title')) == q), None)
    out[n] = pick
    if pick:
        ok = '' if (not want_id or str(pick.get('book_id')) == want_id) else '  <<ID MISMATCH>>'
        print('%3d id=%-10s %-28s %-12s %-10s %-14s %s%s' % (
            n, pick.get('book_id'), clean(pick.get('title'))[:28], clean(pick.get('author')),
            pick.get('words_num', ''), pick.get('category2_name', ''),
            pick.get('is_over_txt', ''), ok))
    else:
        print('%3d %-28s -> UNRESOLVED' % (n, q[:28]))
    time.sleep(1.3)

json.dump(out, open('.scrape/ch4_qm_final.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved .scrape/ch4_qm_final.json')
smp = next(v for v in out.values() if v)
print('\nfull sample record:')
print(json.dumps({k: (str(v)[:90]) for k, v in smp.items()}, ensure_ascii=False, indent=1))
