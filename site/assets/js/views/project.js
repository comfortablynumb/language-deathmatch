/* Project page: header, tab navigation and dispatch to the tab renderers. */
import * as format from '../lib/format.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';
import { notfound } from './pages.js';
import { overview } from './project-overview.js';
import { code } from './project-code.js';
import { compare } from './project-compare.js';
import { benchmarks } from './project-benchmarks.js';

const e = format.escapeHtml;

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'code', label: 'Code' },
  { id: 'compare', label: 'Compare' },
  { id: 'benchmarks', label: 'Benchmarks' },
];

function coverage(ctx, project) {
  const implemented = project.implementations.map((i) => i.language);
  const chips = ctx.catalog.languages.map((l) => (implemented.includes(l.id)
    ? c.langChip(l)
    : `<span class="chip opacity-40" title="Not implemented yet">${c.langDot(l)}${e(l.name)}</span>`)).join('');

  return `<div class="flex flex-wrap gap-1.5">${chips}</div>`;
}

/** "⚔ Fight in The Number Pit →": the project's category as a deathmatch arena. */
function arenaLink(ctx, project) {
  const category = ctx.catalog.categories.find((cat) => cat.id === project.category);

  if (!category || !category.arena) {
    return '';
  }

  const href = router.build('deathmatch', { arena: category.id });
  return `<a class="mt-4 inline-block text-sm font-medium text-gold hover:underline" href="${href}">⚔ Fight in ${e(category.arena.stage)} →</a>`;
}

function header(ctx, project) {
  return `<nav class="text-sm text-ink-3" aria-label="Breadcrumb">
      <a class="hover:text-ink" href="#/">Projects</a> <span aria-hidden="true">/</span> <span class="text-ink-2">${e(project.name)}</span>
    </nav>
    <div class="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">${e(project.name)}</h1>
        <p class="mt-2 max-w-3xl text-ink-2">${e(project.summary)}</p>
        <div class="mt-4 flex flex-wrap gap-1.5">
          ${c.categoryChip(ctx.catalog, project.category)}${c.levelBadge(project.level, ctx.catalog.levels)}
          <span class="chip">kind: ${e(project.kind)}</span>${c.tagChips(project.tags)}
        </div>
        ${arenaLink(ctx, project)}
      </div>
      <div class="lg:max-w-sm"><div class="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">Implemented in</div>${coverage(ctx, project)}</div>
    </div>`;
}

function tabs(project, active) {
  const links = TABS.map((t) => `<a role="tab" class="tab" aria-selected="${t.id === active}"
    href="${router.build('project', { id: project.id, tab: t.id })}">${t.label}</a>`).join('');

  return `<div class="mt-8 border-b border-line"><div role="tablist" aria-label="Project sections" class="flex gap-6 overflow-x-auto overflow-y-hidden">${links}</div></div>`;
}

const TAB_RENDERERS = { overview, code, compare, benchmarks };

export async function render(ctx) {
  ctx.$root.html(c.skeleton());
  const project = await ctx.store.project(ctx.route.params.id);

  if (!ctx.isCurrent()) {
    return;
  }

  if (!project) {
    notfound(ctx);
    return;
  }

  const tab = ctx.route.params.tab;
  document.title = format.pageTitle(project.name);
  ctx.$root.html(`${header(ctx, project)}${tabs(project, tab)}<div id="tab-panel" class="mt-8"></div>`);
  TAB_RENDERERS[tab]({ ...ctx, project, $panel: ctx.$root.find('#tab-panel') });
}
