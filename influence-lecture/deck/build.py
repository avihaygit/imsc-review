"""Assemble deck/index.html from parts/p1..p4.html.
- merges duplicate style="" attributes inside one tag (the second would be ignored by the browser);
- fills each <aside class="notes"></aside> with the talking points from ../src/spec.py.
usage: python3 build.py"""
import html, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'src'))
import spec  # noqa: E402

src = ''.join(open(os.path.join(HERE, 'parts', f'p{i}.html'), encoding='utf-8').read() for i in range(1, 5))

def merge_styles(m):
    tag = m.group(0)
    styles = re.findall(r'\sstyle="([^"]*)"', tag)
    if len(styles) < 2:
        return tag
    tag = re.sub(r'\sstyle="[^"]*"', '', tag)
    joined = ';'.join(s.strip().rstrip(';') for s in styles)
    return re.sub(r'^<([a-zA-Z0-9]+)', lambda t: f'<{t.group(1)} style="{joined}"', tag, count=1)

src = re.sub(r'<[a-zA-Z][^<>]*>', merge_styles, src)

def talk(body):
    lines = body.split('\n')
    out, on = [], False
    for ln in lines:
        if ln.startswith('מה אומרים:'):
            on = True; out.append(ln[len('מה אומרים:'):].strip()); continue
        if ln.startswith(('מקור', 'ויזואל:', 'המודל:', 'הדוגמ')):
            on = False; continue
        if on:
            out.append(ln.strip())
    return ' '.join(x for x in out if x) or body.replace('\n', ' ')

notes = [talk(x['body']) for x in spec.S]
parts = src.split('<aside class="notes"></aside>')
assert len(parts) - 1 == len(notes) == 44, (len(parts) - 1, len(notes))
out = parts[0]
for n, rest in zip(notes, parts[1:]):
    out += '<aside class="notes">' + html.escape(n) + '</aside>' + rest
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(out)
print('slides:', out.count('<section class="slide'), '· merged styles ok · notes filled')
