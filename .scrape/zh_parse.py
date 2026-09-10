import re
import sys
import json

path, out = sys.argv[1], sys.argv[2]
h = open(path, encoding='utf-8', errors='ignore').read()

# each rank item lives in a <div class="rank_d_list ..."> block
blocks = re.split(r'<div class="rank_d_list', h)[1:]
items = []
for b in blocks:
    b = '<div class="rank_d_list' + b
    b = b.split('<div class="rank_d_b_page')[0]
    def grab(pat, flags=re.S):
        m = re.search(pat, b, flags)
        return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', '', m.group(1))).strip() if m else ''
    bookid = ''
    m = re.search(r'book\.zongheng\.com/book/(\d+)\.html', b)
    if m:
        bookid = m.group(1)
    title = grab(r'<div class="rank_d_b_name"[^>]*>\s*<a[^>]*>(.*?)</a>')
    cat = grab(r'<div class="rank_d_b_cate"[^>]*>(.*?)</div>')
    info = grab(r'<div class="rank_d_b_info"[^>]*>(.*?)</div>')
    chap = grab(r'<div class="rank_d_b_last"[^>]*>(.*?)</div>')
    num = grab(r'<div class="rank_d_b_num"[^>]*>(.*?)</div>')
    rank = grab(r'<div class="rank_d_num[^"]*"[^>]*>(.*?)</div>')
    items.append(dict(rank=rank, title=title, cat=cat, bookid=bookid,
                      info=info[:400], chap=chap, num=num))
with open(out, 'w', encoding='utf-8') as f:
    json.dump(items, f, ensure_ascii=False, indent=1)
print(len(items), 'items ->', out)
