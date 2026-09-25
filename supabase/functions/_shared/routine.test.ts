import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeStreak, isDueToday, normalizeRoutine } from './routine.ts';

test('isDueToday: daily is always due', () => {
  assert.equal(isDueToday('daily', 0), true);
  assert.equal(isDueToday('daily', 40), true);
});

test('isDueToday: every_other_day alternates from day 0', () => {
  assert.deepEqual([0, 1, 2, 3].map((d) => isDueToday('every_other_day', d)), [true, false, true, false]);
});

test('isDueToday: negative days (routine not started yet) is never due', () => {
  assert.equal(isDueToday('daily', -1), false);
});

const catalog = [
  { id: 'p1', name: 'Cleanser', category: 'cleanser' as const, key_ingredients: [], targets: [], how_to_use: '' },
  { id: 'p2', name: 'Retinol Cream', category: 'treatment' as const, key_ingredients: ['retinol'], targets: [], how_to_use: '' },
  { id: 'p3', name: 'Salicylic Treatment', category: 'treatment' as const, key_ingredients: [], targets: [], how_to_use: '' },
  { id: 'p4', name: 'SPF 50', category: 'spf' as const, key_ingredients: [], targets: [], how_to_use: '' },
];

test('normalizeRoutine: keeps well-formed steps referencing the catalog', () => {
  const r = normalizeRoutine({
    steps: [
      { period: 'am', product_id: 'p1', instructions: 'Cleanse', frequency: 'daily', wait_minutes: 0 },
      { period: 'am', product_id: 'p4', instructions: 'SPF', frequency: 'daily', wait_minutes: 0 },
    ],
    note: 'Start simple.',
  }, catalog);
  assert.equal(r.steps.length, 2);
  assert.equal(r.note, 'Start simple.');
});

test('normalizeRoutine: drops steps referencing unknown product ids as a custom step', () => {
  const r = normalizeRoutine({
    steps: [{ period: 'pm', product_id: 'does-not-exist', instructions: 'Do something', frequency: 'daily', wait_minutes: 0 }],
    note: '',
  }, catalog);
  assert.equal(r.steps[0].product_id, null);
});

test('normalizeRoutine: forces treatment products off daily frequency', () => {
  const r = normalizeRoutine({
    steps: [{ period: 'pm', product_id: 'p2', instructions: 'Retinol', frequency: 'daily', wait_minutes: 0 }],
    note: '',
  }, catalog);
  assert.equal(r.steps[0].frequency, '3x_week');
});

test('normalizeRoutine: allows only one treatment-category step in the whole routine', () => {
  const r = normalizeRoutine({
    steps: [
      { period: 'pm', product_id: 'p2', instructions: 'Retinol', frequency: '2x_week', wait_minutes: 0 },
      { period: 'pm', product_id: 'p3', instructions: 'Salicylic acid', frequency: '2x_week', wait_minutes: 0 },
    ],
    note: '',
  }, catalog);
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].product_id, 'p2');
});

test('normalizeRoutine: drops malformed steps and falls back to a default note', () => {
  const r = normalizeRoutine({ steps: [{ period: 'evening' }, { period: 'am', instructions: '' }], note: '' }, catalog);
  assert.equal(r.steps.length, 0);
  assert.ok(r.note.length > 0);
});

test('normalizeRoutine: garbage input does not throw', () => {
  const r = normalizeRoutine(null, catalog);
  assert.deepEqual(r.steps, []);
});

test('computeStreak: no logs is zero', () => {
  assert.deepEqual(computeStreak([], '2026-09-26'), { current: 0, longest: 0 });
});

test('computeStreak: consecutive days counts up, today included', () => {
  const { current } = computeStreak(['2026-09-24', '2026-09-25', '2026-09-26'], '2026-09-26');
  assert.equal(current, 3);
});

test('computeStreak: today not logged yet still counts yesterday\'s streak', () => {
  const { current } = computeStreak(['2026-09-23', '2026-09-24', '2026-09-25'], '2026-09-26');
  assert.equal(current, 3);
});

test('computeStreak: missing both today and yesterday breaks the streak', () => {
  const { current } = computeStreak(['2026-09-20', '2026-09-21'], '2026-09-26');
  assert.equal(current, 0);
});

test('computeStreak: a single isolated gap is bridged by the banked grace day', () => {
  // 21,22,23 done, 24 missed, 25,26 done — one gap, should bridge to a streak of 5.
  const { current } = computeStreak(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-25', '2026-09-26'], '2026-09-26');
  assert.equal(current, 5);
});

test('computeStreak: two gaps in a short streak only bridges one', () => {
  // 26 done, 25 missed (bridged with the one banked grace day), 24 done, 23 missed — no grace
  // left, so the walk stops there: current counts 26 and 24 only.
  const { current } = computeStreak(['2026-09-22', '2026-09-24', '2026-09-26'], '2026-09-26');
  assert.equal(current, 2);
});

test('computeStreak: longest can exceed current', () => {
  const { current, longest } = computeStreak(
    ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-20'],
    '2026-09-26',
  );
  assert.equal(current, 0);
  assert.equal(longest, 5);
});
