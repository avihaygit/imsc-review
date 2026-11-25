// usage: node extract.js <deck dir> <out dir>
// Walks every slide of the HTML deck (final, static state) and writes:
//   out/slides.json  : per slide, the native items (shapes, text boxes, images) in paint order + notes + section
//   out/rNN.png      : per slide, a transparent 2x capture of everything that is NOT native (SVG drawings,
//                      pseudo-elements, glows), to be cut into pieces by cut.py
//   out/bg.png       : the empty stage (gradient, grid, scan band, corners)
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const [root, out] = process.argv.slice(2);
const T = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };

function EXTRACT(variant) {
  const stage = document.getElementById('stage');
  const S = window.deck.slides[window.deck.index];
  const bare = stage.classList.contains('bare');
  const roots = variant === 'video' ? [S.querySelector('.vid')] : [S];
  if (!bare) roots.push(document.getElementById('hud'));
  const items = [];
  const col = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const R = r => ({ x: r.left, y: r.top, w: r.width, h: r.height });
  const ctxCache = new Map();
  // cumulative opacity, scale, and whether a rotation/offset-path makes the element raster-only
  function ctx(el) {
    if (ctxCache.has(el)) return ctxCache.get(el);
    let c = { op: 1, sc: 1, raster: false, hidden: false };
    const parent = el.parentElement;
    if (parent && parent !== stage && parent !== document.body) c = Object.assign({}, ctx(parent));
    const cs = getComputedStyle(el);
    c.op *= parseFloat(cs.opacity);
    if (cs.display === 'none' || el.hasAttribute('hidden')) c.hidden = true;
    if (cs.transform && cs.transform !== 'none') {
      const m = /matrix\(([^)]+)\)/.exec(cs.transform);
      if (m) { const [a, b, cc] = m[1].split(',').map(Number); if (Math.abs(b) > 1e-3 || Math.abs(cc) > 1e-3) c.raster = true; c.sc *= Math.hypot(a, b); }
      else c.raster = true;
    }
    if (cs.offsetPath && cs.offsetPath !== 'none') c.raster = true;
    ctxCache.set(el, c);
    return c;
  }
  const visible = el => { const c = ctx(el); const cs = getComputedStyle(el); return !c.hidden && cs.visibility !== 'hidden' && c.op > 0.02; };
  const skipEl = el => el.closest('aside.notes,style,script,audio,iframe');

  // ---- text blocks ----
  const blockOf = new Map(); // block element -> [text nodes]
  for (const r of roots) {
    const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) {
      if (!/\S/.test(t.data)) continue;
      const pe = t.parentElement;
      if (!pe || skipEl(pe) || pe.closest('svg')) continue;
      if (!visible(pe) || ctx(pe).raster) continue;
      { const pcs = getComputedStyle(pe), cc = col(pcs.color); if (parseFloat(pcs.webkitTextStrokeWidth || '0') > 0 && cc && cc.a === 0) continue; }
      let B = pe;
      while (B !== r && ['inline', 'contents'].includes(getComputedStyle(B).display)) B = B.parentElement;
      if (!blockOf.has(B)) blockOf.set(B, []);
      blockOf.get(B).push(t);
    }
  }
  function runStyle(t, B) {
    const pe = t.parentElement, cs = getComputedStyle(pe), c = ctx(pe);
    let strike = false, under = false;
    for (let e = pe; e; e = e.parentElement) { const d = getComputedStyle(e).textDecorationLine; if (d.includes('line-through')) strike = true; if (d.includes('underline')) under = true; if (e === B) break; }
    const color = col(cs.color);
    const sw = parseFloat(cs.webkitTextStrokeWidth || '0');
    const a = pe.closest('a[href]');
    return {
      family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), weight: parseInt(cs.fontWeight, 10), size: parseFloat(cs.fontSize) * c.sc,
      color: color, op: c.op, italic: cs.fontStyle === 'italic', strike, under,
      stroke: sw > 0 ? { w: sw * c.sc, color: col(cs.webkitTextStrokeColor) } : null,
      ls: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) * c.sc,
      upper: cs.textTransform === 'uppercase', dir: cs.direction, ub: cs.unicodeBidi, href: a ? a.href : null,
    };
  }
  function textItem(B, nodes) {
    const parts = [];
    (function walk(node) {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { if (nodes.includes(ch)) parts.push({ t: ch }); }
        else if (ch.nodeType === 1) {
          if (ch.tagName === 'BR') parts.push({ br: true });
          else if (['inline', 'contents'].includes(getComputedStyle(ch).display) && !ch.closest('svg')) walk(ch);
        }
      }
    })(B);
    const lines = [[]];
    const rects = [];
    for (const p of parts) {
      if (p.br) { lines.push([]); continue; }
      const st = runStyle(p.t, B);
      let s = p.t.data.replace(/\s+/g, ' ');
      if (st.upper) s = s.toUpperCase();
      const rg = document.createRange(); rg.selectNodeContents(p.t);
      const own = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      own.forEach(r => rects.push(r));
      const L = lines[lines.length - 1], prev = L[L.length - 1];
      // a visible gap made by CSS (margin, flex gap) between two runs becomes spaces
      if (prev && prev._last && own.length && !/ $/.test(prev.text) && !/^ /.test(s)) {
        const a = prev._last, b = own[0];
        if (Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 0.5 * Math.min(a.height, b.height)) {
          const gap = Math.max(a.left - b.right, b.left - a.right);
          if (gap > 0.15 * st.size) s = ' '.repeat(Math.max(1, Math.min(4, Math.round(gap / (0.28 * st.size))))) + s;
        }
      }
      L.push(Object.assign({ text: s, _last: own[own.length - 1] || null }, st));
    }
    for (const L of lines) {
      if (L.length) { L[0].text = L[0].text.replace(/^ /, ''); L[L.length - 1].text = L[L.length - 1].text.replace(/ $/, ''); }
      for (let i = 1; i < L.length; i++) if (L[i - 1].text.endsWith(' ') && L[i].text.startsWith(' ')) L[i].text = L[i].text.slice(1);
    }
    const lines2 = lines.map(L => L.filter(r => r.text.length)).filter(L => L.length);
    lines2.forEach(L => L.forEach(r => delete r._last));
    if (!lines2.length || !rects.length) return null;
    const U = { l: Math.min(...rects.map(r => r.left)), t: Math.min(...rects.map(r => r.top)), r: Math.max(...rects.map(r => r.right)), b: Math.max(...rects.map(r => r.bottom)) };
    // rows: rects whose vertical centres are close belong to one line (mixed fonts have different tops)
    const cens = rects.map(r => ({ c: (r.top + r.bottom) / 2, h: r.height })).sort((a, b) => a.c - b.c);
    const rowTops = []; let last = null;
    for (const r of cens) { if (!last || r.c - last.c > 0.5 * Math.min(r.h, last.h)) { rowTops.push(r.c); last = r; } }
    const cs = getComputedStyle(B), c = ctx(B), br = B.getBoundingClientRect();
    const px = k => parseFloat(cs[k]) * c.sc;
    const cl = br.left + px('borderLeftWidth') + px('paddingLeft'), cr = br.right - px('borderRightWidth') - px('paddingRight');
    let ta = cs.textAlign; const rtl = cs.direction === 'rtl';
    if (ta === 'start' || ta === 'justify' || ta === '-webkit-auto') ta = rtl ? 'right' : 'left';
    else if (ta === 'end') ta = rtl ? 'left' : 'right';
    else if (ta.includes('center')) ta = 'center';
    else if (ta.includes('right')) ta = 'right'; else if (ta.includes('left')) ta = 'left';
    const flexish = /flex|grid/.test(cs.display);
    const lh = rowTops.length > 1 ? (rowTops[rowTops.length - 1] - rowTops[0]) / (rowTops.length - 1) : (cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight) * c.sc);
    return { type: 'text', U, cl, cr, align: ta, rtl, flexish, nrows: rowTops.length, lh, lines: lines2, head: !!B.closest('h1,h2'), tag: B.tagName.toLowerCase(), cls: B.className && typeof B.className === 'string' ? B.className : '' };
  }

  // ---- walk elements in document order ----
  const txt = [], shapes = [], images = [];
  const natives = [], textEls = new Set(), imgEls = [];
  for (const r of roots) {
    const all = [r, ...r.querySelectorAll('*')];
    for (const el of all) {
      if (skipEl(el)) continue;
      if (el instanceof SVGElement) {
        if (el.tagName === 'text' && visible(el) && !ctx(el).raster) {
          const m = el.getScreenCTM();
          if (!m || Math.abs(m.b) > 1e-3 || Math.abs(m.c) > 1e-3) continue;
          const bb = el.getBoundingClientRect(); if (bb.width < 1) continue;
          const cs = getComputedStyle(el);
          const s = el.textContent.replace(/\s+/g, ' ').trim(); if (!s) continue;
          let op = ctx(el).op;
          const anchor = cs.textAnchor;
          txt.push({ type: 'text', svg: true, U: { l: bb.left, t: bb.top, r: bb.right, b: bb.bottom }, cl: bb.left, cr: bb.right,
            align: anchor === 'middle' ? 'center' : (cs.direction === 'rtl' ? (anchor === 'end' ? 'left' : 'right') : (anchor === 'end' ? 'right' : 'left')),
            rtl: cs.direction === 'rtl' && /[֐-׿]/.test(s), flexish: true, nrows: 1, lh: null,
            lines: [[{ text: s, family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), weight: parseInt(cs.fontWeight, 10), size: parseFloat(cs.fontSize) * m.a,
              color: col(cs.fill), op, italic: false, strike: false, under: false, stroke: null, ls: 0, upper: false, dir: cs.direction, href: null }]] });
          textEls.add(el);
        }
        continue;
      }
      if (!visible(el)) continue;
      const c = ctx(el);
      if (c.raster) continue;
      if (blockOf.has(el)) { const it = textItem(el, blockOf.get(el)); if (it) { it.z = txt.length; txt.push(it); } blockOf.get(el).forEach(t => textEls.add(t.parentElement)); }
      const rect = el.getBoundingClientRect();
      if (rect.width < 0.5 || rect.height < 0.5) continue;
      if (el.tagName === 'IMG') { images.push(Object.assign({ type: 'image', src: el.currentSrc || el.src, fit: getComputedStyle(el).objectFit, op: c.op, href: (el.closest('a[href]') || {}).href || null }, R(rect))); imgEls.push(el); continue; }
      if (el.tagName === 'CANVAS' || el.tagName === 'svg') continue;
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== 'none') continue; // gradients and pictures stay in the raster
      const bg = col(cs.backgroundColor);
      const side = k => { const w = parseFloat(cs['border' + k + 'Width']) * c.sc, s = cs['border' + k + 'Style'], cc = col(cs['border' + k + 'Color']); return (w > 0 && s !== 'none' && s !== 'hidden' && cc && cc.a > 0) ? { w, style: s, color: cc } : null; };
      const sides = { Top: side('Top'), Right: side('Right'), Bottom: side('Bottom'), Left: side('Left') };
      const hasFill = bg && bg.a > 0;
      if (!hasFill && !Object.values(sides).some(Boolean)) continue;
      let rad = cs.borderTopLeftRadius; rad = rad.endsWith('%') ? parseFloat(rad) / 100 * Math.min(rect.width, rect.height) : parseFloat(rad) * c.sc;
      shapes.push(Object.assign({ type: 'shape', fill: hasFill ? bg : null, op: c.op, sides, rad: rad || 0, cls: typeof el.className === 'string' ? el.className : '' }, R(rect)));
      natives.push(el);
    }
  }
  // classes for the raster pass
  natives.forEach(e => e.classList.add('x-nat'));
  textEls.forEach(e => e.classList.add('x-tx'));
  imgEls.forEach(e => e.classList.add('x-img'));
  const notes = (S.querySelector('aside.notes') || {}).textContent || '';
  const sec = document.querySelector('#hud .sec');
  return { bare, title: S.dataset.title, part: S.dataset.part, sec: sec ? sec.innerText.replace(/\s+/g, ' ').trim() : '', notes: notes.trim(), shapes, images, texts: txt };
}

const RASTER_CSS = `
*,*::before,*::after{transition:none!important}
html,body,#viewport,#stage{background:transparent!important}
.grid,.scan,.vignette,.corner{display:none!important}
.x-nat{background-color:transparent!important;border-color:transparent!important}
.x-tx{color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;fill:transparent!important}
.x-img{visibility:hidden!important}
.x-off{visibility:hidden!important}`;

const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'text/html; charset=utf-8' }); r.end(d); });
}).listen(8771, async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8771/index.html?static=1#1', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const n = await p.evaluate(() => window.deck.slides.length);
  // empty stage
  await p.evaluate(() => { document.querySelectorAll('.slide,#hud').forEach(e => e.style.visibility = 'hidden'); });
  await p.screenshot({ path: path.join(out, 'bg.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  await p.evaluate(() => { document.querySelectorAll('.slide,#hud').forEach(e => e.style.visibility = ''); });
  const slides = [];
  for (let i = 1; i <= n; i++) {
    await p.evaluate(k => window.deck.show(k - 1, true), i);
    const video = await p.evaluate(k => !!window.deck.slides[k - 1].querySelector('.vid'), i);
    for (const variant of video ? ['content', 'video'] : ['final']) {
      await p.evaluate(([k, v]) => { const s = window.deck.slides[k - 1]; if (v !== 'final') s.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('on', v === 'video')); }, [i, variant]);
      await p.waitForTimeout(250);
      const data = await p.evaluate(EXTRACT, variant);
      data.n = i; data.variant = variant; data.idx = slides.length + 1;
      await p.addStyleTag({ content: RASTER_CSS }).then(h => h.evaluate(e => e.id = 'xr'));
      if (variant === 'video') await p.evaluate(k => { const s = window.deck.slides[k - 1]; [...s.children].forEach(e => { if (!e.classList.contains('vid')) e.classList.add('x-off'); }); }, i);
      await p.waitForTimeout(100);
      const rf = 'r' + String(data.idx).padStart(2, '0') + '.png';
      await p.screenshot({ path: path.join(out, rf), clip: { x: 0, y: 0, width: 1920, height: 1080 }, omitBackground: true });
      data.raster = rf;
      await p.evaluate(() => { document.getElementById('xr').remove(); document.querySelectorAll('.x-nat,.x-tx,.x-img,.x-off').forEach(e => e.classList.remove('x-nat', 'x-tx', 'x-img', 'x-off')); });
      slides.push(data);
    }
  }
  fs.writeFileSync(path.join(out, 'slides.json'), JSON.stringify(slides));
  console.log('slides', n, 'pptx slides', slides.length, 'errors', errs.length ? errs : 'none');
  await b.close(); srv.close();
});
