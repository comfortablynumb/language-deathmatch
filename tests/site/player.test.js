import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../../site/assets/js/lib/player.js';

/** Manual timers: run() fires the pending callback. */
function fakeTimers() {
  const timers = { pending: null, delays: [], cleared: 0 };
  timers.setTimeout = (fn, delay) => {
    timers.pending = fn;
    timers.delays.push(delay);
    return timers.delays.length;
  };
  timers.clearTimeout = () => {
    timers.pending = null;
    timers.cleared += 1;
  };
  timers.run = () => {
    const fn = timers.pending;
    timers.pending = null;
    fn();
  };
  return timers;
}

function setup(active = () => true) {
  const steps = [{ id: 0, duration: 100 }, { id: 1, duration: 200 }, { id: 2, duration: 300 }];
  const timers = fakeTimers();
  const seen = [];
  const log = { completed: 0 };
  const player = createPlayer(steps, {
    timers, isActive: active, onStep: (step, i) => seen.push([step.id, i]), onComplete: () => { log.completed += 1; },
  });
  return { player, timers, seen, log };
}

test('plays every step after the previous one\'s duration and completes once', () => {
  const { player, timers, seen, log } = setup();

  player.play();
  assert.deepEqual(seen, [[0, 0]]);
  timers.run();
  timers.run();

  assert.deepEqual(seen, [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(timers.delays, [100, 200]);
  assert.equal(log.completed, 1);
  assert.equal(player.done, true);
  assert.equal(timers.pending, null);
});

test('speed divides the durations', () => {
  const { player, timers } = setup();

  player.setSpeed(2);
  player.play();
  timers.run();

  assert.deepEqual(timers.delays, [50, 100]);
});

test('skip stops the timers and completes once; replay starts over', () => {
  const { player, timers, seen, log } = setup();

  player.play();
  player.skip();
  player.skip();

  assert.equal(timers.pending, null);
  assert.equal(player.index, 2);
  assert.equal(log.completed, 1);

  player.play();
  assert.deepEqual(seen, [[0, 0], [0, 0]]);
  assert.equal(player.done, false);
});

test('an inactive player stops silently', () => {
  let active = true;
  const { player, timers, seen, log } = setup(() => active);

  player.play();
  active = false;
  timers.run();

  assert.deepEqual(seen, [[0, 0]]);
  assert.equal(log.completed, 0);
  assert.equal(timers.pending, null);
});
