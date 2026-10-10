/* Arena tournaments: round-robin standings and arcade towers. Pure, no DOM. */
import { canFight } from './arena.js';
import { playMatch } from './fight.js';

/** Every match of the arena's round-robin (each pair once, catalog order). */
export function roundRobin(arena) {
  const matches = [];

  arena.fighters.forEach((a, i) => {
    for (const b of arena.fighters.slice(i + 1)) {
      if (canFight(arena, a, b)) {
        matches.push(playMatch(arena, a, b));
      }
    }
  });

  return matches;
}

function emptyRow(language, order) {
  return { language, order, matches: 0, wins: 0, losses: 0, draws: 0, roundsWon: 0, roundsLost: 0, fatalities: 0, flawless: 0 };
}

/** Adds one match to a fighter's row; side is the fighter's side in the match. */
function tally(row, match, side) {
  const other = side === 'a' ? 'b' : 'a';
  row.matches += 1;
  row.wins += match.winner === side ? 1 : 0;
  row.losses += match.winner === other ? 1 : 0;
  row.draws += match.winner ? 0 : 1;
  row.roundsWon += match.score[side];
  row.roundsLost += match.score[other];
  row.fatalities += match.fatality && match.winner === side ? 1 : 0;
  row.flawless += match.rounds.filter((r) => r.winner === side && r.flawless).length;
}

function compareRows(x, y) {
  const difference = (row) => row.roundsWon - row.roundsLost;
  return y.wins - x.wins || x.losses - y.losses || difference(y) - difference(x) || y.fatalities - x.fatalities || x.order - y.order;
}

/**
 * Standings of an arena: [{ language, rank, matches, wins, losses, draws, roundsWon, roundsLost,
 * fatalities, flawless }] sorted by wins, losses, round difference, fatalities, catalog order.
 */
export function standings(arena, matches = roundRobin(arena)) {
  const rows = new Map(arena.fighters.map((id, order) => [id, emptyRow(id, order)]));

  for (const match of matches) {
    tally(rows.get(match.a), match, 'a');
    tally(rows.get(match.b), match, 'b');
  }

  const ranked = [...rows.values()].filter((row) => row.matches > 0).sort(compareRows);
  return ranked.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * The tower of a fighter: every opponent it can fight, weakest first, the strongest last (the
 * boss). Returns { arena, fighter, opponents: [{ language, rank, match }] }; the fighter is side
 * 'a' of every match.
 */
export function tower(arena, fighter, table = standings(arena)) {
  const opponents = table
    .filter((row) => canFight(arena, fighter, row.language))
    .sort((x, y) => y.rank - x.rank)
    .map((row) => ({ language: row.language, rank: row.rank, match: playMatch(arena, fighter, row.language) }));

  return { arena: arena.id, fighter, opponents };
}

/** Outcome of a match for one fighter: 'won', 'lost' or 'draw'. */
export function outcomeFor(match, language) {
  if (!match.winner) {
    return 'draw';
  }

  return match[match.winner] === language ? 'won' : 'lost';
}
