import test from 'node:test';
import assert from 'node:assert/strict';
import * as tournament from '../../site/assets/js/lib/tournament.js';
import { arena } from './deathmatch-fixtures.js';

/** rust beats go beats python; rust beats python; zig shares no case with anyone. */
function ladder() {
  const data = arena([
    { rust: [1, 1], go: [2, 2], python: [40, 40] },
    { rust: [1, 1], go: [2, 2], python: [40, 40] },
  ]);
  data.cases.push({ key: 'q/c', project: 'q', projectName: 'Q', caseId: 'c', caseName: 'C', values: { zig: { wall: 1, memory: 1 } } });
  data.fighters = ['go', 'rust', 'python', 'zig'];
  return data;
}

test('roundRobin plays every pair that can fight once', () => {
  const matches = tournament.roundRobin(ladder());

  assert.deepEqual(matches.map((m) => `${m.a}-${m.b}`), ['go-rust', 'go-python', 'rust-python']);
});

test('standings rank by wins and count rounds, fatalities and flawless rounds', () => {
  const rows = tournament.standings(ladder());
  const rust = rows[0];

  assert.deepEqual(rows.map((r) => [r.language, r.rank]), [['rust', 1], ['go', 2], ['python', 3]]);
  assert.deepEqual([rust.matches, rust.wins, rust.losses, rust.draws], [2, 2, 0, 0]);
  assert.deepEqual([rust.roundsWon, rust.roundsLost], [4, 0]);
  assert.equal(rust.flawless, 4);
  assert.equal(rust.fatalities, 1, 'python is 40× slower: fatality; go is only 2× slower');
  assert.equal(rows.find((r) => r.language === 'zig'), undefined, 'no opponent, not ranked');
});

test('standings break ties by losses, round difference, fatalities, then catalog order', () => {
  const even = arena([{ go: [1, 1], rust: [1, 1] }]);
  const rows = tournament.standings(even);

  assert.deepEqual(rows.map((r) => [r.language, r.draws]), [['go', 1], ['rust', 1]]);
});

test('tower: opponents weakest first, the strongest last; the fighter is side a', () => {
  const data = ladder();
  const python = tournament.tower(data, 'python');
  const rust = tournament.tower(data, 'rust');

  assert.deepEqual(python.opponents.map((o) => o.language), ['go', 'rust']);
  assert.deepEqual(rust.opponents.map((o) => o.language), ['python', 'go']);
  assert.equal(rust.opponents[0].match.a, 'rust');
  assert.equal(tournament.outcomeFor(rust.opponents[1].match, 'rust'), 'won');
  assert.equal(tournament.outcomeFor(python.opponents[1].match, 'python'), 'lost');
  assert.deepEqual(tournament.tower(data, 'zig').opponents, []);
});

test('outcomeFor a draw', () => {
  assert.equal(tournament.outcomeFor({ a: 'go', b: 'rust', winner: null }, 'go'), 'draw');
});
