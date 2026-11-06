import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRecordMoney, canManageFunds, branchCondition, yearCondition } from './fundPermissions.js';

const KDY = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const COL = 'cccccccccccccccccccccccc';

const admin = { roles: [{ name: 'admin', branch: null }] };
const centralTreasurer = { roles: [{ name: 'treasurer', branch: null }] };
const kandyTreasurer = { roles: [{ name: 'treasurer', branch: KDY }] };
const centralSecretary = { roles: [{ name: 'secretary', branch: null }] };

test('who can record money', () => {
  assert.equal(canRecordMoney(admin, null), true);
  assert.equal(canRecordMoney(centralTreasurer, KDY), true);
  assert.equal(canRecordMoney(centralTreasurer, null), true);
  assert.equal(canRecordMoney(kandyTreasurer, KDY), true);
  assert.equal(canRecordMoney(kandyTreasurer, COL), false);
  assert.equal(canRecordMoney(kandyTreasurer, null), false, 'central money needs a central treasurer');
  assert.equal(canRecordMoney(centralSecretary, KDY), false, 'only treasurers record money');
});

test('who can manage funds', () => {
  assert.equal(canManageFunds(admin), true);
  assert.equal(canManageFunds(centralTreasurer), true);
  assert.equal(canManageFunds(kandyTreasurer), false);
});

test('filters', () => {
  assert.deepEqual(branchCondition(''), {});
  assert.deepEqual(branchCondition('central'), { branch: null });
  assert.deepEqual(branchCondition(KDY), { branch: KDY });
  assert.equal(branchCondition('nope'), null);
  assert.deepEqual(yearCondition('2026'), { date: { $gte: '2026-01-01', $lte: '2026-12-31' } });
  assert.deepEqual(yearCondition('all'), {});
  assert.equal(yearCondition('26'), null);
});
