import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colomboToDate, dateToColombo } from './time.js';

test('Sri Lanka 6:30 pm is 1:00 pm UTC', () => {
  assert.equal(colomboToDate('2026-12-05T18:30').toISOString(), '2026-12-05T13:00:00.000Z');
});

test('early morning in Sri Lanka is the previous day in UTC', () => {
  assert.equal(colomboToDate('2026-12-05T02:00').toISOString(), '2026-12-04T20:30:00.000Z');
});

test('round trip back to the form value', () => {
  assert.equal(dateToColombo(colomboToDate('2027-01-01T00:15')), '2027-01-01T00:15');
});

test('bad input gives null', () => {
  assert.equal(colomboToDate('5 Dec 2026'), null);
  assert.equal(colomboToDate('2026-02-31T10:00'), null);
  assert.equal(colomboToDate(''), null);
});
