/* Fixtures for the deathmatch engine: a small catalog + results, and hand-built arenas. */

function fighter(glyph) {
  return { glyph, nickname: `The ${glyph}`, special: `${glyph} Special`, fatality: `${glyph} Fatality`, quote: `${glyph} wins.` };
}

export function language(id, name) {
  return { id, name, color: '#123456', kind: 'compiled', fighter: fighter(name.slice(0, 2)) };
}

export function catalog() {
  return {
    languages: [language('go', 'Go'), language('rust', 'Rust'), language('asm', 'Assembly'), language('python', 'Python')],
    categories: [
      { id: 'algorithms', name: 'Algorithms', arena: { stage: 'The Number Pit', tagline: 't', color: '#f97316' } },
      { id: 'data-structures', name: 'Data Structures', arena: { stage: 'The Heap', tagline: 't', color: '#22c55e' } },
      { id: 'web', name: 'Web', arena: { stage: 'The Gauntlet', tagline: 't', color: '#3b82f6' } },
    ],
    projects: [
      { id: 'sieve', name: 'Sieve', category: 'algorithms', level: 2, languages: ['go', 'rust', 'python'],
        benchmarks: [{ id: 'big', name: 'Big' }], loc: { go: 40, rust: 30, python: 20 } },
      { id: 'fib', name: 'Fibonacci', category: 'algorithms', level: 1, languages: ['go', 'rust', 'asm', 'python'],
        benchmarks: [{ id: 'startup', name: 'Startup' }, { id: 'throughput', name: 'Throughput' }],
        loc: { go: 50, rust: 40, asm: 150, python: 25 } },
      { id: 'trees', name: 'Trees', category: 'data-structures', level: 3, languages: ['go'],
        benchmarks: [{ id: 'deep', name: 'Deep' }], loc: { go: 60 } },
    ],
  };
}

function summary(value) {
  return { min: value, q1: value, median: value, q3: value, max: value, mean: value, stddev: 0 };
}

/** A benchmark case result whose wall time, CPU time and memory medians are the given values. */
export function caseResult(caseId, wall, memory, status = 'ok') {
  return {
    case: caseId, status, error: '',
    samples: { wallNs: [wall], cpuNs: [wall], maxRssKb: [memory] },
    stats: { wallNs: summary(wall), cpuNs: summary(wall), maxRssKb: summary(memory) },
  };
}

export function implResult(project, language, cases, extra = {}) {
  return { project, language, status: 'ok', error: '', image: { tag: '', sizeBytes: 1000 }, verification: [], benchmarks: cases, ...extra };
}

export function results() {
  return {
    generatedAt: '2026-10-09T00:00:00Z',
    results: [
      implResult('fib', 'go', [caseResult('startup', 2, 200), caseResult('throughput', 10, 200)], { image: { sizeBytes: 2000 } }),
      implResult('fib', 'rust', [caseResult('startup', 1, 100), caseResult('throughput', 20, 100)]),
      implResult('fib', 'asm', [caseResult('startup', 1, 10), caseResult('throughput', 5, 10)], { image: { sizeBytes: 10 } }),
      implResult('fib', 'python', [caseResult('startup', 50, 5000)], { status: 'failed', error: 'verification failed' }),
      implResult('sieve', 'go', [caseResult('big', 100, 1000)]),
      implResult('sieve', 'rust', [caseResult('big', 80, 1000)]),
      implResult('sieve', 'python', [caseResult('big', 2000, 3000)]),
      implResult('trees', 'go', [caseResult('deep', 5, 50)]),
    ],
  };
}

/**
 * Hand-built arena for fight tests. cases: [{ go: [wall, memory], rust: [wall, memory] }],
 * code: [{ go: loc, rust: loc }] (one entry per project).
 */
export function arena(cases, code = []) {
  const toValues = (row, keys) => Object.fromEntries(Object.entries(row).map(([id, v]) => [id, { [keys[0]]: v[0], [keys[1]]: v[1] }]));

  return {
    id: 'test',
    cases: cases.map((row, i) => ({ key: `p/c${i}`, project: 'p', projectName: 'Proj', caseId: `c${i}`, caseName: `Case ${i}`, values: toValues(row, ['wall', 'memory']) })),
    code: code.map((row, i) => ({ key: `p${i}`, project: `p${i}`, projectName: `Proj ${i}`, values: Object.fromEntries(Object.entries(row).map(([id, loc]) => [id, { loc }])) })),
    fighters: [...new Set(cases.flatMap((row) => Object.keys(row)))],
  };
}
