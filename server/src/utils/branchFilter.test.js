import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopedBranchFilter } from './branchFilter.js';
import { formatMemberNo } from './memberNo.js';

const KDY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const COL = 'cccccccccccccccccccccccc';
const VIEW = ['secretary', 'coordinator'];

const admin = { roles: [{ name: 'admin', branch: null }] };
const kandyCoordinator = { roles: [{ name: 'coordinator', branch: KDY }] };

test('central roles see all branches, or one if asked', () => {
  assert.deepEqual(scopedBranchFilter(admin, VIEW), {});
  assert.deepEqual(scopedBranchFilter(admin, VIEW, COL), { branch: COL });
});

test('a branch coordinator is limited to her branch', () => {
  assert.deepEqual(scopedBranchFilter(kandyCoordinator, VIEW), { branch: { $in: [KDY] } });
  assert.deepEqual(scopedBranchFilter(kandyCoordinator, VIEW, KDY), { branch: KDY });
  assert.equal(scopedBranchFilter(kandyCoordinator, VIEW, COL).status, 403);
});

test('rejects a branch id that is not an id', () => {
  assert.equal(scopedBranchFilter(admin, VIEW, 'nope').status, 400);
});

test('member numbers carry branch, batch and a padded running number', () => {
  assert.equal(formatMemberNo('kdy', 2004, 12), 'OGA-KDY-2004-0012');
  assert.equal(formatMemberNo('COL', undefined, 7), 'OGA-COL-0000-0007');
});
