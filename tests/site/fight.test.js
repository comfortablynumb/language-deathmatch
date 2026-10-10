import test from 'node:test';
import assert from 'node:assert/strict';
import * as fight from '../../site/assets/js/lib/fight.js';
import { arena } from './deathmatch-fixtures.js';

const SPEED = fight.ROUNDS[0];
const MEMORY = fight.ROUNDS[1];
const BREVITY = fight.ROUNDS[2];
const PAIR = { a: 'go', b: 'rust' };

test('moveTier maps factors to moves', () => {
  const tiers = [[1, 'block'], [1.049, 'block'], [1.05, 'jab'], [1.49, 'jab'], [1.5, 'kick'], [2.49, 'kick'],
    [2.5, 'uppercut'], [4.99, 'uppercut'], [5, 'special'], [9.99, 'special'], [10, 'critical'], [500, 'critical']];

  for (const [factor, move] of tiers) {
    assert.equal(fight.moveTier(factor), move, `factor ${factor}`);
  }
});

test('damageFor: 50 per doubling split over the round, blocked below 1.05×, 1..100', () => {
  assert.equal(fight.damageFor(1.04, 1), 0);
  assert.equal(fight.damageFor(2, 1), 50);
  assert.equal(fight.damageFor(2, 2), 25);
  assert.equal(fight.damageFor(4, 4), 25);
  assert.equal(fight.damageFor(1.05, 10), 1, 'minimum one point once not blocked');
  assert.equal(fight.damageFor(1e6, 1), 100, 'capped');
});

test('comparisons skip entries where a fighter has no positive value', () => {
  const data = arena([{ go: [1, 10], rust: [2, 20] }, { go: [3, 30] }, { go: [0, 5], rust: [1, 5] }]);
  const list = fight.comparisons(data, SPEED, PAIR);

  assert.deepEqual(list.map((c) => [c.a, c.b]), [[1, 2]]);
  assert.equal(fight.comparisons(data, MEMORY, PAIR).length, 2);
});

test('resolveBlow: lower value attacks; blocked blows have no attacker', () => {
  const blow = fight.resolveBlow({ a: 4, b: 1 }, 1);

  assert.equal(blow.attacker, 'b');
  assert.equal(blow.factor, 4);
  assert.equal(blow.damage, 100);
  assert.equal(blow.move, 'uppercut');
  assert.deepEqual(fight.resolveBlow({ a: 100, b: 103 }, 1).attacker, null);
});

test('playRound: less damage taken wins, health and finisher order', () => {
  const data = arena([{ go: [4, 1], rust: [1, 1] }, { go: [1, 1], rust: [2, 1] }]);
  const round = fight.playRound(data, SPEED, PAIR);

  // case 0: rust 4× faster → 50 on go; case 1: go 2× faster → 25 on rust.
  assert.deepEqual(round.taken, { a: 50, b: 25 });
  assert.deepEqual(round.health, { a: 50, b: 75 });
  assert.equal(round.winner, 'b');
  assert.equal(round.ko, false);
  assert.equal(round.flawless, false);
  assert.equal(round.blows[round.blows.length - 1].attacker, 'b', 'finishing blow last');
  assert.equal(round.blows[0].entry.caseId, 'c1');
});

test('playRound: K.O. and flawless victory', () => {
  const data = arena([{ go: [1, 1], rust: [16, 1] }]);
  const round = fight.playRound(data, SPEED, PAIR);

  assert.equal(round.winner, 'a');
  assert.equal(round.ko, true);
  assert.equal(round.flawless, true);
  assert.deepEqual(round.health, { a: 100, b: 0 });
});

test('playRound: equal damage or no comparisons is a draw', () => {
  const even = arena([{ go: [1, 1], rust: [2, 1] }, { go: [2, 1], rust: [1, 1] }]);

  assert.equal(fight.playRound(even, SPEED, PAIR).winner, null);
  assert.equal(fight.playRound(even, MEMORY, PAIR).winner, null, 'all blocked');
  assert.deepEqual(fight.playRound(even, BREVITY, PAIR).blows, []);
});

test('the finishing blow is the biggest one on the loser, later one on ties', () => {
  const data = arena([{ go: [1, 1], rust: [8, 1] }, { go: [1, 1], rust: [2, 1] }, { go: [1, 1], rust: [8, 1] }, { go: [3, 1], rust: [1, 1] }]);
  const round = fight.playRound(data, SPEED, PAIR);
  const order = round.blows.map((b) => b.entry.caseId);

  assert.deepEqual(order, ['c0', 'c1', 'c3', 'c2']);
});

test('playMatch: 2–0 ends after two rounds', () => {
  const data = arena([{ go: [1, 1], rust: [2, 2] }], [{ go: 90, rust: 10 }]);
  const match = fight.playMatch(data, 'go', 'rust');

  assert.equal(match.rounds.length, 2);
  assert.deepEqual(match.score, { a: 2, b: 0 });
  assert.equal(match.winner, 'a');
  assert.equal(fight.winnerId(match), 'go');
});

test('playMatch: round 3 (brevity) decides a 1–1', () => {
  const data = arena([{ go: [1, 2], rust: [2, 1] }], [{ go: 40, rust: 120 }]);
  const match = fight.playMatch(data, 'go', 'rust');

  assert.deepEqual(match.rounds.map((r) => r.id), ['speed', 'memory', 'brevity']);
  assert.deepEqual(match.score, { a: 2, b: 1 });
  assert.equal(match.winner, 'a');
});

test('playMatch: tied round wins go to the fighter with more health left, else a draw', () => {
  const tiebreak = arena([{ go: [1, 4], rust: [2, 1] }], [{ go: 50, rust: 50 }]);
  const byHealth = fight.playMatch(tiebreak, 'go', 'rust');

  // speed: go wins (rust 50 left); memory: rust wins (go 0 left); brevity: draw.
  assert.deepEqual(byHealth.score, { a: 1, b: 1 });
  assert.equal(byHealth.winner, 'b');

  const even = arena([{ go: [1, 1], rust: [1, 1] }]);
  const draw = fight.playMatch(even, 'go', 'rust');
  assert.equal(draw.winner, null);
  assert.equal(fight.winnerId(draw), null);
  assert.equal(draw.fatality, false);
});

test('fatality needs a K.O. in the last round with a critical finishing blow', () => {
  const brutal = arena([{ go: [1, 1], rust: [20, 20] }]);
  const strong = arena([{ go: [1, 1], rust: [6, 6] }]);

  assert.equal(fight.playMatch(brutal, 'go', 'rust').fatality, true);
  assert.equal(fight.playMatch(strong, 'go', 'rust').rounds[1].ko, true);
  assert.equal(fight.playMatch(strong, 'go', 'rust').fatality, false, '6× is not critical');
});

test('playMatch is symmetric', () => {
  const data = arena([{ go: [1, 3], rust: [2, 1] }, { go: [5, 1], rust: [1, 1.2] }], [{ go: 40, rust: 20 }]);
  const ab = fight.playMatch(data, 'go', 'rust');
  const ba = fight.playMatch(data, 'rust', 'go');
  const flip = (side) => (side ? fight.opponentOf(side) : side);

  assert.equal(ba.winner, flip(ab.winner));
  assert.deepEqual(ba.score, { a: ab.score.b, b: ab.score.a });
  assert.equal(ba.fatality, ab.fatality);
  assert.deepEqual(ba.rounds.map((r) => r.blows.map((b) => [b.entry.key, b.metric, flip(b.attacker), b.damage])),
    ab.rounds.map((r) => r.blows.map((b) => [b.entry.key, b.metric, b.attacker, b.damage])));
});

test('playMatch is deterministic', () => {
  const data = arena([{ go: [1, 3], rust: [2, 1] }], [{ go: 40, rust: 20 }]);

  assert.deepEqual(fight.playMatch(data, 'go', 'rust'), fight.playMatch(data, 'go', 'rust'));
});
