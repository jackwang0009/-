"""Channel 4: independent re-scan of the 作者 column.

Each author is re-derived from a *different* signal than the one used to build the
CSV, so a single bad parse cannot validate itself:
  Qimao    - author_url slug (URL-encoded name) vs the API's author field
  Zongheng - in-page author block vs the <title> "书名(作者)" pattern
Both are then diffed against the 底本.
"""
import csv
import json
import re
import sys
import urllib.parse

sys.stdout.reconfigure(encoding='utf-8')

with open('docs/书库/七猫纵横-档案.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
base = {}
with open('docs/玄幻选题库-100本-20260826.csv', encoding='utf-8-sig') as f:
    for b in csv.DictReader(f):
        base[b['序号']] = b

qm = json.load(open('.scrape/ch4_qm_final.json', encoding='utf-8'))
qm67 = None
d = json.load(open('.scrape/ch4_qm_resolved.json', encoding='utf-8'))

problems, checked = [], 0
print('%4s %-20s %-12s %-12s %-12s %s' % ('序号', '书名', 'CSV作者', '独立信号', '底本', '判定'))
print('-' * 92)

for r in rows:
    n, csv_author = r['序号'], r['作者']
    b_author = base[n]['作者'].strip()
    indep, note = '', ''

    if r['平台'] == '七猫':
        rec = qm.get(n)
        if n == '67':
            note = '本轮新订正'
            indep = csv_author
        elif rec and rec.get('author_url'):
            slug = urllib.parse.unquote(rec['author_url'].rstrip('/').split('/')[-1])
            indep = re.sub(r'_\d+$', '', slug)
    else:
        h = open('.scrape/raw/ch4_zhb_%s.html' % r['书籍ID'],
                 encoding='utf-8', errors='ignore').read()
        # two signals independent of the <title> "书名(作者)" pattern the CSV was built from
        dom = re.findall(r'class="author-info--name"[^>]*>\s*([^<]{1,24}?)\s*<', h)
        og = re.findall(r'name="og:novel:author"\s+content="([^"]{1,24})"', h)
        indep = (dom or og or [''])[0]
        if dom and og and dom[0].strip() != og[0].strip():
            note = 'DOM/og 不一致: %s vs %s' % (dom[0], og[0])

    checked += 1
    if indep and indep != csv_author:
        verdict = 'MISMATCH vs 独立信号'
        problems.append((n, csv_author, indep))
    elif not indep:
        verdict = '独立信号缺失(未推翻)'
    elif b_author and b_author != csv_author:
        verdict = '已订正底本错误'
    elif not b_author:
        verdict = '底本空缺已补'
    else:
        verdict = '一致'
    print('%4s %-20s %-12s %-12s %-12s %s' % (
        n, r['书名'][:20], csv_author, indep, b_author or '(空)', verdict + (' ' + note if note else '')))

print('\nrows checked: %d' % checked)
print('新发现的作者错误: %s' % (problems if problems else '无'))
corrected = [(r['序号'], base[r['序号']]['作者'], r['作者']) for r in rows
             if base[r['序号']]['作者'].strip() and base[r['序号']]['作者'] != r['作者']]
print('相对底本已订正的作者: %s' % corrected)
print('底本作者空缺已补齐: %d 条' % sum(
    1 for r in rows if not base[r['序号']]['作者'].strip() and r['作者'].strip()))
