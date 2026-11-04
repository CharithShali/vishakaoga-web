import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRole, branchScope, isCommittee, isAdmin } from './permissions.js';

const KDY = 'kdy-id';
const COL = 'col-id';

const member = { roles: [] };
const admin = { roles: [{ name: 'admin', branch: null }] };
const centralSecretary = { roles: [{ name: 'secretary', branch: null }] };
const kandyCoordinator = { roles: [{ name: 'coordinator', branch: KDY }] };
const populatedRole = { roles: [{ name: 'treasurer', branch: { _id: COL, name: 'Colombo' } }] };

test('plain members have no committee rights', () => {
  assert.equal(hasRole(member, ['secretary']), false);
  assert.equal(isCommittee(member), false);
  assert.deepEqual(branchScope(member, ['secretary']), []);
});

test('the main admin can do everything, everywhere', () => {
  assert.equal(hasRole(admin, ['treasurer'], KDY), true);
  assert.equal(branchScope(admin, ['coordinator']), 'all');
  assert.equal(isAdmin(admin), true);
});

test('a role without a branch covers all branches', () => {
  assert.equal(hasRole(centralSecretary, ['secretary'], KDY), true);
  assert.equal(hasRole(centralSecretary, ['secretary'], COL), true);
  assert.equal(branchScope(centralSecretary, ['secretary']), 'all');
  assert.equal(hasRole(centralSecretary, ['treasurer']), false);
});

test('a branch role only covers its own branch', () => {
  assert.equal(hasRole(kandyCoordinator, ['coordinator'], KDY), true);
  assert.equal(hasRole(kandyCoordinator, ['coordinator'], COL), false);
  assert.equal(hasRole(kandyCoordinator, ['coordinator']), true);
  assert.deepEqual(branchScope(kandyCoordinator, ['coordinator', 'secretary']), [KDY]);
  assert.equal(isAdmin(kandyCoordinator), false);
});

test('works when the role branch has been populated', () => {
  assert.equal(hasRole(populatedRole, ['treasurer'], COL), true);
  assert.equal(hasRole(populatedRole, ['treasurer'], KDY), false);
  assert.deepEqual(branchScope(populatedRole, ['treasurer']), [COL]);
});
