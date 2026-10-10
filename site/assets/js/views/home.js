/* Home: project explorer cards (the deathmatch sections live in home-deathmatch.js). */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';

const e = format.escapeHtml;

function fastestTeaser(ctx, project) {
  const firstCase = ctx.results && (ctx.results.results.find((r) => r.project === project.id && r.benchmarks.length) || {}).benchmarks;

  if (!firstCase) {
    return '<span class="text-xs text-ink-3">no results yet</span>';
  }

  const [top] = stats.rankCase(ctx.results, project.id, firstCase[0].case, 'wall');

  if (!top) {
    return '';
  }

  return `<span class="text-xs text-ink-3" title="Fastest on the ${e(firstCase[0].case)} case">⚡ ${e(c.languageName(ctx.catalog, top.language))}
    · ${format.duration(top.value)}</span>`;
}

export function projectCard(ctx, project) {
  const dots = ctx.catalog.languages.map((l) => `<span class="${project.languages.includes(l.id) ? '' : 'opacity-20'}"
    title="${e(l.name)}${project.languages.includes(l.id) ? '' : ' (not implemented)'}">${c.langDot(l)}</span>`).join('');

  return `<a href="${router.build('project', { id: project.id })}" class="card group flex flex-col p-5 transition-colors hover:border-ink-3">
    <div class="flex items-start justify-between gap-3">
      <h3 class="text-lg font-semibold group-hover:text-accent">${e(project.name)}</h3>
      ${c.levelBadge(project.level, ctx.catalog.levels)}
    </div>
    <p class="mt-2 flex-1 text-sm text-ink-2">${e(project.summary)}</p>
    <div class="mt-4 flex flex-wrap gap-1.5">${c.categoryChip(ctx.catalog, project.category)}${c.tagChips(project.tags.slice(0, 3))}</div>
    <div class="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
      <span class="flex items-center gap-1.5">${dots}</span>${fastestTeaser(ctx, project)}
    </div>
  </a>`;
}
