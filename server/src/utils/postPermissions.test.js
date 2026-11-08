import test from 'node:test';
import assert from 'node:assert/strict';
import { canManagePost, canEditHistory, draftCondition } from './postPermissions.js';

const KANDY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const COLOMBO = 'cccccccccccccccccccccccc';
const admin = { roles: [{ name: 'admin', branch: null }] };
const centralSecretary = { roles: [{ name: 'secretary', branch: null }] };
const kandyCoordinator = { roles: [{ name: 'coordinator', branch: KANDY }] };
const treasurer = { roles: [{ name: 'treasurer', branch: null }] };
const member = { roles: [] };

test('who can write posts', () => {
  assert.equal(canManagePost(admin, null), true);
  assert.equal(canManagePost(centralSecretary, null), true);
  assert.equal(canManagePost(centralSecretary, COLOMBO), true);
  assert.equal(canManagePost(kandyCoordinator, KANDY), true);
  assert.equal(canManagePost(kandyCoordinator, COLOMBO), false);
  assert.equal(canManagePost(kandyCoordinator, null), false, 'all-branch posts need a central role');
  assert.equal(canManagePost(treasurer, KANDY), false);
  assert.equal(canManagePost(member, KANDY), false);
});

test('who can edit the history page', () => {
  assert.equal(canEditHistory(admin), true);
  assert.equal(canEditHistory(centralSecretary), true);
  assert.equal(canEditHistory({ roles: [{ name: 'secretary', branch: KANDY }] }), false);
  assert.equal(canEditHistory(kandyCoordinator), false);
});

test('which drafts someone sees', () => {
  assert.deepEqual(draftCondition(centralSecretary), { status: 'draft' });
  assert.deepEqual(draftCondition(kandyCoordinator), { status: 'draft', branch: { $in: [KANDY] } });
  assert.equal(draftCondition(member), null);
  assert.equal(draftCondition(treasurer), null);
});
