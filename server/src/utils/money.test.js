import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, centsToText, isValidDate, todayInColombo } from './money.js';

test('amounts become whole cents', () => {
  assert.equal(toCents('5000'), 500000);
  assert.equal(toCents('5,000.50'), 500050);
  assert.equal(toCents('0.1'), 10);
  assert.equal(toCents(1250.75), 125075);
});

test('bad amounts are refused', () => {
  for (const bad of ['', '0', '-5', 'abc', '1.234', '1e5', '1000000001']) {
    assert.equal(toCents(bad), null, bad);
  }
});

test('cents back to form text', () => {
  assert.equal(centsToText(500000), '5000');
  assert.equal(centsToText(500050), '5000.50');
  assert.equal(centsToText(5), '0.05');
});

test('dates', () => {
  assert.equal(isValidDate('2026-11-06'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('06/11/2026'), false);
  // 11:00 pm UTC on 5 Nov is already 6 Nov in Sri Lanka
  assert.equal(todayInColombo(new Date('2026-11-05T23:00:00Z')), '2026-11-06');
});
