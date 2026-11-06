import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageEvent, canCheckIn, normaliseMemberNo } from './eventPermissions.js';

const KDY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const COL = 'cccccccccccccccccccccccc';

const admin = { roles: [{ name: 'admin', branch: null }] };
const centralSecretary = { roles: [{ name: 'secretary', branch: null }] };
const kandyCoordinator = { roles: [{ name: 'coordinator', branch: KDY }] };
const colomboHelper = { roles: [{ name: 'eventHelper', branch: COL }] };
const member = { roles: [] };

test('managing events', () => {
  assert.equal(canManageEvent(admin, null), true);
  assert.equal(canManageEvent(centralSecretary, null), true);
  assert.equal(canManageEvent(centralSecretary, KDY), true);
  assert.equal(canManageEvent(kandyCoordinator, KDY), true);
  assert.equal(canManageEvent(kandyCoordinator, COL), false);
  assert.equal(canManageEvent(kandyCoordinator, null), false, 'joint events need a central role');
  assert.equal(canManageEvent(colomboHelper, COL), false, 'helpers scan, they do not create');
  assert.equal(canManageEvent(member, KDY), false);
});

test('scanning at the gate', () => {
  assert.equal(canCheckIn(colomboHelper, COL), true);
  assert.equal(canCheckIn(colomboHelper, KDY), false);
  assert.equal(canCheckIn(colomboHelper, null), true, 'any helper can scan at joint events');
  assert.equal(canCheckIn(kandyCoordinator, { _id: KDY, name: 'Kandy' }), true);
  assert.equal(canCheckIn(member, null), false);
});

test('member numbers from QR or typing are tidied', () => {
  assert.equal(normaliseMemberNo(' oga-col-2016-0001 '), 'OGA-COL-2016-0001');
  assert.equal(normaliseMemberNo('OGA - COL - 2016 - 0001'), 'OGA-COL-2016-0001');
});
