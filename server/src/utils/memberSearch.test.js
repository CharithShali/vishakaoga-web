import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberSearch } from './memberSearch.js';

test('no search and no role = no extra conditions', () => {
  assert.deepEqual(buildMemberSearch('', ''), { filter: {} });
});

test('a name searches names, member number and email, ignoring case', () => {
  const { filter } = buildMemberSearch('kavindya');
  assert.equal(filter.$or.length, 4);
  assert.ok(filter.$or[0].fullName.test('Kavindya Perera'));
  assert.ok(filter.$or[2].memberNo.test('x kavindya x'));
});

test('a 4-digit year also matches the batch year', () => {
  const { filter } = buildMemberSearch('2016');
  assert.deepEqual(filter.$or.at(-1), { batchYear: 2016 });
});

test('part of a member number works, and special characters are safe', () => {
  const { filter } = buildMemberSearch('OGA-COL-2016');
  assert.ok(filter.$or[2].memberNo.test('OGA-COL-2016-0001'));
  assert.doesNotThrow(() => buildMemberSearch('(a+[b'));
});

test('role filters', () => {
  assert.deepEqual(buildMemberSearch('', 'committee:any').filter, { 'roles.0': { $exists: true } });
  assert.deepEqual(buildMemberSearch('', 'committee:treasurer').filter, { 'roles.name': 'treasurer' });
  assert.deepEqual(buildMemberSearch('', 'school:Prefect').filter, { schoolRoles: 'Prefect' });
  assert.ok(buildMemberSearch('', 'school:Astronaut').error);
  assert.ok(buildMemberSearch('', 'committee:boss').error);
});
