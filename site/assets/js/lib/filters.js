/* Project explorer filtering and sorting. Pure, no DOM. */
/** Normalizes free text for matching: lowercase, trimmed. */
function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

/** True when every word of the query appears in the name, summary, id or tags. */
export function matchesQuery(project, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const haystack = normalize([project.id, project.name, project.summary, ...(project.tags || [])].join(' '));
  return words.every((word) => haystack.includes(word));
}

/**
 * Filters projects. criteria: { q, category, level, language } — empty values match all.
 */
export function filterProjects(projects, criteria) {
  const c = criteria || {};
  const level = c.level ? Number(c.level) : 0;

  return projects.filter((p) =>
    matchesQuery(p, c.q)
    && (!c.category || p.category === c.category)
    && (!level || p.level === level)
    && (!c.language || (p.languages || []).includes(c.language)));
}

/** Sorts a copy of the projects: 'name' or 'level' (default: level, then name). */
export function sortProjects(projects, sort) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const compare = sort === 'name' ? byName : (a, b) => a.level - b.level || byName(a, b);
  return [...projects].sort(compare);
}

/** Number of projects per category id. */
export function countByCategory(projects) {
  const counts = {};

  for (const project of projects) {
    counts[project.category] = (counts[project.category] || 0) + 1;
  }

  return counts;
}
