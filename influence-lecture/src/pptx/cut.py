"""usage: python3 cut.py <ex dir>
Cuts each slide's transparent raster layer (rNN.png, 2x) into its separate visual pieces, so the
PowerPoint gets several small pictures in place instead of one picture over the whole slide.
Writes ex/crops/NN-K.png and adds `crops` (CSS px of the 1920x1080 stage) to slides.json."""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

ex = sys.argv[1]
os.makedirs(os.path.join(ex, 'crops'), exist_ok=True)
slides = json.load(open(os.path.join(ex, 'slides.json')))
B = 8          # block size in device px (2x), i.e. 4 CSS px
GROW = 3       # blocks of dilation: pieces closer than ~12 CSS px are kept together
for s in slides:
    im = Image.open(os.path.join(ex, s['raster'])).convert('RGBA')
    a = np.asarray(im)[:, :, 3]
    H, W = a.shape
    gh, gw = H // B, W // B
    m = (a[:gh * B, :gw * B] > 4).reshape(gh, B, gw, B).any(axis=(1, 3))
    d = m.copy()
    for _ in range(GROW):
        e = d.copy()
        e[1:, :] |= d[:-1, :]; e[:-1, :] |= d[1:, :]; e[:, 1:] |= d[:, :-1]; e[:, :-1] |= d[:, 1:]
        d = e
    lab = np.zeros(d.shape, dtype=np.int32)
    crops, k = [], 0
    for y0 in range(gh):
        for x0 in range(gw):
            if not d[y0, x0] or lab[y0, x0]:
                continue
            k += 1
            q = deque([(y0, x0)]); lab[y0, x0] = k
            ys, xs = [y0, y0], [x0, x0]
            while q:
                y, x = q.popleft()
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < gh and 0 <= xx < gw and d[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = k; q.append((yy, xx))
                        ys[0] = min(ys[0], yy); ys[1] = max(ys[1], yy); xs[0] = min(xs[0], xx); xs[1] = max(xs[1], xx)
            # tighten to the real pixels of this piece
            y1, y2, x1, x2 = ys[0] * B, (ys[1] + 1) * B, xs[0] * B, (xs[1] + 1) * B
            sub = a[y1:y2, x1:x2] > 4
            sub &= np.kron(lab[ys[0]:ys[1] + 1, xs[0]:xs[1] + 1] == k, np.ones((B, B), dtype=bool))[:sub.shape[0], :sub.shape[1]]
            if sub.sum() < 12:
                continue
            rr, cc = np.where(sub)
            y1, y2, x1, x2 = y1 + rr.min(), y1 + rr.max() + 1, x1 + cc.min(), x1 + cc.max() + 1
            piece = np.asarray(im)[y1:y2, x1:x2].copy()
            mask = np.kron(lab[ys[0]:ys[1] + 1, xs[0]:xs[1] + 1] == k, np.ones((B, B), dtype=bool))
            oy, ox = y1 - ys[0] * B, x1 - xs[0] * B
            piece[:, :, 3] = np.where(mask[oy:oy + (y2 - y1), ox:ox + (x2 - x1)], piece[:, :, 3], 0)
            f = 'crops/%02d-%d.png' % (s['idx'], len(crops) + 1)
            Image.fromarray(piece).save(os.path.join(ex, f), optimize=True)
            crops.append({'file': f, 'x': x1 / 2, 'y': y1 / 2, 'w': (x2 - x1) / 2, 'h': (y2 - y1) / 2})
    s['crops'] = crops
json.dump(slides, open(os.path.join(ex, 'slides.json'), 'w'))
print('slides', len(slides), 'pieces', sum(len(s['crops']) for s in slides), 'max per slide', max(len(s['crops']) for s in slides))
