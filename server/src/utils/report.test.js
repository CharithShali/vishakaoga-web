import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { renderReport, fileSlug } from './report.js';
import { columnLetter, sheetName } from './xlsx.js';
import { pdfSafe } from './pdfTable.js';

const report = {
  filename: 'Kandy members',
  title: 'Kandy members',
  subtitle: 'Active members, by batch',
  columns: [
    { header: 'Member no.', width: 18 },
    { header: 'Name', width: 28 },
    { header: 'Batch', width: 8, type: 'number' },
    { header: 'Paid (LKR)', width: 12, type: 'money' },
  ],
  rows: [
    { heading: 'Batch 2004 · 2 members' },
    ['OGA-KDY-2004-0001', 'Nimali Perera & <Co>', 2004, 1500],
    ['OGA-KDY-2004-0002', 'සිංහල නම', 2004, null],
    { totals: ['', 'Total', '', 1500] },
  ],
};

// Read one file out of the zip (enough for this test: no zip64, deflate only).
function unzip(buf, wanted) {
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extra = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString();
    const start = i + 30 + nameLen + extra;
    if (name === wanted) return zlib.inflateRawSync(buf.subarray(start, start + size)).toString();
    i = start + size;
  }
  return null;
}

test('Excel file is a zip with the rows, escaped', async () => {
  const { buffer, filename, contentType } = await renderReport(report, 'xlsx');
  assert.match(filename, /^kandy-members-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.match(contentType, /spreadsheetml/);
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);
  const sheet = unzip(buffer, 'xl/worksheets/sheet1.xml');
  assert.ok(sheet.includes('Nimali Perera &amp; &lt;Co&gt;'));
  assert.ok(sheet.includes('සිංහල නම'));
  assert.ok(sheet.includes('<v>1500</v>'));
  assert.ok(unzip(buffer, 'xl/workbook.xml').includes('name="Kandy members"'));
});

test('PDF is made', async () => {
  const { buffer, filename } = await renderReport(report, 'pdf');
  assert.match(filename, /\.pdf$/);
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
});

test('helpers', () => {
  assert.equal(columnLetter(0), 'A');
  assert.equal(columnLetter(25), 'Z');
  assert.equal(columnLetter(26), 'AA');
  const used = new Set();
  assert.equal(sheetName('Kandy: batch [2004]?', used), 'Kandy  batch  2004');
  assert.equal(sheetName('Kandy: batch [2004]?', used), 'Kandy  batch  2004 (2)');
  assert.equal(pdfSafe('Āyusha – “OGA”'), 'Ayusha – “OGA”');
  assert.equal(pdfSafe('නම'), '??');
  assert.equal(fileSlug('Batch 2004 · Kandy!'), 'batch-2004-kandy');
});
