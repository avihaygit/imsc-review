// usage: node deckshots.js deck/index.html outdir [first last] -> outdir/sNN.png, final (static) state of each slide
const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const [file, out, a, z] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(file) + '?static=1#1');
  await p.evaluate(() => document.fonts.ready);
  const n = await p.evaluate(() => window.deck.slides.length);
  for (let i = (+a || 1); i <= (+z || n); i++) {
    await p.evaluate(k => window.deck.show(k - 1, true), i);
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(out, 's' + String(i).padStart(2, '0') + '.png') });
  }
  console.log('slides', n, 'errors', errs.length ? errs : 'none');
  await b.close();
})();
