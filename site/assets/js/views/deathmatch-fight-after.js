/* After a fight: the result card with the climb's next step, and the round-by-round scorecard. */
import * as format from '../lib/format.js';
import * as fighterUi from '../ui/fighter.js';
import * as common from './deathmatch-common.js';

const e = format.escapeHtml;

/** What the climb says now: [title, body, actions HTML]. */
function climbMessage(ctx, fight, climb) {
  const { arena, languages } = fight;
  const tower = common.link({ arena: arena.id, fighter: languages.a.id });
  const towerLink = `<a class="pill" href="${tower}">${e(languages.a.name)}'s tower</a>`;
  const counted = climb.state.progress.watched.includes(languages.b.id);
  const state = climb.state;

  if (!counted) {
    const next = state.next ? ` Next in the climb: ${common.languageOf(ctx, state.next.language).name}.` : '';
    return ['Exhibition match', `This was not ${languages.a.name}'s next fight, so it does not count for the climb.${next}`, towerLink];
  }

  if (state.status === 'champion') {
    return ['Champion!', `${languages.a.name} conquered ${arena.category.arena.stage}: every opponent defeated.`, towerLink];
  }

  if (state.status === 'game-over') {
    const actions = `<button type="button" class="dm-button" data-continue>Continue?</button>
      <a class="pill" href="${common.link({}, { arena: arena.id })}">Choose another fighter</a>`;
    return ['Game over', `${languages.b.name} stopped the climb.`, actions];
  }

  if (state.next) {
    const opponent = common.languageOf(ctx, state.next.language);
    const href = common.link({ arena: arena.id, fighter: languages.a.id, opponent: opponent.id });
    return ['Next opponent', `${opponent.name} — ${opponent.fighter.nickname} — waits on the next floor.`,
      `<a class="dm-button" href="${href}">Next fight →</a>${towerLink}`];
  }

  return ['Tower complete', `${languages.a.name} defeated ${state.defeated} of ${state.total} opponents.`, towerLink];
}

/** Result card: winner, score, badges, then the climb's next step. */
export function afterFight(ctx, fight, climb) {
  const result = fight.steps[fight.steps.length - 1];
  const side = fight.match.winner;
  const badges = side ? common.matchBadges(fight.match, side, fighterUi.badge) : '';
  const quote = result.quote ? `<blockquote class="mt-3 text-ink-2 italic">“${e(result.quote)}”</blockquote>` : '';
  const [title, body, actions] = climbMessage(ctx, fight, climb);

  return `<section class="card p-6">
    <p class="dm-eyebrow">Result</p>
    <p class="dm-title mt-2 text-5xl">${e(result.text)} <span class="text-ink-2">${e(result.sub)}</span></p>
    <div class="mt-3 flex flex-wrap gap-1.5">${badges}</div>${quote}
    <div class="mt-6 border-t border-line pt-5"><p class="font-display text-2xl tracking-wide uppercase">${e(title)}</p>
      <p class="mt-1 text-sm text-ink-2">${e(body)}</p>
      <div class="mt-4 flex flex-wrap items-center gap-2">${actions}
        <a class="pill" href="${common.link({ arena: fight.arena.id })}">Arena rankings</a></div></div>
  </section>`;
}

function finishOf(match, round, index) {
  if (!round.winner) {
    return 'Draw';
  }

  if (match.fatality && index === match.rounds.length - 1) {
    return 'Fatality';
  }

  return round.ko ? 'K.O.' : 'Time';
}

/** Round-by-round table: winner, finish, health left, blows. */
export function scorecard(fight) {
  const { match, languages } = fight;
  const rows = match.rounds.map((round, i) => {
    const winner = round.winner ? languages[round.winner].name : '—';
    const blocked = round.blows.filter((b) => !b.attacker).length;
    const flawless = round.flawless ? ' · flawless' : '';

    return `<tr><td class="text-ink">${i + 1} · ${e(round.name)}</td><td class="text-ink">${e(winner)}</td>
      <td>${finishOf(match, round, i)}${flawless}</td><td>${round.health.a} – ${round.health.b}</td>
      <td>${round.blows.length}${blocked ? ` (${blocked} blocked)` : ''}</td></tr>`;
  }).join('');

  return `<section class="card p-5"><h2 class="font-display text-2xl tracking-wide uppercase">Scorecard</h2>
    <div class="mt-3 overflow-x-auto"><table class="data-table">
      <thead><tr><th>Round</th><th>Winner</th><th>Finish</th><th>Health ${e(languages.a.name)} – ${e(languages.b.name)}</th><th>Blows</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="mt-3 text-xs text-ink-3">Each round starts at 100 health. Damage = 50 × log₂(ratio) ÷ blows in the round; ratios under 1.05× are blocked.</p>
  </section>`;
}
