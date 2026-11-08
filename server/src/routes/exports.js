import { Router } from 'express';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { Transaction } from '../models/Fund.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isCommittee } from '../utils/permissions.js';
import { scopedBranchFilter } from '../utils/branchFilter.js';
import { canCheckIn } from '../utils/eventPermissions.js';
import { branchCondition, yearCondition } from '../utils/fundPermissions.js';
import { isValidYear } from '../utils/feeReminder.js';
import { FORMATS, sendReport } from '../utils/report.js';
import { loadEvent, attendeeList } from './events.js';
import { feeStatus, FEE_ROLES } from './fees.js';

// Excel and PDF downloads for the committee. ?format=xlsx (default) or pdf.
export const exportsRouter = Router();
exportsRouter.use(requireAuth);

const MEMBER_ROLES = ['secretary', 'coordinator']; // same people who see the member lists
const MAX_ROWS = 5000;

function formatOf(req, res) {
  const format = String(req.query.format || 'xlsx');
  if (!FORMATS.includes(format)) {
    res.status(400).json({ error: 'Choose Excel or PDF.' });
    return null;
  }
  return format;
}

const colomboTime = (d) =>
  d
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(d))
    : '';
const rupees = (cents) => (cents == null ? null : cents / 100);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function branchName(id) {
  if (!id || id === 'central') return id === 'central' ? 'Central' : 'All branches';
  const b = await Branch.findById(id).select('name');
  return b?.name || 'Branch';
}

// ---------- Members, grouped by branch and batch ----------

// GET /api/exports/members?format=&branch=&batch=
exportsRouter.get('/members', requireRole(...MEMBER_ROLES), async (req, res) => {
  const format = formatOf(req, res);
  if (!format) return;
  const scoped = scopedBranchFilter(req.user, MEMBER_ROLES, req.query.branch);
  if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });

  const filter = { status: 'active', ...scoped };
  const batch = req.query.batch ? Number(req.query.batch) : null;
  if (req.query.batch) {
    if (!Number.isInteger(batch)) return res.status(400).json({ error: 'Choose a batch year.' });
    filter.batchYear = batch;
  }

  const [members, branches] = await Promise.all([
    User.find(filter)
      .limit(MAX_ROWS)
      .select('memberNo fullName nameAtSchool batchYear lastClass house schoolRoles phone email currentCity profession branch')
      .lean(),
    Branch.find({}).sort({ order: 1, name: 1 }).select('name').lean(),
  ]);
  const order = new Map(branches.map((b, i) => [String(b._id), i]));
  const nameOf = new Map(branches.map((b) => [String(b._id), b.name]));
  members.sort(
    (a, b) =>
      (order.get(String(a.branch)) ?? 99) - (order.get(String(b.branch)) ?? 99) ||
      (b.batchYear || 0) - (a.batchYear || 0) ||
      a.fullName.localeCompare(b.fullName)
  );

  const rows = [];
  let group = null;
  for (const m of members) {
    const key = `${m.branch}|${m.batchYear || ''}`;
    if (key !== group) {
      group = key;
      const count = members.filter((x) => `${x.branch}|${x.batchYear || ''}` === key).length;
      const year = m.batchYear ? `Batch ${m.batchYear}` : 'Batch not given';
      rows.push({ heading: `${nameOf.get(String(m.branch)) || ''} · ${year} · ${plural(count, 'member')}` });
    }
    const p = m.profession || {};
    rows.push([
      m.memberNo || '',
      m.fullName,
      m.nameAtSchool || '',
      nameOf.get(String(m.branch)) || '',
      m.batchYear || '',
      m.lastClass || '',
      m.house || '',
      (m.schoolRoles || []).join(', '),
      m.phone || '',
      m.email || '',
      m.currentCity || '',
      [p.title || p.category, p.workplace].filter(Boolean).join(', '),
    ]);
  }

  const where = await branchName(req.query.branch);
  const title = `${where} members${batch ? ` · batch ${batch}` : ''}`;
  await sendReport(
    res,
    {
      filename: `${where} members${batch ? ` batch ${batch}` : ''}`,
      title,
      subtitle: `${plural(members.length, 'active member')}, grouped by branch and batch (the year they left school). Contains phone numbers and emails: for the committee only.`,
      columns: [
        { header: 'Member no.', width: 19 },
        { header: 'Name', width: 26 },
        { header: 'Name at school', width: 20 },
        { header: 'Branch', width: 13, pdf: false },
        { header: 'Batch', width: 8, type: 'number', pdf: false },
        { header: 'Class', width: 8 },
        { header: 'House', width: 11 },
        { header: 'Roles at school', width: 24 },
        { header: 'Phone', width: 13 },
        { header: 'Email', width: 26 },
        { header: 'Lives in', width: 13 },
        { header: 'Profession', width: 22 },
      ],
      rows,
    },
    format
  );
});

// ---------- Event attendance ----------

// GET /api/exports/events/:id?format=
exportsRouter.get('/events/:id', async (req, res) => {
  const format = formatOf(req, res);
  if (!format) return;
  const event = await loadEvent(req, res);
  if (!event) return;
  if (!canCheckIn(req.user, event.branch ? event.branch._id : null)) {
    return res.status(403).json({ error: 'This list is for the committee of this branch.' });
  }

  const { attendees, goingCount, attendedCount } = await attendeeList(event);
  const when = colomboTime(event.startsAt);
  await sendReport(
    res,
    {
      filename: `attendance ${event.title}`,
      title: `Attendance · ${event.title}`,
      sheetName: 'Attendance',
      subtitle: `${when} · ${event.venue} · ${event.branch?.name || 'All branches'} · ${goingCount} said attending · ${attendedCount} came`,
      columns: [
        { header: 'Name', width: 28 },
        { header: 'Member no.', width: 19 },
        { header: 'Branch', width: 13 },
        { header: 'Batch', width: 8, type: 'number' },
        { header: 'Said attending', width: 12 },
        { header: 'Came (scanned at)', width: 20 },
        { header: 'Scanned by', width: 20 },
      ],
      rows: attendees.map((a) => [
        a.fullName,
        a.memberNo,
        a.branch,
        a.batchYear || '',
        a.going ? 'Yes' : '',
        a.attendedAt ? colomboTime(a.attendedAt) : 'Did not come',
        a.scannedBy,
      ]),
    },
    format
  );
});

// ---------- Fund statement ----------

// GET /api/exports/funds?format=&branch=&year=   (branch: '', 'central' or an id)
exportsRouter.get('/funds', async (req, res) => {
  const format = formatOf(req, res);
  if (!format) return;
  if (!isCommittee(req.user)) return res.status(403).json({ error: 'Fund statements are for the committee.' });

  const branch = branchCondition(String(req.query.branch || ''));
  const yearText = req.query.year ? String(req.query.year) : String(new Date().getFullYear());
  const year = yearCondition(yearText);
  if (!branch || !year) return res.status(400).json({ error: 'Unknown branch or year.' });

  const records = await Transaction.find({ ...branch, ...year, 'voided.at': null })
    .sort({ date: 1, createdAt: 1 })
    .limit(MAX_ROWS)
    .populate('fund', 'name')
    .populate('branch', 'name')
    .populate('member', 'fullName memberNo')
    .lean();

  let inCents = 0;
  let outCents = 0;
  const rows = records.map((t) => {
    if (t.type === 'in') inCents += t.amountCents;
    else outCents += t.amountCents;
    return [
      t.date,
      t.description + (t.subscriptionYear ? ` (fee for ${t.subscriptionYear})` : ''),
      t.category,
      t.fund?.name || '',
      t.branch?.name || 'Central',
      t.member ? `${t.member.fullName}${t.member.memberNo ? ` (${t.member.memberNo})` : ''}` : '',
      [t.paymentMethod, t.reference].filter(Boolean).join(' · '),
      t.type === 'in' ? rupees(t.amountCents) : null,
      t.type === 'out' ? rupees(t.amountCents) : null,
    ];
  });
  if (records.length) {
    rows.push({ totals: ['', 'Total', '', '', '', '', '', rupees(inCents), rupees(outCents)] });
    rows.push({ totals: ['', 'Money in minus money out', '', '', '', '', '', rupees(inCents - outCents), null] });
  }

  const where = await branchName(req.query.branch);
  const period = yearText === 'all' ? 'all years' : yearText;
  await sendReport(
    res,
    {
      filename: `fund statement ${where} ${period}`,
      title: `Fund statement · ${where} · ${period}`,
      sheetName: 'Fund statement',
      subtitle: `${plural(records.length, 'record')}. Amounts in LKR. Voided (cancelled) records are left out.`,
      columns: [
        { header: 'Date', width: 11 },
        { header: 'Description', width: 34 },
        { header: 'Category', width: 16 },
        { header: 'Fund', width: 16 },
        { header: 'Branch', width: 13 },
        { header: 'Member', width: 26 },
        { header: 'Paid by · Ref', width: 18 },
        { header: 'In (LKR)', width: 14, type: 'money' },
        { header: 'Out (LKR)', width: 14, type: 'money' },
      ],
      rows,
    },
    format
  );
});

// ---------- Membership fees for a year ----------

// GET /api/exports/fees?format=&year=&branch=&show=all|paid|unpaid
exportsRouter.get('/fees', requireRole(...FEE_ROLES), async (req, res) => {
  const format = formatOf(req, res);
  if (!format) return;
  const year = Number(req.query.year || new Date().getFullYear());
  if (!isValidYear(year)) return res.status(400).json({ error: 'Choose a year.' });

  const result = await feeStatus(req.user, { year, branch: req.query.branch, q: '' });
  if (result.error) return res.status(result.status).json({ error: result.error });

  const show = req.query.show;
  const list = result.list
    .filter((m) => (show === 'paid' ? m.paid : show === 'unpaid' ? !m.paid : true))
    .sort((a, b) => (a.branch?.name || '').localeCompare(b.branch?.name || '') || a.fullName.localeCompare(b.fullName));
  const paidCount = list.filter((m) => m.paid).length;
  const where = await branchName(req.query.branch);
  const which = show === 'paid' ? 'paid' : show === 'unpaid' ? 'not paid' : 'all members';

  await sendReport(
    res,
    {
      filename: `membership fees ${year} ${where} ${which}`,
      title: `Membership fees ${year} · ${where} · ${which}`,
      sheetName: `Fees ${year}`,
      subtitle: `${plural(list.length, 'member')}: ${paidCount} paid, ${list.length - paidCount} not paid.`,
      columns: [
        { header: 'Name', width: 28 },
        { header: 'Member no.', width: 19 },
        { header: 'Branch', width: 13 },
        { header: 'Batch', width: 8, type: 'number' },
        { header: 'Phone', width: 13 },
        { header: `Fee ${year}`, width: 10 },
        { header: 'Paid (LKR)', width: 13, type: 'money' },
        { header: 'Paid on', width: 11 },
        { header: 'Reminders sent', width: 12, type: 'number' },
      ],
      rows: list.map((m) => [
        m.fullName,
        m.memberNo,
        m.branch?.name || '',
        m.batchYear || '',
        m.phone,
        m.paid ? 'Paid' : 'Not paid',
        m.paid ? rupees(m.paidCents) : null,
        m.paidDate || '',
        m.reminderCount || '',
      ]),
    },
    format
  );
});
