/* Hash routing: "#/projects/fibonacci/code/rust?x=1" ⇄ { name, params, query }. Pure, no DOM. */
const PROJECT_TABS = ['overview', 'code', 'compare', 'benchmarks'];
const STATIC_PAGES = ['leaderboard', 'fighters', 'methodology'];

export function parseQuery(text) {
  const query = {};

  for (const [key, value] of new URLSearchParams(text || '')) {
    query[key] = value;
  }

  return query;
}

export function buildQuery(query) {
  const entries = Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

/** Splits "#/a/b?c=d" into decoded path segments and the query string. */
function split(hash) {
  const text = String(hash || '').replace(/^#/, '');
  const [path, queryText] = text.split('?', 2);
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { segments, query: parseQuery(queryText) };
}

function projectRoute(segments, query) {
  const [, id, tab = 'overview', a = '', b = ''] = segments;

  if (!id || !PROJECT_TABS.includes(tab) || segments.length > 5) {
    return { name: 'notfound', params: {}, query };
  }

  return { name: 'project', params: { id, tab, a, b }, query };
}

/** "#/deathmatch[/:arena[/:fighter[/:opponent]]]": select, rankings, tower, fight. */
function deathmatchRoute(segments, query) {
  const [, arena = '', fighter = '', opponent = ''] = segments;

  if (segments.length > 4) {
    return { name: 'notfound', params: {}, query };
  }

  return { name: 'deathmatch', params: { arena, fighter, opponent }, query };
}

/** Parses a location hash into { name, params, query }. */
export function parse(hash) {
  const { segments, query } = split(hash);

  if (segments.length === 0) {
    return { name: 'home', params: {}, query };
  }

  if (segments[0] === 'projects') {
    return projectRoute(segments, query);
  }

  if (segments[0] === 'deathmatch') {
    return deathmatchRoute(segments, query);
  }

  if (segments.length === 1 && STATIC_PAGES.includes(segments[0])) {
    return { name: segments[0], params: {}, query };
  }

  return { name: 'notfound', params: {}, query };
}

function pathOf(name, p) {
  if (name === 'project') {
    const tail = [p.tab && p.tab !== 'overview' ? p.tab : '', p.a || '', p.b || ''];
    return ['projects', p.id, ...tail];
  }

  if (name === 'deathmatch') {
    return ['deathmatch', p.arena || '', p.arena && p.fighter ? p.fighter : '', p.arena && p.fighter && p.opponent ? p.opponent : ''];
  }

  return STATIC_PAGES.includes(name) ? [name] : [];
}

/** Builds a hash for a route; inverse of parse. */
export function build(name, params, query) {
  const parts = pathOf(name, params || {}).filter(Boolean).map(encodeURIComponent);
  return `#/${parts.join('/')}${buildQuery(query)}`;
}
