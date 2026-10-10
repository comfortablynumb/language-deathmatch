import test from 'node:test';
import assert from 'node:assert/strict';
import * as filters from '../../site/assets/js/lib/filters.js';
import * as router from '../../site/assets/js/lib/router.js';
import { createStore } from '../../site/assets/js/lib/store.js';

const projects = [
  { id: 'fibonacci', name: 'Fibonacci', summary: 'Print numbers', category: 'algorithms', level: 1, tags: ['loops'], languages: ['go', 'rust'] },
  { id: 'http-hello', name: 'HTTP Hello', summary: 'A server', category: 'web', level: 4, tags: ['http'], languages: ['go'] },
  { id: 'binary-trees', name: 'Binary Trees', summary: 'Allocate', category: 'data-structures', level: 3, tags: ['memory'], languages: ['rust'] },
];

test('filterProjects combines all criteria', () => {
  const ids = (list) => list.map((p) => p.id);

  assert.deepEqual(ids(filters.filterProjects(projects, {})), ['fibonacci', 'http-hello', 'binary-trees']);
  assert.deepEqual(ids(filters.filterProjects(projects, { q: 'LOOPS' })), ['fibonacci']);
  assert.deepEqual(ids(filters.filterProjects(projects, { q: 'print numbers' })), ['fibonacci']);
  assert.deepEqual(ids(filters.filterProjects(projects, { category: 'web' })), ['http-hello']);
  assert.deepEqual(ids(filters.filterProjects(projects, { level: '3' })), ['binary-trees']);
  assert.deepEqual(ids(filters.filterProjects(projects, { language: 'go', level: 1 })), ['fibonacci']);
});

test('sortProjects by level then name, or by name', () => {
  assert.deepEqual(filters.sortProjects(projects).map((p) => p.level), [1, 3, 4]);
  assert.deepEqual(filters.sortProjects(projects, 'name').map((p) => p.id), ['binary-trees', 'fibonacci', 'http-hello']);
});

test('countByCategory', () => {
  assert.deepEqual(filters.countByCategory(projects), { algorithms: 1, web: 1, 'data-structures': 1 });
});

test('router parses every route', () => {
  assert.deepEqual(router.parse(''), { name: 'home', params: {}, query: {} });
  assert.deepEqual(router.parse('#/?q=fib&level=1'), { name: 'home', params: {}, query: { q: 'fib', level: '1' } });
  assert.deepEqual(router.parse('#/projects/fibonacci').params, { id: 'fibonacci', tab: 'overview', a: '', b: '' });
  assert.deepEqual(router.parse('#/projects/fibonacci/compare/go/rust').params, { id: 'fibonacci', tab: 'compare', a: 'go', b: 'rust' });
  assert.equal(router.parse('#/projects/fibonacci/benchmarks?case=startup').query.case, 'startup');
  assert.equal(router.parse('#/leaderboard').name, 'leaderboard');
  assert.equal(router.parse('#/fighters').name, 'fighters');
  assert.equal(router.parse('#/languages').name, 'notfound');
  assert.deepEqual(router.parse('#/deathmatch'), { name: 'deathmatch', params: { arena: '', fighter: '', opponent: '' }, query: {} });
  assert.deepEqual(router.parse('#/deathmatch/algorithms/rust/go').params, { arena: 'algorithms', fighter: 'rust', opponent: 'go' });
  assert.equal(router.parse('#/deathmatch?fighter=rust').query.fighter, 'rust');
  assert.equal(router.parse('#/deathmatch/a/b/c/d').name, 'notfound');
  assert.equal(router.parse('#/projects/fibonacci/nope').name, 'notfound');
  assert.equal(router.parse('#/projects').name, 'notfound');
  assert.equal(router.parse('#/unknown').name, 'notfound');
});

test('router build is the inverse of parse', () => {
  const hashes = ['#/', '#/projects/fibonacci', '#/projects/fibonacci/code/rust', '#/projects/fibonacci/compare/go/python',
    '#/projects/fibonacci/benchmarks?case=throughput&metric=memory', '#/leaderboard?metric=wall', '#/methodology', '#/fighters',
    '#/deathmatch', '#/deathmatch?fighter=rust&arena=algorithms', '#/deathmatch/algorithms', '#/deathmatch/algorithms/rust',
    '#/deathmatch/algorithms/rust/go'];

  for (const hash of hashes) {
    const route = router.parse(hash);
    assert.equal(router.build(route.name, route.params, route.query), hash);
  }

  assert.equal(router.build('home', {}, { q: '', level: undefined }), '#/');
  assert.equal(router.build('deathmatch', { fighter: 'rust' }), '#/deathmatch', 'no fighter without an arena');
  assert.equal(router.build('deathmatch', { arena: 'algorithms', opponent: 'go' }), '#/deathmatch/algorithms');
});

test('store caches documents and maps a missing results file to null', async () => {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    return url.endsWith('results.json') ? null : { url };
  };
  const store = createStore(fetchJson, 'data');

  assert.deepEqual(await store.catalog(), { url: 'data/catalog.json' });
  await store.catalog();
  assert.equal(await store.results(), null);
  assert.deepEqual(await store.project('fibonacci'), { url: 'data/projects/fibonacci.json' });
  assert.deepEqual(calls, ['data/catalog.json', 'data/results.json', 'data/projects/fibonacci.json']);
});

test('store rejects a missing catalog and retries after failures', async () => {
  let attempts = 0;
  const fetchJson = async () => {
    attempts++;

    if (attempts === 1) {
      throw new Error('network');
    }

    return null;
  };
  const store = createStore(fetchJson);

  await assert.rejects(store.catalog(), /network/);
  await assert.rejects(store.catalog(), /catalog.json is missing/);
  assert.equal(attempts, 2);
});
