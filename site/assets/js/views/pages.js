/* Static-ish pages: Fighters (the language roster), Not found. */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as arenas from '../lib/arena.js';
import * as tournament from '../lib/tournament.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';
import * as fighterUi from '../ui/fighter.js';

const e = format.escapeHtml;

/** Arena champions: language id → [arena stage names it ranks first in]. */
function arenaTitles(ctx) {
  const titles = new Map();

  for (const arena of arenas.listArenas(ctx.catalog, ctx.results).filter((a) => a.open)) {
    const [top] = tournament.standings(arena);

    if (top) {
      titles.set(top.language, [...(titles.get(top.language) || []), arena.category.arena.stage]);
    }
  }

  return titles;
}

function row(label, value, valueClass = 'truncate text-ink-2') {
  return `<div class="flex justify-between gap-3"><dt class="shrink-0 text-ink-3">${label}</dt><dd class="min-w-0 text-right ${valueClass}">${value}</dd></div>`;
}

function fighterCard(ctx, language, info) {
  const count = ctx.catalog.projects.filter((p) => p.languages.includes(language.id)).length;
  const entry = info.board.find((r) => r.language === language.id);
  const rank = entry ? `#${entry.rank} · ${format.factor(entry.score)}` : '–';
  const titles = info.titles.get(language.id) || [];
  const f = language.fighter;
  const select = router.build('deathmatch', {}, { fighter: language.id });

  return `<article class="card relative overflow-hidden p-5" style="--lang-color:${e(language.color)}">
    <div class="absolute inset-x-0 top-0 h-1" style="background:${e(language.color)}"></div>
    <div class="flex items-center gap-4">${fighterUi.emblem(language, 'md')}
      <div class="min-w-0"><h2 class="dm-title text-4xl">${e(language.name)}</h2><p class="text-sm text-ink-2">${e(f.nickname)}</p></div>
      <span class="chip ml-auto">${e(language.kind)}</span>
    </div>
    <blockquote class="mt-4 text-sm text-ink-2 italic">“${e(f.quote)}”</blockquote>
    <dl class="mt-4 space-y-2 text-sm">
      ${row('Special move', e(f.special), 'truncate text-ink')}
      ${row('Fatality', e(f.fatality), 'truncate text-ink')}
      ${row('Arena titles', titles.length ? e(titles.join(', ')) : '–', titles.length ? 'text-gold' : 'text-ink-2')}
      ${row('Toolchain', e(language.toolchain))}
      ${row('Base image', `<span class="font-mono text-xs">${e(language.image)}</span>`)}
      ${row('Implementations', count)}
      ${row('Leaderboard (wall)', rank)}
    </dl>
    <div class="mt-4 flex flex-wrap gap-3 text-sm font-medium">
      <a class="text-accent hover:underline" href="${select}">Fight as ${e(language.name)} →</a>
      <a class="text-ink-3 hover:text-ink" href="${e(language.website)}" target="_blank" rel="noopener">Website ↗</a>
    </div>
  </article>`;
}

export function fighters(ctx) {
  document.title = format.pageTitle('Fighters');
  const info = {
    board: ctx.results ? stats.leaderboard(ctx.results, 'wall') : [],
    titles: ctx.results ? arenaTitles(ctx) : new Map(),
  };
  const cards = ctx.catalog.languages.map((l) => fighterCard(ctx, l, info)).join('');

  ctx.$root.html(`<p class="dm-eyebrow">The roster</p><h1 class="dm-title mt-2 text-6xl sm:text-7xl">Fighters</h1>
    <p class="mt-3 max-w-3xl text-ink-2">Each language fights with one pinned toolchain image for every project, so results stay comparable.
      Arena titles go to the fighter ranked first in an arena's round-robin.</p>
    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`);
}

export function notfound(ctx) {
  document.title = format.pageTitle('Not found');
  ctx.$root.html(`<div class="py-16">${c.emptyState('Page not found', 'This page does not exist (yet). <a class="text-accent hover:underline" href="#/">Back to all projects</a>.')}</div>`);
}
