import test from 'node:test';
import assert from 'node:assert/strict';
import * as fight from '../../site/assets/js/lib/fight.js';
import * as script from '../../site/assets/js/lib/fight-script.js';
import { arena, language } from './deathmatch-fixtures.js';

const LANGUAGES = { a: language('go', 'Go'), b: language('rust', 'Rust') };
const kinds = (steps) => steps.map((s) => s.kind);

function stepsFor(data) {
  return script.fightScript(fight.playMatch(data, 'go', 'rust'), LANGUAGES);
}

test('a 2–1 match: intro, three rounds of announcements and blows, result', () => {
  const steps = stepsFor(arena([{ go: [1, 2], rust: [2, 1] }], [{ go: 40, rust: 120 }]));

  assert.deepEqual(kinds(steps), [
    'intro',
    'round', 'fight', 'blow', 'round-end',
    'round', 'fight', 'blow', 'round-end',
    'round', 'fight', 'blow', 'round-end',
    'result',
  ]);
  assert.equal(steps[0].text, 'GO VS RUST');
  assert.equal(steps[1].text, 'ROUND 1');
  assert.equal(steps[1].sub, 'SPEED');
  assert.equal(steps[2].text, 'FIGHT!');
  assert.deepEqual(steps[steps.length - 1].wins, { a: 2, b: 1 });
  assert.equal(steps[steps.length - 1].text, 'GO WINS');
  assert.equal(steps[steps.length - 1].sub, '2–1');
  assert.equal(steps[steps.length - 1].quote, LANGUAGES.a.fighter.quote);
});

test('health resets every round and never rises within it', () => {
  const steps = stepsFor(arena([{ go: [1, 3], rust: [2, 1] }, { go: [5, 1], rust: [1, 1.2] }], [{ go: 40, rust: 20 }]));
  let previous = null;

  for (const step of steps) {
    if (step.kind === 'round') {
      assert.deepEqual(step.health, { a: 100, b: 100 });
      previous = step.health;
    } else if (previous) {
      assert.ok(step.health.a <= previous.a && step.health.b <= previous.b, `${step.kind} raised health`);
      previous = step.health;
    }
  }
});

test('a knocked-out loser stays standing until the last blow; the winner never shows 0', () => {
  // Two 100-damage blows on rust (the second one is the finisher, played last), one 9× blow on go.
  const steps = stepsFor(arena([{ go: [1, 1], rust: [1e6, 1] }, { go: [1, 1], rust: [1e6, 1] }, { go: [9, 1], rust: [1, 1] }]));
  const blows = steps.filter((s) => s.kind === 'blow' && s.round === 0);

  assert.deepEqual(blows.map((b) => b.health.b), [1, 1, 0]);
  assert.ok(blows.every((b) => b.health.a >= 1));
  assert.equal(steps.find((s) => s.kind === 'round-end').text, 'K.O.');
  assert.equal(steps.find((s) => s.kind === 'round-end').down, 'b');
  assert.equal(steps[steps.length - 1].down, null, 'the last round played was a draw');
  assert.deepEqual(blows.map((b) => [b.blowIndex, b.blowCount]), [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual(blows.map((b) => [b.project, b.caseId]), [['p', 'c0'], ['p', 'c2'], ['p', 'c1']]);
});

test('a fatality: FINISH THEM! before the finishing blow, FATALITY instead of the last round end', () => {
  const steps = stepsFor(arena([{ go: [1, 1], rust: [20, 30] }, { go: [1, 1], rust: [20, 30] }]));

  assert.deepEqual(kinds(steps).slice(-7), ['round', 'fight', 'blow', 'finish', 'blow', 'fatality', 'result']);
  const finisher = steps[steps.length - 3];
  assert.equal(finisher.move, LANGUAGES.a.fighter.fatality);
  assert.ok(finisher.log.includes(LANGUAGES.a.fighter.fatality));
  assert.equal(finisher.health.b, 0);
  assert.equal(steps[steps.length - 4].health.b, 1, 'still standing at FINISH THEM!');
  assert.equal(steps[steps.length - 2].text, 'FATALITY');
  assert.equal(steps[steps.length - 1].summary, 'Go wins 2–0 against Rust by fatality');
  assert.equal(steps.filter((s) => s.kind === 'round-end').length, 1, 'only round 1 ends normally');
  assert.deepEqual(steps.slice(-3).map((s) => [s.down, s.fatality]), [[null, false], ['b', true], ['b', true]]);
});

test('no FINISH THEM! or FATALITY without a fatality', () => {
  const steps = stepsFor(arena([{ go: [1, 1], rust: [2, 2] }]));

  assert.ok(!kinds(steps).includes('finish'));
  assert.ok(!kinds(steps).includes('fatality'));
  assert.equal(steps.filter((s) => s.kind === 'round-end').length, 2);
});

test('round ends: TIME with the winner, flawless victory, draw', () => {
  const steps = stepsFor(arena([{ go: [1, 1], rust: [2, 1] }], [{ go: 30, rust: 30 }]));
  const ends = steps.filter((s) => s.kind === 'round-end');

  assert.equal(ends[0].text, 'TIME');
  assert.equal(ends[0].sub, 'GO WINS ROUND 1 · FLAWLESS VICTORY');
  assert.equal(ends[1].text, 'DRAW');
  assert.equal(ends[1].sub, 'NO WINNER IN ROUND 2');
});

test('commentary names the move, the case, both values and the factor', () => {
  const data = arena([{ go: [1e6, 1], rust: [4e6, 1] }]);
  const blow = fight.playRound(data, fight.ROUNDS[0], { a: 'go', b: 'rust' }).blows[0];

  assert.equal(script.commentary(blow, LANGUAGES), 'Go — Uppercut · Proj › Case 0: 1 ms vs 4 ms (4.00× faster) · −100');
  assert.equal(script.blowLabel(blow), 'Proj › Case 0');

  const brevity = fight.playRound(arena([], [{ go: 60, rust: 30 }, { go: 30, rust: 31 }]), fight.ROUNDS[2], { a: 'go', b: 'rust' }).blows;
  const byProject = Object.fromEntries(brevity.map((b) => [b.entry.project, b]));
  assert.equal(script.commentary(byProject.p0, LANGUAGES), 'Rust — Kick · Proj 0 › Lines of code: 30 lines vs 60 lines (2.00× shorter) · −25');
  assert.equal(script.commentary(byProject.p1, LANGUAGES), 'Blocked · Proj 1 › Lines of code: Go 30 lines vs Rust 31 lines (within 5%)');
});

test('critical blows use the special move and a longer duration', () => {
  const steps = stepsFor(arena([{ go: [1, 1], rust: [12, 1] }, { go: [1, 1], rust: [1.2, 1] }]));
  const critical = steps.find((s) => s.kind === 'blow' && s.critical);

  assert.equal(critical.move, LANGUAGES.a.fighter.special);
  assert.equal(critical.duration, script.DURATIONS.critical);
  assert.ok(critical.log.endsWith('(12× faster) · critical · −90'), critical.log);
});

test('a drawn match', () => {
  const steps = stepsFor(arena([{ go: [1, 1], rust: [1, 1] }]));
  const result = steps[steps.length - 1];

  assert.equal(result.text, 'DRAW');
  assert.equal(result.summary, 'Go and Rust draw 0–0');
});
