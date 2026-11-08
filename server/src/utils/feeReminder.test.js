import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feeReminderText, firstNameOf, isValidYear } from './feeReminder.js';

test('reminder names her, the year and her branch treasurer', () => {
  const text = feeReminderText('Kavindya', 2026, 'Colombo');
  assert.match(text, /^Dear Kavindya, /);
  assert.match(text, /membership fee for 2026/);
  assert.match(text, /your Colombo branch treasurer/);
});

test('works without a name or branch', () => {
  const text = feeReminderText('', 2026, '');
  assert.match(text, /^we haven't recorded/);
  assert.match(text, /your branch treasurer/);
});

test('first names and years', () => {
  assert.equal(firstNameOf('  Kavindya  Perera '), 'Kavindya');
  assert.equal(isValidYear('2026'), true);
  assert.equal(isValidYear(1800), false);
  assert.equal(isValidYear('abc'), false);
});
