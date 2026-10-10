/* Step player: plays a list of steps, each after the previous one's duration ÷ speed. Pure: the
   timers ({ setTimeout, clearTimeout }) and the callbacks are injected. */

function clear(p) {
  if (p.timer !== null) {
    p.options.timers.clearTimeout(p.timer);
    p.timer = null;
  }
}

function finish(p) {
  clear(p);

  if (!p.done) {
    p.done = true;
    p.options.onComplete();
  }
}

function advance(p) {
  p.timer = null;

  if (!p.options.isActive()) {
    return;
  }

  p.index += 1;
  const step = p.steps[p.index];
  p.options.onStep(step, p.index);

  if (p.index >= p.steps.length - 1) {
    finish(p);
    return;
  }

  p.timer = p.options.timers.setTimeout(() => advance(p), step.duration / p.speed);
}

/**
 * options: { timers, onStep(step, index), onComplete(), isActive() }. isActive() returning false
 * (e.g. the route changed) stops the playback silently. onComplete runs once per play, also on skip.
 */
export function createPlayer(steps, options) {
  const p = { steps, options, index: -1, speed: 1, timer: null, done: false };

  return {
    /** Starts (or restarts) from the first step. */
    play() {
      clear(p);
      p.index = -1;
      p.done = false;
      advance(p);
    },
    /** Jumps to the end: stops the timers and completes; the caller renders the final state. */
    skip() {
      p.index = steps.length - 1;
      finish(p);
    },
    setSpeed(speed) {
      p.speed = speed > 0 ? speed : 1;
    },
    stop: () => clear(p),
    get index() {
      return p.index;
    },
    get done() {
      return p.done;
    },
  };
}
