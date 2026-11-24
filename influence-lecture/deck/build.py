"""Assemble deck/index.html from parts/p1..p5.html, and the review page from the deck.
- merges duplicate style="" attributes inside one tag (the browser ignores the second);
- refuses to build while a __PLACEHOLDER__ is left;
- with --review <version> also writes ../index.html (the review page) from the deck's
  data-title / data-part attributes and speaker notes; slide images are taken from ../img/sNN.jpg.
usage: python3 build.py [--review N]"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
parts = sorted(f for f in os.listdir(os.path.join(HERE, 'parts')) if re.fullmatch(r'p\d\.html', f))
src = ''.join(open(os.path.join(HERE, 'parts', f), encoding='utf-8').read() for f in parts)

def merge_styles(m):
    tag = m.group(0)
    styles = re.findall(r'\sstyle="([^"]*)"', tag)
    if len(styles) < 2:
        return tag
    tag = re.sub(r'\sstyle="[^"]*"', '', tag)
    joined = ';'.join(s.strip().rstrip(';') for s in styles)
    return re.sub(r'^<([a-zA-Z0-9]+)', lambda t: f'<{t.group(1)} style="{joined}"', tag, count=1)

src = re.sub(r'<[a-zA-Z][^<>]*>', merge_styles, src)
left = sorted(set(re.findall(r'__[A-Z0-9_]+__', src)))
if left:
    sys.exit('placeholders left: ' + ', '.join(left))
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(src)
slides = re.findall(r'<section ([^>]*class="slide[^>]*)>(.*?)</section>', src, re.S)
print('slides:', len(slides))

if '--review' in sys.argv:
    ver = sys.argv[sys.argv.index('--review') + 1]
    items = []
    for i, (attrs, body) in enumerate(slides, 1):
        t = re.search(r'data-title="([^"]*)"', attrs).group(1)
        part = re.search(r'data-part="([^"]*)"', attrs).group(1)
        note = html.unescape(re.search(r'<aside class="notes">(.*?)</aside>', body, re.S).group(1)).strip()
        items.append({'k': 's%02d' % i, 'n': '%02d' % i, 't': t, 'sub': part, 'img': 'img/s%02d.jpg' % i, 'body': 'מה אומרים: ' + note})
    cfg = json.load(open(os.path.join(HERE, 'review.json'), encoding='utf-8'))
    cfg['items'] = [dict(it, **cfg.get('changed', {}).get(it['t'], {})) for it in items]
    cfg.pop('changed', None)
    for k in ('brand', 'h1', 'sendTitle'):
        cfg[k] = cfg[k].replace('{v}', ver)
    cfg['doc'] = cfg['ls'] = None
    cfg['doc'] = 'reviews/influence-deck-v' + ver
    cfg['ls'] = 'influence-deck-v' + ver
    tpl = open(os.path.join(HERE, '..', '..', 'ai-revolution-lecture', 'index.html'), encoding='utf-8').read()
    a = tpl.index('const CONFIG = {'); b = tpl.index('};', tpl.index('"project"', a)) + 2
    out = tpl[:a] + 'const CONFIG = ' + json.dumps(cfg, ensure_ascii=False, indent=1) + ';' + tpl[b:]
    out = re.sub(r'<title>.*?</title>', '<title>איך מתכננים השפעה · המצגת לאישור</title>', out, count=1)
    open(os.path.join(HERE, '..', 'index.html'), 'w', encoding='utf-8').write(out)
    print('review page: version', ver, len(items), 'items')
