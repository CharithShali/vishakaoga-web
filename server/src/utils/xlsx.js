// A small Excel (.xlsx) writer with no extra packages.
//
// An .xlsx file is a zip of a few XML files. This writes just what Excel,
// LibreOffice and Google Sheets need for a printable list: a bold title, a
// coloured header row that stays at the top when scrolling and printing,
// column widths, filters, group headings (e.g. "Batch 2004") and a totals row.
//
// Used through utils/report.js, which shares one report definition between
// Excel and PDF.

import zlib from 'node:zlib';

// ---------- zip ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** files: [{ name, data: string|Buffer }] → zip Buffer (deflated) */
export function zip(files, now = new Date()) {
  const { time, day } = dosDateTime(now);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const raw = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const packed = zlib.deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6); // needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    // extra, comment, disk, internal attrs, external attrs = 0
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + packed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// ---------- spreadsheet XML ----------

// Characters XML 1.0 does not allow (control characters) are dropped.
// eslint-disable-next-line no-control-regex
const BAD_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;
const esc = (value) =>
  String(value)
    .replace(BAD_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 0 → A, 25 → Z, 26 → AA */
export function columnLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Style numbers (cellXfs order in STYLES below)
const S = { normal: 0, header: 1, title: 2, subtitle: 3, text: 4, money: 5, totalMoney: 6, totalText: 7, group: 8, number: 9 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="15"/><color rgb="FF14284B"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF5B6472"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF14284B"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF14284B"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEFE8D8"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFE3DCCB"/></bottom><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF14284B"/></top><bottom style="double"><color rgb="FF14284B"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function textCell(ref, value, style) {
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function numberCell(ref, value, style) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return textCell(ref, value, style === S.totalMoney ? S.totalText : S.text);
  }
  return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
}

// Excel sheet names: max 31 characters, none of []:*?/\
export function sheetName(name, used = new Set()) {
  let base = String(name || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * One worksheet.
 * sheet = { title, subtitle, columns: [{ header, width, type }], rows }
 *   type: 'text' (default) | 'money' (numbers shown 1,234.50) | 'number'
 *   rows: arrays of cell values, { heading: 'Batch 2004' } or { totals: [..] }
 */
function sheetXml(sheet) {
  const cols = sheet.columns;
  const lastCol = columnLetter(cols.length - 1);
  const out = [];
  const merges = [];
  let r = 0;

  const row = (cells, attrs = '') => {
    r += 1;
    out.push(`<row r="${r}"${attrs}>${cells(r)}</row>`);
  };

  row((n) => textCell(`A${n}`, sheet.title, S.title), ' ht="22" customHeight="1"');
  merges.push(`A1:${lastCol}1`);
  if (sheet.subtitle) {
    row((n) => textCell(`A${n}`, sheet.subtitle, S.subtitle));
    merges.push(`A${r}:${lastCol}${r}`);
  }
  r += 1; // blank row
  row((n) => cols.map((c, i) => textCell(`${columnLetter(i)}${n}`, c.header, S.header)).join(''), ' ht="20" customHeight="1"');
  const headerRow = r;

  for (const item of sheet.rows) {
    if (item && !Array.isArray(item) && item.heading !== undefined) {
      row((n) => textCell(`A${n}`, item.heading, S.group));
      merges.push(`A${r}:${lastCol}${r}`);
    } else if (item && !Array.isArray(item) && item.totals) {
      row((n) =>
        cols
          .map((c, i) => {
            const ref = `${columnLetter(i)}${n}`;
            return c.type === 'money' ? numberCell(ref, item.totals[i], S.totalMoney) : textCell(ref, item.totals[i], S.totalText);
          })
          .join('')
      );
    } else {
      row((n) =>
        cols
          .map((c, i) => {
            const ref = `${columnLetter(i)}${n}`;
            const v = item[i];
            if (c.type === 'money') return numberCell(ref, v, S.money);
            if (c.type === 'number') return numberCell(ref, v, S.number);
            return textCell(ref, v, S.text);
          })
          .join('')
      );
    }
  }

  const colsXml = cols
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`)
    .join('');
  const lastRow = Math.max(r, headerRow);
  // Filters only make sense on a plain list without group headings / totals.
  const plain = sheet.rows.every((x) => Array.isArray(x));

  return {
    headerRow,
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${colsXml}</cols>
<sheetData>${out.join('')}</sheetData>
${plain && sheet.rows.length ? `<autoFilter ref="A${headerRow}:${lastCol}${lastRow}"/>` : ''}
<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="${sheet.landscape === false ? 'portrait' : 'landscape'}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L${esc(sheet.title)}&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>
</worksheet>`,
    filter: plain && sheet.rows.length ? `A${headerRow}:${lastCol}${lastRow}` : null,
    lastCol,
  };
}

/** sheets: [{ name, title, subtitle, columns, rows, landscape }] → .xlsx Buffer */
export function buildXlsx(sheets, now = new Date()) {
  const used = new Set();
  const names = sheets.map((s) => sheetName(s.name || s.title, used));
  const built = sheets.map(sheetXml);

  const definedNames = built
    .flatMap((b, i) => {
      const quoted = `'${names[i].replace(/'/g, "''")}'`;
      const list = [`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${esc(quoted)}!$${b.headerRow}:$${b.headerRow}</definedName>`];
      if (b.filter) {
        const [from, to] = b.filter.split(':');
        const abs = (ref) => ref.replace(/([A-Z]+)(\d+)/, '$$$1$$$2');
        list.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(quoted)}!${abs(from)}:${abs(to)}</definedName>`);
      }
      return list;
    })
    .join('');

  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
    },
    {
      name: 'docProps/core.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(sheets[0]?.title || 'Vishaka OGA')}</dc:title>
<dc:creator>Vishaka OGA website</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>
</cp:coreProperties>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews>
<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames>${definedNames}</definedNames>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/styles.xml', data: STYLES },
    ...built.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: b.xml })),
  ];
  return zip(files, now);
}
