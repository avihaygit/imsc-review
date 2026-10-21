(() => {
  const stage = document.getElementById('stage');
  const slides = [...document.querySelectorAll('.slide')];
  const params = new URLSearchParams(location.search);
  const STATIC = params.has('static');
  if (STATIC) document.documentElement.classList.add('static');

  /* ---------- fit 1920x1080 stage to the window ---------- */
  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ---------- sections: accent colours + progress nodes ---------- */
  const SECTIONS = {
    open: { a: '#38E8FF', b: '#8B5CFF', node: 0, label: '' },
    c1: { a: '#38E8FF', b: '#8B5CFF', node: 1, label: 'המצאה שממציאה' },
    c2: { a: '#8B5CFF', b: '#38E8FF', node: 2, label: 'זה כבר קורה' },
    ex: { a: '#FF3DCB', b: '#8B5CFF', node: 2, label: 'זה כבר קורה' },
    game: { a: '#FF3DCB', b: '#38E8FF', node: 2, label: 'אמיתי או AI?' },
    c3: { a: '#8B5CFF', b: '#FF3DCB', node: 3, label: 'העולם החדש' },
    fut: { a: '#FFC65C', b: '#FF5A7A', node: 3, label: 'לאן העולם הולך' },
    end: { a: '#38E8FF', b: '#8B5CFF', node: 4, label: '' },
  };
  const nodes = document.getElementById('nodes');
  nodes.innerHTML = '<i></i><i></i><i></i><span></span>';
  const nodeEls = [...nodes.querySelectorAll('i')], nodeLabel = nodes.querySelector('span');

  /* ---------- prepare SVG draw lengths ---------- */
  document.querySelectorAll('.draw').forEach(p => {
    try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 2); } catch (e) {}
  });
  /* ---------- typewriter: wrap characters ---------- */
  document.querySelectorAll('.type').forEach(el => {
    const text = el.textContent; el.textContent = ''; el.dataset.full = text;
  });

  let cur = -1, step = 0;
  const maxStep = s => Math.max(0, ...[...s.querySelectorAll('[data-step]')].map(e => +e.dataset.step));
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function runCounters(scope, onlyStep) {
    scope.querySelectorAll('.count').forEach(el => {
      const host = el.closest('[data-step]');
      const hs = host ? +host.dataset.step : 0;
      if (onlyStep !== undefined && hs !== onlyStep) return;
      if (onlyStep === undefined && hs > 0) return;
      const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0);
      const dur = +(el.dataset.dur || 1800), delay = +(el.dataset.d || 0);
      const fmt = v => {
        let s = v.toFixed(dec);
        if (el.dataset.sep !== undefined) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        return (el.dataset.pre || '') + s + (el.dataset.suf || '');
      };
      if (STATIC) { el.textContent = fmt(to); return; }
      el.textContent = fmt(0);
      later(() => {
        const t0 = performance.now();
        const tick = now => {
          const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
          el.textContent = fmt(to * e);
          if (k < 1 && el.isConnected) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, delay);
    });
  }
  function runTypers(scope) {
    scope.querySelectorAll('.type').forEach(el => {
      const full = el.dataset.full;
      if (STATIC) { el.textContent = full; return; }
      el.textContent = '';
      const speed = +(el.dataset.speed || 38), delay = +(el.dataset.d || 0);
      let i = 0;
      later(function tick() {
        el.textContent = full.slice(0, ++i);
        if (i < full.length) timers.push(setTimeout(tick, full[i - 1] === ',' || full[i - 1] === '.' ? speed * 7 : speed));
      }, delay);
    });
  }

  function show(n, atEnd) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    timers.splice(0).forEach(clearTimeout);
    const prev = slides[cur];
    if (prev && prev !== slides[n]) {
      prev.classList.remove('active'); prev.classList.add('leaving');
      setTimeout(() => prev.classList.remove('leaving'), 1200);
      prev.dispatchEvent(new CustomEvent('slideleave'));
    }
    cur = n;
    const s = slides[n];
    // reset steps
    step = atEnd || STATIC ? maxStep(s) : 0;
    s.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('on', +e.dataset.step <= step));
    s.querySelectorAll('.revealed').forEach(e => e.classList.remove('revealed'));
    if (step) s.querySelectorAll('[data-reveal]').forEach(e => { if (+e.dataset.reveal <= step) e.classList.add('revealed'); });
    // restart entrance animations
    s.classList.remove('active'); void s.offsetWidth; s.classList.add('active');
    // section styling
    const sec = SECTIONS[s.dataset.sec || 'open'];
    stage.style.setProperty('--accent', sec.a); stage.style.setProperty('--accent2', sec.b);
    nodeEls.forEach((el, i) => { el.classList.toggle('on', i + 1 === sec.node); el.classList.toggle('done', i + 1 < sec.node); });
    nodeLabel.textContent = sec.label;
    stage.classList.toggle('bare', s.hasAttribute('data-bare'));
    document.getElementById('count').textContent = String(n + 1).padStart(2, '0') + ' / ' + slides.length;
    document.getElementById('progress').style.width = ((n + 1) / slides.length * 100) + '%';
    runCounters(s); runTypers(s);
    if (step) for (let k = 1; k <= step; k++) runCounters(s, k);
    s.dispatchEvent(new CustomEvent('slideenter', { detail: { step } }));
    if (location.hash !== '#' + (n + 1)) history.replaceState(null, '', location.pathname + location.search + '#' + (n + 1));
    bg.setAccent(sec.a, sec.b);
  }
  function next() {
    const s = slides[cur];
    if (step < maxStep(s)) {
      step++;
      s.querySelectorAll(`[data-step="${step}"]`).forEach(e => e.classList.add('on'));
      s.querySelectorAll(`[data-reveal="${step}"]`).forEach(e => e.classList.add('revealed'));
      runCounters(s, step);
      s.dispatchEvent(new CustomEvent('slidestep', { detail: { step } }));
    } else if (cur < slides.length - 1) show(cur + 1);
  }
  function prev() { if (cur > 0) show(cur - 1, true); }
  window.deck = { show, next, prev, get index() { return cur; }, slides };

  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') show(0);
    else if (k === 'End') show(slides.length - 1);
    else if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  });
  let tx = null;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => {
    if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev()); else next();
  });
  addEventListener('click', e => { if (e.target.closest('a,button,audio')) return; if (!('ontouchstart' in window)) next(); });
  addEventListener('contextmenu', e => { e.preventDefault(); prev(); });

  /* ---------- background: drifting network ---------- */
  const bg = (() => {
    const c = document.getElementById('bg'), x = c.getContext('2d');
    c.width = 1920; c.height = 1080;
    const N = 86, P = [];
    for (let i = 0; i < N; i++) P.push({ x: Math.random() * 1920, y: Math.random() * 1080, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: Math.random() * 1.8 + .6 });
    let A = [56, 232, 255], B = [139, 92, 255], tA = A, tB = B;
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    function frame() {
      A = mix(A, tA, .03); B = mix(B, tB, .03);
      x.clearRect(0, 0, 1920, 1080);
      for (const p of P) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = 1940; if (p.x > 1940) p.x = -20; if (p.y < -20) p.y = 1100; if (p.y > 1100) p.y = -20;
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = P[i], b = P[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
        if (d < 40000) {
          const k = 1 - d / 40000, col = mix(A, B, a.x / 1920);
          x.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${k * .16})`;
          x.lineWidth = 1; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
        }
      }
      for (const p of P) {
        const col = mix(A, B, p.x / 1920);
        x.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},.55)`;
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
      }
      if (!STATIC) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { setAccent(a, b) { tA = hex(a); tB = hex(b); if (STATIC) { A = tA; B = tB; } } };
  })();

  /* ---------- waveform canvases (opening + closing) ---------- */
  document.querySelectorAll('canvas.wave').forEach(cv => {
    const g = cv.getContext('2d'); cv.width = 1920; cv.height = 1080;
    const slide = cv.closest('.slide'), audio = slide.querySelector('audio');
    let t = 0, level = .12;
    (function draw() {
      const playing = audio && !audio.paused;
      level += ((playing ? .9 : .12) - level) * .06;
      g.clearRect(0, 0, 1920, 1080);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        for (let px = 0; px <= 1920; px += 6) {
          const u = px / 1920, env = Math.sin(Math.PI * u) ** 2;
          const n = Math.sin(u * 22 + t * (1.6 + k * .4)) * .5 + Math.sin(u * 51 - t * 2.3 + k) * .3 + Math.sin(u * 9 + t * .7) * .2;
          const y = 540 + n * env * 210 * level * (1 - k * .25);
          px ? g.lineTo(px, y) : g.moveTo(px, y);
        }
        g.strokeStyle = k === 0 ? 'rgba(56,232,255,.95)' : k === 1 ? 'rgba(139,92,255,.6)' : 'rgba(255,61,203,.35)';
        g.lineWidth = k === 0 ? 3 : 2; g.shadowColor = '#38E8FF'; g.shadowBlur = k === 0 ? 24 : 0; g.stroke();
      }
      t += playing ? .09 : .025;
      if (!STATIC) requestAnimationFrame(draw);
    })();
  });
  /* voice option: ?voice=a1|a2|b|c */
  const VOICES = window.VOICES || {};
  document.querySelectorAll('audio[data-voice]').forEach(a => {
    const pick = params.get('voice') || a.dataset.voice;
    if (VOICES[pick]) a.src = VOICES[pick];
  });
  slides.forEach(s => {
    const a = s.querySelector('audio');
    if (!a) return;
    const hint = s.querySelector('.hint');
    s.addEventListener('slidestep', e => { if (e.detail.step === 1) { a.currentTime = 0; a.play().catch(() => {}); if (hint) hint.style.opacity = '0'; } });
    s.addEventListener('slideenter', () => { if (hint) hint.style.opacity = ''; });
    s.addEventListener('slideleave', () => a.pause());
  });

  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (Number.isFinite(n) && n - 1 !== cur) show(n - 1); });
  /* ---------- start ---------- */
  const h = parseInt((location.hash || '').replace('#', ''), 10);
  show(Number.isFinite(h) ? h - 1 : 0);
  document.fonts && document.fonts.ready.then(fit);
})();
