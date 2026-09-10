import sys

path, needle, out = sys.argv[1], sys.argv[2], sys.argv[3]
span = int(sys.argv[4]) if len(sys.argv) > 4 else 1200
h = open(path, encoding='utf-8', errors='ignore').read()
i = h.find(needle)
with open(out, 'w', encoding='utf-8') as f:
    if i < 0:
        f.write('NOT FOUND')
    else:
        f.write(h[max(0, i - span):i + span])
print('idx', i, '->', out)
