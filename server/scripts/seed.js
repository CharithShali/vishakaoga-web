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
    { email: 'kandy.member@demo.lk', fullName: 'Kandy Member', code: 'KDY', batchYear: 2004 },
    { email: 'bdw.member@demo.lk', fullName: 'Bandarawela Member', code: 'BDW', batchYear: 2010 },
    { email: 'col.member@demo.lk', fullName: 'Colombo Member', code: 'COL', batchYear: 1998 },
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
  ];

  for (const d of demo) {
    if (await User.exists({ email: d.email })) continue;
    await User.create({
      email: d.email,
      passwordHash,
      fullName: d.fullName,
      branch: branchesByCode[d.code]._id,
      batchYear: d.batchYear,
      status: 'active',
      roles: (d.roles || []).map((r) => ({
        name: r.name,
        branch: r.code ? branchesByCode[r.code]._id : null,
      })),
    });
  }
  console.log(`Demo members ready (password: DEMO_PASSWORD from .env, default demo-pass-123):`);
  for (const d of demo) console.log(`  ${d.email}`);
}

try {
  await connectDb();
  const branchesByCode = await seedBranches();
  await seedAdmin(branchesByCode);
  if (withDemo) await seedDemo(branchesByCode);
  console.log('Seed finished.');
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
