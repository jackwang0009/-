"""Channel 4 round 2: apply the five dispatcher rulings to 七猫纵横-档案.csv.

67 becomes the Qimao edition of 《盗梦千年》 (cross-station twin of 94, kept as a
separate row), 71/60 notes are reworded, and the new cover is probed like the rest.
"""
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

CSV_PATH = 'docs/书库/七猫纵横-档案.csv'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
MIN_GAP = 1.3
_next_ok = 0.0


def throttle():
    """Deadline loop - a bare sleep() can return early and dip under the 1s floor."""
    global _next_ok
    while True:
        now = time.monotonic()
        if now >= _next_ok:
            break
        time.sleep(min(0.05, _next_ok - now))
    _next_ok = time.monotonic() + MIN_GAP


def get_json(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.qimao.com/search/index/'})
    for _ in range(3):
        throttle()
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8', 'ignore'))
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                print('   %d backoff 60s' % e.code)
                time.sleep(60)
            else:
                return None
        except Exception:
            time.sleep(2)
    return None


def probe_img(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8',
        'Referer': 'https://www.qimao.com/', 'Range': 'bytes=0-0'})
    throttle()
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            ct = (r.headers.get('Content-Type') or '').lower()
            r.read(1)
            return (r.status in (200, 206) and ct.startswith('image/')), r.status, ct
    except Exception as e:
        return False, str(e)[:40], ''


# ---- 1. pull the Qimao edition of 盗梦千年 (ruling: id 12257385, 咸鱼老白) ----
d = get_json('https://api-www.qimao.com/api/search/result?keyword=%s&page=1'
             % urllib.parse.quote('盗梦千年'))
lst = (((d or {}).get('data') or {}).get('search_list')) or []
pick = next((b for b in lst if str(b.get('book_id')) == '12257385'), None)
print('67 pick:', json.dumps({k: str(v)[:70] for k, v in (pick or {}).items()},
                             ensure_ascii=False, indent=1) if pick else 'NOT FOUND')

lvl1 = {}
for blk in json.load(open('.scrape/ch4_qm_boards.json', encoding='utf-8')).values():
    for r in blk['rows']:
        if '/' in r.get('cat', ''):
            a, b = r['cat'].split('/', 1)
            lvl1[b] = a

with open(CSV_PATH, encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
    cols = list(rows[0].keys())
by = {r['序号']: r for r in rows}

# ---- 2. ruling: 67 -> Qimao 盗梦千年, cross-station twin of 94, row kept ----
if pick:
    cat2 = pick.get('category2_name', '')
    r67 = by['67']
    r67.update({
        '书名': pick['title'].strip(), '作者': pick['author'].strip(),
        '书籍ID': pick['book_id'],
        '官方书页URL': 'https://www.qimao.com/shuku/%s/' % pick['book_id'],
        '字数(万)': '%.1f' % float(pick['words_num'].replace('万字', '')),
        '连载状态': '已完结' if pick.get('is_over_txt') in ('完结', '已完结') else '连载中',
        '平台分类': ('%s/%s' % (lvl1[cat2], cat2)) if cat2 in lvl1 else cat2,
        '最近更新': (pick.get('update_time') or '')[:10],
        '简介摘要': '以入梦为金手指的幻想修真，跨越千年的逆袭杀伐。',
        '封面URL': pick.get('image_link', ''),
        '数据来源': '七猫官方检索接口+官方书页 2026-08-26',
        '核验状态': ('冲突-说明：底本书名「盗梦长生」为《盗梦千年》讹写，'
                 '据榜单调研5.3节实测热度区间5.2-5.8万与底本5.7万比对定案；'
                 '与序号94为同书跨站双记录（纵横版ID 1552353），不合并不删行'),
    })

# ---- 3. cross-reference back from 94, and reword 71 / 60 per the rulings ----
by['94']['核验状态'] = ('已核实：与序号67为同书跨站双记录（七猫版ID 12257385），不合并不删行')
by['71']['核验状态'] = ('冲突-说明：底本记女大三千万，现为旧名或宣传语，'
                    '字数420.4万↔底本419.56万量级吻合，取平台现名《混沌塔》')
by['60']['核验状态'] = ('冲突-说明：底本记平台=七猫，与纵横916691为同书跨站双记录，'
                    '同作者铁马飞桥；按裁定不拆行，保持平台=七猫取七猫ID195631，'
                    '榜位快照沿用底本跨站表述')

# ---- 4. probe the newly added cover ----
if pick and by['67']['封面URL']:
    ok, st, ct = probe_img(by['67']['封面URL'])
    print('\n67 cover: %s %s %s' % ('OK' if ok else 'FAIL', st, ct))
    if not ok:
        by['67']['封面URL'] = ''
    else:
        by['67']['数据来源'] += '；封面直链实测校验 200/image'

with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

print('\nrewrote', CSV_PATH)
for n in ('60', '66', '67', '71', '91', '94'):
    r = by[n]
    print('%4s %-18s %-10s %-9s %-8s %s' % (
        n, r['书名'][:18], r['作者'], r['书籍ID'], r['字数(万)'], r['核验状态'][:60]))
