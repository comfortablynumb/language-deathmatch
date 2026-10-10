/* Deathmatch route: #/deathmatch[/:arena[/:fighter[/:opponent]]] → select, rankings, tower, fight. */
import { buildArena, canFight } from '../lib/arena.js';
import { notfound } from './pages.js';
import * as common from './deathmatch-common.js';
import { select } from './deathmatch-select.js';
import { rankingsView } from './deathmatch-rankings.js';
import { towerView } from './deathmatch-tower.js';
import { fightView } from './deathmatch-fight.js';

/** The fight screen once arena, fighter and opponent are known to be valid ids. */
function fight(ctx, arena, fighter, opponentId) {
  const opponent = common.languageOf(ctx, opponentId);

  if (!opponent) {
    notfound(ctx);
    return;
  }

  if (common.notInArena(ctx, arena, opponent)) {
    return;
  }

  if (!canFight(arena, fighter.id, opponent.id)) {
    common.blocked(ctx, `${fighter.name} cannot fight ${opponent.name} here`, 'They share no benchmark case in this arena.');
    return;
  }

  fightView(ctx, arena, fighter, opponent);
}

export function render(ctx) {
  const { arena: arenaId, fighter: fighterId, opponent } = ctx.route.params;

  if (!ctx.results) {
    common.noResults(ctx);
    return;
  }

  if (!arenaId) {
    select(ctx);
    return;
  }

  const arena = buildArena(ctx.catalog, ctx.results, arenaId);
  const fighter = fighterId ? common.languageOf(ctx, fighterId) : null;

  if (!arena || (fighterId && !fighter)) {
    notfound(ctx);
    return;
  }

  if (common.arenaLocked(ctx, arena)) {
    return;
  }

  if (!fighter) {
    rankingsView(ctx, arena);
    return;
  }

  if (common.notInArena(ctx, arena, fighter)) {
    return;
  }

  if (!arena.fighters.some((id) => canFight(arena, fighter.id, id))) {
    common.blocked(ctx, `No opponent for ${fighter.name}`, 'No other fighter shares a benchmark case with it in this arena.');
    return;
  }

  if (opponent) {
    fight(ctx, arena, fighter, opponent);
  } else {
    towerView(ctx, arena, fighter);
  }
}
