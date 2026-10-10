/* Ranking logic over results.json: per-case rankings, comparisons, leaderboard. Pure, no DOM. */
/** Metric id → key in results.json samples/stats, plus wording. */
const METRICS = {
  wall: { key: 'wallNs', label: 'Wall time', better: 'faster' },
  cpu: { key: 'cpuNs', label: 'CPU time', better: 'faster' },
  memory: { key: 'maxRssKb', label: 'Peak memory', better: 'leaner' },
};

export function metricInfo(metric) {
  const info = METRICS[metric];

  if (!info) {
    throw new Error(`unknown metric "${metric}"`);
  }

  return info;
}

/** Successful benchmark case of an implementation result, or null. */
export function findCase(result, caseId) {
  if (!result || result.status !== 'ok') {
    return null;
  }

  const found = (result.benchmarks || []).find((b) => b.case === caseId);
  return found && found.status === 'ok' ? found : null;
}

/** Summary ({min,q1,median,q3,max,mean,stddev}) of a metric in a case result. */
export function summary(caseResult, metric) {
  return caseResult.stats[metricInfo(metric).key];
}

/** Implementation results of one project. */
export function projectResults(results, projectId) {
  return ((results && results.results) || []).filter((r) => r.project === projectId);
}

/**
 * Ranks the implementations of a project for one case and metric (median, ascending).
 * Returns [{ language, rank, value, relative, summary, samples }].
 */
export function rankCase(results, projectId, caseId, metric) {
  const key = metricInfo(metric).key;
  const rows = [];

  for (const result of projectResults(results, projectId)) {
    const caseResult = findCase(result, caseId);

    if (caseResult) {
      const stats = caseResult.stats[key];
      rows.push({ language: result.language, value: stats.median, summary: stats, samples: caseResult.samples[key] });
    }
  }

  rows.sort((a, b) => a.value - b.value);
  const best = rows.length ? rows[0].value : 0;
  return rows.map((row, i) => ({ ...row, rank: i + 1, relative: best > 0 ? row.value / best : 1 }));
}

/** Geometric mean of positive numbers (0 for an empty list). */
export function geometricMean(values) {
  if (!values.length) {
    return 0;
  }

  const logSum = values.reduce((sum, v) => sum + Math.log(v), 0);
  return Math.exp(logSum / values.length);
}

/** Every (project, case) pair that has at least one successful result. */
function allCases(results) {
  const seen = new Map();

  for (const result of (results && results.results) || []) {
    for (const bench of result.benchmarks || []) {
      seen.set(`${result.project}\u0000${bench.case}`, { project: result.project, caseId: bench.case });
    }
  }

  return [...seen.values()];
}

/**
 * Overall ranking: geometric mean of each language's relative factors over all cases.
 * Returns [{ language, rank, score, cases, wins }] sorted by score.
 */
export function leaderboard(results, metric) {
  const perLanguage = new Map();

  for (const { project, caseId } of allCases(results)) {
    for (const row of rankCase(results, project, caseId, metric)) {
      const entry = perLanguage.get(row.language) || { language: row.language, factors: [], wins: 0 };
      entry.factors.push(row.relative);
      entry.wins += row.rank === 1 ? 1 : 0;
      perLanguage.set(row.language, entry);
    }
  }

  const rows = [...perLanguage.values()].map((e) => ({
    language: e.language, score: geometricMean(e.factors), cases: e.factors.length, wins: e.wins,
  }));
  rows.sort((a, b) => a.score - b.score || b.cases - a.cases);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Compares two positive values where lower is better.
 * Returns { winner: 'a'|'b'|'tie', factor } with factor >= 1.
 */
export function compare(valueA, valueB) {
  if (!(valueA > 0) || !(valueB > 0) || valueA === valueB) {
    return { winner: 'tie', factor: 1 };
  }

  return valueA < valueB ? { winner: 'a', factor: valueB / valueA } : { winner: 'b', factor: valueA / valueB };
}

/** Returns a sorted copy of rows by a key (string or number), direction 'asc' | 'desc'. */
export function sortRows(rows, key, direction) {
  const sign = direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];

    if (typeof x === 'string' || typeof y === 'string') {
      return sign * String(x).localeCompare(String(y));
    }

    return sign * ((x ?? Infinity) - (y ?? Infinity));
  });
}
