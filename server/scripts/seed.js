// Creates the three branches and the first main admin.
// Safe to run more than once: existing records are left as they are.
//
//   npm run seed         branches + admin
//   npm run seed:demo    also adds test members (never on the live site)

import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Branch } from '../src/models/Branch.js';
import { User } from '../src/models/User.js';
import { nextSequence } from '../src/models/Counter.js';
import { Event } from '../src/models/Event.js';
import { Fund, Transaction } from '../src/models/Fund.js';
import { todayInColombo } from '../src/utils/money.js';
import { formatMemberNo } from '../src/utils/memberNo.js';

const BRANCHES = [
  { name: 'Kandy', code: 'KDY', order: 1 },
  { name: 'Bandarawela', code: 'BDW', order: 2 },
  { name: 'Colombo', code: 'COL', order: 3 },
];

const withDemo = process.argv.includes('--demo');

async function seedBranches() {
  for (const b of BRANCHES) {
    await Branch.updateOne({ code: b.code }, { $setOnInsert: b }, { upsert: true });
  }
  const all = await Branch.find().sort({ order: 1 });
  console.log(`Branches: ${all.map((b) => `${b.name} (${b.code})`).join(', ')}`);
  return Object.fromEntries(all.map((b) => [b.code, b]));
}

// The three starting funds (only when there are none yet).
async function seedFunds() {
  if (await Fund.exists({})) return;
  await Fund.create([
    { name: 'General fund', description: 'Events, meetings and running costs of the association.', order: 1 },
    { name: 'Scholarship fund', description: 'Support for students at all three branches who need help.', order: 2 },
    { name: 'School project fund', description: 'The current school project. Edit this to describe it.', order: 3 },
  ]);
  console.log('Funds created: General, Scholarship, School project');
}

async function seedAdmin(branchesByCode) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env: no admin created.');
    return;
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');

  const code = (process.env.ADMIN_BRANCH || 'COL').toUpperCase();
  const branch = branchesByCode[code];
  if (!branch) throw new Error(`ADMIN_BRANCH "${code}" is not one of KDY, BDW, COL.`);

  const existing = await User.findOne({ email });
  if (existing) {
    if (!existing.roles.some((r) => r.name === 'admin')) {
      existing.roles.push({ name: 'admin', branch: null });
    }
    existing.status = 'active';
    await existing.save();
    console.log(`Admin ${email} already exists (password not changed).`);
    return;
  }

  await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    fullName: process.env.ADMIN_NAME || 'OGA Admin',
    branch: branch._id,
    status: 'active',
    roles: [{ name: 'admin', branch: null }],
  });
  console.log(`Created main admin: ${email}`);
}

async function seedDemo(branchesByCode) {
  if (env.isProd) {
    console.log('Skipping demo members: NODE_ENV is production.');
    return;
  }
  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'demo-pass-123', 12);
  const demo = [
    {
      email: 'kandy.member@demo.lk',
      fullName: 'Kandy Member',
      code: 'KDY',
      batchYear: 2004,
      profession: { category: 'Medicine & health', title: 'Doctor', workplace: 'Demo Hospital' },
    },
    {
      email: 'bdw.member@demo.lk',
      fullName: 'Bandarawela Member',
      code: 'BDW',
      batchYear: 2010,
      profession: { category: 'Education', title: 'Teacher' },
    },
    {
      email: 'col.member@demo.lk',
      fullName: 'Colombo Member',
      code: 'COL',
      batchYear: 1998,
      profession: { category: 'IT & technology', title: 'Software engineer' },
    },
    {
      email: 'kandy.coordinator@demo.lk',
      fullName: 'Kandy Coordinator',
      code: 'KDY',
      batchYear: 1995,
      roles: [{ name: 'coordinator', code: 'KDY' }],
    },
    {
      email: 'secretary@demo.lk',
      fullName: 'Central Secretary',
      code: 'COL',
      batchYear: 1990,
      roles: [{ name: 'secretary', code: null }],
    },
    {
      email: 'treasurer@demo.lk',
      fullName: 'Kandy Treasurer',
      code: 'KDY',
      batchYear: 2001,
      roles: [{ name: 'treasurer', code: 'KDY' }],
    },
    {
      email: 'helper@demo.lk',
      fullName: 'Colombo Event Helper',
      code: 'COL',
      batchYear: 2012,
      roles: [{ name: 'eventHelper', code: 'COL' }],
    },
  ];

  for (const d of demo) {
    const existing = await User.findOne({ email: d.email });
    if (existing) {
      // Older demo members had no member number, so they couldn't be scanned.
      if (!existing.memberNo) {
        const seq = await nextSequence(`member-${d.code}`);
        existing.memberNo = formatMemberNo(d.code, d.batchYear, seq);
        await existing.save();
      }
      continue;
    }
    const seq = await nextSequence(`member-${d.code}`);
    await User.create({
      memberNo: formatMemberNo(d.code, d.batchYear, seq),
      email: d.email,
      passwordHash,
      fullName: d.fullName,
      branch: branchesByCode[d.code]._id,
      batchYear: d.batchYear,
      profession: d.profession || {},
      status: 'active',
      roles: (d.roles || []).map((r) => ({
        name: r.name,
        branch: r.code ? branchesByCode[r.code]._id : null,
      })),
    });
  }
  console.log(`Demo members ready (password: DEMO_PASSWORD from .env, default demo-pass-123):`);
  for (const d of demo) {
    const u = await User.findOne({ email: d.email }).select('memberNo');
    console.log(`  ${d.email}  ${u?.memberNo || ''}`);
  }

  // A few events to try the Events page and the gate scanner with.
  if (!(await Event.exists({}))) {
    const hour = 60 * 60 * 1000;
    const now = Date.now();
    await Event.create([
      {
        title: 'Annual OGA Get-Together (demo)',
        kind: 'Get-together',
        venue: 'School main hall, Colombo',
        description: 'Happening now, so you can test scanning cards at the gate.',
        branch: null,
        startsAt: new Date(now - hour),
        endsAt: new Date(now + 3 * hour),
      },
      {
        title: 'OGA vs School netball match (demo)',
        kind: 'Sport',
        venue: 'School grounds, Kandy',
        branch: branchesByCode.KDY._id,
        startsAt: new Date(now + 10 * 24 * hour),
        endsAt: new Date(now + 10 * 24 * hour + 3 * hour),
      },
      {
        title: 'Batch 2010 reunion (demo)',
        kind: 'Reunion',
        venue: 'Bandarawela',
        branch: branchesByCode.BDW._id,
        startsAt: new Date(now - 30 * 24 * hour),
        endsAt: new Date(now - 30 * 24 * hour + 4 * hour),
      },
    ]);
    console.log('Demo events created (one is happening now, for testing the scanner).');
  }

  // A few money records to try the Funds page with.
  if (!(await Transaction.exists({})) && (await User.exists({ 'roles.name': 'admin' }))) {
    const funds = Object.fromEntries((await Fund.find()).map((f) => [f.name, f._id]));
    const admin = await User.findOne({ 'roles.name': 'admin' });
    const kandyMember = await User.findOne({ email: 'kandy.member@demo.lk' });
    const today = todayInColombo();
    const year = Number(today.slice(0, 4));
    const day = (n) => `${year}-${String(n).padStart(2, '0')}`;
    const base = { recordedBy: admin._id, fund: funds['General fund'] };
    await Transaction.create([
      { ...base, date: `${day(1)}-15`, type: 'in', amountCents: 150000, category: 'Membership fee', description: 'Membership fee', branch: branchesByCode.KDY._id, member: kandyMember._id, subscriptionYear: year, reference: 'R-001' },
      { ...base, date: `${day(2)}-02`, type: 'in', amountCents: 2500000, category: 'Donation', description: 'Donation from Batch 1998', branch: branchesByCode.COL._id, fund: funds['Scholarship fund'] },
      { ...base, date: `${day(3)}-10`, type: 'out', amountCents: 1200000, category: 'Scholarship', description: 'Scholarships for 4 students', branch: branchesByCode.COL._id, fund: funds['Scholarship fund'] },
      { ...base, date: `${day(4)}-20`, type: 'in', amountCents: 800000, category: 'Event income', description: 'Get-together tickets', branch: null },
      { ...base, date: `${day(4)}-21`, type: 'out', amountCents: 650000, category: 'Event costs', description: 'Get-together venue and food', branch: null },
      { ...base, date: `${day(5)}-05`, type: 'out', amountCents: 500000, category: 'Running costs', description: 'Website domain (.lk) for the year', branch: null, paymentMethod: 'Bank transfer' },
    ]);
    console.log('Demo money records created. treasurer@demo.lk is the Kandy treasurer.');
  }
}

try {
  await connectDb();
  const branchesByCode = await seedBranches();
  await seedFunds();
  await seedAdmin(branchesByCode);
  if (withDemo) await seedDemo(branchesByCode);
  console.log('Seed finished.');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
