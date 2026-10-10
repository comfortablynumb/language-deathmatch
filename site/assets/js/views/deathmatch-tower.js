/* Deathmatch tower: the fighter's ladder of opponents in an arena, weakest at the bottom and the
   arena's strongest on top. Results stay hidden until each fight has been watched. */
import * as format from '../lib/format.js';
import * as progress from '../lib/progress.js';
import * as fighterUi from '../ui/fighter.js';
import * as common from './deathmatch-common.js';

const e = format.escapeHtml;

function stepAction(ctx, climb, step) {
  const href = common.link({ arena: climb.tower.arena, fighter: climb.tower.fighter, opponent: step.language });

  if (step.state === 'next') {
    return `<a class="dm-button px-4 text-xl" href="${href}">Fight!</a>`;
  }

  if (step.state === 'locked') {
    return '<span class="text-xl text-ink-3" role="img" aria-label="Locked">🔒</span>';
  }

  const score = common.scoreFor(step.match, 'a');
  const badges = common.matchBadges(step.match, 'a', fighterUi.badge);
  return `<span class="flex flex-wrap items-center justify-end gap-1.5">${fighterUi.outcomeBadge(step.state, score)}${badges}
    <a class="text-xs font-medium text-accent hover:underline" href="${href}">Replay</a></span>`;
}

function stepRow(ctx, climb, step, index) {
  const language = common.languageOf(ctx, step.language);
  const boss = index === climb.tower.opponents.length - 1 ? fighterUi.badge('Boss', 'blood') : '';

  return `<li class="tower-step" data-state="${step.state}">
    <span class="tower-floor" aria-label="Fight ${index + 1}">${index + 1}</span>
    ${fighterUi.emblem(language, 'sm')}
    <span class="flex min-w-0 items-center gap-2">${fighterUi.nameplate(language)}${boss}</span>
    ${stepAction(ctx, climb, step)}
  </li>`;
}

const BANNERS = {
  ready: (c) => ['The climb begins', `${format.plural(c.state.total, 'opponent')} stand between ${c.name} and the title.`],
  climbing: (c) => ['Keep climbing', `${c.state.defeated} of ${c.state.total} defeated. Next: ${c.next}.`],
  'game-over': (c) => ['Game over', `${c.name} fell. Continue the climb, or choose another fighter.`],
  champion: (c) => ['Champion!', `${c.name} conquered ${c.stage}: ${c.state.total} of ${c.state.total} defeated. “${c.quote}”`],
  finished: (c) => ['Tower complete', `${c.name} defeated ${c.state.defeated} of ${c.state.total} opponents in ${c.stage}.`],
};

function banner(ctx, climb, arena) {
  const language = common.languageOf(ctx, climb.tower.fighter);
  const next = climb.state.next ? common.languageOf(ctx, climb.state.next.language).name : '';
  const info = { name: language.name, quote: language.fighter.quote, stage: arena.category.arena.stage, state: climb.state, next };
  const [title, body] = BANNERS[climb.state.status](info);
  const continueButton = climb.state.status === 'game-over'
    ? '<button type="button" class="dm-button mt-5" data-continue>Continue?</button>' : '';

  return `<section class="card p-6 text-center"><p class="dm-title text-5xl sm:text-6xl">${e(title)}</p>
    <p class="mx-auto mt-3 max-w-xl text-ink-2">${e(body)}</p>${continueButton}</section>`;
}

function render(ctx, arena, climb) {
  const language = common.languageOf(ctx, climb.tower.fighter);
  const rows = climb.state.steps.map((step, i) => stepRow(ctx, climb, step, i)).reverse().join('');
  const crumbs = [...common.arenaCrumbs(arena), { label: `${language.name}'s tower` }];

  ctx.$root.html(`${common.breadcrumb(crumbs)}
    <header class="mt-6 flex flex-wrap items-center gap-5" style="${fighterUi.arenaStyle(arena.category)}">
      ${fighterUi.emblem(language, 'lg')}
      <div class="min-w-0"><p class="dm-eyebrow">${e(arena.category.arena.stage)} · ${e(arena.category.name)}</p>
        <h1 class="dm-title mt-2 text-5xl sm:text-6xl">${e(language.name)}'s tower</h1>
        <p class="mt-2 text-sm text-ink-3">${climb.state.defeated} of ${climb.state.total} defeated · continues used: ${climb.state.progress.continues}</p></div>
    </header>
    <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div><ol class="space-y-3" aria-label="Opponents, boss first">${rows}</ol>
        <div class="tower-step mt-3 border-dashed" data-state="you"><span class="tower-floor">P1</span>${fighterUi.emblem(language, 'sm')}
          ${fighterUi.nameplate(language)}<span class="chip">you</span></div></div>
      <div class="space-y-4">${banner(ctx, climb, arena)}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="pill" data-reveal>Reveal all results</button>
          <button type="button" class="pill" data-reset>Reset climb</button>
          <a class="pill" href="${common.link({ arena: arena.id })}">Arena rankings</a>
          <a class="pill" href="${common.link({}, { arena: arena.id })}">Choose another fighter</a>
        </div></div>
    </div>`);
}

/** Renders the tower of `fighter` (a language) in an open arena it fights in. */
export function towerView(ctx, arena, language) {
  document.title = format.pageTitle(`${language.name}'s tower`, arena.category.arena.stage);
  let climb = common.climbOf(ctx, arena, language.id);
  const update = (next) => {
    climb = common.saveClimb(ctx, climb, next);
    render(ctx, arena, climb);
  };

  render(ctx, arena, climb);
  ctx.$root.on('click', '[data-continue]', () => update(progress.spendContinue(climb.tower, climb.state.progress)));
  ctx.$root.on('click', '[data-reveal]', () => update(progress.revealAll(climb.tower)));
  ctx.$root.on('click', '[data-reset]', () => {
    progress.clearProgress(ctx.storage, climb.tower);
    climb = common.climbOf(ctx, arena, language.id);
    render(ctx, arena, climb);
  });
}
