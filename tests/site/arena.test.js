import test from 'node:test';
import assert from 'node:assert/strict';
import * as arenas from '../../site/assets/js/lib/arena.js';
import { catalog, results, implResult, caseResult } from './deathmatch-fixtures.js';

test('buildArena orders projects by level then name and collects case medians', () => {
  const arena = arenas.buildArena(catalog(), results(), 'algorithms');

  assert.deepEqual(arena.projects.map((p) => p.id), ['fib', 'sieve']);
  assert.deepEqual(arena.cases.map((c) => c.key), ['fib/startup', 'fib/throughput', 'sieve/big']);
  assert.deepEqual(arena.cases[0].values.go, { wall: 2, cpu: 2, memory: 200 });
  assert.equal(arena.cases[1].caseName, 'Throughput');
  assert.equal(arena.cases[1].projectName, 'Fibonacci');
});

test('failed implementations do not fight', () => {
  const arena = arenas.buildArena(catalog(), results(), 'algorithms');

  assert.equal(arena.cases[0].values.python, undefined, 'python failed verification on fib');
  assert.deepEqual(arena.cases[2].values.python, { wall: 2000, cpu: 2000, memory: 3000 });
  assert.deepEqual(arena.fighters, ['go', 'rust', 'asm', 'python']);
});

test('code entries carry the lines of code of ok results', () => {
  const arena = arenas.buildArena(catalog(), results(), 'algorithms');
  const fib = arena.code.find((f) => f.project === 'fib');

  assert.deepEqual(fib.values.go, { loc: 50 });
  assert.deepEqual(fib.values.asm, { loc: 150 });
  assert.equal(fib.values.python, undefined);
});

test('failed or missing benchmark cases are skipped', () => {
  const data = results();
  const asm = data.results.find((r) => r.project === 'fib' && r.language === 'asm');
  asm.benchmarks = [caseResult('startup', 1, 10, 'failed')];

  const arena = arenas.buildArena(catalog(), data, 'algorithms');

  assert.equal(arena.cases[0].values.asm, undefined, 'failed case');
  assert.equal(arena.cases[1].values.asm, undefined, 'missing case');
  assert.equal(arena.fighters.includes('asm'), false);
});

test('a project without results for a fighter adds no code entry for it', () => {
  const data = results();
  data.results.push(implResult('trees', 'rust', [caseResult('deep', 4, 40)]));

  const arena = arenas.buildArena(catalog(), data, 'data-structures');

  assert.deepEqual(arena.fighters, ['go', 'rust']);
  assert.deepEqual(Object.keys(arena.code[0].values), ['go', 'rust']);
  assert.equal(arena.code[0].values.rust.loc, 0, 'rust is not in the catalog loc map');
});

test('listArenas reports open and locked arenas with a reason', () => {
  const list = arenas.listArenas(catalog(), results());
  const byId = Object.fromEntries(list.map((a) => [a.id, a]));

  assert.deepEqual(list.map((a) => a.id), ['algorithms', 'data-structures', 'web']);
  assert.equal(byId.algorithms.open, true);
  assert.equal(arenas.lockReason(byId.algorithms), null);
  assert.equal(arenas.lockReason(byId['data-structures']), 'no-results', 'only one fighter');
  assert.equal(arenas.lockReason(byId.web), 'no-projects');
});

test('buildArena without results has no fighters; unknown arena is null', () => {
  const arena = arenas.buildArena(catalog(), null, 'algorithms');

  assert.deepEqual(arena.fighters, []);
  assert.equal(arena.open, false);
  assert.equal(arenas.buildArena(catalog(), results(), 'nope'), null);
});

test('canFight needs a shared case and two different fighters', () => {
  const arena = arenas.buildArena(catalog(), results(), 'algorithms');

  assert.equal(arenas.canFight(arena, 'go', 'asm'), true);
  assert.equal(arenas.canFight(arena, 'asm', 'python'), false, 'asm has no sieve, python has only sieve');
  assert.equal(arenas.canFight(arena, 'go', 'go'), false);
});
