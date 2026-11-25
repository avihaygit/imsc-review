# HTML deck → PDF and editable PowerPoint

- `pdf.js <deck dir> <out dir>`: one vector PDF page per slide (final state); merge with `pdfunite`.
- `extract.js <deck dir> <ex dir>`: reads every slide from the browser (static mode, served over http):
  native text and boxes go to `slides.json`, everything else to a transparent 2x capture per slide.
- `cut.py <ex dir>`: cuts each capture into its separate pictures.
- `build.js <ex dir> <raw.pptx> <poster.jpg>`: pptxgenjs build (run from the deck dir; needs `bg.jpg` in ex dir).
- `fix.py <raw.pptx> <out.pptx>`: one `<a:pPr>` per paragraph, `rtl="1"` for Hebrew, hollow outlined text,
  slide titles as title placeholders, no folder entries in the ZIP.

Fonts: static Heebo weights made from `Heebo[wght].ttf` with fontTools (`instantiateVariableFont`, `updateFontNames=True`).
