/* Fight script: turns a match into the ordered steps the fight player animates (announcer text,
   blows, health after every step, durations) plus commentary lines. Pure, no DOM. */
import * as format from './format.js';
import { MAX_HEALTH, opponentOf } from './fight.js';

/** Base duration of each step kind in ms (the player divides by its speed). */
export const DURATIONS = {
  intro: 1700, round: 1100, fight: 750, blow: 950, critical: 1250,
  finish: 1400, 'round-end': 1900, fatality: 2200, result: 0,
};

const METRICS = {
  wall: { label: 'Wall time', better: 'faster', format: (v) => format.duration(v) },
  memory: { label: 'Peak memory', better: 'leaner', format: (v) => format.memory(v) },
  loc: { label: 'Lines of code', better: 'shorter', format: (v) => format.plural(v, 'line') },
};

const ROUND_BLURBS = {
  speed: 'median wall time of every benchmark case',
  memory: 'median peak memory of every benchmark case',
  brevity: 'lines of code of every project (fewer wins)',
};

const BASIC_MOVES = { jab: 'Jab', kick: 'Kick', uppercut: 'Uppercut' };

const upper = (language) => language.name.toUpperCase();

/** Name of the move of a blow: a basic move, the attacker's special, or its fatality. */
export function moveName(blow, fighter, finishing) {
  if (finishing) {
    return fighter.fatality;
  }

  return BASIC_MOVES[blow.move] || fighter.special;
}

/** "Fibonacci › Startup" for cases, "Fibonacci › Lines of code" for brevity blows. */
export function blowLabel(blow) {
  const entry = blow.entry;
  return `${entry.projectName} › ${entry.caseName || METRICS[blow.metric].label}`;
}

/** One commentary line; languages = { a, b } catalog languages (with their fighter profile). */
export function commentary(blow, languages, finishing = false) {
  const metric = METRICS[blow.metric];

  if (!blow.attacker) {
    const values = `${languages.a.name} ${metric.format(blow.a)} vs ${languages.b.name} ${metric.format(blow.b)}`;
    return `Blocked · ${blowLabel(blow)}: ${values} (within 5%)`;
  }

  const attacker = languages[blow.attacker];
  const defender = opponentOf(blow.attacker);
  const values = `${metric.format(blow[blow.attacker])} vs ${metric.format(blow[defender])}`;
  const critical = blow.move === 'critical' ? ' · critical' : '';
  const move = moveName(blow, attacker.fighter, finishing);
  return `${attacker.name} — ${move} · ${blowLabel(blow)}: ${values} (${format.factor(blow.factor)} ${metric.better})${critical} · −${blow.damage}`;
}

/** Health shown after a blow: the round winner never shows 0, a K.O.'d loser falls on the last blow. */
function shownHealth(round, taken, isLast) {
  const shown = {};

  for (const side of ['a', 'b']) {
    const health = Math.max(0, MAX_HEALTH - taken[side]);
    const standing = Boolean(round.winner) && (side === round.winner || !isLast);
    shown[side] = standing ? Math.max(1, health) : health;
  }

  return shown;
}

function makeStep(kind, base, fields) {
  return {
    kind, text: '', sub: '', log: '', side: null, down: null, fatality: false, damage: 0, critical: false, blocked: false,
    blowIndex: 0, blowCount: 0, duration: DURATIONS[kind], ...base,
    health: { ...base.health }, wins: { ...base.wins }, ...fields,
  };
}

function blowStep(blow, ctx) {
  const critical = blow.move === 'critical';

  return makeStep('blow', ctx.base, {
    side: blow.attacker, damage: blow.damage, critical, blocked: !blow.attacker,
    blowIndex: ctx.index + 1, blowCount: ctx.count, project: blow.entry.project, caseId: blow.entry.caseId || '',
    move: blow.attacker ? moveName(blow, ctx.languages[blow.attacker].fighter, ctx.finishing) : 'Block',
    log: commentary(blow, ctx.languages, ctx.finishing),
    duration: critical || ctx.finishing ? DURATIONS.critical : DURATIONS.blow,
  });
}

/** Steps of the blows of a round, with FINISH THEM! before a fatality's finishing blow. */
function blowSteps(round, ctx) {
  const steps = [];
  const taken = { a: 0, b: 0 };

  round.blows.forEach((blow, index) => {
    const isLast = index === round.blows.length - 1;
    const finishing = ctx.fatal && isLast;

    if (finishing) {
      const before = { ...ctx.base, health: shownHealth(round, taken, false) };
      steps.push(makeStep('finish', before, { text: 'FINISH THEM!', log: 'Finish them!' }));
    }

    if (blow.attacker) {
      taken[opponentOf(blow.attacker)] += blow.damage;
    }

    const base = { ...ctx.base, health: shownHealth(round, taken, isLast) };
    steps.push(blowStep(blow, { ...ctx, base, index, count: round.blows.length, finishing }));
  });

  return steps;
}

function roundEndStep(round, ctx) {
  const n = ctx.base.round + 1;

  if (!round.winner) {
    return makeStep('round-end', ctx.base, { text: 'DRAW', sub: `NO WINNER IN ROUND ${n}`, log: `Draw — no winner in round ${n}.` });
  }

  const name = ctx.languages[round.winner].name;
  const flawless = round.flawless ? ' · FLAWLESS VICTORY' : '';
  const how = round.ko ? 'K.O.' : 'TIME';
  const healthLeft = `${round.health.a} vs ${round.health.b} health`;
  const log = `${round.ko ? 'K.O.!' : 'Time!'} ${name} wins round ${n} (${healthLeft})${round.flawless ? ' — flawless victory' : ''}.`;
  const down = round.ko ? opponentOf(round.winner) : null;
  return makeStep('round-end', ctx.base, { text: how, sub: `${name.toUpperCase()} WINS ROUND ${n}${flawless}`, side: round.winner, down, log });
}

function fatalityStep(round, ctx) {
  const winner = ctx.languages[round.winner];
  const sub = `${winner.fighter.fatality.toUpperCase()}${round.flawless ? ' · FLAWLESS VICTORY' : ''}`;
  const log = `Fatality! ${winner.name} performs ${winner.fighter.fatality}.`;
  return makeStep('fatality', ctx.base, { text: 'FATALITY', sub, side: round.winner, down: opponentOf(round.winner), fatality: true, log });
}

/** Steps of one round: announcement, FIGHT!, blows, then the round end (or the fatality). */
function roundSteps(round, ctx) {
  const n = ctx.base.round + 1;
  const full = { a: MAX_HEALTH, b: MAX_HEALTH };
  const start = { ...ctx.base, health: full };
  const blows = blowSteps(round, { ...ctx, base: start });
  const health = blows.length ? blows[blows.length - 1].health : full;
  const wins = { ...ctx.base.wins, ...(round.winner ? { [round.winner]: ctx.base.wins[round.winner] + 1 } : {}) };
  const end = { ...ctx, base: { ...ctx.base, health, wins } };

  return [
    makeStep('round', start, { text: `ROUND ${n}`, sub: round.name.toUpperCase(), log: `Round ${n} · ${round.name}: ${ROUND_BLURBS[round.id]}.` }),
    makeStep('fight', start, { text: 'FIGHT!' }),
    ...blows,
    ctx.fatal ? fatalityStep(round, end) : roundEndStep(round, end),
  ];
}

/** Plain-text result: "Rust wins 2–1 against Go by fatality" / "Rust and Go draw 1–1". */
export function resultSummary(match, languages) {
  const score = (side) => `${match.score[side]}–${match.score[opponentOf(side)]}`;

  if (!match.winner) {
    return `${languages.a.name} and ${languages.b.name} draw ${score('a')}`;
  }

  const loser = opponentOf(match.winner);
  const how = match.fatality ? ' by fatality' : '';
  return `${languages[match.winner].name} wins ${score(match.winner)} against ${languages[loser].name}${how}`;
}

function resultStep(match, languages, base) {
  const winner = match.winner ? languages[match.winner] : null;
  const text = winner ? `${upper(winner)} WINS` : 'DRAW';
  const sub = winner ? `${match.score[match.winner]}–${match.score[opponentOf(match.winner)]}` : `${match.score.a}–${match.score.b}`;
  const summary = resultSummary(match, languages);
  const last = match.rounds[match.rounds.length - 1];
  const down = last && last.ko && last.winner === match.winner ? opponentOf(match.winner) : null;
  const quote = winner ? winner.fighter.quote : '';
  return makeStep('result', base, { text, sub, side: match.winner, down, fatality: match.fatality, quote, summary, log: `${summary}.` });
}

/**
 * Ordered steps of a match. languages = { a, b }: catalog languages of sides a and b.
 * Every step carries { kind, text, sub, log, health: { a, b }, wins: { a, b }, round, duration }.
 */
export function fightScript(match, languages) {
  let base = { round: null, health: { a: MAX_HEALTH, b: MAX_HEALTH }, wins: { a: 0, b: 0 } };
  const intro = `${languages.a.name} (${languages.a.fighter.nickname}) vs ${languages.b.name} (${languages.b.fighter.nickname}).`;
  const steps = [makeStep('intro', base, { text: `${upper(languages.a)} VS ${upper(languages.b)}`, log: intro })];

  match.rounds.forEach((round, index) => {
    const fatal = match.fatality && index === match.rounds.length - 1;
    const roundStepsList = roundSteps(round, { languages, fatal, base: { ...base, round: index } });
    const last = roundStepsList[roundStepsList.length - 1];
    base = { round: index, health: last.health, wins: last.wins };
    steps.push(...roundStepsList);
  });

  steps.push(resultStep(match, languages, base));
  return steps;
}
