import glob
import json
import os
import re

RAW = os.path.join(os.path.dirname(__file__), 'raw')


def clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', '', s)).strip()


# ---------------- zongheng ----------------
def parse_zh(path, board):
    h = open(path, encoding='utf-8', errors='ignore').read()
    out = []
    for b in re.split(r'(?=<div class="rank_d_list )', h)[1:]:
        b = b.split('<div class="rank_d_pagesize')[0]
        mid = re.search(r'bookId="(\d+)"', b)
        mname = re.search(r'bookName\s*=\s*"([^"]*)"', b)
        if not mid:
            continue
        cate = re.search(r'<div class="rank_d_b_cate"[^>]*>(.*?)</div>', b, re.S)
        parts = [clean(x) for x in re.findall(r'>([^<>]+)<', cate.group(1))] if cate else []
        parts = [p for p in parts if p and p != '|']
        author = parts[0] if len(parts) > 0 else ''
        cat = parts[1] if len(parts) > 1 else ''
        status = parts[2] if len(parts) > 2 else ''
        intro = re.search(r'<div class="rank_d_b_info">(.*?)</div>', b, re.S)
        rank = re.search(r'class="rank_d_icon rank_d_b_num[^"]*"[^>]*>(\d+)</div>', b)
        val = re.search(r'<div class="rank_d_b_ticket">([\d,\.万]+)<span>([^<]*)</span>', b)
        chap = re.search(r'class="rank_d_lastchapter">最新章节</span>(.*?)</a>', b, re.S)
        ctime = re.search(r'class="rank_d_b_time"\s*>([^<]*)</span>', b)
        out.append(dict(
            platform='纵横', board=board, bookid=mid.group(1),
            title=mname.group(1) if mname else '',
            author=author, cat=cat, status=status,
            rank=rank.group(1) if rank else '',
            metric=(val.group(2) if val else ''),
            value=(val.group(1) if val else ''),
            chap=clean(chap.group(1)) if chap else '',
            chap_time=ctime.group(1).strip() if ctime else '',
            intro=clean(intro.group(1))[:400] if intro else '',
            url=f'https://book.zongheng.com/book/{mid.group(1)}.html',
        ))
    return out


zh = []
for label, board in (('new', '新书人气榜'), ('sub', '新书订阅榜'), ('ticket', '月票榜')):
    for p in sorted(glob.glob(os.path.join(RAW, f'zh_{label}_p*.html'))):
        zh += parse_zh(p, board)

# ---------------- qimao ----------------
def parse_qm_rank(path, board):
    h = open(path, encoding='utf-8', errors='ignore').read()
    out = []
    for b in re.split(r'(?=<li class="rank-list-item")', h)[1:]:
        m = re.search(r'href="https://www\.qimao\.com/shuku/(\d+)/"[^>]*class="s-book-title"[^>]*>(.*?)</a>', b, re.S)
        if not m:
            continue
        bookid, title = m.group(1), clean(m.group(2))
        rank = re.search(r'class="rank-number[^"]*"[^>]*>(\d+)</span>', b)
        mi = re.search(r'<span class="s-book-info clearfix"[^>]*>(.*?)</span>', b, re.S)
        parts = []
        if mi:
            parts = [clean(x) for x in re.findall(r'>([^<>]+)<', mi.group(1))]
            parts = [p for p in parts if p and p != '|']
        author = parts[0] if parts else ''
        cat1 = parts[1] if len(parts) > 1 else ''
        cat2 = parts[2] if len(parts) > 2 else ''
        status = parts[3] if len(parts) > 3 else ''
        words = parts[4] if len(parts) > 4 else ''
        intro = re.search(r'<span class="s-book-intro"[^>]*>(.*?)</span>', b, re.S)
        heat = re.search(r'class="rank-num"[^>]*>([\d.]+)</em>\s*<em class="rank-unit"[^>]*>([^<]*)</em>', b)
        chap = re.search(r'class="mr20"[^>]*>(.*?)</a>\s*<em[^>]*>([^<]*)</em>', b, re.S)
        tag = re.search(r'<span class="rank-tag"[^>]*>(.*?)</span>', b, re.S)
        out.append(dict(
            platform='七猫', board=board, bookid=bookid, title=title,
            author=author, cat=f'{cat1}/{cat2}', status=status, words=words,
            rank=rank.group(1) if rank else '',
            metric='热度', value=(heat.group(1) + heat.group(2)) if heat else '',
            chap=clean(chap.group(1)) if chap else '',
            chap_time=chap.group(2).strip() if chap else '',
            tag=clean(tag.group(1)) if tag else '',
            intro=clean(intro.group(1))[:400] if intro else '',
            url=f'https://www.qimao.com/shuku/{bookid}/',
        ))
    return out


def parse_qm_cat(path, board):
    h = open(path, encoding='utf-8', errors='ignore').read()
    out = []
    for b in re.split(r'(?=<li class="qm-cover-text-item)', h)[1:]:
        m = re.search(r'<span class="s-tit"[^>]*><a href="https://www\.qimao\.com/shuku/(\d+)/"[^>]*>(.*?)</a>', b, re.S)
        if not m:
            continue
        bookid, title = m.group(1), clean(m.group(2))
        cat = re.search(r'class="s-category"[^>]*>([^<]*)</a>', b)
        status = re.search(r'class="s-status"[^>]*>([^<]*)</em>', b)
        words = re.search(r'class="s-words-num"[^>]*>([^<]*)</em>', b)
        author = re.search(r'class="s-author"[^>]*>([^<]*)</a>', b)
        upd = re.search(r'class="s-update-time"[^>]*>([^<]*)</em>', b)
        desc = re.search(r'<span class="s-desc"[^>]*>(.*?)</span>', b, re.S)
        out.append(dict(
            platform='七猫', board=board, bookid=bookid, title=title,
            author=clean(author.group(1)) if author else '',
            cat=clean(cat.group(1)) if cat else '',
            status=clean(status.group(1)) if status else '',
            words=clean(words.group(1)) if words else '',
            rank='', metric='', value='',
            chap='', chap_time=clean(upd.group(1)) if upd else '',
            url=f'https://www.qimao.com/shuku/{bookid}/',
            intro=clean(desc.group(1))[:400] if desc else '',
        ))
    return out


qm = []
qm += parse_qm_rank(os.path.join(RAW, 'qm_new_date.html'), '新书榜·男生·日榜')
qm += parse_qm_rank(os.path.join(RAW, 'qm_new_month.html'), '新书榜·男生·月榜')
qm += parse_qm_rank(os.path.join(RAW, 'qm_hot_date.html'), '大热榜·男生·日榜')
for f, name in (('qm_cat_37_p1.html', '东方玄幻分类新书'), ('qm_cat_37_p2.html', '东方玄幻分类新书'),
                ('qm_cat_a_p1.html', '玄幻奇幻分类新书'), ('qm_cat_a_p2.html', '玄幻奇幻分类新书')):
    p = os.path.join(RAW, f)
    if os.path.exists(p):
        qm += parse_qm_cat(p, name)

json.dump(zh, open(os.path.join(RAW, '..', 'zh_all.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
json.dump(qm, open(os.path.join(RAW, '..', 'qm_all.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('zongheng', len(zh), 'qimao', len(qm))
from collections import Counter
print(Counter([x['board'] for x in zh]))
print(Counter([x['board'] for x in qm]))
