"""usage: python3 fix.py in.pptx out.pptx
Repairs two pptxgenjs habits in every slide: it writes a <a:pPr> before every run of a paragraph
(only the first is allowed), and it does not mark paragraphs right-to-left. A paragraph whose first
run is Hebrew (lang="he-IL") gets rtl="1". Also drops the folder entries from the ZIP."""
import re, sys, zipfile
src, dst = sys.argv[1:3]
PPR = re.compile(r'<a:pPr\b[^>]*?(?:/>|>.*?</a:pPr>)', re.S)
def fix_p(m):
    p = m.group(0)
    found = list(PPR.finditer(p))
    if not found:
        return p
    first = found[0].group(0)
    for f in reversed(found[1:]):
        p = p[:f.start()] + p[f.end():]
    if re.search(r'<a:rPr lang="he-IL"', p) and 'rtl="1"' not in first:
        newfirst = first.replace('<a:pPr', '<a:pPr rtl="1"', 1)
        p = p.replace(first, newfirst, 1)
    return p
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
names = [n for n in zin.namelist() if not n.endswith('/')]
names.sort(key=lambda n: (n != '[Content_Types].xml', ))
fixed = 0
for n in names:
    data = zin.read(n)
    if re.match(r'ppt/slides/slide\d+\.xml$', n):
        x = data.decode('utf-8')
        y = re.sub(r'<a:p>.*?</a:p>', fix_p, x, flags=re.S)
        # the slide's main heading becomes its title placeholder (outline view, screen readers)
        y = re.sub(r'(<p:cNvPr id="\d+" name="כותרת השקופית"></p:cNvPr>)<p:cNvSpPr txBox="1"/><p:nvPr></p:nvPr>',
                   r'\1<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr>', y)
        # fully transparent text (outlined numbers): no fill at all, so every renderer leaves it hollow
        y = re.sub(r'<a:solidFill><a:srgbClr val="[0-9A-F]{6}"><a:alpha val="0"/></a:srgbClr></a:solidFill>', '<a:noFill/>', y)
        fixed += x != y
        data = y.encode('utf-8')
    zout.writestr(zin.getinfo(n), data)
zout.close()
print('slides fixed', fixed)
