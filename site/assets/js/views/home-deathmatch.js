/* Home sections of the deathmatch: hero with the fighter roster, reigning champions, arenas. */
import * as format from '../lib/format.js';
import * as filters from '../lib/filters.js';
import * as arenas from '../lib/arena.js';
import * as tournament from '../lib/tournament.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';
import * as fighterUi from '../ui/fighter.js';

const e = format.escapeHtml;

function rosterLink(language) {
  const href = router.build('deathmatch', {}, { fighter: language.id });

  return `<a class="portrait" href="${href}" aria-label="${e(`Fight as ${language.name}`)}">${fighterUi.emblem(language, 'md')}
    <span class="truncate">${e(language.name)}</span></a>`;
}

export function hero(ctx) {
  const { catalog, results } = ctx;
  const open = arenas.listArenas(catalog, results).filter((a) => a.open).length;
  const implementations = catalog.projects.reduce((sum, p) => sum + p.languages.length, 0);
  const lastRun = results ? format.dateTime(results.generatedAt).slice(0, 10) : 'not yet';

  return `<section class="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 sm:px-10 sm:py-16">
    <div class="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-blood/25 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-gold/10 blur-3xl"></div>
    <div class="relative grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center">
      <div>
        <p class="dm-eyebrow">Same program · many languages · real benchmarks</p>
        <h1 class="dm-title mt-4 text-[clamp(2.5rem,12vw,6.5rem)]">Language<br>Deathmatch</h1>
        <p class="mt-5 max-w-xl text-base text-ink-2 sm:text-lg">Choose your fighter. Choose your arena. Fight every other language,
          one after another — every blow is a real benchmark of the same program, verified byte for byte and measured in Docker.</p>
        <div class="mt-7 flex flex-wrap items-center gap-3">
          <a class="dm-button" href="${router.build('deathmatch')}">Choose your fighter</a>
          <button type="button" class="pill" data-scroll="projects">Browse the code</button>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3" aria-label="Fighters">${catalog.languages.map(rosterLink).join('')}</div>
    </div>
    <div class="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${c.statTile('Fighters', catalog.languages.length)}
      ${c.statTile('Open arenas', `${open} of ${catalog.categories.length}`)}
      ${c.statTile('Projects', catalog.projects.length, `${implementations} implementations`)}
      ${c.statTile('Last benchmark', lastRun, results && results.commit ? `commit ${results.commit}` : '')}
    </div>
  </section>`;
}

function championCard(ctx, arena) {
  const [top] = tournament.standings(arena);
  const language = ctx.catalog.languages.find((l) => l.id === top.language);
  const href = router.build('deathmatch', { arena: arena.id });

  return `<a class="arena-card block" style="${fighterUi.arenaStyle(arena.category)}" href="${href}">
    <span class="flex items-center gap-4">${fighterUi.emblem(language, 'md')}
      <span class="min-w-0"><span class="block font-display text-3xl leading-none tracking-wide text-ink uppercase">${e(language.name)}</span>
        <span class="mt-1 block text-xs text-ink-3">${top.wins}–${top.losses}${top.draws ? `–${top.draws}` : ''} in ${e(arena.category.arena.stage)}</span></span></span>
    <span class="mt-3 block text-xs font-medium tracking-wide text-ink-3 uppercase">${e(arena.category.name)} · rankings →</span>
  </a>`;
}

/** One card per open arena with its rank-1 fighter; empty without results. */
export function championsSection(ctx) {
  const open = arenas.listArenas(ctx.catalog, ctx.results).filter((a) => a.open);

  if (!open.length) {
    return '';
  }

  return `<section class="mt-14">${c.sectionTitle('Reigning champions', 'The fighter ranked first in each open arena\'s round-robin.')}
    <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">${open.map((a) => championCard(ctx, a)).join('')}</div></section>`;
}

function arenaCard(arena, count) {
  const rankings = arena.open ? `<a class="text-accent hover:underline" href="${router.build('deathmatch', { arena: arena.id })}">Rankings</a>` : '';
  const status = arena.open ? format.plural(arena.fighters.length, 'fighter') : '🔒 locked';

  return `<div class="arena-card ${count ? '' : 'opacity-60'}" style="${fighterUi.arenaStyle(arena.category)}">
    <div class="flex items-start justify-between gap-2"><span class="min-w-0">${fighterUi.arenaTitle(arena.category)}</span>
      <span class="shrink-0 text-xs text-ink-3">${count ? format.plural(count, 'project') : 'planned'}</span></div>
    <p class="mt-2 text-sm text-ink-3">${e(arena.category.description)}</p>
    <div class="mt-3 flex items-center gap-4 text-sm font-medium">
      <button type="button" class="text-ink-2 hover:text-ink" data-category="${e(arena.id)}" ${count ? '' : 'disabled'}>Projects</button>
      ${rankings}<span class="ml-auto text-xs font-normal text-ink-3">${status}</span></div>
  </div>`;
}

/** Every category as an arena: project count, open/locked, links to its projects and rankings. */
export function arenasSection(ctx) {
  const counts = filters.countByCategory(ctx.catalog.projects);
  const cards = arenas.listArenas(ctx.catalog, ctx.results).map((a) => arenaCard(a, counts[a.id] || 0)).join('');

  return `<section class="mt-14">${c.sectionTitle('Arenas', 'Every project belongs to one category — its arena — and one complexity level (1 Trivial → 5 Expert).')}
    <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">${cards}</div></section>`;
}
