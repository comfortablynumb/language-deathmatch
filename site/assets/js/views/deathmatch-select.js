/* Deathmatch select screen: choose your fighter, choose your arena, FIGHT. Selection lives in the
   URL query (?fighter=rust&arena=algorithms) so the screen can be shared. */
import * as format from '../lib/format.js';
import * as arenas from '../lib/arena.js';
import * as fighterUi from '../ui/fighter.js';
import * as shared from './shared.js';
import { link } from './deathmatch-common.js';

const e = format.escapeHtml;

/** Arenas the fighter can climb: open, and with at least one opponent for it. */
function climbable(arena, fighter) {
  return arena.open && arena.fighters.includes(fighter) && arena.fighters.some((id) => arenas.canFight(arena, fighter, id));
}

function initialState(ctx, list) {
  const query = ctx.route.query;
  const fighter = ctx.catalog.languages.some((l) => l.id === query.fighter) ? query.fighter : '';
  const wanted = list.find((a) => a.id === query.arena);
  const arena = wanted && (!fighter || climbable(wanted, fighter)) ? wanted.id : '';
  return { fighter, arena };
}

function preview(ctx, state) {
  const language = ctx.catalog.languages.find((l) => l.id === state.fighter);

  if (!language) {
    return `<div class="card flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <p class="dm-title text-4xl">Player 1</p><p class="mt-3 text-sm text-ink-3">Pick a fighter from the roster.</p></div>`;
  }

  const count = ctx.arenaList.filter((a) => climbable(a, language.id)).length;
  const f = language.fighter;

  return `<div class="card relative overflow-hidden p-6" style="--lang-color:${e(language.color)}">
    <div class="absolute inset-x-0 top-0 h-1" style="background:${e(language.color)}"></div>
    <div class="flex items-center gap-5">${fighterUi.emblem(language, 'lg')}
      <div class="min-w-0"><p class="dm-title text-5xl">${e(language.name)}</p><p class="mt-1 text-ink-2">${e(f.nickname)}</p>
        <div class="mt-2 flex flex-wrap gap-1.5"><span class="chip">${e(language.kind)}</span><span class="chip">${e(language.toolchain)}</span></div></div>
    </div>
    <dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
      <div><dt class="text-xs tracking-wide text-ink-3 uppercase">Special move</dt><dd class="mt-0.5 font-medium text-ink">${e(f.special)}</dd></div>
      <div><dt class="text-xs tracking-wide text-ink-3 uppercase">Fatality</dt><dd class="mt-0.5 font-medium text-ink">${e(f.fatality)}</dd></div>
    </dl>
    <blockquote class="mt-5 border-l-2 border-gold/60 pl-3 text-ink-2 italic">“${e(f.quote)}”</blockquote>
    <p class="mt-5 text-xs text-ink-3">Fights in ${format.plural(count, 'arena')}.</p>
  </div>`;
}

function arenaCard(arena, state) {
  const reason = arenas.lockReason(arena);
  const usable = !state.fighter || climbable(arena, state.fighter);
  const note = reason === 'no-projects' ? 'Locked · no project yet'
    : reason === 'no-results' ? 'Locked · not enough fighters'
      : usable ? `${format.plural(arena.projects.length, 'project')} · ${format.plural(arena.fighters.length, 'fighter')}`
        : 'Your fighter has no results here';

  return `<button type="button" class="arena-card" style="${fighterUi.arenaStyle(arena.category)}" data-arena="${e(arena.id)}"
    aria-pressed="${arena.id === state.arena}" ${reason || !usable ? 'disabled' : ''}>
    ${fighterUi.arenaTitle(arena.category)}
    <span class="mt-2 block text-sm text-ink-2">${e(arena.category.arena.tagline)}</span>
    <span class="mt-2 block text-xs text-ink-3">${reason ? '🔒 ' : ''}${e(note)}</span>
  </button>`;
}

function fightButton(state) {
  const ready = state.fighter && state.arena;
  const href = ready ? link({ arena: state.arena, fighter: state.fighter }) : '#/deathmatch';
  return `<a class="dm-button" href="${href}" aria-disabled="${!ready}" ${ready ? '' : 'tabindex="-1"'}>Fight!</a>`;
}

const RULES = `<ul class="mt-3 space-y-1.5 text-sm text-ink-2">
  <li><b class="text-ink">Best of three rounds:</b> Speed (wall time), Memory (peak memory), then Brevity (lines of code) at 1–1.</li>
  <li><b class="text-ink">Every blow is a benchmark case:</b> the faster (or leaner) language hits; damage grows with how many times better it was.</li>
  <li><b class="text-ink">Climb the tower:</b> beat every other language of the arena, weakest first, the arena's strongest last.</li>
</ul>`;

function refresh(ctx, state) {
  ctx.$root.find('#dm-preview').html(preview(ctx, state));
  ctx.$root.find('#dm-arenas').html(ctx.arenaList.map((a) => arenaCard(a, state)).join(''));
  ctx.$root.find('#dm-go').html(fightButton(state));
  ctx.$root.find('[data-fighter]').attr('aria-pressed', function () { return String($(this).attr('data-fighter') === state.fighter); });
  shared.replaceQuery(ctx.route, { fighter: state.fighter, arena: state.arena });
}

export function select(ctx) {
  document.title = format.pageTitle('Choose your fighter');
  ctx.arenaList = arenas.listArenas(ctx.catalog, ctx.results);
  const state = initialState(ctx, ctx.arenaList);
  const portraits = ctx.catalog.languages.map((l) => fighterUi.portrait(l, l.id === state.fighter)).join('');

  ctx.$root.html(`<header class="text-center"><p class="dm-eyebrow">Language Deathmatch</p>
      <h1 class="dm-title mt-3 text-[clamp(2.75rem,10vw,6rem)]">Choose your fighter</h1></header>
    <div class="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div id="dm-preview" class="lg:sticky lg:top-24 lg:self-start"></div>
      <div>
        <div class="grid grid-cols-3 gap-3 sm:grid-cols-6" role="group" aria-label="Fighters">${portraits}</div>
        <h2 class="dm-title mt-10 text-4xl sm:text-5xl">Choose your arena</h2>
        <div id="dm-arenas" class="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Arenas"></div>
        <div class="mt-6 flex flex-wrap items-center gap-4"><span id="dm-go"></span>
          <a class="text-sm font-medium text-accent hover:underline" href="#/methodology?section=fight-rules">How fights are scored →</a></div>
      </div>
    </div>
    <section class="card mt-10 p-5 sm:p-6"><h2 class="font-display text-2xl tracking-wide uppercase">How a fight works</h2>${RULES}</section>`);

  bind(ctx, state);
  refresh(ctx, state);
}

function bind(ctx, state) {
  ctx.$root.on('click', '[data-fighter]', function () {
    state.fighter = $(this).attr('data-fighter');
    const current = ctx.arenaList.find((a) => a.id === state.arena);
    state.arena = current && climbable(current, state.fighter) ? state.arena : '';
    refresh(ctx, state);
  });

  ctx.$root.on('click', '[data-arena]', function () {
    state.arena = $(this).attr('data-arena');
    refresh(ctx, state);
  });
}
