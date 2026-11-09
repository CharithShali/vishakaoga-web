import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidBranchCode, changeMemberNoCode } from './memberNo.js';

test('branch codes', () => {
  for (const ok of ['KDY', 'VVK', 'CM', 'CMB2', 'ABCDE']) assert.equal(isValidBranchCode(ok), true, ok);
  for (const bad of ['', 'K', 'kdy', '2KD', 'ABCDEF', 'K-D', 'K D']) assert.equal(isValidBranchCode(bad), false, bad);
});

test('member numbers get the new code', () => {
  assert.equal(changeMemberNoCode('OGA-KDY-2004-0012', 'KDY', 'KAN'), 'OGA-KAN-2004-0012');
  assert.equal(changeMemberNoCode('OGA-COL-2004-0012', 'KDY', 'KAN'), 'OGA-COL-2004-0012');
  assert.equal(changeMemberNoCode('OGA-KDYX-2004-0012', 'KDY', 'KAN'), 'OGA-KDYX-2004-0012');
  assert.equal(changeMemberNoCode(null, 'KDY', 'KAN'), null);
});
