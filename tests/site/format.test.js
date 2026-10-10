import test from 'node:test';
import assert from 'node:assert/strict';
import * as format from '../../site/assets/js/lib/format.js';

test('escapeHtml escapes markup characters', () => {
  assert.equal(format.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(format.escapeHtml(null), '');
});

test('duration picks a readable unit', () => {
  assert.equal(format.duration(0), '0');
  assert.equal(format.duration(950), '950 ns');
  assert.equal(format.duration(151000), '151 µs');
  assert.equal(format.duration(17690000), '17.7 ms');
  assert.equal(format.duration(1234567890), '1.23 s');
});

test('memory and bytes use binary units', () => {
  assert.equal(format.memory(20), '20 KiB');
  assert.equal(format.memory(2324), '2.27 MiB');
  assert.equal(format.bytes(24576), '24 KiB');
  assert.equal(format.bytes(512), '512 B');
});

test('factor formats relative values', () => {
  assert.equal(format.factor(1), '1.00×');
  assert.equal(format.factor(41.27), '41.3×');
  assert.equal(format.factor(117.4), '117×');
  assert.equal(format.factor(NaN), '–');
});

test('sigfig, number, plural, commandLine', () => {
  assert.equal(format.sigfig(0.000123456, 2), '0.00012');
  assert.equal(format.sigfig(0), '0');
  assert.equal(format.number(2000000), '2,000,000');
  assert.equal(format.plural(1, 'case'), '1 case');
  assert.equal(format.plural(3, 'case'), '3 cases');
  assert.equal(format.commandLine('fibonacci', ['10']), 'fibonacci 10');
});

test('dateTime renders UTC and tolerates bad input', () => {
  assert.equal(format.dateTime('2026-10-08T23:40:12Z'), '2026-10-08 23:40 UTC');
  assert.equal(format.dateTime('nope'), '–');
});
