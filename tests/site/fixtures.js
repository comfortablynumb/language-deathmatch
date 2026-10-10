/** Builds a results.json-like case result whose metrics all share the given medians. */
export function caseResult(caseId, medians) {
  const summary = (median) => ({ min: median, q1: median, median, q3: median, max: median, mean: median, stddev: 0 });

  return {
    case: caseId,
    status: 'ok',
    error: '',
    samples: { wallNs: [medians.wall], cpuNs: [medians.cpu], maxRssKb: [medians.memory] },
    stats: { wallNs: summary(medians.wall), cpuNs: summary(medians.cpu), maxRssKb: summary(medians.memory) },
  };
}

export function implResult(language, cases, status = 'ok') {
  return { project: 'fibonacci', language, status, error: '', image: { tag: '', sizeBytes: 1 }, verification: [], benchmarks: cases };
}

/** Three languages, two cases; python failed. */
export function sampleResults() {
  return {
    generatedAt: '2026-10-08T12:00:00Z',
    commit: 'abc1234',
    environment: { cpuModel: 'CPU', cpus: 4 },
    results: [
      implResult('go', [caseResult('startup', { wall: 2, cpu: 2, memory: 300 }), caseResult('throughput', { wall: 30, cpu: 30, memory: 300 })]),
      implResult('rust', [caseResult('startup', { wall: 1, cpu: 1, memory: 100 }), caseResult('throughput', { wall: 60, cpu: 60, memory: 100 })]),
      implResult('asm', [caseResult('startup', { wall: 4, cpu: 4, memory: 10 })]),
      implResult('python', [caseResult('startup', { wall: 8, cpu: 8, memory: 900 })], 'failed'),
    ],
  };
}

