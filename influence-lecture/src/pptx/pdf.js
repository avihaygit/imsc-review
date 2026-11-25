// usage: node pdf.js <deck dir> <out dir>  -> out/pNN.pdf, one page per slide (final state);
// a slide with an embedded video gets two pages: the slide itself, then the video frame with its link.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const [root, out] = process.argv.slice(2);
const T = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'text/html; charset=utf-8' }); r.end(d); });
}).listen(8770, async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errs.push(r.status() + ' ' + r.url()); });
  await p.emulateMedia({ media: 'screen' });
  await p.goto('http://localhost:8770/index.html?static=1#1', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const n = await p.evaluate(() => window.deck.slides.length);
  let page = 0;
  const shot = async () => {
    await p.waitForTimeout(300);
    page++;
    await p.pdf({ path: path.join(out, 'p' + String(page).padStart(2, '0') + '.pdf'), width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });
  };
  for (let i = 1; i <= n; i++) {
    await p.evaluate(k => window.deck.show(k - 1, true), i);
    const video = await p.evaluate(k => !!window.deck.slides[k - 1].querySelector('.vid'), i);
    if (video) {
      await p.evaluate(k => window.deck.slides[k - 1].querySelectorAll('[data-step]').forEach(e => e.classList.remove('on')), i);
      await shot();
      await p.evaluate(k => window.deck.slides[k - 1].querySelectorAll('[data-step]').forEach(e => e.classList.add('on')), i);
      await p.evaluate(() => Promise.all([...document.images].filter(im => !im.complete).map(im => new Promise(r => { im.onload = im.onerror = r; }))));
    }
    await shot();
  }
  console.log('slides', n, 'pages', page, 'errors', errs.length ? errs : 'none');
  await b.close(); srv.close();
});
