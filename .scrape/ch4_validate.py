"""Channel 4: validate the delivered CSV against the field spec before hand-off."""
import csv
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

P = 'docs/书库/七猫纵横-档案.csv'
COLS = ['序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态',
        '平台分类', '内容标签', '总章节数', '首发时间', '最近更新', '榜位快照20260826',
        '核心设定', '简介摘要', '封面URL', '是否核心玄幻盘', '数据来源', '核验状态']

raw = open(P, 'rb').read()
print('BOM (UTF-8 with BOM):', raw[:3] == b'\xef\xbb\xbf')

with open(P, encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))

print('columns match spec exactly:', list(rows[0].keys()) == COLS)
print('row count:', len(rows))
want = list(range(56, 76)) + list(range(91, 101))
print('序号 exact & in order:', [int(r['序号']) for r in rows] == want)

ok = True
for r in rows:
    n = r['序号']
    for c, v in r.items():
        if v.strip() in ('N/A', 'NA', '未知', '-', '0', 'null', 'None'):
            print('  PLACEHOLDER %s %s=%r' % (n, c, v))
            ok = False
    if r['简介摘要'] and len(r['简介摘要']) > 60:
        print('  SUMMARY>60 %s len=%d' % (n, len(r['简介摘要'])))
        ok = False
    if r['连载状态'] and r['连载状态'] not in ('连载中', '已完结'):
        print('  BAD STATUS %s %s' % (n, r['连载状态']))
        ok = False
    if r['是否核心玄幻盘'] not in ('是', '否'):
        print('  BAD 玄幻盘 %s' % n)
        ok = False
    if r['字数(万)'] and not re.fullmatch(r'\d+\.\d', r['字数(万)']):
        print('  BAD WORDS %s %s' % (n, r['字数(万)']))
        ok = False
    if r['官方书页URL'] and not re.match(r'https://(www\.qimao\.com|book\.zongheng\.com)/', r['官方书页URL']):
        print('  BAD URL %s %s' % (n, r['官方书页URL']))
        ok = False
    for c in ('首发时间', '最近更新'):
        if r[c] and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', r[c]):
            print('  BAD DATE %s %s=%s' % (n, c, r[c]))
            ok = False
print('value checks passed:', ok)

# carry-over integrity vs 底本
base = {}
with open('docs/玄幻选题库-100本-20260826.csv', encoding='utf-8-sig') as f:
    for b in csv.DictReader(f):
        base[b['序号']] = b
bad = [r['序号'] for r in rows
       if r['是否核心玄幻盘'] != base[r['序号']]['核心玄幻盘']
       or r['榜位快照20260826'] != base[r['序号']]['榜位快照']]
print('底本 carry-over (核心玄幻盘 + 榜位快照) intact:', not bad, bad or '')
print('竞品参照 72-75 present with 否:',
      all(next(r for r in rows if r['序号'] == str(n))['是否核心玄幻盘'] == '否'
          for n in (72, 73, 74, 75)))

print('\n--- coverage ---')
for c in COLS:
    filled = sum(1 for r in rows if r[c].strip())
    if filled < 30:
        print('  %-16s %2d/30' % (c, filled))
print('\n核验状态 breakdown:')
kinds = {}
for r in rows:
    k = r['核验状态'].split('：')[0]
    kinds[k] = kinds.get(k, 0) + 1
for k, v in kinds.items():
    print('  %-10s %d' % (k, v))
