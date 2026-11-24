// Generated visuals for individual slides (deterministic, so screenshots match)
(() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a, parent) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };

  // 19 · a crowd of dots inside a circle, some of them lit (one segment)
  const crowd = document.getElementById('crowd');
  if (crowd) {
    el('circle', { cx: 230, cy: 230, r: 220, fill: 'none', stroke: '#3A4A40', 'stroke-width': 2, 'stroke-dasharray': '6 8' }, crowd);
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 200, x = 230 + r * Math.cos(a), y = 230 + r * Math.sin(a);
      const lit = x > 230 && y < 250 && rnd() > .35;
      el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: lit ? 6 : 4.5, fill: lit ? '#F2A93B' : '#56655B' }, crowd);
    }
    [[230, 10, 230, 450], [10, 230, 450, 230]].forEach(([x1, y1, x2, y2]) => el('line', { x1, y1, x2, y2, stroke: '#27322B', 'stroke-width': 1.5 }, crowd));
  }

  // 20 · persuasion score 0..10: voters as dots, the middle under a question mark
  const sc = document.getElementById('scale10');
  if (sc) {
    const X = v => 1650 - v * 160; // RTL: 0 on the right
    el('line', { x1: X(0), y1: 250, x2: X(10), y2: 250, stroke: '#3A4A40', 'stroke-width': 3 }, sc);
    for (let v = 0; v <= 10; v++) {
      el('line', { x1: X(v), y1: 240, x2: X(v), y2: 262, stroke: '#56655B', 'stroke-width': 2 }, sc);
      const t = el('text', { x: X(v), y: 302, 'text-anchor': 'middle', fill: '#8E9F94', 'font-family': 'Plex Mono', 'font-size': 26 }, sc); t.textContent = v;
    }
    for (let i = 0; i < 150; i++) {
      const v = Math.min(10, Math.max(0, 5 + (rnd() + rnd() + rnd() - 1.5) * 4.2));
      const moved = v > 7 ? rnd() > .3 : v < 3 ? rnd() > .9 : rnd() > .78;
      el('circle', { cx: X(v).toFixed(1), cy: (215 - rnd() * 150).toFixed(1), r: 7, fill: moved ? '#F2A93B' : '#56655B' }, sc);
    }
    const g = el('g', { 'data-a': 'scale', style: '--d:1400' }, sc);
    el('rect', { x: X(6.5), y: 40, width: X(3.5) - X(6.5), height: 190, fill: 'rgba(242,169,59,.06)', stroke: '#F2A93B', 'stroke-width': 2.5, 'stroke-dasharray': '10 8' }, g);
    const q = el('text', { x: (X(6.5) + X(3.5)) / 2, y: 32, 'text-anchor': 'middle', fill: '#F2A93B', 'font-family': 'Heebo', 'font-weight': 800, 'font-size': 30 }, g); q.textContent = '״המתלבטים״?';
    const l1 = el('text', { x: X(10) - 10, y: 302, 'text-anchor': 'end', fill: '#8E9F94', 'font-family': 'Heebo', 'font-size': 22 }, sc); l1.textContent = '';
  }

  // 21 · school network: a few "social referents" light up their neighbours
  const sch = document.getElementById('school');
  if (sch) {
    const P = [];
    for (let t = 0; P.length < 46 && t < 4000; t++) {
      const x = 30 + rnd() * 500, y = 30 + rnd() * 500;
      if (Math.hypot(x - 280, y - 280) < 260 && P.every(p => Math.hypot(p.x - x, p.y - y) > 58)) P.push({ x, y });
    }
    const near = i => P.map((q, j) => [j, Math.hypot(P[i].x - q.x, P[i].y - q.y)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
    const hubs = [3, 17, 31].filter(i => i < P.length);
    const lit = new Set(hubs);
    const eg = el('g', {}, sch), ng = el('g', {}, sch);
    P.forEach((p, i) => near(i).slice(0, 2).forEach(([j]) => { if (i < j) el('line', { x1: p.x, y1: p.y, x2: P[j].x, y2: P[j].y, stroke: '#27322B', 'stroke-width': 1.5 }, eg); }));
    hubs.forEach((h, k) => near(h).slice(0, 6).forEach(([j], m) => {
      lit.add(j);
      el('line', { x1: P[h].x, y1: P[h].y, x2: P[j].x, y2: P[j].y, stroke: '#F2A93B', 'stroke-width': 2.5, 'stroke-opacity': .85, 'data-a': 'fade', style: `--d:${900 + k * 300 + m * 80}` }, eg);
    }));
    P.forEach((p, i) => {
      const hub = hubs.includes(i);
      if (hub) el('circle', { cx: p.x, cy: p.y, r: 22, fill: 'none', stroke: '#F2A93B', 'stroke-width': 2, opacity: .6 }, ng);
      el('circle', { cx: p.x, cy: p.y, r: hub ? 12 : 7, fill: lit.has(i) ? '#F2A93B' : '#56655B', 'data-a': lit.has(i) && !hub ? 'fade' : null, style: '--d:1500' }, ng);
    });
    ng.querySelectorAll('[data-a="null"]').forEach(e => e.removeAttribute('data-a'));
  }

  // 29 · waffle: 100 users, one of them gets 70% of exposures
  const w = document.getElementById('waffle');
  if (w) for (let i = 0; i < 100; i++) {
    const d = document.createElement('i');
    d.style.cssText = 'display:block;height:44px;background:' + (i === 0 ? '#F2A93B' : '#27322B') + (i === 0 ? ';box-shadow:0 0 20px rgba(242,169,59,.7)' : '');
    w.appendChild(d);
  }

  // 35 · lights floating down the river
  const L = document.querySelector('.lights');
  if (L) {
    const d = "path('M1920 120 C1650 40 1500 300 1220 230 S 760 60 520 200 S 160 380 0 300')";
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('i');
      b.className = 'flow';
      const off = (i / 16 * 100 + rnd() * 3).toFixed(1);
      b.style.cssText = `position:absolute;left:0;top:0;width:16px;height:16px;margin:${(rnd() * 24 - 12).toFixed(0)}px 0 0 0;border-radius:50%;background:#F2A93B;box-shadow:0 0 16px 4px rgba(242,169,59,.55);offset-path:${d};offset-distance:${off}%;animation-delay:-${(i / 16 * 9).toFixed(2)}s`;
      L.appendChild(b);
    }
  }
})();
