/* Arena rankings: round-robin standings and the head-to-head matrix of every fight. */
import * as format from '../lib/format.js';
import * as arenas from '../lib/arena.js';
import { playMatch } from '../lib/fight.js';
import * as tournament from '../lib/tournament.js';
import * as fighterUi from '../ui/fighter.js';
import * as c from '../ui/components.js';
import * as common from './deathmatch-common.js';

const e = format.escapeHtml;

function championCard(ctx, arena, top) {
  const language = common.languageOf(ctx, top.language);

  return `<section class="card relative self-start overflow-hidden p-6" style="${fighterUi.arenaStyle(arena.category)}">
    <p class="dm-eyebrow">Arena champion</p>
    <div class="mt-4 flex items-center gap-5">${fighterUi.emblem(language, 'lg')}
      <div class="min-w-0"><p class="dm-title text-5xl">${e(language.name)}</p>
        <p class="mt-1 text-ink-2">${e(language.fighter.nickname)} · ${top.wins}–${top.losses}${top.draws ? `–${top.draws}` : ''}</p>
        <blockquote class="mt-2 text-sm text-ink-3 italic">“${e(language.fighter.quote)}”</blockquote></div>
    </div>
  </section>`;
}

function standingsTable(ctx, arena, rows) {
  const body = rows.map((r) => {
    const language = common.languageOf(ctx, r.language);
    const tower = common.link({ arena: arena.id, fighter: r.language });

    return `<tr><td class="font-semibold text-ink">${r.rank}</td>
      <td><a class="hover:text-accent" href="${tower}">${fighterUi.fighterLine(language)}</a></td>
      <td class="font-semibold text-ink">${r.wins}–${r.losses}${r.draws ? `–${r.draws}` : ''}</td>
      <td>${r.roundsWon}–${r.roundsLost}</td><td>${r.fatalities}</td><td>${r.flawless}</td></tr>`;
  }).join('');

  return c.panel('Standings', 'Every pair fights once. Sorted by wins, losses, round difference, fatalities.',
    `<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>#</th><th>Fighter</th><th>W–L</th><th>Rounds</th>
      <th>Fatalities</th><th>Flawless</th></tr></thead><tbody>${body}</tbody></table></div>`);
}

function matrixCell(arena, row, column) {
  if (row === column) {
    return '<td class="text-center text-ink-3">—</td>';
  }

  if (!arenas.canFight(arena, row, column)) {
    return '<td class="text-center text-ink-3">n/a</td>';
  }

  const match = playMatch(arena, row, column);
  const outcome = tournament.outcomeFor(match, row);
  const tone = { won: 'text-good', lost: 'text-critical', draw: 'text-ink-2' }[outcome];
  const label = `${{ won: 'W', lost: 'L', draw: 'D' }[outcome]} ${common.scoreFor(match, 'a')}`;
  const skull = match.fatality ? ' <span aria-label="fatality" title="Fatality">☠</span>' : '';
  const href = common.link({ arena: arena.id, fighter: row, opponent: column });
  return `<td class="text-center"><a class="font-semibold ${tone} hover:underline" href="${href}">${label}${skull}</a></td>`;
}

function matrix(ctx, arena, rows) {
  const ids = rows.map((r) => r.language);
  const name = (id) => e(common.languageOf(ctx, id).name);
  const head = ids.map((id) => `<th class="text-center">${name(id)}</th>`).join('');
  const body = ids.map((row) => `<tr><th scope="row" class="text-left">${name(row)}</th>${ids.map((col) => matrixCell(arena, row, col)).join('')}</tr>`).join('');

  return c.panel('Head to head', 'Row fighter against column fighter: W/L and rounds won–lost; ☠ = the fight ended in a fatality. Click a result to watch it.',
    `<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>vs</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
}

function arenaSwitcher(ctx, current) {
  const links = arenas.listArenas(ctx.catalog, ctx.results).filter((a) => a.open)
    .map((a) => `<a class="pill" aria-pressed="${a.id === current.id}" href="${common.link({ arena: a.id })}">${e(a.category.arena.stage)}</a>`)
    .join('');

  return `<div class="flex flex-wrap gap-2" role="group" aria-label="Arenas">${links}</div>`;
}

/** Renders the rankings of an open arena. */
export function rankingsView(ctx, arena) {
  const rows = tournament.standings(arena);
  const crumbs = [{ label: 'Deathmatch', href: common.link({}) }, { label: arena.category.arena.stage }];
  document.title = format.pageTitle('Rankings', arena.category.arena.stage);

  ctx.$root.html(`${common.breadcrumb(crumbs)}
    <header class="mt-6"><p class="dm-eyebrow">${e(arena.category.name)} · ${format.plural(arena.projects.length, 'project')}</p>
      <h1 class="dm-title mt-2 text-6xl sm:text-7xl">${e(arena.category.arena.stage)}</h1>
      <p class="mt-3 max-w-2xl text-ink-2">${e(arena.category.arena.tagline)} Projects: ${e(arena.projects.map((p) => p.name).join(', '))}.</p>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <a class="dm-button" href="${common.link({}, { arena: arena.id })}">Choose your fighter</a>${arenaSwitcher(ctx, arena)}</div>
    </header>
    <div class="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">${championCard(ctx, arena, rows[0])}${standingsTable(ctx, arena, rows)}</div>
    <div class="mt-6">${matrix(ctx, arena, rows)}</div>`);
}
