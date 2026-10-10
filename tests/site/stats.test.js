import test from 'node:test';
import assert from 'node:assert/strict';
import * as stats from '../../site/assets/js/lib/stats.js';
import { sampleResults } from './fixtures.js';

test('rankCase sorts by median and skips failed implementations', () => {
  const rows = stats.rankCase(sampleResults(), 'fibonacci', 'startup', 'wall');

  assert.deepEqual(rows.map((r) => r.language), ['rust', 'go', 'asm']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  assert.deepEqual(rows.map((r) => r.relative), [1, 2, 4]);
});

test('rankCase uses the requested metric', () => {
  const rows = stats.rankCase(sampleResults(), 'fibonacci', 'startup', 'memory');

  assert.deepEqual(rows.map((r) => r.language), ['asm', 'rust', 'go']);
  assert.deepEqual(rows[2].samples, [300]);
});

test('rankCase on unknown case is empty', () => {
  assert.deepEqual(stats.rankCase(sampleResults(), 'fibonacci', 'nope', 'wall'), []);
  assert.deepEqual(stats.rankCase(null, 'fibonacci', 'startup', 'wall'), []);
});

test('metricInfo rejects unknown metrics', () => {
  assert.throws(() => stats.metricInfo('speed'), /unknown metric/);
});

test('geometricMean', () => {
  assert.equal(stats.geometricMean([]), 0);
  assert.ok(Math.abs(stats.geometricMean([1, 4]) - 2) < 1e-12);
});

test('leaderboard combines cases with the geometric mean', () => {
  const rows = stats.leaderboard(sampleResults(), 'wall');
  const byLanguage = Object.fromEntries(rows.map((r) => [r.language, r]));

  // go: startup 2×, throughput 1× → √2; rust: 1× and 2× → √2; asm: 4× on one case.
  assert.ok(Math.abs(byLanguage.go.score - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(byLanguage.rust.score - Math.SQRT2) < 1e-12);
  assert.equal(byLanguage.asm.score, 4);
  assert.equal(byLanguage.asm.cases, 1);
  assert.equal(byLanguage.rust.wins, 1);
  assert.equal(rows[rows.length - 1].language, 'asm');
  assert.equal(byLanguage.python, undefined);
});

test('compare reports winner and factor', () => {
  assert.deepEqual(stats.compare(1, 4), { winner: 'a', factor: 4 });
  assert.deepEqual(stats.compare(10, 5), { winner: 'b', factor: 2 });
  assert.equal(stats.compare(3, 3).winner, 'tie');
  assert.equal(stats.compare(0, 3).winner, 'tie');
  assert.equal(stats.compare(NaN, 3).winner, 'tie');
});

test('sortRows sorts numbers and strings in both directions', () => {
  const rows = [{ n: 2, s: 'b' }, { n: 1, s: 'c' }, { n: 3, s: 'a' }];

  assert.deepEqual(stats.sortRows(rows, 'n', 'asc').map((r) => r.n), [1, 2, 3]);
  assert.deepEqual(stats.sortRows(rows, 'n', 'desc').map((r) => r.n), [3, 2, 1]);
  assert.deepEqual(stats.sortRows(rows, 's', 'asc').map((r) => r.s), ['a', 'b', 'c']);
  assert.equal(rows[0].n, 2, 'input must not be mutated');
});
