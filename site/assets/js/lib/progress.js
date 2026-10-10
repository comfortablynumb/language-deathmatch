/* Tower progress per viewer: which fights of a climb were watched and how many continues were
   spent. Pure; storage is injected as { get(key), set(key, value), remove(key) } and may throw. */
import { outcomeFor } from './tournament.js';

const KEY_PREFIX = 'ldm:tower:';

export function storageKey(arenaId, fighter) {
  return `${KEY_PREFIX}${arenaId}:${fighter}`;
}

export function emptyProgress() {
  return { watched: [], continues: 0 };
}

/** Coerces stored JSON into a progress object. */
function normalize(value) {
  if (!value || typeof value !== 'object') {
    return emptyProgress();
  }

  const watched = Array.isArray(value.watched) ? value.watched.filter((id) => typeof id === 'string') : [];
  const continues = Number.isInteger(value.continues) && value.continues > 0 ? value.continues : 0;
  return { watched, continues };
}

/** Reads a climb; missing, corrupt or unavailable storage gives an empty climb. */
export function loadProgress(storage, arenaId, fighter) {
  try {
    const raw = storage.get(storageKey(arenaId, fighter));
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyProgress();
  }
}

/** Saves a climb; returns false when storage is unavailable. */
export function saveProgress(storage, tower, progress) {
  try {
    storage.set(storageKey(tower.arena, tower.fighter), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(storage, tower) {
  try {
    storage.remove(storageKey(tower.arena, tower.fighter));
  } catch {
    // Nothing stored or storage unavailable: the climb is already empty.
  }
}

/** Results ('won' | 'lost' | 'draw') of the watched prefix of the tower that matches its order. */
function watchedResults(tower, progress) {
  const results = [];

  for (const id of progress.watched) {
    const step = tower.opponents[results.length];

    if (!step || step.language !== id) {
      break;
    }

    results.push(outcomeFor(step.match, tower.fighter));
  }

  return results;
}

function stepState(index, results, gameOver) {
  if (index < results.length) {
    return results[index];
  }

  return index === results.length && !gameOver ? 'next' : 'locked';
}

function towerStatus(results, total, gameOver) {
  const nonWins = results.filter((r) => r !== 'won').length;

  if (results.length === 0) {
    return 'ready';
  }

  if (results.length === total) {
    return nonWins === 0 ? 'champion' : 'finished';
  }

  return gameOver ? 'game-over' : 'climbing';
}

/**
 * State of a climb: { steps: [{ language, rank, match, state }], status, progress, defeated,
 * total, next }. States: won | lost | draw | next | locked. Status: ready | climbing |
 * game-over | champion | finished. Stored ids that do not follow the tower order are dropped.
 */
export function towerState(tower, rawProgress) {
  const stored = normalize(rawProgress);
  const results = watchedResults(tower, stored);
  const nonWins = results.filter((r) => r !== 'won').length;
  const continues = Math.min(stored.continues, nonWins);
  const lastLost = results.length > 0 && results[results.length - 1] !== 'won';
  const gameOver = lastLost && continues < nonWins && results.length < tower.opponents.length;
  const steps = tower.opponents.map((step, i) => ({ ...step, state: stepState(i, results, gameOver) }));
  const progress = { watched: tower.opponents.slice(0, results.length).map((s) => s.language), continues };

  return {
    steps,
    status: towerStatus(results, tower.opponents.length, gameOver),
    progress,
    defeated: results.filter((r) => r === 'won').length,
    total: tower.opponents.length,
    next: steps.find((s) => s.state === 'next') || null,
  };
}

/** Records a watched fight; only the climb's next opponent counts. Returns the new progress. */
export function recordFight(tower, progress, opponent) {
  const state = towerState(tower, progress);

  if (!state.next || state.next.language !== opponent) {
    return state.progress;
  }

  return { ...state.progress, watched: [...state.progress.watched, opponent] };
}

/** Spends a continue after a loss (game over); otherwise returns the progress unchanged. */
export function spendContinue(tower, progress) {
  const state = towerState(tower, progress);

  if (state.status !== 'game-over') {
    return state.progress;
  }

  return { ...state.progress, continues: state.progress.continues + 1 };
}

/** Marks every fight of the tower as watched (continues cover every loss). */
export function revealAll(tower) {
  const watched = tower.opponents.map((step) => step.language);
  const continues = tower.opponents.filter((step) => outcomeFor(step.match, tower.fighter) !== 'won').length;
  return { watched, continues };
}
