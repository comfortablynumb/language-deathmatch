# M3 — Fight engine

**Status:** ✅ Done · **Depends on:** M2 · **Unblocks:** M5

## Goal

Pure, deterministic, unit-tested JavaScript that turns `catalog.json` + `results.json` into
arenas, matches, standings, towers and an animation script. No DOM, no timers, no storage access:
storage is injected, so `node --test` covers every rule.

## Modules (`site/assets/js/lib/`)

| Module | Responsibility |
|--------|----------------|
| `arena.js` | Arena list (open/locked), arena data: comparable cases and code (lines of code) entries per fighter |
| `fight.js` | Blows, damage, moves, rounds, matches (rules below) |
| `tournament.js` | Round-robin standings, head-to-head lookup, tower order |
| `progress.js` | Tower progress (watched fights, continues) over an injected `{ get, set, remove }` storage |
| `fight-script.js` | Match → ordered steps (announcer, blows, health after each blow, durations) + commentary text |

## Arena data

An arena is a category. For each project of the category (catalog order: level, then name) and
each benchmark case (project order), a **case entry** records every fighter's median wall time,
CPU time and peak memory — only from implementation results with `status: ok` and case results
with `status: ok`. A **code entry** per project records lines of code (`catalog.json` `loc`) for
fighters whose result for that project is `ok`.

- **Fighters of an arena:** languages (catalog order) with at least one case entry.
- **Open arena:** at least two fighters. Otherwise **locked** ("no fighters have trained here yet").
- A pair can fight when they share at least one case entry.

## Rules of combat

### Rounds

| # | Round | Blows | Value compared (lower wins) |
|---|-------|-------|-----------------------------|
| 1 | **Speed** | one per case both fighters completed | median wall time |
| 2 | **Memory** | one per case both fighters completed | median peak memory |
| 3 | **Brevity** | one per project both completed | lines of code |

Rounds are played in order until a fighter has **2 round wins** (so round 3 only happens at 1–1,
or after a drawn round).

### Blows and damage

For one comparison with values `x` (fighter A) and `y` (fighter B), both > 0:

- `factor = max(x, y) / min(x, y)`; the lower value is the **attacker**.
- `factor < 1.05` → **blocked** (difference within noise): no damage.
- Otherwise `damage = clamp(round(50 × log2(factor) / n), 1, 100)` where `n` is the number of
  comparisons in the round. Each round therefore distributes the same "power" however many cases
  the arena has: a fighter 2× worse on every comparison loses 50 health, 4× worse is knocked out.
- A comparison with a missing or non-positive value on either side is not a blow.

### Moves (flavor, derived from the factor)

| Factor | Move | Note |
|--------|------|------|
| < 1.05 | Block | no damage |
| < 1.5 | Jab | |
| < 2.5 | Kick | |
| < 5 | Uppercut | |
| < 10 | the attacker's `special` | |
| ≥ 10 | the attacker's `special` | **critical** (an order of magnitude) |
| finishing blow of a fatality | the attacker's `fatality` | |

### Round result

- Each fighter starts every round at **100 health**; `health = max(0, 100 − damage taken)`.
- The fighter who **took less damage** wins the round. Equal damage → **draw** (no round win).
- **K.O.** — the round loser's health is 0. Otherwise the round ends on **time** (blows ran out).
- **Flawless victory** — the round winner took no damage.
- Because damage is proportional to `log(factor)`, the round winner is (up to the per-blow cap,
  rounding, the 1-point minimum and blocks) the fighter whose **geometric mean of ratios** is
  better — the same statistic as the leaderboard.

### Match result

- First to 2 round wins. If all played rounds leave the wins tied (draws), the fighter with more
  health left in total wins; if that is tied too, the match is a **draw**.
- **Fatality** — the match winner knocked the loser out in the last round played and the
  finishing blow was critical (≥ 10×).
- **Finishing blow** — in a won round, the blow that dealt the most damage to the loser
  (the later one on ties). It is played last in that round.

### Symmetry

`match(arena, a, b)` is the mirror of `match(arena, b, a)`: same rounds, same blows, swapped
sides. Tests assert it.

### Design change after the first real run

The plan first had a **Footprint** round (image size + lines of code). Run against the full
results, it made all four open arenas rank the six fighters in the same order: image size (and
part of the memory baseline) is a per-language constant, so it decided fights the same way whatever
the arena. Image size was dropped; round 3 became **Brevity** (lines of code, which do depend on the
problem). With it the arenas differ — e.g. Rust tops Simulation and C++ climbs to second in Data
Structures — which is the point of choosing an arena.

## Standings and towers

- **Standings** (round-robin, every pair that can fight): wins, losses, draws, rounds won/lost,
  fatalities performed, flawless rounds. Sort: wins ↓, losses ↑, round difference ↓,
  fatalities ↓, catalog order.
- **Tower** of fighter F in arena X: every opponent F can fight, ordered **weakest first**
  (reverse standings), so the arena's strongest other fighter is the final **boss**.

## Tower progress (`progress.js`)

Climbing is per viewer and lives in browser storage (a convenience; losing it only resets the
climb). Storage is injected (`{ get(key), set(key, value), remove(key) }`); the site wraps
`localStorage` in try/catch, tests use an in-memory fake.

```js
// key: "ldm:tower:<arena>:<fighter>"
{ watched: ["python", "javascript"], continues: 0 }
```

| State of a tower step | When |
|-----------------------|------|
| `won` / `lost` / `draw` | the fight was watched |
| `next` | first unwatched opponent, and the climb is not in game over |
| `locked` | everything after `next` (and `next` itself during game over) |

| Tower status | When |
|--------------|------|
| `ready` | nothing watched |
| `climbing` | some watched, last result a win (or a used continue) |
| `game-over` | the last watched fight was not a win and no continue was spent on it |
| `champion` | every fight watched and every one won without continues |
| `finished` | every fight watched otherwise |

Operations: `watch` (only the `next` opponent is recorded), `continue` (spends a continue after a
loss), `revealAll`, `reset`. Stored data is sanitized against the current tower: unknown or
out-of-order ids are dropped, so new benchmark results never break a stored climb.

## Fight script (`fight-script.js`)

A match becomes a list of steps the UI plays one by one (the UI never computes game logic):

| Step | Text | When |
|------|------|------|
| `intro` | `RUST VS GO` | first |
| `round` | `ROUND 1` + theme (`SPEED`) | each round |
| `fight` | `FIGHT!` | after each round announcement |
| `blow` | commentary line; `health` after the blow | each blow |
| `finish` | `FINISH THEM!` | before the finishing blow of a fatality |
| `round-end` | `K.O.` / `TIME` / `DRAW`, `RUST WINS ROUND 1`, `FLAWLESS VICTORY` | each round |
| `fatality` | `FATALITY` | after the finishing blow of a fatality |
| `result` | `RUST WINS` / `DRAW`, score `2–1`, quote | last |

- Every step carries the health of both fighters after it, so skipping to any step renders a
  consistent state. Displayed health never shows 0 for the round winner, and a knocked-out loser
  stays at ≥ 1 until the finishing blow lands.
- Every step carries a base `duration` in ms (blows 900, critical blows 1100, announcements
  800–2200); the player divides by the speed setting.
- **Commentary** example: `Rust — Uppercut · Fibonacci › Startup: 226 µs vs 919 µs (4.06× faster) · −61`.
  Values use the existing formatters (`duration`, `memory`, `bytes`, lines).

## Tests (`tests/site/`)

- `arena.test.js` — open/locked arenas, failed implementations excluded, missing cases skipped,
  code entries need `ok` results.
- `fight.test.js` — block threshold, damage formula and cap, moves by factor, round winner/draw/K.O./
  flawless, round 3 only at 1–1, match draw tie-break, fatality conditions, symmetry.
- `tournament.test.js` — standings order and counters, tower order (weakest first, boss last),
  fighters that cannot fight are left out.
- `progress.test.js` — every status, `watch` only records the next opponent, continue after a loss,
  sanitizing stale data, storage failures tolerated (throwing fake).
- `fight-script.test.js` — step sequence, health never increases within a round, finishing blow
  last, `finish`/`fatality` only for fatalities, commentary text.

## Acceptance criteria

- `npm test` green; every module ≤ 50-line functions; no DOM or global access in `lib/`.
- The same inputs always produce identical outputs (deep-equal in tests).
