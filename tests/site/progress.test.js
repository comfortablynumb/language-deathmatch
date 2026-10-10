import test from 'node:test';
import assert from 'node:assert/strict';
import * as progress from '../../site/assets/js/lib/progress.js';

/** rust's tower: beats python, loses to go, beats cpp (the boss). */
function climb(outcomes = ['a', 'b', 'a']) {
  const ids = ['python', 'go', 'cpp'];
  return {
    arena: 'algorithms',
    fighter: 'rust',
    opponents: ids.map((id, i) => ({ language: id, rank: 3 - i, match: { a: 'rust', b: id, winner: outcomes[i] } })),
  };
}

function memoryStorage() {
  const items = new Map();
  return { items, get: (k) => (items.has(k) ? items.get(k) : null), set: (k, v) => items.set(k, v), remove: (k) => items.delete(k) };
}

const states = (state) => state.steps.map((s) => s.state);

test('a fresh tower is ready with the first opponent next', () => {
  const state = progress.towerState(climb(), progress.emptyProgress());

  assert.equal(state.status, 'ready');
  assert.deepEqual(states(state), ['next', 'locked', 'locked']);
  assert.equal(state.next.language, 'python');
  assert.deepEqual([state.defeated, state.total], [0, 3]);
});

test('watching fights climbs the tower; only the next opponent is recorded', () => {
  const tower = climb();
  let p = progress.recordFight(tower, progress.emptyProgress(), 'python');

  assert.deepEqual(p.watched, ['python']);
  assert.equal(progress.towerState(tower, p).status, 'climbing');
  assert.deepEqual(progress.recordFight(tower, p, 'cpp'), p, 'cpp is not next');

  p = progress.recordFight(tower, p, 'go');
  const state = progress.towerState(tower, p);

  assert.equal(state.status, 'game-over');
  assert.deepEqual(states(state), ['won', 'lost', 'locked']);
  assert.equal(state.next, null);
  assert.deepEqual(progress.recordFight(tower, p, 'cpp'), p, 'locked during game over');
});

test('a continue after a loss unlocks the next opponent; the climb ends finished', () => {
  const tower = climb();
  let p = { watched: ['python', 'go'], continues: 0 };

  assert.deepEqual(progress.spendContinue(tower, progress.emptyProgress()), progress.emptyProgress(), 'nothing to continue');
  p = progress.spendContinue(tower, p);
  assert.equal(p.continues, 1);
  assert.equal(progress.towerState(tower, p).status, 'climbing');
  assert.equal(progress.towerState(tower, p).next.language, 'cpp');

  p = progress.recordFight(tower, p, 'cpp');
  const state = progress.towerState(tower, p);
  assert.equal(state.status, 'finished');
  assert.equal(state.defeated, 2);
});

test('winning every fight makes a champion; losing the last fight finishes the climb', () => {
  const allWins = climb(['a', 'a', 'a']);
  const lastLost = climb(['a', 'a', 'b']);

  assert.equal(progress.towerState(allWins, { watched: ['python', 'go', 'cpp'], continues: 0 }).status, 'champion');
  assert.equal(progress.towerState(lastLost, { watched: ['python', 'go', 'cpp'], continues: 0 }).status, 'finished');
});

test('a draw is not a win', () => {
  const state = progress.towerState(climb(['a', null, 'a']), { watched: ['python', 'go'], continues: 0 });

  assert.deepEqual(states(state), ['won', 'draw', 'locked']);
  assert.equal(state.status, 'game-over');
});

test('stored progress is sanitized against the tower order', () => {
  const tower = climb();

  assert.equal(progress.towerState(tower, { watched: ['go'], continues: 5 }).status, 'ready');
  assert.deepEqual(progress.towerState(tower, { watched: ['python', 'zig', 'go'], continues: 5 }).progress, { watched: ['python'], continues: 0 });
  assert.deepEqual(progress.towerState(tower, 'garbage').progress, progress.emptyProgress());
});

test('revealAll marks every fight watched', () => {
  const tower = climb();
  const p = progress.revealAll(tower);

  assert.deepEqual(p, { watched: ['python', 'go', 'cpp'], continues: 1 });
  assert.equal(progress.towerState(tower, p).status, 'finished');
});

test('progress round-trips through storage and tolerates failures', () => {
  const tower = climb();
  const storage = memoryStorage();
  const p = { watched: ['python'], continues: 0 };

  assert.equal(progress.saveProgress(storage, tower, p), true);
  assert.ok(storage.items.has(progress.storageKey('algorithms', 'rust')));
  assert.deepEqual(progress.loadProgress(storage, 'algorithms', 'rust'), p);

  progress.clearProgress(storage, tower);
  assert.deepEqual(progress.loadProgress(storage, 'algorithms', 'rust'), progress.emptyProgress());

  storage.items.set(progress.storageKey('algorithms', 'rust'), '{not json');
  assert.deepEqual(progress.loadProgress(storage, 'algorithms', 'rust'), progress.emptyProgress());

  const broken = { get() { throw new Error('denied'); }, set() { throw new Error('denied'); }, remove() { throw new Error('denied'); } };
  assert.deepEqual(progress.loadProgress(broken, 'algorithms', 'rust'), progress.emptyProgress());
  assert.equal(progress.saveProgress(broken, tower, p), false);
  assert.doesNotThrow(() => progress.clearProgress(broken, tower));
});
