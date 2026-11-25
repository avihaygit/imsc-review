// usage: node build.js <ex dir> <out.pptx> <poster.jpg>
// Builds an editable PowerPoint from the extraction: native text boxes and shapes, the non-native
// visuals as small transparent pictures, speaker notes, and one section per stage of the model.
const path = require('path'), fs = require('fs');
const pptxgen = require('pptxgenjs');
const [ex, outFile, poster] = process.argv.slice(2);
const slides = JSON.parse(fs.readFileSync(path.join(ex, 'slides.json'), 'utf8'));

const IN = px => +(px / 144).toFixed(4);           // stage px -> inches (1920px = 13.333in)
const PT = px => +(px * 0.5).toFixed(2);            // stage px -> points
const hex = c => [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const transp = a => Math.max(0, Math.min(100, Math.round(100 * (1 - a))));
const BG = { r: 12, g: 16, b: 14 };
const blend = (c, a) => ({ r: c.r * a + BG.r * (1 - a), g: c.g * a + BG.g * (1 - a), b: c.b * a + BG.b * (1 - a) });
const HEB = /[֐-׿]/;

function face(family, weight, heb) {
  const w = Math.round((weight || 400) / 100) * 100;
  if (/plex/i.test(family) && !heb) return [w >= 600 ? 'IBM Plex Mono SemiBold' : 'IBM Plex Mono', false];
  if (/karantina/i.test(family)) return ['Karantina', w >= 600];
  return ({ 100: ['Heebo Light', false], 200: ['Heebo Light', false], 300: ['Heebo Light', false], 400: ['Heebo', false], 500: ['Heebo Medium', false], 600: ['Heebo SemiBold', false], 700: ['Heebo', true], 800: ['Heebo ExtraBold', false], 900: ['Heebo Black', false] })[w] || ['Heebo', false];
}

function runs(t) {
  const out = [];
  t.lines.forEach((L, li) => {
    for (const r of L) {
      // a monospace run that holds Hebrew: the Hebrew part falls back to Heebo, as in the browser
      const segs = /plex/i.test(r.family) && HEB.test(r.text) ? r.text.match(/[֐-׿][֐-׿\s"'״׳]*|[^֐-׿]+/g) : [r.text];
      for (const sg of segs) {
        const heb = HEB.test(sg);
        const [ff, bold] = face(r.family, r.weight, heb);
        let text = sg;
        const isolated = r.dir === 'ltr' && /isolate|embed|override/.test(r.ub || '');
        if (t.rtl && isolated && !heb) text = '‪' + text + '‬';
        const o = { fontFace: ff, fontSize: PT(r.size), bold, lang: t.rtl ? 'he-IL' : 'en-US' };
        const a = (r.color ? r.color.a : 1) * r.op;
        if (r.stroke && a < 0.02) {
          const sa = r.stroke.color.a * r.op;
          o.outline = { size: Math.max(0.5, PT(r.stroke.w)), color: hex(blend(r.stroke.color, sa)) };
          o.color = hex(r.stroke.color); o.transparency = 100;
        } else {
          o.color = hex(r.color || { r: 231, g: 237, b: 231 });
          if (a < 0.995) o.transparency = transp(a);
        }
        if (r.italic) o.italic = true;
        if (r.strike) o.strike = 'sngStrike';
        if (r.under) o.underline = { style: 'sng' };
        if (r.ls) o.charSpacing = PT(r.ls);
        if (r.href) o.hyperlink = { url: r.href, tooltip: r.href };
        out.push({ text, options: o });
      }
    }
    if (li < t.lines.length - 1 && out.length) out[out.length - 1].options.breakLine = true;
  });
  return out;
}

function textBox(t) {
  const U = t.U;
  const single = t.nrows <= 1;
  let x0 = U.l, x1 = U.r;
  if (!single && !t.flexish && !t.svg) { x0 = Math.min(t.cl, U.l); x1 = Math.max(t.cr, U.r); }
  const w = x1 - x0;
  const slack = single ? Math.max(8, w * 0.04) : Math.max(3, w * 0.006);
  if (t.align === 'right') x0 -= slack; else if (t.align === 'left') x1 += slack; else { x0 -= slack / 2; x1 += slack / 2; }
  const o = {
    x: IN(x0), y: IN(U.t), w: IN(x1 - x0), h: IN(Math.max(U.b - U.t, 4)),
    margin: 0, valign: 'top', align: t.align, isTextBox: true, wrap: !single, rtlMode: !!t.rtl,
    paraSpaceBefore: 0, paraSpaceAfter: 0, fit: 'none',
  };
  if (!single && t.lh) o.lineSpacing = PT(t.lh);
  return o;
}

function addShapeItem(pres, s, sh, k) {
  const all = ['Top', 'Right', 'Bottom', 'Left'].map(n => sh.sides[n]);
  const same = (a, b) => a && b && Math.abs(a.w - b.w) < 0.01 && a.style === b.style && hex(a.color) === hex(b.color) && Math.abs(a.color.a - b.color.a) < 0.01;
  const uniform = all.every(x => same(x, all[0]));
  const ell = sh.rad >= Math.min(sh.w, sh.h) / 2 - 0.5;
  const type = ell ? pres.ShapeType.ellipse : sh.rad > 0.5 ? pres.ShapeType.roundRect : pres.ShapeType.rect;
  const fill = sh.fill ? { color: hex(sh.fill), transparency: transp(sh.fill.a * sh.op) } : { type: 'none' };
  const dash = st => st === 'dashed' ? 'dash' : st === 'dotted' ? 'sysDot' : 'solid';
  const name = 'צורה ' + k;
  if (uniform) {
    const b = all[0], i = b.w / 2;
    s.addShape(type, { x: IN(sh.x + i), y: IN(sh.y + i), w: IN(sh.w - b.w), h: IN(sh.h - b.w), fill,
      line: { color: hex(b.color), width: PT(b.w), transparency: transp(b.color.a * sh.op), dashType: dash(b.style) },
      rectRadius: type === pres.ShapeType.roundRect ? IN(Math.max(0, sh.rad - i)) : undefined, objectName: name });
    return;
  }
  if (sh.fill) s.addShape(type, { x: IN(sh.x), y: IN(sh.y), w: IN(sh.w), h: IN(sh.h), fill, rectRadius: type === pres.ShapeType.roundRect ? IN(sh.rad) : undefined, objectName: name });
  const geo = { Top: [sh.x, sh.y, sh.w, 'h'], Bottom: [sh.x, sh.y + sh.h, sh.w, 'h'], Right: [sh.x + sh.w, sh.y, sh.h, 'v'], Left: [sh.x, sh.y, sh.h, 'v'] };
  ['Top', 'Right', 'Bottom', 'Left'].forEach((n, j) => {
    const b = all[j]; if (!b) return;
    const c = hex(b.color), tr = transp(b.color.a * sh.op);
    if (b.style === 'solid' || b.style === 'double' || b.style === 'groove' || b.style === 'ridge' || b.style === 'inset' || b.style === 'outset') {
      const [gx, gy, len, dir] = geo[n];
      const r = dir === 'h' ? { x: sh.x, y: n === 'Top' ? sh.y : sh.y + sh.h - b.w, w: len, h: b.w } : { x: n === 'Left' ? sh.x : sh.x + sh.w - b.w, y: sh.y, w: b.w, h: len };
      s.addShape(pres.ShapeType.rect, { x: IN(r.x), y: IN(r.y), w: IN(r.w), h: IN(r.h), fill: { color: c, transparency: tr }, objectName: name + ' קו' });
    } else {
      const [gx, gy, len, dir] = geo[n];
      const off = (n === 'Top' || n === 'Left') ? b.w / 2 : -b.w / 2;
      const ln = dir === 'h' ? { x: gx, y: gy + off, w: len, h: 0 } : { x: gx + off, y: gy, w: 0, h: len };
      s.addShape(pres.ShapeType.line, { x: IN(ln.x), y: IN(ln.y), w: IN(ln.w), h: IN(ln.h), line: { color: c, width: PT(b.w), transparency: tr, dashType: dash(b.style) }, objectName: name + ' קו' });
    }
  });
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = 'איך מתכננים השפעה';
  pres.subject = 'תהליך מבצעי, שלב אחרי שלב';
  pres.theme = { headFontFace: 'Karantina', bodyFontFace: 'Heebo' };
  pres.defineSlideMaster({ title: 'רקע המצגת', background: { path: path.join(ex, 'bg.jpg') } });
  let lastSec = null;
  const posterData = poster ? 'data:image/jpeg;base64,' + fs.readFileSync(poster).toString('base64') : null;
  for (const d of slides) {
    const sec = d.bare && !d.sec ? 'פתיחה' : (d.sec || 'פתיחה');
    if (sec !== lastSec) { pres.addSection({ title: sec }); lastSec = sec; }
    const s = pres.addSlide({ masterName: 'רקע המצגת', sectionTitle: sec });
    d.shapes.forEach((sh, k) => addShapeItem(pres, s, sh, k + 1));
    for (const im of d.images) {
      if (/ytimg|youtube/.test(im.src) && posterData) {
        // a still frame, not an embedded video: the deck has no motion; a click opens the video in the browser
        s.addImage({ data: posterData, x: IN(im.x), y: IN(im.y), w: IN(im.w), h: IN(im.h), hyperlink: { url: 'https://youtu.be/IHzWOe7K0hY', tooltip: 'אני יצאתי בחמש · יוטיוב' }, altText: 'תמונה מהסרטון ״אני יצאתי בחמש״', objectName: 'תמונה מהסרטון' });
      } else {
        s.addImage({ path: im.src.replace(/^https?:\/\/localhost:\d+\//, ''), x: IN(im.x), y: IN(im.y), w: IN(im.w), h: IN(im.h) });
      }
    }
    (d.crops || []).forEach((c, k) => s.addImage({ path: path.join(ex, c.file), x: IN(c.x), y: IN(c.y), w: IN(c.w), h: IN(c.h), altText: 'גרפיקה', objectName: 'גרפיקה ' + (k + 1) }));
    const head = d.texts.findIndex(t => t.head);
    d.texts.forEach((t, k) => { const r = runs(t); if (r.length) s.addText(r, Object.assign(textBox(t), { objectName: k === head ? 'כותרת השקופית' : 'טקסט ' + (k + 1) })); });
    let notes = d.notes || '';
    if (d.variant === 'video') notes = 'הסרטון ״אני יצאתי בחמש״ (הכל מאבא). הוא לא מוטמע במצגת: לחיצה על התמונה או על הקישור פותחת אותו ביוטיוב. הקישור: https://youtu.be/IHzWOe7K0hY';
    if (notes) s.addNotes(notes);
  }
  await pres.writeFile({ fileName: outFile });
  console.log('wrote', outFile, slides.length, 'slides');
})();
