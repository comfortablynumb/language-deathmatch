/* Arenas: a project category turned into fight data (per-case medians, lines of code). Pure, no DOM. */
import { findCase, projectResults } from './stats.js';

/** Projects of a category in arena order: level, then name. */
export function arenaProjects(catalog, categoryId) {
  return catalog.projects
    .filter((p) => p.category === categoryId)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/** Implementation results of a project that passed verification and every case, by language. */
function okResults(results, projectId) {
  const byLanguage = new Map();

  for (const result of projectResults(results, projectId)) {
    if (result.status === 'ok') {
      byLanguage.set(result.language, result);
    }
  }

  return byLanguage;
}

/** One entry per benchmark case: every fighter's median wall time, CPU time and peak memory. */
function caseEntries(project, okByLanguage) {
  return (project.benchmarks || []).map((bench) => {
    const values = {};

    for (const [language, result] of okByLanguage) {
      const found = findCase(result, bench.id);

      if (found) {
        values[language] = { wall: found.stats.wallNs.median, cpu: found.stats.cpuNs.median, memory: found.stats.maxRssKb.median };
      }
    }

    return { key: `${project.id}/${bench.id}`, project: project.id, projectName: project.name, caseId: bench.id, caseName: bench.name, values };
  });
}

/** One entry per project: lines of code of every fighter with an ok result. */
function codeEntry(project, okByLanguage) {
  const values = {};

  for (const language of okByLanguage.keys()) {
    values[language] = { loc: (project.loc || {})[language] || 0 };
  }

  return { key: project.id, project: project.id, projectName: project.name, values };
}

/**
 * Fight data of one arena: { id, category, projects, cases, code, fighters, open }, or null
 * for an unknown category. Fighters are languages (catalog order) with at least one case result.
 */
export function buildArena(catalog, results, categoryId) {
  const category = catalog.categories.find((c) => c.id === categoryId);

  if (!category) {
    return null;
  }

  const projects = arenaProjects(catalog, categoryId);
  const cases = [];
  const code = [];

  for (const project of projects) {
    const ok = okResults(results, project.id);
    cases.push(...caseEntries(project, ok).filter((entry) => Object.keys(entry.values).length > 0));
    code.push(codeEntry(project, ok));
  }

  const fighters = catalog.languages.map((l) => l.id).filter((id) => cases.some((entry) => entry.values[id]));
  return { id: categoryId, category, projects, cases, code, fighters, open: fighters.length >= 2 };
}

/** Every arena in catalog order, open and locked. */
export function listArenas(catalog, results) {
  return catalog.categories.map((category) => buildArena(catalog, results, category.id));
}

/** Why an arena is locked: 'no-projects', 'no-results', or null when it is open. */
export function lockReason(arena) {
  if (arena.open) {
    return null;
  }

  return arena.projects.length === 0 ? 'no-projects' : 'no-results';
}

/** True when two different fighters share at least one benchmark case in the arena. */
export function canFight(arena, a, b) {
  return a !== b && arena.cases.some((entry) => entry.values[a] && entry.values[b]);
}
