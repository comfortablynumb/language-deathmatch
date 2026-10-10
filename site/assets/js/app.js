/* Bootstrap: load data, route hash changes to views, keep nav and footer in sync. */
import * as format from './lib/format.js';
import * as router from './lib/router.js';
import { createStore } from './lib/store.js';
import * as c from './ui/components.js';
import * as charts from './ui/charts.js';
import { browserStorage } from './ui/storage.js';
import * as home from './views/home-page.js';
import * as project from './views/project.js';
import * as deathmatch from './views/deathmatch.js';
import * as leaderboard from './views/leaderboard.js';
import * as methodology from './views/methodology.js';
import { fighters, notfound } from './views/pages.js';

const e = format.escapeHtml;

const VIEWS = {
  home: home.render,
  project: project.render,
  deathmatch: deathmatch.render,
  leaderboard: leaderboard.render,
  methodology: methodology.render,
  fighters,
  notfound,
};

const NAV_FOR_ROUTE = {
  home: 'home', project: 'home', deathmatch: 'deathmatch', leaderboard: 'leaderboard', fighters: 'fighters', methodology: 'methodology',
};

/** Routes that share a key keep the scroll position (project tabs); a new key scrolls to the top. */
function scrollKey(route) {
  const p = route.params;
  return route.name === 'deathmatch' ? `${route.name}/${p.arena}/${p.fighter}/${p.opponent}` : `${route.name}/${p.id || ''}`;
}

/** jQuery-backed fetch: resolves JSON, null on 404, rejects otherwise. */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    $.ajax({ url, dataType: 'json', cache: false })
      .done(resolve)
      .fail((xhr) => (xhr.status === 404 ? resolve(null) : reject(new Error(`${url}: HTTP ${xhr.status || 'error'}`))));
  });
}

function footer(results) {
  const run = results
    ? `Benchmarks from ${e(format.dateTime(results.generatedAt))}${results.commit ? ` · commit ${e(results.commit)}` : ''} · ${e(results.environment.runner || '')}`
    : 'No benchmark results published yet.';

  $('#footer-run').html(run);
}

function fatal(error) {
  const hint = location.protocol === 'file:' ? 'Serve the site over HTTP, e.g. <code class="font-mono">bin/serve.sh</code>.' : e(error.message);
  $('#app').html(c.emptyState('Could not load the data', hint));
}

function createRouter(state) {
  let token = 0;
  let previous = null;

  return function route() {
    const current = ++token;
    const r = router.parse(location.hash);
    const $root = $('#app').off();
    const view = VIEWS[r.name] || VIEWS.notfound;
    charts.disposeAll();
    $('[data-nav]').attr('aria-current', function () { return $(this).attr('data-nav') === NAV_FOR_ROUTE[r.name] ? 'page' : null; });

    if (!previous || scrollKey(previous) !== scrollKey(r)) {
      window.scrollTo(0, 0);
      document.title = format.pageTitle();
    }

    previous = r;
    const ctx = { ...state, route: r, $root, isCurrent: () => current === token };
    Promise.resolve(view(ctx)).catch((error) => ctx.isCurrent() && fatal(error));
  };
}

$(function () {
  const store = createStore(fetchJson, 'data');

  Promise.all([store.catalog(), store.results().catch(() => null)])
    .then(([catalog, results]) => {
      const route = createRouter({ store, catalog, results, storage: browserStorage() });
      footer(results);
      window.addEventListener('hashchange', route);
      route();
    })
    .catch(fatal);
});
