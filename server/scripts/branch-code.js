// Change a branch's short code (used in member numbers), e.g. KDY → VVK.
//
//   npm run branch-code                      list the branches and their codes
//   npm run branch-code -- KDY VVK           show what would change (nothing is saved)
//   npm run branch-code -- KDY VVK --yes     change it
//
// Updates the branch, every member number of that branch (OGA-KDY-2004-0012 →
// OGA-VVK-2004-0012) and the counter for the next new member number.
// Cards on phones and the website show the new number straight away (the QR code
// is made from it). Card pictures saved or printed before the change keep the
// old number, so they no longer scan: best done before the site goes live.

import { connectDb, disconnectDb } from '../src/db.js';
import { Branch } from '../src/models/Branch.js';
import { User } from '../src/models/User.js';
import { Counter } from '../src/models/Counter.js';
import { isValidBranchCode, changeMemberNoCode } from '../src/utils/memberNo.js';

const [oldArg, newArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--yes');

async function run() {
  const branches = await Branch.find().sort({ order: 1 });
  if (!oldArg || !newArg) {
    console.log('Branches and their codes:');
    for (const b of branches) console.log(`  ${b.code.padEnd(6)} ${b.name}`);
    console.log('\nTo change one:  npm run branch-code -- OLD NEW   (then again with --yes)');
    return;
  }

  const oldCode = oldArg.trim().toUpperCase();
  const newCode = newArg.trim().toUpperCase();
  const branch = branches.find((b) => b.code === oldCode);
  if (!branch) throw new Error(`No branch has the code ${oldCode}. Run "npm run branch-code" to see the codes.`);
  if (!isValidBranchCode(newCode)) throw new Error(`"${newCode}" can't be used: 2 to 5 capital letters or digits, starting with a letter.`);
  if (newCode === oldCode) throw new Error('That is already the code.');
  if (branches.some((b) => b.code === newCode)) throw new Error(`Another branch already uses ${newCode}.`);

  const members = await User.find({ memberNo: { $regex: `^OGA-${oldCode}-` } }).select('memberNo fullName');
  const clashes = await User.countDocuments({ memberNo: { $regex: `^OGA-${newCode}-` } });
  if (clashes) throw new Error(`${clashes} member number(s) already start with OGA-${newCode}-. Choose another code.`);

  console.log(`${branch.name}: ${oldCode} → ${newCode}`);
  console.log(`Member numbers to change: ${members.length}`);
  for (const m of members.slice(0, 5)) {
    console.log(`  ${m.memberNo} → ${changeMemberNoCode(m.memberNo, oldCode, newCode)}  (${m.fullName})`);
  }
  if (members.length > 5) console.log(`  … and ${members.length - 5} more`);

  if (!apply) {
    console.log('\nNothing was changed. Run the same command with --yes to make the change.');
    return;
  }

  if (members.length) {
    await User.bulkWrite(
      members.map((m) => ({
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { memberNo: changeMemberNoCode(m.memberNo, oldCode, newCode) } },
        },
      }))
    );
  }

  // Keep counting from where the branch was, so numbers are never reused.
  const counter = await Counter.findById(`member-${oldCode}`);
  if (counter) {
    await Counter.updateOne({ _id: `member-${newCode}` }, { $max: { seq: counter.seq } }, { upsert: true });
    await Counter.deleteOne({ _id: `member-${oldCode}` });
  }

  branch.code = newCode;
  await branch.save();
  console.log(`\nDone. ${branch.name} is now ${newCode}; ${members.length} member number(s) updated.`);
}

try {
  await connectDb();
  await run();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
