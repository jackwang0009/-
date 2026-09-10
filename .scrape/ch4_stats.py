"""Channel 4: fill-rate deltas vs the base CSV, for the hand-off report."""
import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

base = {}
with open('docs/玄幻选题库-100本-20260826.csv', encoding='utf-8-sig') as f:
    for b in csv.DictReader(f):
        base[b['序号']] = b
with open('docs/书库/七猫纵横-档案.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

was_empty_author = [r['序号'] for r in rows if not base[r['序号']]['作者'].strip()]
filled_author = [n for n in was_empty_author
                 if next(r for r in rows if r['序号'] == n)['作者'].strip()]
was_empty_words = [r['序号'] for r in rows if not base[r['序号']]['字数(万)'].strip()]
filled_words = [n for n in was_empty_words
                if next(r for r in rows if r['序号'] == n)['字数(万)'].strip()]

print('作者 底本为空 %d 条: %s' % (len(was_empty_author), ','.join(was_empty_author)))
print('  -> 本轮补齐 %d 条, 仍空: %s' % (
    len(filled_author), ','.join(set(was_empty_author) - set(filled_author)) or '无'))
print('字数 底本为空 %d 条 -> 本轮补齐 %d 条, 仍空: %s' % (
    len(was_empty_words), len(filled_words),
    ','.join(set(was_empty_words) - set(filled_words)) or '无'))
print('书籍ID / 官方书页URL / 封面URL 底本全表为空 -> 本轮各补 %d 条'
      % sum(1 for r in rows if r['书籍ID'].strip()))
print('作者与底本不一致(已按平台订正):',
      [(r['序号'], base[r['序号']]['作者'], r['作者']) for r in rows
       if base[r['序号']]['作者'].strip() and base[r['序号']]['作者'] != r['作者']])
print('书名与底本不一致(已按平台订正):',
      [(r['序号'], base[r['序号']]['书名'], r['书名']) for r in rows
       if base[r['序号']]['书名'] != r['书名']])
