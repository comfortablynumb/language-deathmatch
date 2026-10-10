/* Helpers shared by the deathmatch screens: lookups, guards, breadcrumbs, scores, climbs. */
import * as format from '../lib/format.js';
import * as router from '../lib/router.js';
import * as progress from '../lib/progress.js';
import * as tournament from '../lib/tournament.js';
import { opponentOf } from '../lib/fight.js';
import * as c from '../ui/components.js';

const e = format.escapeHtml;

export function languageOf(ctx, id) {
  return ctx.catalog.languages.find((l) => l.id === id) || null;
}

export function link(params, query) {
  return router.build('deathmatch', params, query);
}

/** Breadcrumb; items: [{ label, href? }], the last one is the current page. */
export function breadcrumb(items) {
  const parts = items.map((item, i) => (i < items.length - 1 && item.href
    ? `<a class="hover:text-ink" href="${item.href}">${e(item.label)}</a>`
    : `<span class="text-ink-2">${e(item.label)}</span>`));

  return `<nav class="text-sm text-ink-3" aria-label="Breadcrumb">${parts.join(' <span aria-hidden="true">/</span> ')}</nav>`;
}

/** Crumbs down to an arena's rankings page. */
export function arenaCrumbs(arena) {
  return [{ label: 'Deathmatch', href: link({}) }, { label: arena.category.arena.stage, href: link({ arena: arena.id }) }];
}

/** Full-page explanation used by every guard. */
export function blocked(ctx, title, body) {
  ctx.$root.html(`<div class="py-10">${c.emptyState(title, `${body} <a class="text-accent hover:underline" href="${link({})}">Choose another fight</a>.`)}</div>`);
}

export function noResults(ctx) {
  blocked(ctx, 'No fights yet', 'Fights are replays of benchmark results, and none are published yet. Run <code class="font-mono text-ink">bin/bench.sh</code> (Docker required) or let the CI publish them.');
}

/** True (after rendering an explanation) when the arena cannot host fights. */
export function arenaLocked(ctx, arena) {
  if (arena.open) {
    return false;
  }

  const why = arena.projects.length === 0 ? 'No project in this category yet.' : 'Fewer than two languages have verified results here.';
  blocked(ctx, `${arena.category.arena.stage} is locked`, why);
  return true;
}

/** True (after rendering an explanation) when the language does not fight in the arena. */
export function notInArena(ctx, arena, language) {
  if (arena.fighters.includes(language.id)) {
    return false;
  }

  blocked(ctx, `${language.name} does not fight in ${arena.category.arena.stage}`, `${e(language.name)} has no verified implementation with results in ${e(arena.category.name)}.`);
  return true;
}

/** Score from one side's point of view: "2–1". */
export function scoreFor(match, side) {
  return `${match.score[side]}–${match.score[opponentOf(side)]}`;
}

/** Rounds a side won without taking damage. */
export function flawlessRounds(match, side) {
  return match.rounds.filter((r) => r.winner === side && r.flawless).length;
}

/** FATALITY / FLAWLESS badges earned by one side of a match. */
export function matchBadges(match, side, badge) {
  const parts = [];
  const flawless = flawlessRounds(match, side);

  if (match.fatality && match.winner === side) {
    parts.push(badge('Fatality', 'blood'));
  }

  if (flawless > 0) {
    parts.push(badge(flawless > 1 ? `Flawless ×${flawless}` : 'Flawless'));
  }

  return parts.join('');
}

/** The fighter's tower in an arena with the viewer's stored progress and its state. */
export function climbOf(ctx, arena, fighter) {
  const tower = tournament.tower(arena, fighter);
  const stored = progress.loadProgress(ctx.storage, arena.id, fighter);
  return { tower, state: progress.towerState(tower, stored) };
}

/** Saves new progress and returns the refreshed climb. */
export function saveClimb(ctx, climb, next) {
  progress.saveProgress(ctx.storage, climb.tower, next);
  return { tower: climb.tower, state: progress.towerState(climb.tower, next) };
}
