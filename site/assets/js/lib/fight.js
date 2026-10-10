/* Rules of combat (docs/10-deathmatch.md): blows, rounds and matches between two fighters of an
   arena. Deterministic: the same arena data always produces the same match. Pure, no DOM. */

export const MAX_HEALTH = 100;
/** Damage a round deals for a 2× advantage on every one of its comparisons. */
export const ROUND_POWER = 50;
/** Ratios below this are measurement noise: the blow is blocked. */
export const BLOCK_FACTOR = 1.05;
/** An order of magnitude: critical hits, and the threshold of a fatality. */
export const CRITICAL_FACTOR = 10;
const WINS_NEEDED = 2;

/**
 * Rounds in play order: speed and memory compare every benchmark case, brevity every project.
 * (Image size is not a round: it is the same for every project of a language, so it would push
 * the same verdict in every arena.)
 */
export const ROUNDS = [
  { id: 'speed', name: 'Speed', source: 'cases', metrics: ['wall'] },
  { id: 'memory', name: 'Memory', source: 'cases', metrics: ['memory'] },
  { id: 'brevity', name: 'Brevity', source: 'code', metrics: ['loc'] },
];

const MOVE_TIERS = [
  { below: BLOCK_FACTOR, id: 'block' },
  { below: 1.5, id: 'jab' },
  { below: 2.5, id: 'kick' },
  { below: 5, id: 'uppercut' },
  { below: CRITICAL_FACTOR, id: 'special' },
];

export function opponentOf(side) {
  return side === 'a' ? 'b' : 'a';
}

/** Move tier of a blow: block, jab, kick, uppercut, special or critical. */
export function moveTier(factor) {
  const tier = MOVE_TIERS.find((t) => factor < t.below);
  return tier ? tier.id : 'critical';
}

/** Damage of a blow won by `factor` in a round of `count` comparisons (0 when blocked). */
export function damageFor(factor, count) {
  if (factor < BLOCK_FACTOR) {
    return 0;
  }

  const raw = Math.round((ROUND_POWER * Math.log2(factor)) / count);
  return Math.min(MAX_HEALTH, Math.max(1, raw));
}

/**
 * Comparisons of a round for the pair { a, b }: one per entry and metric where both fighters
 * have a positive value. Returns [{ entry, metric, a, b }] in arena order.
 */
export function comparisons(arena, round, pair) {
  const entries = round.source === 'code' ? arena.code : arena.cases;
  const list = [];

  for (const entry of entries) {
    for (const metric of round.metrics) {
      const x = entry.values[pair.a] ? entry.values[pair.a][metric] : 0;
      const y = entry.values[pair.b] ? entry.values[pair.b][metric] : 0;

      if (x > 0 && y > 0) {
        list.push({ entry, metric, a: x, b: y });
      }
    }
  }

  return list;
}

/** Resolves one comparison: attacker ('a', 'b' or null when blocked), factor, damage, move. */
export function resolveBlow(comparison, count) {
  const factor = Math.max(comparison.a, comparison.b) / Math.min(comparison.a, comparison.b);
  const move = moveTier(factor);
  const attacker = move === 'block' ? null : comparison.a < comparison.b ? 'a' : 'b';
  return { ...comparison, factor, move, attacker, damage: attacker ? damageFor(factor, count) : 0 };
}

/** Damage taken by each side over a list of blows. */
function damageTaken(blows) {
  const taken = { a: 0, b: 0 };

  for (const blow of blows) {
    if (blow.attacker) {
      taken[opponentOf(blow.attacker)] += blow.damage;
    }
  }

  return taken;
}

/** Moves the finishing blow (most damage on the loser, later one on ties) to the end. */
function withFinisherLast(blows, winner) {
  let finisher = -1;

  blows.forEach((blow, i) => {
    if (blow.attacker === winner && (finisher < 0 || blow.damage >= blows[finisher].damage)) {
      finisher = i;
    }
  });

  if (finisher < 0) {
    return blows;
  }

  return [...blows.slice(0, finisher), ...blows.slice(finisher + 1), blows[finisher]];
}

/** Plays one round: the fighter who took less damage wins; K.O. when the loser has no health left. */
export function playRound(arena, round, pair) {
  const list = comparisons(arena, round, pair);
  const blows = list.map((c) => resolveBlow(c, list.length));
  const taken = damageTaken(blows);
  const health = { a: Math.max(0, MAX_HEALTH - taken.a), b: Math.max(0, MAX_HEALTH - taken.b) };
  const winner = taken.a === taken.b ? null : taken.a < taken.b ? 'a' : 'b';
  const ko = Boolean(winner) && health[opponentOf(winner)] === 0;
  const flawless = Boolean(winner) && taken[winner] === 0;
  const ordered = winner ? withFinisherLast(blows, winner) : blows;
  return { id: round.id, name: round.name, blows: ordered, taken, health, winner, ko, flawless };
}

/** Match winner: more round wins; on a tie, more health left over all rounds; else a draw. */
function matchWinner(rounds, score) {
  if (score.a !== score.b) {
    return score.a > score.b ? 'a' : 'b';
  }

  const left = (side) => rounds.reduce((sum, r) => sum + r.health[side], 0);
  const difference = left('a') - left('b');

  if (difference === 0) {
    return null;
  }

  return difference > 0 ? 'a' : 'b';
}

/** Fatality: the winner knocked the loser out in the last round with a critical finishing blow. */
function isFatality(rounds, winner) {
  const last = rounds[rounds.length - 1];

  if (!winner || !last || last.winner !== winner || !last.ko) {
    return false;
  }

  return last.blows[last.blows.length - 1].factor >= CRITICAL_FACTOR;
}

/**
 * Plays a best-of-three match between fighters a and b (language ids) in an arena.
 * Returns { arena, a, b, rounds, score: { a, b }, winner: 'a' | 'b' | null, fatality }.
 */
export function playMatch(arena, a, b) {
  const pair = { a, b };
  const rounds = [];
  const score = { a: 0, b: 0 };

  for (const round of ROUNDS) {
    if (score.a >= WINS_NEEDED || score.b >= WINS_NEEDED) {
      break;
    }

    const played = playRound(arena, round, pair);
    rounds.push(played);

    if (played.winner) {
      score[played.winner] += 1;
    }
  }

  const winner = matchWinner(rounds, score);
  return { arena: arena.id, a, b, rounds, score, winner, fatality: isFatality(rounds, winner) };
}

/** Winner of a match as a language id, or null for a draw. */
export function winnerId(match) {
  return match.winner ? match[match.winner] : null;
}
