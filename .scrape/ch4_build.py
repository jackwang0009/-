"""Channel 4: build docs/书库/七猫纵横-档案.csv (序号 56-75 七猫 + 91-100 纵横), 20 cols, UTF-8 BOM."""
import csv
import glob
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE = 'docs/玄幻选题库-100本-20260826.csv'
OUT = 'docs/书库/七猫纵横-档案.csv'
SNAP = '2026-08-26'

COLS = ['序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态',
        '平台分类', '内容标签', '总章节数', '首发时间', '最近更新', '榜位快照20260826',
        '核心设定', '简介摘要', '封面URL', '是否核心玄幻盘', '数据来源', '核验状态']

# Own-words premise lines, <=60 chars. Written from genre/tag/setting signals,
# deliberately not lifted from platform marketing copy.
SUMMARY = {
    56: '少年重铸吞天神脉，万物皆可吞噬炼化，一路杀伐问鼎神道。',
    57: '遭家族迫害的少年借鸿蒙金塔重铸霸体，逆势翻盘。',
    58: '主角与神棺相融，无系统纯剑修，背棺踏碎诸方强敌。',
    59: '承荒古武道传承，从微末走到武神之位的长线争锋，已完本。',
    60: '吞天体质少年逆势成长，跨诸族争锋的超长篇升级线。',
    61: '少年承邪神之血、掌天毒之珠，以逆天之力君临诸界。',
    62: '女频向修真轻喜：被当成废物的主角，反派大佬却排队求亲。',
    63: '主角能从古物中提取技能，鉴宝眼力与都市异能双线并行。',
    64: '下山流变体，高武背景下入世历练、以武破局。',
    65: '都市邪修视角，行事亦正亦邪，于红尘中修行问道。',
    66: '宗门杂役被一连串误会认作掌门骨肉，身份错位闹剧。',
    67: '',  # 平台未检索到该书名，简介暂缺
    68: '最底层骑奴出身，靠武道一步步挣到大乾武圣之位。',
    69: '排行第六的皇子扮猪吃虎，以无敌之姿搅动朝局，已完本。',
    70: '六扇门捕快查案缉凶，牵出王朝争霸的暗线。',
    71: '极端年龄差设定的轻喜玄幻，主角携万岁娘子闯荡万界。',
    72: '医术金手指的都市高武爽文，同榜竞品参照，非玄幻。',
    73: '架空历史纨绔逆袭，四公子并称的权谋与江湖线，非玄幻。',
    74: '出狱归来流，蛰伏者重返都市清算旧账，非玄幻。',
    75: '官场晋升线，从基层一步步走向权力中枢，非玄幻。',
    91: '家族崛起式传统玄幻，祖宗庇荫下的热血剑道少年成长线。',
    92: '天命加身的无敌流，跨诸天万界横推的长线爽文。',
    93: '诸天穿越流，主角于万界间兼修全能，走出星辰大道。',
    94: '以入梦为金手指的幻想修真，跨越千年的逆袭杀伐。',
    95: '强者回归格局，剑道天才重立门庭，终得万仙来朝。',
    96: '古典仙侠脑洞流，轻松笔调写剑修杀伐与众仙俯首。',
    97: '穿越者入赘寒门，从窘迫处境起步踏上帝途。',
    98: '以仙葫为核心金手指的幻想修真，剑道杀伐一路问鼎。',
    99: '圣体觉醒的无敌流，主角轻松横扫诸天万界。',
    100: '被判废灵根的主角靠吞噬逆转天赋，越吞越强。',
}

# 底本 核心设定 为空的两行，按规范补一句
CORE_FILL = {
    91: '家族崛起 + 祖宗传承；传统玄幻剑道少年线',
    96: '剑修杀伐 + 脑洞轻喜；古典仙侠群像',
}

NOTE = {
    60: '冲突-说明：底本记平台=七猫，本轮确认七猫195631与纵横916691同名同作者双线在营，本行取七猫',
    66: '冲突-说明：底本书名「我怎么成掌门孩子他爹了」为简写，平台全称已订正',
    67: '待核实：七猫站内检索无「盗梦长生」，疑与序号94纵横《盗梦千年》混淆，ID/URL/字数留空',
    69: '冲突-说明：底本作者记「妖妖妖」，平台书页作者为「梁山老鬼」，以平台为准',
    71: '冲突-说明：底本书名「女大三千万」为旧名/宣传语，平台现名《混沌塔》，同作者同字数量级可对应',
    91: '冲突-说明：底本把作者「日落红尘」误填进书名列，平台实为《齐天》，书名作者已订正',
}


def wan(s):
    """'378.03万字' / '345.2' -> '378.0' (one decimal, per spec)."""
    if s in (None, ''):
        return ''
    m = re.search(r'([\d.]+)', str(s))
    return '%.1f' % float(m.group(1)) if m else ''


def status(s):
    s = (s or '').strip()
    if s in ('完结', '已完结', '完本'):
        return '已完结'
    return '连载中' if s in ('连载中', '连载') else ''


def date(s):
    m = re.search(r'(\d{4}-\d{2}-\d{2})', str(s or ''))
    return m.group(1) if m else ''


base = {}
with open(BASE, encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        base[int(r['序号'])] = r

qm = {int(k): v for k, v in json.load(open('.scrape/ch4_qm_final.json', encoding='utf-8')).items()}
zh = {int(k): v for k, v in json.load(open('.scrape/ch4_zh_final.json', encoding='utf-8')).items()}
merged = json.load(open('.scrape/merged.json', encoding='utf-8'))

# level-1 category lookup harvested from cached Qimao rank boards (platform's own wording)
lvl1 = {}
for f in glob.glob('.scrape/ch4_qm_boards.json'):
    for blk in json.load(open(f, encoding='utf-8')).values():
        for r in blk['rows']:
            if '/' in r.get('cat', ''):
                a, b = r['cat'].split('/', 1)
                lvl1[b] = a

rows, gaps = [], []
for n in list(range(56, 76)) + list(range(91, 101)):
    b = base[n]
    plat = b['平台']
    row = dict.fromkeys(COLS, '')
    row['序号'] = n
    row['平台'] = plat
    row['榜位快照20260826'] = b['榜位快照']
    row['核心设定'] = b['核心设定/开篇套路'] or CORE_FILL.get(n, '')
    row['简介摘要'] = SUMMARY.get(n, '')
    row['是否核心玄幻盘'] = b['核心玄幻盘']

    if plat == '七猫':
        p = qm.get(n)
        row['数据来源'] = '七猫官方检索接口+官方书页 %s' % SNAP
        if p:
            cat2 = p.get('category2_name', '')
            row.update({
                '书名': p['title'].strip(), '作者': p['author'].strip(),
                '书籍ID': p['book_id'],
                '官方书页URL': 'https://www.qimao.com/shuku/%s/' % p['book_id'],
                '字数(万)': wan(p.get('words_num')),
                '连载状态': status(p.get('is_over_txt')),
                '平台分类': ('%s/%s' % (lvl1[cat2], cat2)) if cat2 in lvl1 else cat2,
                '最近更新': date(p.get('update_time')),
                '封面URL': p.get('image_link', ''),
            })
        else:
            row['书名'] = b['书名']
    else:
        p = zh.get(n)
        row['数据来源'] = '纵横官方书页 %s' % SNAP
        m = merged.get('zh_%s' % (p or {}).get('bookid', ''), {})
        if p:
            row.update({
                '书名': p.get('title', ''), '作者': p.get('author', ''),
                '书籍ID': p['bookid'], '官方书页URL': p['url'],
                '字数(万)': wan(p.get('words_wan')),
                '连载状态': status(p.get('status')),
                '平台分类': p.get('cat', ''),
                '内容标签': '/'.join(p.get('tags', [])),
                '最近更新': date(p.get('latest_date')),
                '封面URL': p.get('cover', ''),
                '总章节数': m.get('n', ''),
                '首发时间': date(m.get('first', '')),
            })

    row['核验状态'] = NOTE.get(n, '已核实')
    for c in ('总章节数',):
        if row[c] in (0, '0', None):
            row[c] = ''
    rows.append(row)
    for c in ('作者', '书籍ID', '官方书页URL', '字数(万)', '连载状态', '平台分类', '简介摘要'):
        if not str(row[c]).strip():
            gaps.append('%d %s' % (n, c))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader()
    w.writerows(rows)

print('wrote %s  rows=%d' % (OUT, len(rows)))
print('\n序号 seq check:', [r['序号'] for r in rows] ==
      list(range(56, 76)) + list(range(91, 101)))
print('required-field gaps (%d): %s' % (len(gaps), gaps))
filled = sum(1 for r in rows if r['官方书页URL'])
print('URL coverage: %d/30 = %.0f%%' % (filled, filled / 30 * 100))
authors = sum(1 for r in rows if r['作者'])
print('author filled: %d/30' % authors)
for c in COLS:
    empty = sum(1 for r in rows if not str(r[c]).strip())
    if empty:
        print('  empty in %-16s %d' % (c, empty))
