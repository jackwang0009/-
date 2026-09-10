"""Channel 4: locate word-count / status / category markers on a Zongheng book page."""
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

h = open('.scrape/raw/zhc_1582826.html', encoding='utf-8', errors='ignore').read()
txt = re.sub(r'\s+', ' ', re.sub(r'(?s)<(script|style).*?</\1>', ' ', h))

for marker in ['万字', '字数', '完本', '连载', '玄幻', '分类', '总字数', '章节']:
    for m in list(re.finditer(marker, txt))[:2]:
        i = m.start()
        print('--- %s @%d ---' % (marker, i))
        print(re.sub(r'<[^>]+>', ' | ', txt[max(0, i - 260):i + 160]))
        print()

print('=== all class names containing book/nums/tag ===')
print(sorted(set(re.findall(r'class="([^"]*(?:book|num|tag|status|count)[^"]*)"', h)))[:40])
