import sys, json
from fontTools.ttLib import TTFont

path = sys.argv[1]
out = sys.argv[2]
f = TTFont(path)
cmap = f.getBestCmap()
lines = []
lines.append("tables: %s" % sorted(f.keys()))
lines.append("numGlyphs: %s" % f["maxp"].numGlyphs)
lines.append("cmap size: %s" % len(cmap))

order = f.getGlyphOrder()
lines.append("first 40 glyph names: %s" % order[:40])

items = sorted(cmap.items())
lines.append("codepoint range: %04X - %04X" % (items[0][0], items[-1][0]))
lines.append("--- first 60 cmap entries ---")
for cp, gname in items[:60]:
    lines.append("U+%04X -> %s" % (cp, gname))

# name table
try:
    for rec in f["name"].names[:12]:
        lines.append("name[%s/%s]: %s" % (rec.nameID, rec.platformID, rec.toUnicode()))
except Exception as e:
    lines.append("name err %s" % e)

open(out, "w", encoding="utf-8").write("\n".join(lines))
print("ok")
