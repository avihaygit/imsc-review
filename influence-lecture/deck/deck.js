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

  /* ---------- sections: label + station strip ---------- */
  const SECTIONS = {
    open: { n: '', label: 'פתיחה', st: 0 },
    s1: { n: '01', label: 'הנחיית מנהלים', st: 1 },
    s2: { n: '02', label: 'משימת ההשפעה', st: 2 },
    s3: { n: '03', label: 'צי״ח לקמ״ן', st: 3 },
    s4: { n: '04', label: 'איסוף ומחקר', st: 4 },
    s5: { n: '05', label: 'תכנון', st: 5 },
    s6: { n: '06', label: 'ביצוע', st: 6 },
    s7: { n: '07', label: 'מדידה, הערכה ותיקון', st: 7 },
    ai: { n: 'AI', label: 'בינה מלאכותית', st: 8 },
    end: { n: '', label: 'סיכום', st: 8 },
  };
  const hud = document.getElementById('hud');
  hud.innerHTML = '<div class="sec"><b></b><span></span></div><div class="count"></div><div class="strip">' + '<i></i>'.repeat(7) + '</div><div class="bar"></div>';
  const strip = [...hud.querySelectorAll('.strip i')];

  /* ---------- prepare SVG draw lengths, typewriters ---------- */
  document.querySelectorAll('.draw').forEach(p => {
    try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 2); } catch (e) {}
  });
  document.querySelectorAll('.type').forEach(el => { el.dataset.full = el.textContent; el.textContent = ''; });

  let cur = -1, step = 0;
  const maxStep = s => Math.max(0, ...[...s.querySelectorAll('[data-step]')].map(e => +e.dataset.step));
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function runCounters(scope) {
    scope.querySelectorAll('.count-up').forEach(el => {
      const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0);
      const dur = +(el.dataset.dur || 1800), delay = +(el.dataset.d || 0);
      const fmt = v => {
        let s = v.toFixed(dec);
        if (el.dataset.sep !== undefined) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        return (el.dataset.pre || '') + s + (el.dataset.suf || '');
      };
      if (STATIC) { el.textContent = fmt(to); return; }
      el.textContent = fmt(+(el.dataset.from || 0));
      later(() => {
        const t0 = performance.now(), from = +(el.dataset.from || 0);
        const tick = now => {
          const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
          el.textContent = fmt(from + (to - from) * e);
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
      const speed = +(el.dataset.speed || 30), delay = +(el.dataset.d || 0);
      let i = 0;
      later(function tick() {
        el.textContent = full.slice(0, ++i);
        if (i < full.length) timers.push(setTimeout(tick, full[i - 1] === ',' || full[i - 1] === '.' ? speed * 6 : speed));
      }, delay);
    });
  }

  function show(n, atEnd) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    timers.splice(0).forEach(clearTimeout);
    const prev = slides[cur];
    if (prev && prev !== slides[n]) { prev.classList.remove('active'); prev.dispatchEvent(new CustomEvent('slideleave')); }
    cur = n;
    const s = slides[n];
    step = atEnd || STATIC ? maxStep(s) : 0;
    s.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('on', +e.dataset.step <= step));
    s.classList.remove('active'); void s.offsetWidth; s.classList.add('active');
    const sec = SECTIONS[s.dataset.sec || 'open'];
    hud.querySelector('.sec b').textContent = sec.n; hud.querySelector('.sec span').textContent = sec.label;
    strip.forEach((el, i) => { el.classList.toggle('on', i + 1 === sec.st); el.classList.toggle('done', i + 1 < sec.st); });
    stage.classList.toggle('bare', s.hasAttribute('data-bare'));
    hud.querySelector('.count').innerHTML = '<b>' + String(n + 1).padStart(2, '0') + '</b> / ' + slides.length;
    hud.querySelector('.bar').style.width = ((n + 1) / slides.length * 100) + '%';
    runCounters(s); runTypers(s);
    s.dispatchEvent(new CustomEvent('slideenter', { detail: { step } }));
    if (location.hash !== '#' + (n + 1)) history.replaceState(null, '', location.pathname + location.search + '#' + (n + 1));
  }
  function next() {
    const s = slides[cur];
    if (step < maxStep(s)) {
      step++;
      s.querySelectorAll(`[data-step="${step}"]`).forEach(e => e.classList.add('on'));
      s.dispatchEvent(new CustomEvent('slidestep', { detail: { step } }));
    } else if (cur < slides.length - 1) show(cur + 1);
  }
  function prev() { if (cur > 0) show(cur - 1, true); }
  window.deck = { show, next, prev, get index() { return cur; }, slides };

  addEventListener('keydown', e => {
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
  addEventListener('click', e => { if (e.target.closest('a,button,audio,.vid .frame')) return; if (!('ontouchstart' in window)) next(); });
  addEventListener('contextmenu', e => { e.preventDefault(); prev(); });

  /* ---------- waveform (opening) ---------- */
  document.querySelectorAll('canvas.wave').forEach(cv => {
    const g = cv.getContext('2d'); cv.width = 1920; cv.height = 1080;
    const slide = cv.closest('.slide'), audio = slide.querySelector('audio');
    let t = 0, level = .14;
    (function draw() {
      const playing = audio && !audio.paused;
      level += ((playing ? .9 : .14) - level) * .06;
      g.clearRect(0, 0, 1920, 1080);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        for (let px = 0; px <= 1920; px += 6) {
          const u = px / 1920, env = Math.sin(Math.PI * u) ** 2;
          const nn = Math.sin(u * 22 + t * (1.6 + k * .4)) * .5 + Math.sin(u * 51 - t * 2.3 + k) * .3 + Math.sin(u * 9 + t * .7) * .2;
          const y = 540 + nn * env * 210 * level * (1 - k * .25);
          px ? g.lineTo(px, y) : g.moveTo(px, y);
        }
        g.strokeStyle = k === 0 ? 'rgba(242,169,59,.95)' : k === 1 ? 'rgba(242,169,59,.45)' : 'rgba(143,160,148,.35)';
        g.lineWidth = k === 0 ? 3 : 2; g.shadowColor = '#F2A93B'; g.shadowBlur = k === 0 ? 22 : 0; g.stroke();
      }
      t += playing ? .09 : .025;
      if (!STATIC) requestAnimationFrame(draw);
    })();
  });
  /* opening voice: ?voice=<key> picks one of window.VOICES */
  const VOICES = window.VOICES || {};
  document.querySelectorAll('audio[data-voice]').forEach(a => {
    const pick = params.get('voice') || a.dataset.voice;
    if (VOICES[pick]) a.src = VOICES[pick];
  });
  slides.forEach(s => {
    const a = s.querySelector('audio');
    if (!a) return;
    const hint = s.querySelector('.hint');
    s.addEventListener('slidestep', e => { if (e.detail.step === 1 && a.src) { a.currentTime = 0; a.play().catch(() => {}); if (hint) hint.style.opacity = '0'; } });
    s.addEventListener('slideenter', () => { if (hint) hint.style.opacity = ''; });
    s.addEventListener('slideleave', () => a.pause());
  });

  /* embedded video: an iframe[data-yt] loads and plays on its step (or on a click on its poster), and stops when the slide is left */
  slides.forEach(s => {
    const f = s.querySelector('iframe[data-yt]');
    if (!f) return;
    const st = +((f.closest('[data-step]') || { dataset: { step: 1 } }).dataset.step);
    const on = () => { if (!STATIC) f.src = 'https://www.youtube-nocookie.com/embed/' + f.dataset.yt + '?autoplay=1&rel=0&playsinline=1'; };
    const off = () => f.removeAttribute('src');
    s.addEventListener('slidestep', e => { if (e.detail.step === st) on(); });
    s.addEventListener('slideenter', off);
    s.addEventListener('slideleave', off);
    const poster = f.parentElement.querySelector('img');
    if (poster) poster.addEventListener('click', on);
  });
  /* a click inside a video takes keyboard focus; hand it back so the clicker keeps working */
  addEventListener('blur', () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME') a.blur(); }, 0));

  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (Number.isFinite(n) && n - 1 !== cur) show(n - 1); });
  const h = parseInt((location.hash || '').replace('#', ''), 10);
  show(Number.isFinite(h) ? h - 1 : 0);
  document.fonts && document.fonts.ready.then(fit);
})();
