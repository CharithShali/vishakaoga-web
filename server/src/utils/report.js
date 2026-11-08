// One report definition → an Excel file or a PDF.
//
// report = {
//   filename: 'kandy-members',          (no extension)
//   title, subtitle, landscape,
//   columns: [{ header, width, type: 'text'|'money'|'number', pdf: false, align }],
//   rows: arrays of raw values, { heading: 'Batch 2004' } or { totals: [...] },
//   note: optional text under the PDF table
// }
// Money values are plain rupee numbers (e.g. 1500.5): Excel keeps them as
// numbers you can add up; the PDF shows "1,500.50".

import { buildXlsx } from './xlsx.js';
import { buildTablePdf } from './pdfTable.js';

export const FORMATS = ['xlsx', 'pdf'];

const money = (v) =>
  v === null || v === undefined || v === ''
    ? ''
    : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function forPdf(report) {
  const columns = report.columns.map((c) => ({ ...c, align: c.align || (c.type === 'money' ? 'right' : 'left') }));
  const show = (c, v) => (c.type === 'money' ? money(v) : v === null || v === undefined ? '' : String(v));
  const rows = report.rows.map((item) => {
    if (Array.isArray(item)) return item.map((v, i) => show(columns[i], v));
    if (item.totals) return { totals: item.totals.map((v, i) => show(columns[i], v)) };
    return item;
  });
  return { ...report, columns, rows };
}

// "Kandy members, batch 2004!" → "kandy-members-batch-2004"
export function fileSlug(text) {
  return (
    String(text)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'list'
  );
}

/** Build the file. Returns { buffer, contentType, filename }. */
export async function renderReport(report, format) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
  const base = `${fileSlug(report.filename || report.title)}-${date}`;
  if (format === 'pdf') {
    const generated = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Colombo',
    }).format(new Date());
    const buffer = await buildTablePdf({ ...forPdf(report), footer: `Visakha OGA · made ${generated}` });
    return { buffer, contentType: 'application/pdf', filename: `${base}.pdf` };
  }
  const buffer = buildXlsx([{ ...report, name: report.sheetName || report.title }]);
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${base}.xlsx`,
  };
}

/** Build and send as a download. */
export async function sendReport(res, report, format) {
  const { buffer, contentType, filename } = await renderReport(report, format);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}
