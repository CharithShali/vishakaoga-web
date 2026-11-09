// Printable PDF lists (members by batch, attendance, fund statements) with pdf-lib.
//
// A4, landscape by default. Each page repeats the title and the table header;
// long text wraps inside its column; every page has "Page X of Y" at the bottom.
// Used through utils/report.js, which shares one report definition with Excel.
//
// The built-in PDF fonts only cover Latin letters, so letters they can't show
// (e.g. Sinhala or Tamil script) print as "?". Accents are kept where possible
// and otherwise dropped (ā → a).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const NAVY = rgb(0x14 / 255, 0x28 / 255, 0x4b / 255);
const INK = rgb(0x1b / 255, 0x22 / 255, 0x30 / 255);
const MUTED = rgb(0x5b / 255, 0x64 / 255, 0x72 / 255);
const SAND = rgb(0xef / 255, 0xe8 / 255, 0xd8 / 255);
const STRIPE = rgb(0xfa / 255, 0xf8 / 255, 0xf3 / 255);
const LINE = rgb(0xe3 / 255, 0xdc / 255, 0xcb / 255);
const GOLD = rgb(0xc9 / 255, 0xa2 / 255, 0x27 / 255);
const WHITE = rgb(1, 1, 1);

const A4 = [595.28, 841.89];
const MARGIN = 36;
const FONT_SIZE = 8.5;
const LINE_HEIGHT = 10.5;
const PAD = 4;
const MAX_LINES = 4;

// Characters outside Latin-1 that the standard fonts (WinAnsi) can still print.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Make text printable with the standard PDF fonts. */
export function pdfSafe(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/[\t\r]+/g, ' ');
  text = text.replace(/[^\n -~ -ÿ]/g, (ch) => {
    if (WIN_ANSI_EXTRA.has(ch)) return ch;
    const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /^[ -~ -ÿ]+$/.test(plain) ? plain : '?';
  });
  return text;
}

// Split text into lines that fit `width`, breaking very long words too.
function wrap(text, font, size, width) {
  const lines = [];
  for (const paragraph of pdfSafe(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryLine, size) <= width) {
        line = tryLine;
        continue;
      }
      if (line) lines.push(line);
      // A word wider than the column: cut it into pieces.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

function clampLines(lines, font, size, width) {
  if (lines.length <= MAX_LINES) return lines;
  const kept = lines.slice(0, MAX_LINES);
  let last = `${kept[MAX_LINES - 1]}…`;
  while (last.length > 1 && font.widthOfTextAtSize(last, size) > width) last = `${last.slice(0, -2)}…`;
  kept[MAX_LINES - 1] = last;
  return kept;
}

/**
 * Column widths from the content: every column gets at least its longest word
 * (so member numbers and emails don't break), then spare room goes to the
 * columns with longer text, so names and notes wrap less.
 */
function fitColumns(cols, rows, font, bold, usable) {
  const measure = (f, s) => f.widthOfTextAtSize(pdfSafe(s), FONT_SIZE);
  const stats = cols.map((c) => {
    let word = Math.max(...pdfSafe(c.header).split(/\s+/).map((w) => measure(bold, w)));
    let full = measure(bold, c.header);
    for (const item of rows) {
      const values = Array.isArray(item) ? item : item?.totals;
      if (!values) continue;
      const text = pdfSafe(values[c.index] ?? '');
      full = Math.max(full, measure(font, text));
      for (const w of text.split(/\s+/)) word = Math.max(word, measure(font, w));
    }
    const min = Math.min(word, usable * 0.25) + PAD * 2;
    const natural = Math.max(min, Math.min(full, usable * 0.4) + PAD * 2);
    return { min, natural, weight: c.width || 10 };
  });

  const sumOf = (key) => stats.reduce((n, s) => n + s[key], 0);
  const naturalSum = sumOf('natural');
  const minSum = sumOf('min');
  if (naturalSum <= usable) {
    const weights = sumOf('weight');
    return stats.map((s) => s.natural + ((usable - naturalSum) * s.weight) / weights);
  }
  if (minSum <= usable) {
    const slack = naturalSum - minSum;
    return stats.map((s) => s.min + ((usable - minSum) * (s.natural - s.min)) / slack);
  }
  return stats.map((s) => (s.min * usable) / minSum);
}

/**
 * report = {
 *   title, subtitle, landscape (default true), footer (left text),
 *   columns: [{ header, width (relative), align: 'left'|'right', pdf: false to hide }],
 *   rows: arrays of display strings, { heading } or { totals: [...] },
 *   note: optional text printed after the table
 * }
 * Returns a Buffer.
 */
export async function buildTablePdf(report) {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(report.title));
  doc.setCreator('Vishaka OGA website');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const [pageW, pageH] = report.landscape === false ? A4 : [A4[1], A4[0]];
  const usable = pageW - MARGIN * 2;

  const shown = report.columns.map((c, i) => ({ ...c, index: i })).filter((c) => c.pdf !== false);
  const widths = fitColumns(shown, report.rows, font, bold, usable);
  let x = MARGIN;
  const cols = shown.map((c, i) => {
    const w = widths[i];
    const col = { ...c, x, w, inner: w - PAD * 2 };
    x += w;
    return col;
  });

  let page;
  let y;

  const textAt = (str, colOrX, top, f, size, color, align = 'left', width = 0) => {
    const s = pdfSafe(str);
    let tx = colOrX;
    if (align === 'right') tx = colOrX + width - f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: tx, y: top - size, size, font: f, color });
  };

  function headerRowHeight() {
    const lines = cols.map((c) => wrap(c.header, bold, FONT_SIZE, c.inner).length);
    return Math.max(...lines) * LINE_HEIGHT + PAD * 2;
  }

  function newPage(first) {
    page = doc.addPage([pageW, pageH]);
    y = pageH - MARGIN;
    // Gold rule and title
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 46, height: 3, color: GOLD });
    y -= 12;
    textAt(report.title, MARGIN, y, bold, first ? 15 : 11, NAVY);
    y -= first ? 19 : 14;
    if (report.subtitle && first) {
      for (const line of wrap(report.subtitle, font, 9.5, usable)) {
        textAt(line, MARGIN, y, font, 9.5, MUTED);
        y -= 12;
      }
    }
    y -= 6;
    // Table header
    const h = headerRowHeight();
    page.drawRectangle({ x: MARGIN, y: y - h, width: usable, height: h, color: NAVY });
    for (const c of cols) {
      wrap(c.header, bold, FONT_SIZE, c.inner).forEach((line, i) => {
        textAt(line, c.x + PAD, y - PAD - i * LINE_HEIGHT, bold, FONT_SIZE, WHITE, c.align, c.inner);
      });
    }
    y -= h;
  }

  const bottom = MARGIN + 18; // room for the footer
  newPage(true);

  let stripe = false;
  for (const item of report.rows) {
    if (item && !Array.isArray(item) && item.heading !== undefined) {
      const h = LINE_HEIGHT + PAD * 2 + 2;
      // Keep a heading with at least one row under it.
      if (y - h - (LINE_HEIGHT + PAD * 2) < bottom) newPage(false);
      page.drawRectangle({ x: MARGIN, y: y - h, width: usable, height: h, color: SAND });
      textAt(item.heading, MARGIN + PAD, y - PAD - 1, bold, 9.5, NAVY);
      y -= h;
      stripe = false;
      continue;
    }

    const isTotal = item && !Array.isArray(item) && item.totals;
    const values = isTotal ? item.totals : item;
    const f = isTotal ? bold : font;
    const cells = cols.map((c) => clampLines(wrap(values[c.index] ?? '', f, FONT_SIZE, c.inner), f, FONT_SIZE, c.inner));
    const h = Math.max(1, ...cells.map((l) => l.length)) * LINE_HEIGHT + PAD * 2;

    if (y - h < bottom) newPage(false);
    if (isTotal) {
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + usable, y }, thickness: 1, color: NAVY });
    } else if (stripe) {
      page.drawRectangle({ x: MARGIN, y: y - h, width: usable, height: h, color: STRIPE });
    }
    cols.forEach((c, ci) => {
      cells[ci].forEach((line, li) => {
        textAt(line, c.x + PAD, y - PAD - li * LINE_HEIGHT, f, FONT_SIZE, isTotal ? NAVY : INK, c.align, c.inner);
      });
    });
    y -= h;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + usable, y }, thickness: 0.5, color: LINE });
    stripe = !stripe;
  }

  if (report.rows.length === 0) {
    y -= 8;
    textAt('Nothing to list.', MARGIN + PAD, y, font, 10, MUTED);
    y -= 14;
  }

  if (report.note) {
    y -= 10;
    for (const line of wrap(report.note, font, 8.5, usable)) {
      if (y - LINE_HEIGHT < bottom) newPage(false);
      textAt(line, MARGIN, y, font, 8.5, MUTED);
      y -= LINE_HEIGHT;
    }
  }

  // Footer on every page, now that the page count is known.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    const label = `Page ${i + 1} of ${pages.length}`;
    textAt(report.footer || 'Vishaka OGA', MARGIN, MARGIN, font, 8, MUTED);
    textAt(label, MARGIN, MARGIN, font, 8, MUTED, 'right', usable);
  });

  return Buffer.from(await doc.save());
}
